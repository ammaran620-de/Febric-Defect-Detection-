"""Seed demo rolls and defects into the database for testing."""
import asyncio
import random
from datetime import datetime, timedelta
import sys
sys.path.insert(0, ".")
from database import get_db

DEFECT_TYPES = ["Hole", "Stain", "Weft Break", "Warp Break", "Running Defect", "Splice"]

async def seed():
    db = await get_db()
    print("Seeding demo data...")

    for i in range(20):
        dt_start = datetime.utcnow() - timedelta(days=random.randint(0, 14),
                                                  hours=random.randint(0, 23))
        fabric_len = random.uniform(50, 200)
        total_pts = random.randint(5, 70)
        threshold = 40.0
        pts100 = (total_pts / (1.37 * fabric_len * 1.19599)) * 100
        result = "PASSED" if pts100 <= threshold else "FAILED"
        roll_id = f"ROLL-{dt_start.strftime('%Y%m%d')}-{str(i+1).zfill(3)}"

        try:
            await db.execute(
                """INSERT OR IGNORE INTO rolls
                   (roll_id, operator, start_time, end_time,
                    fabric_length_m, total_points, points_per_100sqyd,
                    threshold_used, result)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (roll_id, "Demo Operator",
                 dt_start.isoformat(),
                 (dt_start + timedelta(minutes=random.randint(20, 90))).isoformat(),
                 round(fabric_len, 2), total_pts,
                 round(pts100, 4), threshold, result)
            )
        except Exception:
            continue

        # Seed defects
        num_defects = random.randint(2, 15)
        for j in range(num_defects):
            dtype = random.choice(DEFECT_TYPES)
            length_in = random.uniform(1.0, 12.0)
            pts = 1 if length_in <= 3 else 2 if length_in <= 6 else 3 if length_in <= 9 else 4
            await db.execute(
                """INSERT INTO defects
                   (roll_id, detected_at, defect_type, length_inches,
                    penalty_points, position_x, position_y, frame_number)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (roll_id,
                 (dt_start + timedelta(seconds=j*30)).isoformat(),
                 dtype, round(length_in, 2), pts,
                 random.uniform(0, 100), random.uniform(0, 100),
                 j * 150)
            )

    await db.commit()
    await db.close()
    print(f"Seeded 20 demo rolls")

if __name__ == "__main__":
    asyncio.run(seed())
