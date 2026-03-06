#!/usr/bin/env python3
"""
Proof of Concept: ONVIF PullPoint collector for Hanwha thermal cameras.

What this script does:
1) Connects to each camera via ONVIF.
2) Calls CreatePullPointSubscription once per camera.
3) Every 60 seconds, calls PullMessages on each camera PullPoint mailbox.
4) Parses BoxTemperatureReading events and prints:
   - ROI identifier (ItemID / AreaName fallback)
   - MaxTemperature / MinTemperature / AverageTemperature

This follows ONVIF topic:
tns1:VideoAnalytics/Radiometry/BoxTemperatureReading

Important:
- This script intentionally avoids HTTP eventsources.cgi polling, MQTT, and RTSP metadata streaming.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from lxml import etree

# ── Raw XML capture ──
# Zeep badly deserializes Hanwha ONVIF responses: Topic._value_1 is null,
# SimpleItems are lost. We monkey-patch zeep transport to capture raw bytes.
_captured_responses: list[bytes] = []

BOX_TEMP_TOPIC_KEYWORD = "BoxTemperatureReading"

# Additional topic keywords to catch vendor variants.
# SUNAPI_event_2.6.7.pdf uses BoxTemperatureDetection in the event schema.
BOX_TEMP_TOPIC_VARIANTS = [
    "BoxTemperatureReading",
    "BoxTemperatureDetection",
]
RADIOMETRY_KEYWORDS = [
    "Radiometry",
    "Temperature",
    "Thermal",
]

# Global flag, set by --debug CLI argument.
DEBUG = False


def _patch_zeep_transport(service_proxy: Any, label: str = "") -> None:
    """Find and patch zeep transport inside an onvif-zeep service proxy."""
    for attr_name in dir(service_proxy):
        if attr_name.startswith("__"):
            continue
        try:
            val = getattr(service_proxy, attr_name)
        except Exception:
            continue
        # Look for zeep Client with transport.
        client = getattr(val, "_client", None)
        if client and hasattr(client, "transport") and hasattr(client.transport, "post"):
            transport = client.transport
            if getattr(transport, "_raw_patched", False):
                return
            original_post = transport.post
            def _make_patched(orig):
                def patched_post(address, message, headers):
                    resp = orig(address, message, headers)
                    try:
                        _captured_responses.append(resp.content)
                    except Exception:
                        pass
                    return resp
                return patched_post
            transport.post = _make_patched(original_post)
            transport._raw_patched = True
            if DEBUG:
                print(f"  [{label}] Patched zeep transport for raw XML capture")
            return


def parse_raw_notifications(raw_xml: bytes) -> List[Dict[str, Any]]:
    """
    Parse raw PullMessages SOAP XML to extract topic + SimpleItem data.
    Returns a list of dicts per NotificationMessage.
    """
    results: List[Dict[str, Any]] = []
    try:
        root = etree.fromstring(raw_xml)
    except Exception:
        return results

    for nm in root.iter("{http://docs.oasis-open.org/wsn/b-2}NotificationMessage"):
        entry: Dict[str, Any] = {"topic": "", "simple_items": {}, "xml_snippet": ""}

        topic_el = nm.find("{http://docs.oasis-open.org/wsn/b-2}Topic")
        if topic_el is not None and topic_el.text:
            entry["topic"] = topic_el.text.strip()

        for si in nm.iter():
            local_name = etree.QName(si.tag).localname
            if local_name == "SimpleItem":
                name = si.get("Name", "")
                value = si.get("Value", "")
                if name:
                    entry["simple_items"][name] = value
            elif local_name == "ElementItem":
                for child in si.iter():
                    cl = etree.QName(child.tag).localname
                    if cl in ("MaxTemperature", "MinTemperature", "AverageTemperature"):
                        val_text = (child.text or "").strip() or child.get("Value", "")
                        if val_text:
                            entry["simple_items"][cl] = val_text

        try:
            entry["xml_snippet"] = etree.tostring(nm, encoding="unicode", pretty_print=True)[:2000]
        except Exception:
            pass

        results.append(entry)
    return results


def ensure_runtime_cache_dir() -> None:
    """
    Ensure zeep cache directory is writable.
    Some locked-down environments deny write under %LOCALAPPDATA%.
    """
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        test_dir = Path(local_app_data)
        try:
            test_dir.mkdir(parents=True, exist_ok=True)
            probe = test_dir / ".write_test"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return
        except Exception:
            pass

    fallback = Path(__file__).resolve().parent / ".runtime" / "localappdata"
    fallback.mkdir(parents=True, exist_ok=True)
    os.environ["LOCALAPPDATA"] = str(fallback)


ensure_runtime_cache_dir()

from onvif import ONVIFCamera
from zeep.helpers import serialize_object


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
                name=(str(row["name"]) if row.get("name") else None),
            )
        )
    if not cameras:
        raise ValueError("No camera found in config file")
    return cameras


def configure_proxy_for_onvif(camera_hosts: List[str], keep_proxy: bool) -> None:
    if keep_proxy:
        return

    # Disable proxy usage for direct camera LAN calls.
    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ.pop(key, None)

    no_proxy_values = {"localhost", "127.0.0.1", "::1"}
    no_proxy_values.update(camera_hosts)
    os.environ["NO_PROXY"] = ",".join(sorted(no_proxy_values))
    os.environ["no_proxy"] = os.environ["NO_PROXY"]


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def extract_text(node: etree._Element, key: str) -> Optional[str]:
    for child in node.iter():
        if etree.QName(child.tag).localname == key:
            text = (child.text or "").strip()
            if text:
                return text
    return None


def iter_xml_elements(value: Any, seen: Optional[set[int]] = None) -> Iterable[etree._Element]:
    if seen is None:
        seen = set()

    obj_id = id(value)
    if obj_id in seen:
        return
    seen.add(obj_id)

    if isinstance(value, etree._Element):
        yield value
        return

    if isinstance(value, dict):
        for v in value.values():
            yield from iter_xml_elements(v, seen)
        return

    if isinstance(value, (list, tuple, set)):
        for item in value:
            yield from iter_xml_elements(item, seen)
        return

    if hasattr(value, "__dict__"):
        for v in vars(value).values():
            yield from iter_xml_elements(v, seen)


def collect_simple_items(value: Any, out: Dict[str, str]) -> None:
    if isinstance(value, dict):
        name = value.get("Name")
        item_value = value.get("Value")
        if isinstance(name, str) and item_value is not None:
            out[name] = str(item_value)
        for v in value.values():
            collect_simple_items(v, out)
        return

    if isinstance(value, list):
        for item in value:
            collect_simple_items(item, out)


def extract_topic(notification: Any) -> str:
    topic = getattr(notification, "Topic", None)
    if topic is None:
        return ""
    if isinstance(topic, str):
        return topic
    value = getattr(topic, "_value_1", None)
    if isinstance(value, str):
        return value
    serialized = serialize_object(topic)
    return json.dumps(serialized)


def _topic_matches_box_temp(topic: str) -> bool:
    """Check if topic matches any BoxTemperature variant."""
    for variant in BOX_TEMP_TOPIC_VARIANTS:
        if variant in topic:
            return True
    return False


def _topic_has_radiometry_keyword(topic: str) -> bool:
    """Check if topic contains any radiometry/temperature related keyword."""
    topic_lower = topic.lower()
    for kw in RADIOMETRY_KEYWORDS:
        if kw.lower() in topic_lower:
            return True
    return False


def debug_dump_notification(
    idx: int,
    raw_entry: Optional[Dict[str, Any]] = None,
    camera_name: str = "",
) -> None:
    """Print a condensed diagnostic dump of one NotificationMessage."""
    topic = raw_entry.get("topic", "") if raw_entry else ""
    simple_items = raw_entry.get("simple_items", {}) if raw_entry else {}

    is_radiometry = _topic_has_radiometry_keyword(topic)
    is_box_temp = _topic_matches_box_temp(topic)
    flag = ""
    if is_box_temp:
        flag = " <<<< BOX_TEMP_MATCH"
    elif is_radiometry:
        flag = " << RADIOMETRY_RELATED"

    print(f"  [DEBUG] msg#{idx} topic={topic!r}{flag}")
    if simple_items:
        print(f"          SimpleItems: {json.dumps(simple_items, ensure_ascii=True)}")

    # Dump raw XML snippet for first 3 messages or temperature-related.
    if raw_entry and (idx < 3 or is_radiometry or is_box_temp):
        snippet = raw_entry.get("xml_snippet", "")
        if snippet:
            print(f"          RAW XML (truncated):\n{snippet[:1500]}")


def parse_box_temp_entries(notification: Any) -> List[Dict[str, Any]]:
    topic = extract_topic(notification)
    serialized = serialize_object(notification)
    result: List[Dict[str, Any]] = []

    # Parse "SimpleItem" style payload (common ONVIF event style).
    simple_items: Dict[str, str] = {}
    collect_simple_items(serialized, simple_items)

    max_temp = to_float(simple_items.get("MaxTemperature"))
    min_temp = to_float(simple_items.get("MinTemperature"))
    avg_temp = to_float(simple_items.get("AverageTemperature"))
    roi = (
        simple_items.get("ItemID")
        or simple_items.get("AreaName")
        or simple_items.get("ROI")
        or simple_items.get("RegionID")
        or simple_items.get("RuleName")
        or simple_items.get("Rule")
        or "UNKNOWN"
    )

    # Broadened topic matching: accept any BoxTemperature variant.
    topic_match = _topic_matches_box_temp(topic)

    if (
        topic_match
        and max_temp is not None
        and min_temp is not None
        and avg_temp is not None
    ):
        result.append(
            {
                "topic": topic,
                "roi": roi,
                "max_temperature": max_temp,
                "min_temperature": min_temp,
                "avg_temperature": avg_temp,
                "source": "SimpleItem",
            }
        )

    # Fallback: if topic doesn't match but we found all 3 temperature values
    # in SimpleItems, still emit (with a hint that topic didn't match).
    if (
        not topic_match
        and max_temp is not None
        and min_temp is not None
        and avg_temp is not None
    ):
        result.append(
            {
                "topic": topic or "(no-topic)",
                "roi": roi,
                "max_temperature": max_temp,
                "min_temperature": min_temp,
                "avg_temperature": avg_temp,
                "source": "SimpleItem (topic-mismatch, fallback)",
            }
        )

    # Parse explicit XML tags for BoxTemperature variants.
    for elem in iter_xml_elements(notification):
        local_name = etree.QName(elem.tag).localname
        # Accept any variant: BoxTemperatureReading, BoxTemperatureDetection, etc.
        is_match = any(v in local_name for v in BOX_TEMP_TOPIC_VARIANTS)
        if not is_match:
            continue

        xml_max = to_float(extract_text(elem, "MaxTemperature"))
        xml_min = to_float(extract_text(elem, "MinTemperature"))
        xml_avg = to_float(extract_text(elem, "AverageTemperature"))
        xml_roi = (
            extract_text(elem, "ItemID")
            or extract_text(elem, "AreaName")
            or extract_text(elem, "ROI")
            or extract_text(elem, "RegionID")
            or extract_text(elem, "RuleName")
            or "UNKNOWN"
        )

        if xml_max is None or xml_min is None or xml_avg is None:
            continue

        result.append(
            {
                "topic": topic or local_name,
                "roi": xml_roi,
                "max_temperature": xml_max,
                "min_temperature": xml_min,
                "avg_temperature": xml_avg,
                "source": f"XML {local_name}",
            }
        )

    # De-duplicate by ROI + values to avoid duplicate prints from dual parsing.
    unique: List[Dict[str, Any]] = []
    seen = set()
    for row in result:
        key = (
            row["roi"],
            row["max_temperature"],
            row["min_temperature"],
            row["avg_temperature"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


class PullPointCollector:
    def __init__(
        self, config: CameraConfig, wsdl_dir: Optional[str], connect_timeout_seconds: int
    ) -> None:
        self.config = config
        self.wsdl_dir = wsdl_dir
        self.connect_timeout_seconds = connect_timeout_seconds
        self.camera: Optional[ONVIFCamera] = None
        self.events_service = None
        self.pullpoint_service = None
        self.lock = threading.Lock()

    def _create_camera(self) -> ONVIFCamera:
        wsdl_dir = self.wsdl_dir or self._resolve_default_wsdl_dir()
        if wsdl_dir:
            return ONVIFCamera(
                self.config.host,
                self.config.port,
                self.config.username,
                self.config.password,
                wsdl_dir,
                no_cache=True,
                adjust_time=True,
            )
        return ONVIFCamera(
            self.config.host,
            self.config.port,
            self.config.username,
            self.config.password,
            no_cache=True,
            adjust_time=True,
        )

    @staticmethod
    def _resolve_default_wsdl_dir() -> Optional[str]:
        # Prefer repository-local WSDL bundle (scripts/wsdl).
        local_wsdl = Path(__file__).resolve().parent / "wsdl"
        if local_wsdl.exists():
            return str(local_wsdl)

        # Fallback: onvif-zeep may ship WSDLs under site-packages/onvif/wsdl.
        try:
            import onvif as onvif_pkg  # type: ignore

            base = Path(onvif_pkg.__file__).resolve().parent
            candidate = base / "wsdl"
            if candidate.exists():
                return str(candidate)
        except Exception:
            return None
        return None

    def subscribe(self) -> None:
        # Fast connectivity check to avoid long hangs if camera is unreachable.
        with socket.create_connection(
            (self.config.host, self.config.port), timeout=self.connect_timeout_seconds
        ):
            pass

        # Step 1: connect ONVIF services.
        self.camera = self._create_camera()
        self.events_service = self.camera.create_events_service()

        # Patch zeep transport for raw XML capture.
        _patch_zeep_transport(self.events_service, self.config.camera_name)

        # Step 1.5 (debug): Probe supported event topics via GetEventProperties.
        if DEBUG:
            self._probe_event_properties()

        # Step 2: create PullPoint subscription mailbox on camera.
        sub_req = {"InitialTerminationTime": "PT24H"}
        sub_resp = self.events_service.CreatePullPointSubscription(sub_req)

        xaddr = None
        ref = getattr(sub_resp, "SubscriptionReference", None)
        if ref is not None:
            address = getattr(ref, "Address", None)
            if isinstance(address, str):
                xaddr = address
            elif address is not None:
                xaddr = getattr(address, "_value_1", None)

        if xaddr:
            self.pullpoint_service = self.camera.create_pullpoint_service(xaddr)
        else:
            self.pullpoint_service = self.camera.create_pullpoint_service()

        # Patch pullpoint transport too.
        _patch_zeep_transport(self.pullpoint_service, self.config.camera_name)

        print(
            f"[{self.config.camera_name}] PullPoint subscribed"
            f"{f' ({xaddr})' if xaddr else ''}"
        )

    def _probe_event_properties(self) -> None:
        """Call GetEventProperties to discover all topics supported by the camera."""
        try:
            props = self.events_service.GetEventProperties()
            topic_set = getattr(props, "TopicSet", None)
            print(f"\n[{self.config.camera_name}] === GetEventProperties ===")

            if topic_set is not None:
                topics = self._extract_topic_names(topic_set)
                radiometry_topics = [
                    t for t in topics if _topic_has_radiometry_keyword(t)
                ]
                box_temp_topics = [
                    t for t in topics if _topic_matches_box_temp(t)
                ]

                print(f"  Total topics discovered: {len(topics)}")
                if box_temp_topics:
                    print(f"  [YES] BoxTemperature topics: {box_temp_topics}")
                else:
                    print(f"  [NO]  BoxTemperatureReading NOT in supported topics")

                if radiometry_topics:
                    print(f"  Radiometry-related topics: {radiometry_topics}")
                else:
                    print(f"  [NO]  No Radiometry/Temperature/Thermal topic at all")

                # Print all topics for full visibility.
                print(f"  All supported topics:")
                for t in sorted(topics):
                    flag = ""
                    if _topic_matches_box_temp(t):
                        flag = " <<<< BOX_TEMP"
                    elif _topic_has_radiometry_keyword(t):
                        flag = " << RADIOMETRY"
                    print(f"    - {t}{flag}")
            else:
                # Fallback: dump raw serialized response.
                raw = serialize_object(props)
                print(f"  TopicSet is None. Raw response:")
                print(json.dumps(raw, default=str, indent=2, ensure_ascii=True)[:5000])

            print(f"=== End GetEventProperties ===\n")
        except Exception as exc:
            print(f"[{self.config.camera_name}] GetEventProperties failed: {exc}")

    def _extract_topic_names(self, topic_set: Any) -> List[str]:
        """Extract topic paths from TopicSet.

        TopicSet._value_1 contains raw lxml Elements for each topic namespace.
        We walk these elements recursively to build topic paths.
        """
        topics: List[str] = []
        raw_elements = getattr(topic_set, "_value_1", None)
        if raw_elements and isinstance(raw_elements, list):
            for elem in raw_elements:
                if isinstance(elem, etree._Element):
                    local = etree.QName(elem.tag).localname
                    topics.append(local)
                    topics.extend(self._walk_topic_element(elem, local))
        else:
            # Fallback: try serialization.
            try:
                serialized = serialize_object(topic_set)
                if isinstance(serialized, dict):
                    self._walk_topic_dict(serialized, "", topics)
            except Exception:
                pass
        return topics

    def _walk_topic_element(self, elem: etree._Element, prefix: str) -> List[str]:
        """Recursively walk lxml topic element tree."""
        paths: List[str] = []
        for child in elem:
            local = etree.QName(child.tag).localname
            if local in ("MessageDescription", "documentation"):
                continue
            child_path = f"{prefix}/{local}"
            paths.append(child_path)
            paths.extend(self._walk_topic_element(child, child_path))
        return paths

    def _walk_topic_dict(
        self, d: Any, prefix: str, out: List[str]
    ) -> None:
        """Walk a serialized TopicSet dict to collect topic paths."""
        if isinstance(d, dict):
            for k, v in d.items():
                if k.startswith("_"):
                    continue
                child_prefix = f"{prefix}/{k}" if prefix else k
                out.append(child_prefix)
                self._walk_topic_dict(v, child_prefix, out)
        elif isinstance(d, list):
            for item in d:
                self._walk_topic_dict(item, prefix, out)

    def pull_once(self, timeout: str, message_limit: int) -> int:
        with self.lock:
            if self.pullpoint_service is None:
                self.subscribe()

            # Step 3: pull newest events from PullPoint mailbox.
            _captured_responses.clear()
            req = {"Timeout": timeout, "MessageLimit": message_limit}
            resp = self.pullpoint_service.PullMessages(req)

        messages = getattr(resp, "NotificationMessage", None) or []
        extracted_count = 0
        now_utc = datetime.now(timezone.utc).isoformat()

        # ── Parse raw XML for reliable topic/SimpleItem extraction ──
        raw_entries: List[Dict[str, Any]] = []
        if _captured_responses:
            raw_entries = parse_raw_notifications(_captured_responses[-1])
            if DEBUG:
                raw_out = Path(__file__).resolve().parent / "debug_pullmessages_raw.xml"
                raw_out.write_bytes(_captured_responses[-1])
                print(f"  [{self.config.camera_name}] Raw XML saved: {raw_out}")

        # Debug: dump ALL events before filtering.
        if DEBUG:
            count = max(len(messages), len(raw_entries))
            print(
                f"  [{self.config.camera_name}] PullMessages: "
                f"{len(messages)} zeep / {len(raw_entries)} raw msg(s)"
            )
            for idx in range(count):
                raw = raw_entries[idx] if idx < len(raw_entries) else None
                debug_dump_notification(idx, raw_entry=raw, camera_name=self.config.camera_name)

        # ── Use raw entries if available, falling back to zeep parsing ──
        if raw_entries:
            for entry in raw_entries:
                topic = entry.get("topic", "")
                si = entry.get("simple_items", {})

                max_temp = to_float(si.get("MaxTemperature"))
                min_temp = to_float(si.get("MinTemperature"))
                avg_temp = to_float(si.get("AverageTemperature"))
                roi = (
                    si.get("ItemID")
                    or si.get("AreaName")
                    or si.get("ROI")
                    or si.get("RegionID")
                    or si.get("RuleName")
                    or si.get("Rule")
                    or "UNKNOWN"
                )

                if max_temp is None or min_temp is None or avg_temp is None:
                    continue

                extracted_count += 1
                print(
                    json.dumps(
                        {
                            "ts_utc": now_utc,
                            "camera": self.config.camera_name,
                            "host": self.config.host,
                            "roi": roi,
                            "max_temperature": max_temp,
                            "min_temperature": min_temp,
                            "avg_temperature": avg_temp,
                            "topic": topic,
                            "parser_source": "raw_xml",
                        },
                        ensure_ascii=True,
                    )
                )
        else:
            # Fallback: original zeep-based parsing.
            for msg in messages:
                rows = parse_box_temp_entries(msg)
                for row in rows:
                    extracted_count += 1
                    print(
                        json.dumps(
                            {
                                "ts_utc": now_utc,
                                "camera": self.config.camera_name,
                                "host": self.config.host,
                                "roi": row["roi"],
                                "max_temperature": row["max_temperature"],
                                "min_temperature": row["min_temperature"],
                                "avg_temperature": row["avg_temperature"],
                                "topic": row["topic"],
                                "parser_source": row["source"],
                            },
                            ensure_ascii=True,
                        )
                    )

        return extracted_count

    def ensure_subscription(self) -> None:
        with self.lock:
            if self.pullpoint_service is None:
                self.subscribe()

    def reset_subscription(self) -> None:
        with self.lock:
            self.pullpoint_service = None
            self.events_service = None
            self.camera = None


def run_collect_loop(
    collectors: List[PullPointCollector],
    interval_seconds: int,
    timeout: str,
    message_limit: int,
    workers: int,
    once: bool,
) -> None:
    # Run fixed-interval schedule: one PullMessages batch every 60 seconds.
    next_tick = time.monotonic()

    while True:
        started = datetime.now(timezone.utc).isoformat()
        print(f"\n=== Pull cycle started at {started} ===")

        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {
                executor.submit(c.pull_once, timeout, message_limit): c for c in collectors
            }
            for fut in as_completed(future_map):
                collector = future_map[fut]
                try:
                    n = fut.result()
                    if n == 0:
                        print(
                            f"[{collector.config.camera_name}] No BoxTemperatureReading in this cycle"
                        )
                except Exception as exc:
                    print(f"[{collector.config.camera_name}] PullMessages failed: {exc}")
                    collector.reset_subscription()

        if once:
            break

        next_tick += interval_seconds
        sleep_s = next_tick - time.monotonic()
        if sleep_s > 0:
            time.sleep(sleep_s)
        else:
            # If one cycle was slow, continue without sleeping and reset clock.
            next_tick = time.monotonic()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PoC ONVIF PullPoint collector for thermal BoxTemperatureReading"
    )
    parser.add_argument(
        "--cameras",
        required=True,
        help="Path to camera JSON config file",
    )
    parser.add_argument(
        "--wsdl-dir",
        default=None,
        help="Optional ONVIF WSDL directory path for onvif-zeep",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=60,
        help="Pull interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--pull-timeout",
        default="PT5S",
        help="ONVIF PullMessages Timeout (default: PT5S)",
    )
    parser.add_argument(
        "--message-limit",
        type=int,
        default=100,
        help="ONVIF PullMessages MessageLimit (default: 100)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=10,
        help="Parallel workers for camera pulls (default: 10)",
    )
    parser.add_argument(
        "--connect-timeout-seconds",
        type=int,
        default=5,
        help="TCP connect timeout per camera before ONVIF calls (default: 5)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run only one PullMessages cycle then exit",
    )
    parser.add_argument(
        "--keep-proxy",
        action="store_true",
        help="Keep HTTP(S) proxy settings instead of disabling them for ONVIF camera calls",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable verbose diagnostic output: dump all events, probe GetEventProperties",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    global DEBUG
    DEBUG = args.debug

    cameras = load_cameras(args.cameras)
    configure_proxy_for_onvif([c.host for c in cameras], keep_proxy=args.keep_proxy)
    collectors = [
        PullPointCollector(c, args.wsdl_dir, args.connect_timeout_seconds) for c in cameras
    ]

    print(f"Loaded {len(collectors)} camera(s). Initializing PullPoint subscriptions...")
    for collector in collectors:
        try:
            collector.ensure_subscription()
        except Exception as exc:
            print(f"[{collector.config.camera_name}] Subscription failed at startup: {exc}")
            collector.reset_subscription()

    print(
        f"Starting loop: interval={args.interval_seconds}s, "
        f"pull-timeout={args.pull_timeout}, message-limit={args.message_limit}"
    )
    run_collect_loop(
        collectors=collectors,
        interval_seconds=args.interval_seconds,
        timeout=args.pull_timeout,
        message_limit=args.message_limit,
        workers=args.workers,
        once=args.once,
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped by user.")
