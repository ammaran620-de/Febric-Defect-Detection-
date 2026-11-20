# Magic QC: fabric roll inspection console

A desktop app for inspecting fabric rolls on a line. It reads a camera or video feed, flags defects per frame, applies the 4-point grading rule to each defect, and keeps a per-roll record with analytics and an audit log.

**Status: working prototype. The detector is a demo stand-in, not a trained model.** See [Detection](#detection) before drawing any conclusion about accuracy.

## What it does

- Live inspection page with a video feed and per-roll stats
- Roll history with export, plus analytics (summary, trends, defect heatmap, per-operator view, CSV export)
- Roles: admin, operator, viewer, each with its own permissions
- Audit log of logins, user changes and roll deletions
- Runs as an Electron desktop app, with a React front end and a FastAPI + SQLite back end

## Detection

`backend/detection.py` currently finds defects by looking for red, green and blue **annotation marks drawn onto the bundled demo video** (`backend/assets/demo_fabric.mp4`) and mapping each colour to a defect type. It does not detect real defects in unmarked fabric, and no accuracy figure applies to it.

The grading code is real and reusable: pixel length is converted to inches from the 1.37 m fabric width, and each defect gets 1 to 4 penalty points from its length, with 4 points for any defect spanning 90% of the width.

Replacing the demo detector with a trained model is the next step. The trained fabric detector in this account is [Febric-Defect](https://github.com/ammaran620-de/Febric-Defect) (YOLOv8n, TILDA images).

## Run it (Windows)

Needs Python 3.9+ and Node.js.

```
start.bat
```

This installs the back-end and front-end dependencies and starts both.

On first run the app creates an `admin` account. Set `MQC_ADMIN_PASSWORD` to choose its password, or read the random one printed once in the console. You must change it at first login. Set `MQC_SECRET_KEY` for anything other than a local demo; otherwise a random key is stored in `backend/data/secret.key`.

`python backend/test_backend.py` runs a smoke test on a synthetic frame and the database. It checks that the code runs, not that detection is correct.

## Known limits

- Demo detector only (above).
- Single machine, SQLite, no industrial camera integration beyond a camera connect call.
- Sessions use a hand-built HMAC token, not a standard JWT library.
- No automated test of grading, auth or analytics beyond the smoke test.

## Stack

React 18, Vite, Tailwind, Recharts, Electron 29, FastAPI, OpenCV, SQLite (aiosqlite).

## Author

Ammara Noor, BS Computer Engineering, NUTECH, Islamabad.
