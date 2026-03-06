#!/usr/bin/env python3
"""
Proof of Concept: SUNAPI grid-sampling collector for Hanwha thermal cameras.

This collector is a fallback when ONVIF PullPoint does not expose
BoxTemperatureReading values. It samples temperatures inside each ROI box using
the SUNAPI `spottemperaturereading` endpoint, then approximates min/max/avg.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from requests.auth import HTTPDigestAuth
from requests.exceptions import RequestException, Timeout


REQUEST_TIMEOUT_SECONDS = 3
MIN_VALID_SAMPLES = 3


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


@dataclass(frozen=True)
class RoiBox:
    roi: int
    channel: int
    x1: int
    y1: int
    x2: int
    y2: int


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


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


def build_base_url(camera: CameraConfig) -> str:
    return f"http://{camera.host}:{camera.port}"


def create_session(camera: CameraConfig) -> requests.Session:
    session = requests.Session()
    session.auth = HTTPDigestAuth(camera.username, camera.password)
    session.trust_env = False
    session.headers.update({"Accept": "application/json"})
    return session


def parse_json_response(response: requests.Response, endpoint_name: str) -> Dict[str, Any]:
    if response.status_code == 401:
        raise PermissionError(f"{endpoint_name}: authentication failed (401)")
    response.raise_for_status()
    try:
        data = response.json()
    except ValueError as exc:
        raise ValueError(f"{endpoint_name}: expected JSON response") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{endpoint_name}: expected top-level JSON object")
    return data


def fetch_roi_boxes(session: requests.Session, camera: CameraConfig) -> List[RoiBox]:
    """
    Load ROI rectangles from SUNAPI boxtemperaturedetection.
    Only ROIs with AreaOverlay=true are returned.
    """
    url = f"{build_base_url(camera)}/stw-cgi/eventsources.cgi"
    params = {
        "msubmenu": "boxtemperaturedetection",
        "action": "view",
    }
    response = session.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    payload = parse_json_response(response, "boxtemperaturedetection")

    items = payload.get("BoxTemperatureDetection", [])
    if not isinstance(items, list):
        raise ValueError("boxtemperaturedetection: unexpected BoxTemperatureDetection payload")

    rois: List[RoiBox] = []
    for channel_entry in items:
        if not isinstance(channel_entry, dict):
            continue
        if channel_entry.get("Enable") is False:
            continue

        channel = int(channel_entry.get("Channel", 0))
        channel_rois = channel_entry.get("ROIs", [])
        if not isinstance(channel_rois, list):
            continue

        for roi_entry in channel_rois:
            if not isinstance(roi_entry, dict):
                continue
            if roi_entry.get("AreaOverlay") is not True:
                continue

            coords = roi_entry.get("Coordinates", [])
            if not isinstance(coords, list) or len(coords) < 2:
                continue

            p1, p2 = coords[0], coords[1]
            if not isinstance(p1, dict) or not isinstance(p2, dict):
                continue

            x1 = int(min(p1.get("x", 0), p2.get("x", 0)))
            y1 = int(min(p1.get("y", 0), p2.get("y", 0)))
            x2 = int(max(p1.get("x", 0), p2.get("x", 0)))
            y2 = int(max(p1.get("y", 0), p2.get("y", 0)))

            rois.append(
                RoiBox(
                    roi=int(roi_entry.get("ROI", len(rois) + 1)),
                    channel=channel,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                )
            )

    return rois


def generate_axis_points(start: int, end: int, grid_size: int) -> List[int]:
    if grid_size <= 1 or start == end:
        return [int(round((start + end) / 2))]

    values: List[int] = []
    span = end - start
    for idx in range(grid_size):
        ratio = idx / (grid_size - 1)
        values.append(int(round(start + span * ratio)))

    # Keep exactly `grid_size` axis positions. For grid sizes >= 3, force one
    # interior slot to the geometric center so the final grid includes it.
    center = int(round((start + end) / 2))
    if grid_size >= 3 and center not in values:
        values[grid_size // 2] = center

    return values


def generate_grid_points(x1: int, y1: int, x2: int, y2: int, grid_size: int) -> List[Tuple[int, int]]:
    """
    Generate evenly spaced points inside ROI bounds.
    Corners and center are always included.
    """
    xs = generate_axis_points(x1, x2, grid_size)
    ys = generate_axis_points(y1, y2, grid_size)

    points: List[Tuple[int, int]] = [
        (x1, y1),
        (x2, y1),
        (x1, y2),
        (x2, y2),
        (int(round((x1 + x2) / 2)), int(round((y1 + y2) / 2))),
    ]

    for y in ys:
        for x in xs:
            points.append((x, y))

    deduped: List[Tuple[int, int]] = []
    seen = set()
    for point in points:
        if point in seen:
            continue
        seen.add(point)
        deduped.append(point)
    return deduped


def read_single_spot(
    session: requests.Session,
    camera: CameraConfig,
    channel: int,
    point: Tuple[int, int],
    resolution: str,
) -> Optional[Tuple[float, str]]:
    x, y = point
    url = f"{build_base_url(camera)}/stw-cgi/image.cgi"
    params = {
        "msubmenu": "spottemperaturereading",
        "action": "view",
        "Channel": channel,
        "ScreenCoordinates": f"{x},{y}",
        "ScreenResolution": resolution,
    }

    try:
        response = session.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        payload = parse_json_response(response, "spottemperaturereading")
    except Timeout:
        log(f"[{camera.camera_name}] Spot timeout at ({x},{y})")
        return None
    except PermissionError:
        raise
    except RequestException as exc:
        log(f"[{camera.camera_name}] Spot request failed at ({x},{y}): {exc}")
        return None
    except ValueError as exc:
        log(f"[{camera.camera_name}] Spot response invalid at ({x},{y}): {exc}")
        return None

    rows = payload.get("SpotTemperatureReading", [])
    if not isinstance(rows, list) or not rows:
        return None
    row = rows[0]
    if not isinstance(row, dict):
        return None

    raw_temp = row.get("Temperature")
    unit = str(row.get("Unit", "Unknown"))
    try:
        temperature = float(str(raw_temp).strip())
    except (TypeError, ValueError):
        return None
    return temperature, unit


def read_spot_temperatures(
    session: requests.Session,
    camera: CameraConfig,
    channel: int,
    points: List[Tuple[int, int]],
    resolution: str,
    max_concurrent: int,
) -> Tuple[List[float], str]:
    temperatures: List[float] = []
    unit = "Unknown"

    with ThreadPoolExecutor(max_workers=max(1, max_concurrent)) as executor:
        future_map = {
            executor.submit(read_single_spot, session, camera, channel, point, resolution): point
            for point in points
        }

        for future in as_completed(future_map):
            point = future_map[future]
            try:
                result = future.result()
            except PermissionError:
                raise
            except Exception as exc:
                log(f"[{camera.camera_name}] Spot read crashed at {point}: {exc}")
                continue

            if result is None:
                continue

            temperature, returned_unit = result
            temperatures.append(temperature)
            if unit == "Unknown":
                unit = returned_unit

    return temperatures, unit


class SunapiBoxCollector:
    def __init__(
        self,
        camera: CameraConfig,
        grid_size: int,
        resolution: str,
        max_concurrent: int,
    ) -> None:
        self.camera = camera
        self.grid_size = grid_size
        self.resolution = resolution
        self.max_concurrent = max_concurrent
        self.session = create_session(camera)
        self.cached_rois: Optional[List[RoiBox]] = None
        self.lock = threading.Lock()

    def get_rois(self) -> List[RoiBox]:
        if self.cached_rois is not None:
            return self.cached_rois

        rois = fetch_roi_boxes(self.session, self.camera)
        if rois:
            self.cached_rois = rois
        return rois

    def run_cycle(self) -> int:
        with self.lock:
            try:
                rois = self.get_rois()
            except PermissionError as exc:
                log(f"[{self.camera.camera_name}] {exc}")
                return 0
            except RequestException as exc:
                log(f"[{self.camera.camera_name}] ROI fetch failed: {exc}")
                return 0
            except ValueError as exc:
                log(f"[{self.camera.camera_name}] ROI response invalid: {exc}")
                return 0

            if not rois:
                log(f"[{self.camera.camera_name}] No ROI configured with AreaOverlay=true")
                return 0

            rows_emitted = 0
            for roi in rois:
                points = generate_grid_points(roi.x1, roi.y1, roi.x2, roi.y2, self.grid_size)
                try:
                    temperatures, unit = read_spot_temperatures(
                        self.session,
                        self.camera,
                        roi.channel,
                        points,
                        self.resolution,
                        self.max_concurrent,
                    )
                except PermissionError as exc:
                    log(f"[{self.camera.camera_name}] {exc}")
                    return rows_emitted

                if len(temperatures) < MIN_VALID_SAMPLES:
                    log(
                        f"[{self.camera.camera_name}] ROI {roi.roi}: only {len(temperatures)} "
                        f"valid samples, skipping"
                    )
                    continue

                row = {
                    "ts_utc": utc_now_iso(),
                    "camera": self.camera.camera_name,
                    "host": self.camera.host,
                    "roi": roi.roi,
                    "min_temperature": round(min(temperatures), 2),
                    "max_temperature": round(max(temperatures), 2),
                    "avg_temperature": round(mean(temperatures), 2),
                    "unit": unit,
                    "sample_count": len(temperatures),
                    "method": "sunapi_grid_sampling",
                }
                print(json.dumps(row, ensure_ascii=True), flush=True)
                rows_emitted += 1

            return rows_emitted


def validate_resolution(value: str) -> str:
    width, sep, height = value.lower().partition("x")
    if not sep or not width.isdigit() or not height.isdigit():
        raise argparse.ArgumentTypeError("resolution must be in the form WIDTHxHEIGHT")
    return f"{int(width)}x{int(height)}"


def run_collect_loop(
    collectors: List[SunapiBoxCollector],
    interval_seconds: int,
    workers: int,
    once: bool,
) -> None:
    next_tick = time.monotonic()

    while True:
        started = utc_now_iso()
        log(f"\n=== SUNAPI cycle started at {started} ===")

        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            future_map = {executor.submit(collector.run_cycle): collector for collector in collectors}
            for future in as_completed(future_map):
                collector = future_map[future]
                try:
                    emitted = future.result()
                    if emitted == 0:
                        log(f"[{collector.camera.camera_name}] No ROI row emitted in this cycle")
                except Exception as exc:
                    log(f"[{collector.camera.camera_name}] Cycle failed: {exc}")

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
        description="SUNAPI box temperature collector using ROI grid sampling"
    )
    parser.add_argument("--cameras", required=True, help="Path to camera config JSON")
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=60,
        help="Polling interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--grid-size",
        type=int,
        default=4,
        help="Grid points per axis (default: 4, total approx 16 points)",
    )
    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=8,
        help="Max concurrent spot requests per camera (default: 8)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Parallel camera workers per cycle (default: 4)",
    )
    parser.add_argument(
        "--resolution",
        type=validate_resolution,
        default="640x480",
        help="Screen resolution for SUNAPI calls (default: 640x480)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one cycle then exit",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cameras = load_cameras(args.cameras)

    collectors = [
        SunapiBoxCollector(
            camera=camera,
            grid_size=max(1, args.grid_size),
            resolution=args.resolution,
            max_concurrent=max(1, args.max_concurrent),
        )
        for camera in cameras
    ]

    log(
        f"Loaded {len(collectors)} camera(s). interval={args.interval_seconds}s, "
        f"grid={args.grid_size}x{args.grid_size}, resolution={args.resolution}"
    )
    run_collect_loop(
        collectors=collectors,
        interval_seconds=max(1, args.interval_seconds),
        workers=max(1, args.workers),
        once=args.once,
    )


if __name__ == "__main__":
    main()
