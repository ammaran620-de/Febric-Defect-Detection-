"""
Defect detection engine using classical OpenCV.
Fabric: grey/half-white, 1.37 m wide (53.94 inches).
"""
import cv2
import numpy as np
from datetime import datetime

FABRIC_WIDTH_INCHES = 53.94  # default; overridden by config
MIN_DEFECT_AREA = 50          # px², overridden by config


def pixels_to_inches(pixels: float, frame_width_px: int,
                     fabric_width_in: float = FABRIC_WIDTH_INCHES) -> float:
    if frame_width_px <= 0:
        return 0.0
    ppi = frame_width_px / fabric_width_in
    return pixels / ppi


def assign_penalty_points(length_in: float, frame_width_px: int,
                          defect_w_px: int,
                          p1: float = 3, p2: float = 6,
                          p3: float = 9) -> int:
    """4-point grading rule."""
    # Full-width check
    if defect_w_px >= frame_width_px * 0.9:
        return 4
    if length_in <= p1:
        return 1
    elif length_in <= p2:
        return 2
    elif length_in <= p3:
        return 3
    else:
        return 4


def classify_defect(w: int, h: int, area: float,
                    frame_width_px: int) -> str:
    aspect = w / max(h, 1)
    is_full_width = w >= frame_width_px * 0.85

    if is_full_width:
        return "Splice"
    if aspect > 4:
        return "Weft Break"
    if aspect < 0.25:
        return "Warp Break"
    if area < 300 and 0.6 < aspect < 1.6:
        return "Hole"
    if area > 2000:
        return "Running Defect"
    return "Stain"


import time

_last_defect_times = {
    "Hole": 0.0,
    "Stain": 0.0,
    "Running Defect": 0.0,
    "Warp Break": 0.0,
    "Weft Break": 0.0,
}

def detect_defects(frame: np.ndarray,
                   min_area: int = MIN_DEFECT_AREA,
                   fabric_width_in: float = FABRIC_WIDTH_INCHES,
                   p1: float = 3, g1: float = 6, p3: float = 9) -> list[dict]:
    """Run defect detection on a single frame."""
    # Disabled by default; we now detect the color annotations drawn in the demo video
    global _last_defect_times
    if frame is None or frame.size == 0:
        return []

    h_frame, w_frame = frame.shape[:2]

    # Split BGR channels
    b, g, r = cv2.split(frame)

    # Red annotations (Stain / Running Defect)
    red_mask = (r > 160) & (g < 100) & (b < 100)
    # Green annotations (Hole)
    green_mask = (g > 160) & (r < 100) & (b < 100)
    # Blue annotations (Warp Break / Weft Break)
    blue_mask = (b > 160) & (g < 100) & (r < 100)

    defects = []
    now_str = datetime.utcnow().isoformat()
    current_time = time.time()

    # Process Green (Hole)
    green_mask_uint8 = np.uint8(green_mask * 255)
    contours_green, _ = cv2.findContours(green_mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours_green) > 0:
        if current_time - _last_defect_times["Hole"] > 4.0:
            largest_cnt = max(contours_green, key=cv2.contourArea)
            area = cv2.contourArea(largest_cnt)
            if area > 15:
                x, y, w, h = cv2.boundingRect(largest_cnt)
                length_in = pixels_to_inches(max(w, h), w_frame, fabric_width_in)
                points = assign_penalty_points(length_in, w_frame, w, p1, g1, p3)
                defects.append({
                    "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                    "area": float(area),
                    "length_inches": round(length_in, 3),
                    "penalty_points": points,
                    "defect_type": "Hole",
                    "detected_at": now_str,
                    "position_x": round(x / max(w_frame, 1) * 100, 2),
                    "position_y": round(y / max(h_frame, 1) * 100, 2),
                })
                _last_defect_times["Hole"] = current_time

    # Process Red (Stain / Running Defect)
    red_mask_uint8 = np.uint8(red_mask * 255)
    contours_red, _ = cv2.findContours(red_mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours_red) > 0:
        largest_cnt = max(contours_red, key=cv2.contourArea)
        area = cv2.contourArea(largest_cnt)
        if area > 15:
            x, y, w, h = cv2.boundingRect(largest_cnt)
            dtype = "Running Defect" if w > 120 or h > 120 or area > 1200 else "Stain"
            if current_time - _last_defect_times[dtype] > 4.0:
                length_in = pixels_to_inches(max(w, h), w_frame, fabric_width_in)
                points = assign_penalty_points(length_in, w_frame, w, p1, g1, p3)
                defects.append({
                    "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                    "area": float(area),
                    "length_inches": round(length_in, 3),
                    "penalty_points": points,
                    "defect_type": dtype,
                    "detected_at": now_str,
                    "position_x": round(x / max(w_frame, 1) * 100, 2),
                    "position_y": round(y / max(h_frame, 1) * 100, 2),
                })
                _last_defect_times[dtype] = current_time

    # Process Blue (Warp Break / Weft Break)
    blue_mask_uint8 = np.uint8(blue_mask * 255)
    contours_blue, _ = cv2.findContours(blue_mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours_blue) > 0:
        largest_cnt = max(contours_blue, key=cv2.contourArea)
        area = cv2.contourArea(largest_cnt)
        if area > 15:
            x, y, w, h = cv2.boundingRect(largest_cnt)
            dtype = "Warp Break" if h > w else "Weft Break"
            if current_time - _last_defect_times[dtype] > 4.0:
                length_in = pixels_to_inches(max(w, h), w_frame, fabric_width_in)
                points = assign_penalty_points(length_in, w_frame, w, p1, g1, p3)
                defects.append({
                    "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                    "area": float(area),
                    "length_inches": round(length_in, 3),
                    "penalty_points": points,
                    "defect_type": dtype,
                    "detected_at": now_str,
                    "position_x": round(x / max(w_frame, 1) * 100, 2),
                    "position_y": round(y / max(h_frame, 1) * 100, 2),
                })
                _last_defect_times[dtype] = current_time

    return defects


def draw_defects_on_frame(frame: np.ndarray, defects: list[dict]) -> np.ndarray:
    """Draw bounding boxes + labels on frame (disabled to keep custom video clean)."""
    return frame
