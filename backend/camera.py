"""
Camera / video source abstraction.
Tries GigE (mvsdk) first; falls back to demo video or webcam.
"""
import cv2
import numpy as np
import threading
import time
import os

DEMO_VIDEO_PATH = os.path.join(os.path.dirname(__file__), "assets", "demo_fabric.mp4")


class FrameSource:
    """Abstract base."""
    def read(self) -> tuple[bool, np.ndarray | None]:
        raise NotImplementedError

    def release(self):
        pass

    @property
    def frame_width(self) -> int:
        return 1280

    @property
    def frame_height(self) -> int:
        return 128


# ── Demo / Webcam source ──────────────────────────────────────────────────────
class DemoSource(FrameSource):
    """Reads from demo MP4 or generates a synthetic fabric texture."""

    def __init__(self, video_path: str = DEMO_VIDEO_PATH):
        self._cap = None
        self._synthetic = False
        self._w = 1280
        self._h = 128

        if os.path.exists(video_path):
            self._cap = cv2.VideoCapture(video_path)
            if self._cap.isOpened():
                self._w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                self._h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                return

        # Try webcam 0
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            self._cap = cap
            self._w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            self._h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return

        # Fully synthetic
        self._synthetic = True

    def read(self):
        if self._synthetic:
            return True, self._make_synthetic()

        ret, frame = self._cap.read()
        if not ret:
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self._cap.read()
            if not ret:
                # If still failing, fallback to synthetic
                self._synthetic = True
                return True, self._make_synthetic()
        return ret, frame

    def _make_synthetic(self) -> np.ndarray:
        """Generate a grey fabric texture frame for demo mode"""
        if not hasattr(self, '_frame_num'):
            self._frame_num = 0
        self._frame_num += 1
        
        # Base grey fabric color
        frame = np.full((self._h, self._w, 3), 185, dtype=np.uint8)
        # Add fabric texture noise
        noise = np.random.randint(-15, 15, (self._h, self._w, 3), dtype=np.int16)
        frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        # Simulate warp lines
        for x in range(0, self._w, 8):
            frame[:, x] = np.clip(frame[:, x].astype(np.int16) - 10, 0, 255)
        # Add a moving defect every 150 frames
        if (self._frame_num // 150) % 3 == 0:
            defect_x = (self._frame_num * 3) % (self._w - 50)
            defect_y = self._h // 2 + np.random.randint(-20, 20)
            cv2.ellipse(frame, (defect_x, defect_y), (25, 8), 0, 0, 360, (120, 118, 115), -1)
        return frame

    def release(self):
        if self._cap:
            self._cap.release()

    @property
    def frame_width(self):
        return self._w

    @property
    def frame_height(self):
        return self._h


# ── GigE / mvsdk source ───────────────────────────────────────────────────────
class GigESource(FrameSource):
    """MindVision GigE line-scan camera via mvsdk."""

    def __init__(self, ip: str = "", exposure: int = 5000,
                 gain: float = 1.0, line_rate: int = 10000):
        self._ok = False
        self._cam = None
        self._frame_info = None
        self._w = 1280
        self._h = 1

        try:
            import mvsdk  # type: ignore
            device_list = mvsdk.CameraEnumerateDevice()
            if not device_list:
                raise RuntimeError("No MindVision cameras found")

            dev_info = device_list[0]
            self._cam = mvsdk.CameraInit(dev_info, -1, -1)
            cap_prop = mvsdk.CameraGetCapability(self._cam)

            mvsdk.CameraSetTriggerMode(self._cam, 0)           # continuous
            mvsdk.CameraSetAeState(self._cam, 0)               # manual exposure
            mvsdk.CameraSetExposureTime(self._cam, exposure)
            mvsdk.CameraSetAnalogGain(self._cam, gain)

            # Line rate (if supported)
            try:
                mvsdk.CameraSetFrameSpeed(self._cam, line_rate)
            except Exception:
                pass

            buf_size = cap_prop.sResolutionRange.iWidthMax * cap_prop.sResolutionRange.iHeightMax * 3
            self._raw_buf = mvsdk.CameraAlignMalloc(buf_size, 16)
            self._w = cap_prop.sResolutionRange.iWidthMax
            mvsdk.CameraPlay(self._cam)
            self._ok = True
            self._mvsdk = mvsdk
        except Exception as e:
            print(f"[Camera] GigE init failed: {e}")
            self._ok = False

    @property
    def connected(self):
        return self._ok

    def read(self):
        if not self._ok:
            return False, None
        try:
            raw, frame_info = self._mvsdk.CameraGetImageBuffer(self._cam, 200)
            self._mvsdk.CameraImageProcess(self._cam, raw, self._raw_buf, frame_info)
            self._mvsdk.CameraReleaseImageBuffer(self._cam, raw)

            w = frame_info.iWidth
            h = frame_info.iHeight
            frame = np.frombuffer(
                (self._mvsdk.c_ubyte * (w * h * 3)).from_address(self._raw_buf),
                dtype=np.uint8
            ).reshape((h, w, 3)).copy()
            self._h = h
            return True, frame
        except Exception as e:
            return False, None

    def release(self):
        if self._cam:
            try:
                self._mvsdk.CameraUnInit(self._cam)
                self._mvsdk.CameraAlignFree(self._raw_buf)
            except Exception:
                pass


# ── Factory ───────────────────────────────────────────────────────────────────
def create_source(mode: str = "demo", ip: str = "",
                  exposure: int = 5000, gain: float = 1.0,
                  line_rate: int = 10000) -> FrameSource:
    if mode == "gigE":
        src = GigESource(ip=ip, exposure=exposure, gain=gain, line_rate=line_rate)
        if src.connected:
            print("[Camera] GigE source ready")
            return src
        print("[Camera] GigE unavailable, falling back to demo")
    print("[Camera] Using demo source")
    return DemoSource()
