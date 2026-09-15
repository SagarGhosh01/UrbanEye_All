"""
UrbanEye — export the stock COCO model used for vehicle and pedestrian counting.

There is NO TRAINING here. YOLOv8n pretrained on COCO already detects person, bicycle,
car, motorcycle, bus and truck, which is everything the traffic and pedestrian-safety
features need. This script only downloads those published weights and re-exports them
to the ONNX contract the Android decoder expects.

Runs in seconds on CPU — a Colab T4 is not required for this one, though it does no harm.

    python export_coco_traffic_model.py

Then copy the result to:
    urbaneye-mobile/app/src/main/assets/models/coco_traffic.onnx
"""

import argparse
from pathlib import Path
import shutil

# COCO indices CocoTrafficDetector.kt maps. Listed here so the two stay in step —
# if this set changes, update cocoClassToVehicle in the Kotlin detector to match.
TRAFFIC_CLASSES = {
    0: "person      -> PEDESTRIAN",
    1: "bicycle     -> TWO_WHEELER",
    2: "car         -> CAR",
    3: "motorcycle  -> TWO_WHEELER",
    5: "bus         -> BUS",
    7: "truck       -> TRUCK",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a COCO-pretrained YOLO to UrbanEye's edge ONNX contract.")
    parser.add_argument("--model", default="yolov8n.pt", help="Pretrained COCO weights to export.")
    parser.add_argument("--imgsz", type=int, default=320, help="Must match the Kotlin decoder's inputWidth.")
    parser.add_argument("--out", default="coco_traffic.onnx")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        raise SystemExit("Install first:  pip install ultralytics onnx onnxslim")

    print(f"Loading pretrained {args.model} (downloads on first run) ...")
    model = YOLO(args.model)

    names = model.names
    print("\nClasses this build will count:")
    for idx, label in TRAFFIC_CLASSES.items():
        actual = names.get(idx, "?") if isinstance(names, dict) else "?"
        flag = "" if actual in label else f"   <-- MISMATCH: model says '{actual}'"
        print(f"  {idx:>2}  {label}{flag}")
    print("\nEvery other COCO class is ignored at decode time, not counted as traffic.")

    print(f"\nExporting to ONNX at {args.imgsz}x{args.imgsz} ...")
    exported = model.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=12,
        dynamic=False,
        simplify=True,
        nms=False,   # NMS runs on-device
    )

    destination = Path(args.out)
    shutil.copy2(exported, destination)
    size_mb = destination.stat().st_size / (1024 * 1024)

    print(f"\nExported -> {destination.resolve()}  ({size_mb:.1f} MB)")
    print("\nNEXT:")
    print("  1. Copy it to urbaneye-mobile/app/src/main/assets/models/coco_traffic.onnx")
    print("  2. CocoTrafficDetector loads it automatically; if the file is missing the app")
    print("     still runs, it just reports no vehicle counts.")
    print("  3. Confirm numClasses = 80 in CocoTrafficDetector.kt matches this export.")


if __name__ == "__main__":
    main()
