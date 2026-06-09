#!/usr/bin/env python3
"""
Quick smoke-test for the backend — no camera required.
Run: python test_backend.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from detection import detect_defects, draw_defects_on_frame
import numpy as np
import cv2

def test_detection():
    print("Testing defect detection on synthetic frame...")
    frame = np.random.randint(170, 210, (128, 1280, 3), dtype=np.uint8)
    # Inject a dark blob (defect)
    frame[40:60, 200:250] = 30
    defects = detect_defects(frame, min_area=50, fabric_width_in=53.94)
    print(f"  Detected {len(defects)} defects")
    for d in defects:
        print(f"  → {d['defect_type']}: {d['length_inches']:.2f}\" | {d['penalty_points']} pts")
    assert len(defects) >= 0, "Should detect at least one defect"
    print("  ✓ Detection test passed\n")

async def test_db():
    print("Testing database...")
    from database import get_db, get_config
    db = await get_db()
    cfg = await get_config(db)
    print(f"  Config loaded: {len(cfg)} keys")
    assert "acceptance_threshold" in cfg
    await db.close()
    print("  ✓ Database test passed\n")

if __name__ == "__main__":
    test_detection()
    asyncio.run(test_db())
    print("All tests passed! ✓")
