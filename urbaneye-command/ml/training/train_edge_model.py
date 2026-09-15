"""
UrbanEye — Edge model training and ONNX export for the Android app.

Targets the phone, not a server: YOLOv8n at 320x320, exported with the exact ONNX
contract OnnxRoadDefectDetector.kt expects. Run on a Colab T4.

The export contract is not negotiable — the Android decoder was written against it:
  * input   "images", shape [1, 3, 320, 320], FP32, values normalised to [0, 1]
  * output  "output0", shape [1, 4 + nc, anchors]  (NMS is applied on-device, not in the graph)
  * opset   12, static shapes, simplified

After training, this prints the exact Kotlin `when` block for the class mapping.
Paste it in rather than writing it by hand — a mismatched mapping is silent: the model
keeps returning confident detections, they just carry the wrong label. That bug shipped
once already (waterlogging was being reported for faded lane markings).
"""

import argparse
import shutil
from pathlib import Path

import yaml

# Kotlin type names, keyed by the unified class name from prepare_dataset.py.
# These must match the codes the backend and detectionCategories.ts already handle.
KOTLIN_TYPE_FOR = {
    "longitudinal_crack": "LONGITUDINAL_CRACK",
    "transverse_crack": "TRANSVERSE_CRACK",
    "alligator_crack": "ALLIGATOR_CRACK",
    "pothole": "POTHOLE",
    "faded_zebra_crossing": "FADED_ZEBRA_CROSSING",
    "faded_lane_marking": "FADED_LANE_MARKING",
    "utility_cover": "UTILITY_COVER",
    "waterlogging": "WATERLOGGING",
    "damaged_signboard": "DAMAGED_SIGNBOARD",
    "traffic_sign": "TRAFFIC_SIGN",
    "road_divider": "ROAD_DIVIDER",
}


def read_class_names(data_yaml: Path) -> list[str]:
    cfg = yaml.safe_load(data_yaml.read_text())
    names = cfg["names"]
    if isinstance(names, dict):
        return [names[k] for k in sorted(names, key=int)]
    return list(names)


def emit_kotlin_mapping(class_names: list[str]) -> str:
    lines = ["                        val mappedType = when (maxClassIdx) {"]
    for idx, name in enumerate(class_names):
        kotlin_type = KOTLIN_TYPE_FOR.get(name)
        if kotlin_type is None:
            lines.append(f'                            {idx} -> "UNKNOWN" // TODO: no Kotlin type for "{name}"')
        else:
            lines.append(f'                            {idx} -> "{kotlin_type}"')
    lines.append("                            else -> \"SURFACE_DAMAGE\"")
    lines.append("                        }")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and export UrbanEye's on-device road model.")
    parser.add_argument("--data", required=True, help="Path to the unified data.yaml from prepare_dataset.py")
    parser.add_argument("--base-model", default="yolov8n.pt", help="yolov8n.pt (edge) or yolo11n.pt")
    parser.add_argument("--epochs", type=int, default=120)
    parser.add_argument("--imgsz", type=int, default=320, help="Must stay 320 unless the Kotlin decoder changes.")
    parser.add_argument("--batch", type=int, default=64, help="64 fits a T4 at 320px with yolov8n.")
    parser.add_argument("--device", default="0")
    parser.add_argument("--project", default="runs/urbaneye_edge")
    parser.add_argument("--name", default="unified_v1")
    parser.add_argument("--export-to", default="road_defect_detector.onnx")
    parser.add_argument("--skip-train", action="store_true", help="Export only, from --weights.")
    parser.add_argument("--weights", default=None, help="Existing .pt to export when using --skip-train.")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        raise SystemExit("Install first:  pip install ultralytics onnx onnxslim onnxruntime")

    data_yaml = Path(args.data)
    class_names = read_class_names(data_yaml)
    nc = len(class_names)

    print("=" * 68)
    print(f"Classes ({nc}):")
    for i, n in enumerate(class_names):
        print(f"  {i:>2}  {n}")
    print("=" * 68)

    if args.skip_train:
        if not args.weights:
            raise SystemExit("--skip-train requires --weights pointing at a trained .pt")
        best_weights = Path(args.weights)
    else:
        model = YOLO(args.base_model)
        model.train(
            data=str(data_yaml),
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            device=args.device,
            project=args.project,
            name=args.name,
            patience=25,
            # Road-scene augmentation: a windshield camera sees glare, rain and dusk,
            # and the bus is always moving, so motion blur and exposure shift matter
            # more than the vertical flips a generic recipe would apply.
            hsv_h=0.015, hsv_s=0.7, hsv_v=0.5,
            degrees=3.0, translate=0.1, scale=0.45, shear=2.0, perspective=0.0005,
            flipud=0.0, fliplr=0.5, mosaic=1.0, mixup=0.1,
        )
        best_weights = Path(args.project) / args.name / "weights" / "best.pt"

    print(f"\nValidating {best_weights} ...")
    trained = YOLO(str(best_weights))
    metrics = trained.val(data=str(data_yaml), imgsz=args.imgsz, device=args.device)

    print("\nPer-class mAP50-95 — anything near zero has too little data to ship:")
    try:
        for i, name in enumerate(class_names):
            print(f"  {i:>2}  {name:<24} {metrics.box.maps[i]:.3f}")
    except (AttributeError, IndexError):
        print("  (per-class metrics unavailable; check the run directory)")

    print("\nExporting ONNX with the Android decoder's contract ...")
    onnx_path = trained.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=12,
        dynamic=False,   # the Kotlin decoder reads a fixed anchor count
        simplify=True,
        nms=False,       # NMS runs on-device in applyNms()
    )

    destination = Path(args.export_to)
    shutil.copy2(onnx_path, destination)
    print(f"Exported -> {destination.resolve()}")

    print("\n" + "=" * 68)
    print("NEXT: copy the .onnx to")
    print("  urbaneye-mobile/app/src/main/assets/models/road_defect_detector.onnx")
    print(f"\nThen set  numClasses = {nc}  in OnnxRoadDefectDetector.kt and paste this mapping:\n")
    print(emit_kotlin_mapping(class_names))
    print("\nAlso add any new category to web/src/constants/detectionCategories.ts")
    print("with phase: 1, and give it a metrics branch in backend events.router.ts.")
    print("=" * 68)


if __name__ == "__main__":
    main()
