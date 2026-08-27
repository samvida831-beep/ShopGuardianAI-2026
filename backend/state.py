import threading
from datetime import datetime


class FrameBuffer:
    def __init__(self):
        self._lock = threading.Lock()
        self._jpeg_bytes = {1: None, 2: None}
        self._frame_id = {1: 0, 2: 0}

    def set_frame(self, camera_id: int, frame_jpeg_bytes: bytes):
        with self._lock:
            self._jpeg_bytes[camera_id] = frame_jpeg_bytes
            self._frame_id[camera_id] += 1

    def get_jpeg(self, camera_id: int):
        with self._lock:
            return self._jpeg_bytes.get(camera_id), self._frame_id.get(camera_id, 0)


latest_frames = FrameBuffer()

shop_state = {
    "occupied": False,
    "shop_status": "Empty",

    "customer_count": 0,

    "last_detection": "",

    "camera1": "Offline",
    "camera2": "Offline",

    "recent_activity": [],

    "latest_snapshot": "",

    "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}