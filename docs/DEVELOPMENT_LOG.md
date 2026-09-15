# UrbanEye — Development Log

A running record of feature work and fixes, grouped by theme. For architecture and setup, see the root [`README.md`](../README.md). For the detection pipeline, cost formulas, and judge Q&A, see [`JUDGE_HANDBOOK.md`](JUDGE_HANDBOOK.md).

## Deployment

- Configured `render.yaml` to deploy the backend + built web dashboard as a single Render web service.
- Fixed several Render-specific build issues: implicit `any` TypeScript errors, missing `devDependencies` in the root install script, portable dataset/script paths, and `io`/`getIO` exports needed by the router build.
- Added a keep-alive heartbeat and frontend cold-start auto-retry to smooth over Render free-tier cold starts.

## Mobile app (`urbaneye-mobile/`)

- Fixed cleartext traffic / network security config so the app can reach a local dev backend during testing.
- Corrected defect label mapping so craters/holes/depressions classify as `POTHOLE` rather than the generic `SURFACE_DAMAGE` bucket.
- Made `numAnchors` dynamic from the model's actual output shape instead of hardcoding it, so the detector isn't tied to one YOLOv8 export.
- `TemporalDetectionTracker.kt` was silently dropping `estimatedDiameterCm` / `estimatedRepairCost` when promoting a candidate to a confirmed track — fixed so those fields survive into every emitted detection.
- Lowered the confidence threshold (0.25 → 0.15 → 0.12) for better real-world road sensitivity, based on field testing.
- Added a live on-screen detection banner (`🚧 POTHOLE XX% Ø XX cm Fix: ₹X,XXX`) and HUD status line.
- Iterated on the edge-AI camera UI: viewfinder layout, manual snap, torch toggle, scanning overlays, confidence sparkline, false-positive dismiss button, indoor/non-road scene rejection, and CPU-friendly downsampled frame analysis.

## Backend (`urbaneye-command/backend/`)

- **Deduplication**: active bus counts were double-counting stale sessions — fixed to group by unique bus label. Event ingestion deduplicates reports within a 15m / 24h Haversine radius so repeat passes over the same pothole don't create duplicate records.
- **Session management**: added `DELETE /api/pairing/sessions/:id` so an officer can unpair/reset a stuck bus session, both in-memory and in the DB.
- **Ingestion robustness**: normalized incoming payload aliases (lat/lon, confidence, defect type naming) so the mobile APK and the in-browser camera capture path both land in the same pipeline; added session auto-creation and lat/lon sanitization to remove a class of HTTP 500s.
- **Citizen reporting**: added a citizen-facing reporting flow (Leaflet map picker, photo capture) that feeds the same authority dashboard as bus-sensor events, with server-side photo storage instead of only inline base64.
- **Single source of truth for categories**: `constants/detectionCategories.ts` now holds all 11 detection categories (5 live, 6 reserved for future phases) with color, display name, and priority — consumed by the map, table, and Android overlay instead of duplicated switch-statements. Red/rose are reserved exclusively for future incident/ANPR categories; no live category uses them.

## Web dashboard (`urbaneye-command/web/`)

- **Information architecture**: added a National Overview screen (India-level Road Health Index choropleth + sortable state table) as the first screen after login for Ministry/National roles; District Heads bypass it and land directly in their district's command view.
- **District Command redesign**: collapsed a cluttered multi-bar header into one calm header, made the Road Health Index the hero KPI, replaced the solid map legend with a frosted-glass overlay, and gave the ingestion feed a "listening" state instead of an empty/error state while waiting for telemetry.
- **Theming**: restored a dark-mode-first landing page with a persisted light/dark toggle (`localStorage`), themed every landing section and the footer consistently.
- **Mobile-first pass**: rewrote the header, National/State overview, analytics panel, live map, defect table, and both modals for phone-width use — 44px touch targets, safe-area insets, bottom-sheet modals, segmented view switchers instead of side-by-side panels, `ResizeObserver`-driven Leaflet resizing, and 16px+ input font sizes to stop iOS auto-zoom.
- **Login**: added a password show/hide toggle.

## Machine learning (`urbaneye-command/ml/`, `backend/scripts/`)

- Built the end-to-end pipeline referenced by the mobile detector: dataset unification/splitting, YOLOv8/YOLOv11 fine-tuning, an inference hardener, TensorRT export, and a validation/benchmark script.
- Added supporting modules for a fuller perception stack: IMU sensor fusion, a ByteTrack-based multi-object tracker, IPM (inverse perspective mapping) 3D geometry via RANSAC, and a municipal Pavement Condition Index (PCI) rating engine.

> Note: several of these ML modules (IMU fusion, ByteTrack, IPM geometry, PCI) are scaffolded and callable but not yet wired into the live mobile inference path the way the core YOLOv8 pothole detector is — verify what's actually running end-to-end before claiming a feature live to judges.
