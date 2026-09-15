#!/usr/bin/env python3
"""
Standalone ONNX Exporter for YOLOv8 License Plate Detector
==========================================================
Exports PyTorch weights (.pt) to mobile-optimized static ONNX format
matching UrbanEye's edge inference specifications (Float32, imgsz=640).

Export Command Equivalent:
    yolo export model=best.pt format=onnx imgsz=640

Outputs:
    - plate_detector.onnx
    - best_float32.onnx
"""

import sys
import shutil
import argparse
from pathlib import Path

def export_to_onnx(
    weights_path: str,
    output_name: str = "plate_detector.onnx",
    imgsz: int = 640,
    opset: int = 12,
    simplify: bool = True
):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[!] Ultralytics not found. Run: pip install ultralytics")
        sys.exit(1)

    pt_file = Path(weights_path)
    if not pt_file.exists() and not weights_path.startswith("yolo"):
        print(f"[!] Checkpoint file not found: {weights_path}")
        sys.exit(1)

    print("=" * 80)
    print(" EXPORTING YOLOV8 WEIGHTS TO ONNX")
    print("=" * 80)
    print(f" Source Weights : {pt_file.resolve()}")
    print(f" Image Size     : {imgsz}x{imgsz}")
    print(f" Target File    : {output_name}")
    print(f" Opset Version  : {opset}")
    print(f" Simplified     : {simplify}")

    model = YOLO(str(pt_file))

    # Export with static input shape [1, 3, 640, 640]
    exported_file = model.export(
        format="onnx",
        imgsz=imgsz,
        dynamic=False,
        opset=opset,
        simplify=simplify
    )

    exported_path = Path(exported_file)
    target_path = Path(output_name)
    shutil.copyfile(exported_path, target_path)
    shutil.copyfile(exported_path, "best_float32.onnx")

    # Inspect ONNX model metadata if onnx is installed
    try:
        import onnx
        onnx_model = onnx.load(str(target_path))
        onnx.checker.check_model(onnx_model)
        
        # Get input / output tensor shapes
        inputs = [(inp.name, [dim.dim_value for dim in inp.type.tensor_type.shape.dim]) for inp in onnx_model.graph.input]
        outputs = [(out.name, [dim.dim_value for dim in out.type.tensor_type.shape.dim]) for out in onnx_model.graph.output]

        print("\n[+] ONNX Model Graph Validation Passed:")
        print(f"    Inputs  : {inputs}")
        print(f"    Outputs : {outputs}")
    except ImportError:
        pass
    except Exception as e:
        print(f"[!] ONNX inspection note: {e}")

    size_mb = target_path.stat().st_size / (1024 * 1024)
    print("\n" + "=" * 80)
    print(f" EXPORT SUCCESSFUL: {target_path.resolve()} ({size_mb:.2f} MB)")
    print(f" Mirror Copy      : best_float32.onnx ({size_mb:.2f} MB)")
    print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Export YOLOv8 PyTorch checkpoint to ONNX")
    parser.add_argument("--weights", type=str, default="runs/detect/plate_train/weights/best.pt", help="Path to best.pt")
    parser.add_argument("--output", type=str, default="plate_detector.onnx", help="Output filename for ONNX model")
    parser.add_argument("--imgsz", type=int, default=640, help="Export input resolution (default: 640)")
    parser.add_argument("--opset", type=int, default=12, help="ONNX opset version (default: 12)")
    args = parser.parse_args()

    export_to_onnx(
        weights_path=args.weights,
        output_name=args.output,
        imgsz=args.imgsz,
        opset=args.opset
    )

if __name__ == "__main__":
    main()
