# UrbanEye

**Turning public transit buses into a continuous road-defect scanning network.**

UrbanEye mounts a low-cost Android phone on a bus windshield, runs a YOLOv8 model on-device to detect potholes and other road defects in real time, and streams lightweight telemetry (not video) to a command backend that deduplicates reports spatially and estimates repair cost using PWD Schedule-of-Rates formulas. A React/Leaflet dashboard gives municipal officers a National → State → District view of road health, live defect feeds, and a bus-pairing workflow.

## Architecture

```
📱 Android Edge-AI (Kotlin, CameraX, ONNX Runtime)
        │  JSON telemetry (~2KB), not video
        ▼
⚙️ Node.js Backend (Express, Prisma, Socket.IO)
        │  spatial dedup, RHI rollups, JWT auth
        ▼
🖥️ React Command Portal (Vite, Tailwind, Leaflet)
```

| Component | Path | Stack |
|---|---|---|
| Mobile edge-AI sensor | `urbaneye-mobile/` | Kotlin, CameraX, ONNX Runtime Mobile |
| Backend API | `urbaneye-command/backend/` | Node.js, Express, Prisma (SQLite dev / Postgres-ready), Socket.IO |
| Web command dashboard | `urbaneye-command/web/` | React 18, Vite, TypeScript, Tailwind CSS, Leaflet |
| Standalone landing page | `urbaneye-landing/` | React, Vite (early prototype, superseded by the landing page embedded in `urbaneye-command/web`) |
| ML training pipeline | `urbaneye-command/ml/` | Python — dataset build, YOLOv11 fine-tuning, tracking, geometry, PCI scoring |

Deeper technical detail (sequence diagrams, detection pipeline math, cost formulas, judge Q&A) lives in [`docs/JUDGE_HANDBOOK.md`](docs/JUDGE_HANDBOOK.md). Project history and feature-by-feature change log is in [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md).

## Key capabilities

- **On-device inference** — YOLOv8 ONNX model runs locally at ~25–30 FPS; no video ever leaves the phone.
- **Temporal filtering** — a candidate must persist across 3 of 5 frames (IoU + centroid matching) before it's confirmed, to reject shadows/transient noise.
- **Offline-first sync** — undelivered telemetry is buffered in a local Room database and flushed automatically when connectivity returns.
- **Spatial deduplication** — new reports within a 15m Haversine radius of an existing unresolved defect update that record instead of creating a duplicate.
- **Cost & health scoring** — repair cost estimated from PWD/NHAI Schedule-of-Rates style formulas; a Road Health Index rolls up per district/state.
- **Role-scoped access** — National Admin / State Admin / District Head roles each see a different slice of the map and data via JWT-authenticated routes.

## Running locally

Requires Node.js 18+.

```bash
# 1. Install dependencies for both the web app and backend
npm run install:all

# 2. Backend — generate the Prisma client, push the schema, seed test data
cd urbaneye-command/backend
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev            # http://localhost:5000

# 3. Web dashboard (separate terminal)
cd urbaneye-command/web
npm run dev             # http://localhost:3000
```

**On macOS**, the AirPlay Receiver holds port 5000 and answers every request with a 403,
which looks just like a broken API. Either turn it off in System Settings → General →
AirDrop & Handoff, or run both sides on another port:

```bash
PORT=5050 npm run dev            # backend
BACKEND_PORT=5050 npm run dev    # web, proxies to it
```

The backend defaults to a local SQLite database (`DATABASE_URL=file:./dev.db`). See `render.yaml` for the current cloud deploy config, and the note in the judge handbook on the Postgres migration path for multi-instance scaling.

### Test accounts

Seeded into the database via `urbaneye-command/backend/prisma/seed.ts` (run `npm run seed`):

| Role | Email | Password | Lands on |
|---|---|---|---|
| National Admin | `admin@urbaneye.gov.in` | `UrbanEye@2026` | National Overview (all-India) |
| State Admin (Punjab) | `admin.pb@urbaneye.gov.in` | `UrbanEye@2026` | Punjab state overview |
| District Head (Kapurthala) | `head.kapurthala@urbaneye.gov.in` | `UrbanEye@2026` | Kapurthala district command |
| District Head (Jalandhar) | `head.jalandhar@urbaneye.gov.in` | `UrbanEye@2026` | Jalandhar district command |

A few additional roles (Maharashtra, Mumbai Suburban, Bengaluru Urban) exist only as an in-memory fallback in `auth.router.ts` for demo reliability — they aren't backed by real seeded DB rows. Add them to `seed.ts` before relying on them for anything beyond a login screenshot.

### Browser camera detection

The dashboard's live camera view runs the **same** `road_defect_detector.onnx` as the
Android app, executed in WebAssembly via `onnxruntime-web`. The backend serves the
weights from `GET /api/models/road-defect.onnx`, so there is one model file in the repo
and two runtimes using it. The ONNX Runtime `.wasm` binaries are copied out of
`node_modules` into `public/ort/` by `npm run copy:ort`, which `npm run dev` and
`npm run build` both invoke — they are build artifacts and are not committed.

### Mobile app

Open `urbaneye-mobile/` in Android Studio. The ONNX detection model ships in `app/src/main/assets/models/road_defect_detector.onnx`. Pair a device to the backend from the dashboard's "Pair Bus" flow using the generated 6-digit PIN.

### ML training pipeline

The scripts in `urbaneye-command/ml/` and `urbaneye-command/backend/scripts/` cover dataset preparation, YOLO fine-tuning, ByteTrack-based tracking, IPM geometry, and pavement condition scoring. The raw training dataset itself is intentionally **not** committed to this repo — it should be pulled from your dataset source (e.g. Roboflow) and placed under `ml_dataset_unified/` locally per `ml_dataset_unified/data.yaml`.

## Deployment

`render.yaml` deploys the backend + built web dashboard as a single Render web service. See the judge handbook for the current known limitation (SQLite on Render's free tier is not persistent across restarts) and the production migration path.
