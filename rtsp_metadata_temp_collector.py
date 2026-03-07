#!/usr/bin/env python3
"""
Proof of Concept: RTSP metadata snapshot collector for Hanwha thermal cameras.

This collector briefly connects to the RTSP metadata stream, reads ONVIF
metadata for a few seconds, extracts BoxTemperatureReading values, then
disconnects. It avoids holding a continuous RTSP stream open between cycles.
"""

from __future__ import annotations

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import binascii
import argparse
import hashlib
import json
import os
import random
import re
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import requests
from requests.auth import HTTPDigestAuth


RTSP_PORT = 554
SOCKET_TIMEOUT_SECONDS = 5
DEFAULT_READ_TIMEOUT_SECONDS = 10
USER_AGENT = "thermal-monitor-rtsp-snapshot/1.0"
METADATA_XML_RE = re.compile(
    rb"((?:<\?xml[^>]*\?>\s*)?<(?:(?:\w+):)?MetadataStream\b[\s\S]*?</(?:(?:\w+):)?MetadataStream>)"
)
ROI_SUFFIX_RE = re.compile(r"([A-Z]+)$")
ROI_COORDINATE_CACHE: Dict[Tuple[str, int], Dict[int, Dict[str, Any]]] = {}

# AES-256-GCM decryption for camera passwords
ENCRYPTION_PREFIX = "enc:v1:"


def decrypt_password(stored: str, key_hex: str) -> str:
    """Decrypt AES-256-GCM encrypted password matching Node.js format.

    Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
    Returns plain text if not encrypted (backward compatibility).
    """
    if not stored or not stored.startswith(ENCRYPTION_PREFIX):
        return stored  # backward compat: plain text

    try:
        parts = stored[len(ENCRYPTION_PREFIX):].split(":")
        if len(parts) != 3:
            return stored  # invalid format, return as-is

        iv = binascii.unhexlify(parts[0])
        auth_tag = binascii.unhexlify(parts[1])
        ciphertext = binascii.unhexlify(parts[2])
        key = binascii.unhexlify(key_hex)

        aesgcm = AESGCM(key)
        # GCM expects ciphertext + tag concatenated
        plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
        return plaintext.decode("utf-8")
    except Exception:
        # On decryption failure, return as-is for backward compat
        return stored


@dataclass(frozen=True)
class CameraConfig:
    host: str
    username: str
    password: str
    port: int = 80
    name: Optional[str] = None

    @property
    def camera_name(self) -> str:
        return self.name or self.host


@dataclass
class DigestChallenge:
    realm: str
    nonce: str
    qop: Optional[str] = None
    opaque: Optional[str] = None
    algorithm: str = "MD5"
    nc: int = 0


@dataclass
class RTSPResponse:
    status_code: int
    reason: str
    headers: Dict[str, str]
    body: bytes = b""


@dataclass(frozen=True)
class RoiCoordinate:
    roi_index: int
    coordinates: List[Dict[str, int]]


def log(message: str) -> None:
    print(message, flush=True)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_cameras(path: str) -> List[CameraConfig]:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    rows: Iterable[Dict[str, Any]]
    if isinstance(payload, dict):
        rows = payload.get("cameras", [])
    elif isinstance(payload, list):
        rows = payload
    else:
        raise ValueError("Camera config must be a JSON list or {'cameras': [...]} object")

    cameras: List[CameraConfig] = []
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"Camera row #{idx} is not a JSON object")
        cameras.append(
            CameraConfig(
                host=str(row["host"]),
                port=int(row.get("port", 80)),
                username=str(row["username"]),
                password=str(row["password"]),
                name=str(row.get("camera_name") or row.get("name") or row["host"]),
            )
        )

    if not cameras:
        raise ValueError("No camera found in config file")

    return cameras


def load_cameras_from_db(
    database_url: str, encryption_key: str
) -> List[CameraConfig]:
    """Query active cameras with IP addresses from PostgreSQL.

    Only returns cameras that are:
    - Status = 'ACTIVE'
    - Have non-null ip_address
    - Have non-null username

    Passwords are decrypted using the provided encryption key.
    """
    try:
        import psycopg2
    except ImportError:
        raise ImportError(
            "psycopg2-binary is required for --from-db mode. Install with: pip install psycopg2-binary"
        )

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ip_address, port, username, password, name
                FROM cameras
                WHERE status = 'ACTIVE'
                  AND ip_address IS NOT NULL
                  AND username IS NOT NULL
            """)
            cameras = []
            for row in cur.fetchall():
                ip, port, user, pwd, name = row
                # Decrypt password if encrypted
                if pwd and encryption_key:
                    pwd = decrypt_password(pwd, encryption_key)
                cameras.append(
                    CameraConfig(
                        host=ip,
                        port=port or 80,
                        username=user,
                        password=pwd or "",
                        name=name,
                    )
                )
            return cameras
    finally:
        conn.close()


def md5_hex(value: str) -> str:
    return hashlib.md5(value.encode("utf-8")).hexdigest()


def parse_digest_challenge(header_value: str) -> DigestChallenge:
    if "Digest" not in header_value:
        raise ValueError("Unsupported WWW-Authenticate header")

    pairs = dict(
        (key.lower(), value.strip().strip('"'))
        for key, value in re.findall(r'(\w+)=(".*?"|[^,]+)', header_value)
    )
    qop_value = pairs.get("qop")
    qop = None
    if qop_value:
        options = [item.strip() for item in qop_value.split(",")]
        if "auth" in options:
            qop = "auth"
        elif options:
            qop = options[0]

    return DigestChallenge(
        realm=pairs["realm"],
        nonce=pairs["nonce"],
        qop=qop,
        opaque=pairs.get("opaque"),
        algorithm=pairs.get("algorithm", "MD5"),
    )


def compute_digest_authorization(
    challenge: DigestChallenge,
    username: str,
    password: str,
    method: str,
    uri: str,
) -> str:
    if challenge.algorithm.upper() != "MD5":
        raise ValueError(f"Unsupported digest algorithm: {challenge.algorithm}")

    challenge.nc += 1
    nc = f"{challenge.nc:08x}"
    cnonce = md5_hex(f"{time.time()}:{random.random()}")[:16]

    ha1 = md5_hex(f"{username}:{challenge.realm}:{password}")
    ha2 = md5_hex(f"{method}:{uri}")

    if challenge.qop:
        response = md5_hex(
            f"{ha1}:{challenge.nonce}:{nc}:{cnonce}:{challenge.qop}:{ha2}"
        )
    else:
        response = md5_hex(f"{ha1}:{challenge.nonce}:{ha2}")

    parts = [
        f'username="{username}"',
        f'realm="{challenge.realm}"',
        f'nonce="{challenge.nonce}"',
        f'uri="{uri}"',
        f'response="{response}"',
        'algorithm="MD5"',
    ]
    if challenge.opaque:
        parts.append(f'opaque="{challenge.opaque}"')
    if challenge.qop:
        parts.append(f"qop={challenge.qop}")
        parts.append(f"nc={nc}")
        parts.append(f'cnonce="{cnonce}"')

    return "Digest " + ", ".join(parts)


def local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    if ":" in tag:
        return tag.split(":", 1)[1]
    return tag


def convert_temperature(raw_value: float) -> Tuple[float, str]:
    if raw_value > 20000:
        return round(raw_value / 100 - 273.15, 1), "kelvin_x100"
    if raw_value > 200:
        return round(raw_value - 273.15, 1), "kelvin"
    return round(raw_value, 1), "direct"


def celsius_to_fahrenheit(value: float) -> float:
    return round(value * 9 / 5 + 32, 1)


def build_profile_candidates(preferred_profile: str) -> List[str]:
    ordered = [preferred_profile, "profile2", "profile1", "profile10"]
    result: List[str] = []
    seen = set()
    for profile in ordered:
        if profile in seen:
            continue
        seen.add(profile)
        result.append(profile)
    return result


def build_profile_url(host: str, profile: str) -> str:
    return f"rtsp://{host}:{RTSP_PORT}/0/onvif/{profile}/media.smp"


def build_http_base_url(camera: CameraConfig) -> str:
    return f"http://{camera.host}:{camera.port}"


def create_digest_session(camera: CameraConfig) -> requests.Session:
    session = requests.Session()
    session.auth = HTTPDigestAuth(camera.username, camera.password)
    session.trust_env = False
    session.headers.update({"Accept": "application/json"})
    return session


def fetch_roi_coordinates(camera: CameraConfig) -> Dict[int, Dict[str, Any]]:
    session = create_digest_session(camera)
    response = session.get(
        f"{build_http_base_url(camera)}/stw-cgi/eventsources.cgi",
        params={"msubmenu": "boxtemperaturedetection", "action": "view"},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    rows = payload.get("BoxTemperatureDetection", [])
    if not isinstance(rows, list):
        return {}

    roi_map: Dict[int, Dict[str, Any]] = {}
    for channel_entry in rows:
        if not isinstance(channel_entry, dict):
            continue
        rois = channel_entry.get("ROIs", [])
        if not isinstance(rois, list):
            continue

        for roi_entry in rois:
            if not isinstance(roi_entry, dict):
                continue
            roi_index = roi_entry.get("ROI")
            coordinates = roi_entry.get("Coordinates")
            if not isinstance(roi_index, int) or not isinstance(coordinates, list) or len(coordinates) < 2:
                continue

            normalized_points: List[Dict[str, int]] = []
            for point in coordinates[:2]:
                if not isinstance(point, dict):
                    continue
                try:
                    normalized_points.append(
                        {
                            "x": int(point["x"]),
                            "y": int(point["y"]),
                        }
                    )
                except (KeyError, TypeError, ValueError):
                    normalized_points = []
                    break

            if len(normalized_points) != 2:
                continue

            roi_map[roi_index] = {
                "roi_index": roi_index,
                "coordinates": normalized_points,
            }

    return roi_map


def get_cached_roi_coordinates(camera: CameraConfig) -> Dict[int, Dict[str, Any]]:
    cache_key = (camera.host, camera.port)
    cached = ROI_COORDINATE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    roi_map = fetch_roi_coordinates(camera)
    ROI_COORDINATE_CACHE[cache_key] = roi_map
    return roi_map


def infer_roi_index(roi_value: str) -> Optional[int]:
    raw = roi_value.strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)

    match = ROI_SUFFIX_RE.search(raw.upper())
    if not match:
        return None

    index = 0
    for char in match.group(1):
        index = index * 26 + (ord(char) - ord("A") + 1)
    return index if index > 0 else None


def resolve_row_coordinates(
    camera: CameraConfig,
    roi_value: str,
) -> Optional[Dict[str, Any]]:
    roi_index = infer_roi_index(roi_value)
    if roi_index is None:
        return None

    roi_map = get_cached_roi_coordinates(camera)
    return roi_map.get(roi_index)


def resolve_control_url(base_url: str, control: str) -> str:
    parsed = urlparse(base_url)
    if control.startswith("rtsp://"):
        return control
    if control == "*":
        return base_url
    if control.startswith("/"):
        return f"{parsed.scheme}://{parsed.netloc}{control}"
    if base_url.endswith("/"):
        return base_url + control
    return base_url + "/" + control


def parse_metadata_track_urls(sdp: str, content_base: str) -> List[str]:
    sections: List[List[str]] = []
    current: Optional[List[str]] = None

    for raw_line in sdp.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("m="):
            if current:
                sections.append(current)
            current = [line]
            continue
        if current is not None:
            current.append(line)

    if current:
        sections.append(current)

    track_urls: List[str] = []
    for section in sections:
        media_line = section[0]
        if not media_line.lower().startswith("m=application"):
            continue

        section_text = "\n".join(section).lower()
        if "onvif.metadata" not in section_text and "vnd.onvif.metadata" not in section_text:
            continue

        for line in section:
            if not line.lower().startswith("a=control:"):
                continue
            control = line.split(":", 1)[1].strip()
            track_urls.append(resolve_control_url(content_base, control))
            break

    return track_urls


def extract_xml_documents(buffer: bytearray) -> List[bytes]:
    documents: List[bytes] = []
    last_end = 0
    for match in METADATA_XML_RE.finditer(buffer):
        documents.append(match.group(1))
        last_end = match.end()

    if last_end:
        del buffer[:last_end]
    elif len(buffer) > 512_000:
        del buffer[:-128_000]

    return documents


def parse_metadata_xml(xml_data: bytes) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return rows

    for notification in root.iter():
        if local_name(notification.tag) != "NotificationMessage":
            continue

        topic = ""
        source_items: Dict[str, str] = {}
        data_items: Dict[str, str] = {}

        for child in notification:
            child_name = local_name(child.tag)
            if child_name == "Topic":
                topic = "".join(child.itertext()).strip()
            elif child_name == "Message":
                for message_node in child.iter():
                    node_name = local_name(message_node.tag)
                    if node_name == "Source":
                        for simple_item in message_node.iter():
                            if local_name(simple_item.tag) != "SimpleItem":
                                continue
                            name = simple_item.attrib.get("Name")
                            value = simple_item.attrib.get("Value")
                            if name and value is not None:
                                source_items[name] = value
                    elif node_name == "Data":
                        for item in message_node.iter():
                            item_name = local_name(item.tag)
                            if item_name == "SimpleItem":
                                name = item.attrib.get("Name")
                                value = item.attrib.get("Value")
                                if name and value is not None:
                                    data_items[name] = value
                            elif item_name == "ElementItem":
                                for child_item in item.iter():
                                    child_name = local_name(child_item.tag)
                                    if child_name != "BoxTemperatureReading":
                                        continue
                                    for attr_key in (
                                        "MaxTemperature",
                                        "MinTemperature",
                                        "AverageTemperature",
                                    ):
                                        attr_value = child_item.attrib.get(attr_key)
                                        if attr_value is not None:
                                            data_items[attr_key] = attr_value
                                    item_id = child_item.attrib.get("ItemID")
                                    if item_id:
                                        source_items["ItemID"] = item_id

        if "BoxTemperatureReading" not in topic and "Radiometry" not in topic:
            continue

        raw_values: Dict[str, float] = {}
        for key in ("MaxTemperature", "MinTemperature", "AverageTemperature"):
            raw = data_items.get(key)
            if raw is None:
                break
            try:
                raw_values[key] = float(raw)
            except ValueError:
                raw_values = {}
                break

        if len(raw_values) != 3:
            continue

        max_temperature, detected_scale = convert_temperature(raw_values["MaxTemperature"])
        min_temperature, _ = convert_temperature(raw_values["MinTemperature"])
        avg_temperature, _ = convert_temperature(raw_values["AverageTemperature"])
        roi = (
            source_items.get("ItemID")
            or source_items.get("Rule")
            or source_items.get("RuleName")
            or source_items.get("AreaName")
            or source_items.get("ROI")
            or "UNKNOWN"
        )

        rows.append(
            {
                "roi": roi,
                "max_temperature": max_temperature,
                "min_temperature": min_temperature,
                "avg_temperature": avg_temperature,
                "raw_max": raw_values["MaxTemperature"],
                "unit_detected": detected_scale,
                "topic": topic,
            }
        )

    return rows


class RTSPMetadataClient:
    def __init__(self, camera: CameraConfig) -> None:
        self.camera = camera
        self.sock: Optional[socket.socket] = None
        self.buffer = bytearray()
        self.cseq = 1
        self.session_id: Optional[str] = None
        self.digest: Optional[DigestChallenge] = None
        self.pending_frames: List[Tuple[int, bytes]] = []

    def connect(self) -> None:
        self.sock = socket.create_connection((self.camera.host, RTSP_PORT), timeout=SOCKET_TIMEOUT_SECONDS)
        self.sock.settimeout(SOCKET_TIMEOUT_SECONDS)

    def close(self) -> None:
        if self.sock is not None:
            try:
                self.sock.close()
            except OSError:
                pass
        self.sock = None
        self.buffer.clear()
        self.pending_frames.clear()

    def send_request(
        self,
        method: str,
        url: str,
        extra_headers: Optional[Dict[str, str]] = None,
        body: bytes = b"",
    ) -> RTSPResponse:
        if self.sock is None:
            raise RuntimeError("RTSP socket is not connected")

        attempt = 0
        while True:
            headers = {
                "CSeq": str(self.cseq),
                "User-Agent": USER_AGENT,
            }
            if self.session_id and method in {"PLAY", "TEARDOWN"}:
                headers["Session"] = self.session_id
            if extra_headers:
                headers.update(extra_headers)
            if body:
                headers["Content-Length"] = str(len(body))
            if self.digest is not None:
                headers["Authorization"] = compute_digest_authorization(
                    self.digest,
                    self.camera.username,
                    self.camera.password,
                    method,
                    url,
                )

            request_lines = [f"{method} {url} RTSP/1.0"]
            request_lines.extend(f"{key}: {value}" for key, value in headers.items())
            payload = ("\r\n".join(request_lines) + "\r\n\r\n").encode("utf-8") + body

            self.sock.sendall(payload)
            self.cseq += 1

            response = self._read_rtsp_response()
            if response.status_code == 401 and attempt == 0:
                challenge = parse_digest_challenge(response.headers.get("www-authenticate", ""))
                self.digest = challenge
                attempt += 1
                continue

            if response.status_code >= 400:
                raise RuntimeError(f"{method} failed: {response.status_code} {response.reason}")
            return response

    def describe(self, url: str) -> Tuple[str, str]:
        response = self.send_request("DESCRIBE", url, {"Accept": "application/sdp"})
        content_base = response.headers.get("content-base") or response.headers.get("content-location") or url
        return response.body.decode("utf-8", errors="ignore"), content_base

    def setup(self, track_url: str) -> str:
        response = self.send_request(
            "SETUP",
            track_url,
            {"Transport": "RTP/AVP/TCP;unicast;interleaved=0-1"},
        )
        session_header = response.headers.get("session")
        if not session_header:
            raise RuntimeError("SETUP response missing Session header")
        self.session_id = session_header.split(";", 1)[0].strip()
        return self.session_id

    def play(self, aggregate_url: str) -> None:
        self.send_request("PLAY", aggregate_url)

    def teardown(self, aggregate_url: str) -> None:
        if self.session_id is None:
            return
        try:
            self.send_request("TEARDOWN", aggregate_url)
        except Exception:
            pass

    def read_metadata(self, timeout_seconds: int) -> List[bytes]:
        deadline = time.monotonic() + timeout_seconds
        xml_buffer = bytearray()
        xml_documents: List[bytes] = []

        while time.monotonic() < deadline:
            try:
                frame = self._next_interleaved_frame(deadline)
            except (TimeoutError, socket.timeout):
                break
            if frame is None:
                break

            channel, payload = frame
            if channel % 2 == 1:
                continue

            rtp_payload = strip_rtp_header(payload)
            if not rtp_payload:
                continue

            xml_buffer.extend(rtp_payload)
            xml_documents.extend(extract_xml_documents(xml_buffer))

        return xml_documents

    def _read_rtsp_response(self) -> RTSPResponse:
        while True:
            frame = self._try_extract_interleaved_frame()
            if frame is not None:
                self.pending_frames.append(frame)
                continue

            header_end = self.buffer.find(b"\r\n\r\n")
            if header_end == -1:
                self._recv_more()
                continue

            raw_headers = bytes(self.buffer[:header_end + 4])
            del self.buffer[:header_end + 4]

            header_text = raw_headers.decode("utf-8", errors="ignore")
            lines = header_text.split("\r\n")
            status_line = lines[0]
            match = re.match(r"RTSP/\d+\.\d+\s+(\d+)\s+(.*)", status_line)
            if not match:
                raise RuntimeError(f"Invalid RTSP status line: {status_line!r}")

            headers: Dict[str, str] = {}
            for line in lines[1:]:
                if not line or ":" not in line:
                    continue
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()

            content_length = int(headers.get("content-length", "0") or "0")
            while len(self.buffer) < content_length:
                self._recv_more()

            body = bytes(self.buffer[:content_length])
            del self.buffer[:content_length]

            return RTSPResponse(
                status_code=int(match.group(1)),
                reason=match.group(2).strip(),
                headers=headers,
                body=body,
            )

    def _next_interleaved_frame(self, deadline: float) -> Optional[Tuple[int, bytes]]:
        if self.pending_frames:
            return self.pending_frames.pop(0)

        while time.monotonic() < deadline:
            frame = self._try_extract_interleaved_frame()
            if frame is not None:
                return frame

            if self.buffer.startswith(b"RTSP/"):
                response = self._read_rtsp_response()
                if response.status_code >= 400:
                    raise RuntimeError(
                        f"Unexpected RTSP response during stream read: {response.status_code} {response.reason}"
                    )
                continue

            try:
                self._recv_more(deadline)
            except (TimeoutError, socket.timeout):
                return None

        return None

    def _try_extract_interleaved_frame(self) -> Optional[Tuple[int, bytes]]:
        if len(self.buffer) < 4 or self.buffer[0] != 0x24:
            return None

        payload_length = int.from_bytes(self.buffer[2:4], "big")
        if len(self.buffer) < 4 + payload_length:
            return None

        channel = self.buffer[1]
        payload = bytes(self.buffer[4:4 + payload_length])
        del self.buffer[:4 + payload_length]
        return channel, payload

    def _recv_more(self, deadline: Optional[float] = None) -> None:
        if self.sock is None:
            raise RuntimeError("RTSP socket is not connected")

        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Timed out waiting for RTSP data")
            self.sock.settimeout(max(0.1, min(remaining, SOCKET_TIMEOUT_SECONDS)))
        else:
            self.sock.settimeout(SOCKET_TIMEOUT_SECONDS)

        chunk = self.sock.recv(65536)
        if not chunk:
            raise ConnectionError("RTSP socket closed by peer")
        self.buffer.extend(chunk)


def strip_rtp_header(packet: bytes) -> bytes:
    if len(packet) < 12:
        return b""

    first_byte = packet[0]
    cc = first_byte & 0x0F
    has_padding = bool(first_byte & 0x20)
    has_extension = bool(first_byte & 0x10)

    header_length = 12 + cc * 4
    if len(packet) < header_length:
        return b""

    if has_extension:
        if len(packet) < header_length + 4:
            return b""
        extension_words = int.from_bytes(packet[header_length + 2:header_length + 4], "big")
        header_length += 4 + extension_words * 4
        if len(packet) < header_length:
            return b""

    data_end = len(packet)
    if has_padding:
        padding_count = packet[-1]
        if 0 < padding_count <= len(packet) - header_length:
            data_end -= padding_count

    return packet[header_length:data_end]


def resolve_wsdl_dir() -> Optional[str]:
    local = Path(__file__).resolve().parent / "wsdl"
    if local.exists():
        return str(local)
    return None


def prepare_onvif_runtime_env() -> None:
    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ.pop(key, None)

    no_proxy = "localhost,127.0.0.1,::1"
    os.environ["NO_PROXY"] = no_proxy
    os.environ["no_proxy"] = no_proxy

    local_appdata = os.environ.get("LOCALAPPDATA", "")
    if local_appdata:
        try:
            probe_dir = Path(local_appdata)
            probe_dir.mkdir(parents=True, exist_ok=True)
            probe_file = probe_dir / ".write_test"
            probe_file.write_text("ok", encoding="utf-8")
            probe_file.unlink(missing_ok=True)
            return
        except Exception:
            pass

    fallback = Path(__file__).resolve().parent / ".runtime" / "localappdata"
    fallback.mkdir(parents=True, exist_ok=True)
    os.environ["LOCALAPPDATA"] = str(fallback)


def try_enable_metadata_analytics(camera: CameraConfig) -> bool:
    try:
        prepare_onvif_runtime_env()
        from onvif import ONVIFCamera  # type: ignore
    except Exception:
        return False

    wsdl_dir = resolve_wsdl_dir()
    try:
        kwargs = {
            "host": camera.host,
            "port": camera.port,
            "user": camera.username,
            "passwd": camera.password,
            "no_cache": True,
            "adjust_time": True,
        }
        if wsdl_dir:
            kwargs["wsdl_dir"] = wsdl_dir

        onvif_camera = ONVIFCamera(**kwargs)
        media = onvif_camera.create_media_service()
        profiles = media.GetProfiles()
        target = None
        for profile in profiles:
            metadata_config = getattr(profile, "MetadataConfiguration", None)
            if metadata_config is None:
                continue
            target = getattr(metadata_config, "token", None)
            if target:
                break

        if not target:
            return False

        configuration = media.GetMetadataConfiguration({"ConfigurationToken": target})
        configuration.Analytics = True
        request = media.create_type("SetMetadataConfiguration")
        request.Configuration = configuration
        request.ForcePersistence = False
        media.SetMetadataConfiguration(request)
        log(f"[{camera.camera_name}] Enabled metadata analytics via ONVIF")
        return True
    except Exception as exc:
        log(f"[{camera.camera_name}] Failed to enable metadata analytics: {exc}")
        return False


def snapshot_metadata(
    camera: CameraConfig,
    preferred_profile: str,
    read_timeout_seconds: int,
) -> List[Dict[str, Any]]:
    profiles = build_profile_candidates(preferred_profile)
    last_error: Optional[Exception] = None

    for attempt in range(2):
        for profile in profiles:
            aggregate_url = build_profile_url(camera.host, profile)
            client = RTSPMetadataClient(camera)

            try:
                client.connect()
                sdp, content_base = client.describe(aggregate_url)
                track_urls = parse_metadata_track_urls(sdp, content_base)
                if not track_urls:
                    log(f"[{camera.camera_name}] No metadata track in {profile}")
                    continue

                client.setup(track_urls[0])
                client.play(aggregate_url)
                xml_documents = client.read_metadata(read_timeout_seconds)

                rows: List[Dict[str, Any]] = []
                for xml_document in xml_documents:
                    rows.extend(parse_metadata_xml(xml_document))

                if rows:
                    return rows

                log(f"[{camera.camera_name}] No BoxTemperatureReading in {profile}")
            except Exception as exc:
                last_error = exc
                log(f"[{camera.camera_name}] {profile} failed: {exc}")
            finally:
                try:
                    client.teardown(aggregate_url)
                finally:
                    client.close()

        if attempt == 0 and try_enable_metadata_analytics(camera):
            continue
        break

    if last_error is not None:
        raise last_error
    return []


def process_camera(
    camera: CameraConfig,
    preferred_profile: str,
    read_timeout_seconds: int,
    roi_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Collect temperature data from camera. Returns list of payloads (NULL on failure)."""
    try:
        rows = snapshot_metadata(camera, preferred_profile, read_timeout_seconds)
    except Exception as exc:
        log(f"[{camera.camera_name}] Collection failed: {exc}")
        rows = []

    if not rows:
        # Emit NULL payload when collection fails or returns no data
        null_payload = {
            "ts_utc": utc_now_iso(),
            "camera": camera.camera_name,
            "host": camera.host,
            "roi": "UNKNOWN",
            "max_temperature": None,
            "unit": "Fahrenheit",
            "status": "failed",
        }
        print(json.dumps(null_payload, ensure_ascii=True), flush=True)
        return [null_payload]

    deduped_rows: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        deduped_rows[str(row["roi"])] = row

    payloads: List[Dict[str, Any]] = []
    for row in deduped_rows.values():
        # Filter by ROI if specified
        if roi_filter and str(row["roi"]) != roi_filter:
            continue

        max_celsius = row["max_temperature"]

        payload = {
            "ts_utc": utc_now_iso(),
            "camera": camera.camera_name,
            "host": camera.host,
            "roi": row["roi"],
            "max_temperature": celsius_to_fahrenheit(max_celsius),
            "unit": "Fahrenheit",
        }

        print(json.dumps(payload, ensure_ascii=True), flush=True)
        payloads.append(payload)
    return payloads


def post_readings_to_api(
    api_url: str,
    readings: List[Dict[str, Any]],
    api_secret: Optional[str] = None,
) -> None:
    """POST batch of readings to the API endpoint."""
    if not readings:
        return
    try:
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if api_secret:
            headers["x-collector-secret"] = api_secret
        resp = requests.post(api_url, json=readings, headers=headers, timeout=30)
        if resp.ok:
            result = resp.json()
            log(f"[API] Posted {len(readings)} readings → {result}")
        else:
            log(f"[API] POST failed: {resp.status_code} {resp.text[:200]}")
    except Exception as exc:
        log(f"[API] POST error: {exc}")


def run_collect_loop(
    cameras: List[CameraConfig],
    interval_seconds: int,
    read_timeout_seconds: int,
    workers: int,
    preferred_profile: str,
    once: bool,
    api_url: Optional[str] = None,
    api_secret: Optional[str] = None,
    roi_filter: Optional[str] = None,
    db_url: Optional[str] = None,
    db_enc_key: str = "",
) -> None:
    next_tick = time.monotonic()

    while True:
        # Auto-reload cameras from DB each cycle (picks up new/removed cameras)
        if db_url:
            try:
                new_cameras = load_cameras_from_db(db_url, db_enc_key)
                old_hosts = {c.host for c in cameras}
                new_hosts = {c.host for c in new_cameras}
                added = new_hosts - old_hosts
                removed = old_hosts - new_hosts
                if added:
                    log(f"[reload] {len(added)} camera(s) added: {added}")
                if removed:
                    log(f"[reload] {len(removed)} camera(s) removed: {removed}")
                cameras = new_cameras
            except Exception as exc:
                log(f"[reload] DB query failed, using previous list ({len(cameras)} cameras): {exc}")

        log(f"\n=== RTSP snapshot cycle started at {utc_now_iso()} ({len(cameras)} cameras) ===")
        all_payloads: List[Dict[str, Any]] = []

        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            future_map = {
                executor.submit(process_camera, camera, preferred_profile, read_timeout_seconds, roi_filter): camera
                for camera in cameras
            }
            for future in as_completed(future_map):
                camera = future_map[future]
                try:
                    payloads = future.result()
                    all_payloads.extend(payloads)
                except Exception as exc:
                    log(f"[{camera.camera_name}] Cycle failed: {exc}")

        log(f"=== Cycle complete: {len(all_payloads)} readings collected ===")

        # POST to API if configured
        if api_url:
            post_readings_to_api(api_url, all_payloads, api_secret)

        if once:
            return

        next_tick += interval_seconds
        sleep_seconds = next_tick - time.monotonic()
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
        else:
            next_tick = time.monotonic()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="RTSP metadata snapshot collector for Hanwha thermal cameras"
    )
    parser.add_argument(
        "--cameras",
        required=False,
        default=None,
        help="Path to camera config JSON (optional when using --from-db)",
    )
    parser.add_argument(
        "--from-db",
        action="store_true",
        help="Read camera configs from database instead of JSON file",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="PostgreSQL connection URL (or set DATABASE_URL env var)",
    )
    parser.add_argument(
        "--encryption-key",
        type=str,
        default=None,
        help="AES-256 key hex (or set CAMERA_ENCRYPTION_KEY env var)",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=60,
        help="Polling interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--read-timeout",
        type=int,
        default=DEFAULT_READ_TIMEOUT_SECONDS,
        help="Seconds to read metadata before disconnect (default: 5)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Parallel camera workers per cycle (default: 4)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one cycle then exit",
    )
    parser.add_argument(
        "--profile",
        default="profile2",
        help="Preferred RTSP profile to try first (default: profile2)",
    )
    parser.add_argument(
        "--api-url",
        default=None,
        help="API endpoint URL to POST readings to (e.g., http://localhost:3000/api/temperature-readings)",
    )
    parser.add_argument(
        "--api-secret",
        default=os.environ.get("COLLECTOR_SECRET"),
        help="API secret for x-collector-secret header (default: COLLECTOR_SECRET env var)",
    )
    parser.add_argument(
        "--roi",
        default=None,
        help="Filter to specific ROI zone (e.g., 'A', 'B', 'C'). If not set, all ROIs are collected.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Load cameras from DB or JSON file
    db_url: Optional[str] = None
    enc_key = ""

    if args.from_db:
        db_url = args.database_url or os.environ.get("DATABASE_URL")
        if not db_url:
            parser_error("--database-url or DATABASE_URL env required with --from-db")

        enc_key = args.encryption_key or os.environ.get("CAMERA_ENCRYPTION_KEY") or ""

        cameras = load_cameras_from_db(db_url, enc_key)
        log(f"Loaded {len(cameras)} active camera(s) from database (auto-reload enabled)")
    else:
        if not args.cameras:
            parser_error("--cameras required when not using --from-db")
        cameras = load_cameras(args.cameras)
        log(f"Loaded {len(cameras)} camera(s) from {args.cameras}")

    log(
        f"Starting RTSP snapshot collector: interval={args.interval_seconds}s, "
        f"read_timeout={args.read_timeout}s, preferred_profile={args.profile}"
    )
    if args.api_url:
        log(f"API endpoint: {args.api_url}")
    if args.roi:
        log(f"ROI filter: {args.roi}")

    run_collect_loop(
        cameras=cameras,
        interval_seconds=max(1, args.interval_seconds),
        read_timeout_seconds=max(1, args.read_timeout),
        workers=max(1, args.workers),
        preferred_profile=args.profile,
        once=args.once,
        api_url=args.api_url,
        api_secret=args.api_secret,
        roi_filter=args.roi,
        db_url=db_url,
        db_enc_key=enc_key,
    )


def parser_error(message: str) -> None:
    """Print error message and exit."""
    print(f"Error: {message}", file=__import__("sys").stderr)
    __import__("sys").exit(1)


if __name__ == "__main__":
    main()
