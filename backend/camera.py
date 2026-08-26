import cv2
import threading
import time
import os


class CameraStream:
    def __init__(self, source):
        self.source = source
        safe_source = source
        if isinstance(source, str) and "@" in source:
            try:
                parts = source.split("@")
                proto_creds = parts[0]
                host_path = parts[1]
                if ":" in proto_creds:
                    proto, creds = proto_creds.rsplit(":", 1)
                    if "//" in proto:
                        scheme, user = proto.split("//", 1)
                        safe_source = f"{scheme}//{user}:***@{host_path}"
            except Exception:
                safe_source = "rtsp://***"
        print("Camera source initialized:", safe_source)

        self.is_image = isinstance(source, str) and source.lower().endswith((".jpg", ".jpeg", ".png"))
        self.is_video = isinstance(source, str) and os.path.isfile(source) and not self.is_image

        self.cap = None
        self.frame = None
        self.ret = False
        self.running = True
        self._frame_id = 0
        self.lock = threading.Lock()

        # Initial connection setup
        self._init_cap()

        # Start thread immediately without blocking main thread
        self.thread = threading.Thread(target=self.update, daemon=True)
        self.thread.start()

    @property
    def frame_id(self) -> int:
        with self.lock:
            return self._frame_id

    def _init_cap(self):
        if self.is_image:
            img = cv2.imread(self.source)
            with self.lock:
                if img is not None:
                    self.frame = img
                    self.ret = True
                    self._frame_id += 1
            return

        try:
            if self.cap is not None:
                self.cap.release()
        except Exception:
            pass

        try:
            if isinstance(self.source, str) and self.source.startswith("rtsp://"):
                self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            else:
                self.cap = cv2.VideoCapture(self.source)

            if self.cap is not None and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception as e:
            print("Failed to initialize camera source:", e)
            self.cap = None

    def reconnect(self):
        if self.is_image:
            return
        print("Reconnecting camera source...")
        self._init_cap()
        time.sleep(1)

    def update(self):
        while self.running:
            if self.is_image:
                time.sleep(0.03)
                continue

            if self.cap is None or not self.cap.isOpened():
                self.reconnect()
                time.sleep(0.2)
                continue

            try:
                ret, frame = self.cap.read()
            except Exception as error:
                print("OpenCV read exception:", error)
                ret, frame = False, None

            if ret and frame is not None:
                with self.lock:
                    self.frame = frame
                    self.ret = True
                    self._frame_id += 1

                # Pace background read loop based on source type
                if self.is_video:
                    fps = 30.0
                    if self.cap is not None:
                        try:
                            vid_fps = self.cap.get(cv2.CAP_PROP_FPS)
                            if vid_fps > 0:
                                fps = vid_fps
                        except Exception:
                            pass
                    time.sleep(1.0 / fps)
                else:
                    # Original behavior for live RTSP cameras
                    time.sleep(0.01)
            else:
                with self.lock:
                    self.ret = False

                if self.is_video:
                    self._init_cap()  # Reopen the video robustly on EOF
                    time.sleep(0.03)
                    continue

                self.reconnect()
                time.sleep(0.5)

    def read_with_id(self):
        """Atomic read returning (ret, frame, frame_id) under lock."""
        with self.lock:
            if not self.ret or self.frame is None:
                return False, None, self._frame_id
            return True, self.frame.copy(), self._frame_id

    def read(self):
        ret, frame, _ = self.read_with_id()
        return ret, frame

    def release(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=1.0)

        if self.cap is not None and self.cap.isOpened():
            try:
                self.cap.release()
            except Exception:
                pass