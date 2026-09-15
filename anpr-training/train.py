#!/usr/bin/env python3
"""
Indian License Plate Detector - Standalone Training Pipeline
===========================================================
Model: YOLOv8n (Bounding box detection only, no OCR)
Architecture consistent with UrbanEye's existing road defect detector (best_float32.onnx).
Exports: plate_detector.onnx (and best_float32.onnx)

Training Command Equivalent:
    yolo detect train data=plates.yaml model=yolov8n.pt epochs=100 imgsz=640 batch=16

Export Command Equivalent:
    yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=640
"""

import os
import sys
import shutil
import argparse
from pathlib import Path

def check_environment():
    """Detects compute hardware and provides warnings/recommendations."""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if cuda_available else "None"
        mps_available = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    except ImportError:
        cuda_available = False
        mps_available = False
        gpu_name = "None"

    print("=" * 80)
    print(" HARDWARE & ENVIRONMENT CHECK")
    print("=" * 80)
    print(f" Python Version : {sys.version.split()[0]}")
    if cuda_available:
        print(f" Hardware       : NVIDIA CUDA GPU ({gpu_name})")
        print(" Status         : Ready for full-speed local training.")
        default_device = "0"
    elif mps_available:
        print(" Hardware       : Apple Silicon MPS (Metal Performance Shaders)")
        print(" Status         : Hardware acceleration available.")
        default_device = "mps"
    else:
        print(" Hardware       : CPU ONLY (No CUDA GPU detected)")
        print(" NOTE: Training 100 epochs on CPU may take 4-8+ hours.")
        print("       Recommended actions:")
        print("       1. Use the included Google Colab notebook for free T4 GPU training:")
        print("          anpr_plate_detection_colab.ipynb (takes ~15-20 min)")
        print("       2. Or lower epochs locally for testing: --epochs 5 --batch 4")
        default_device = "cpu"
    print("=" * 80)
    return default_device, cuda_available

def run_training(
    data_yaml: str = "plates.yaml",
    model_name: str = "yolov8n.pt",
    epochs: int = 100,
    imgsz: int = 640,
    batch: int = 16,
    device: str = "",
    project: str = "runs/detect",
    name: str = "plate_train",
    export_onnx: bool = True,
    output_onnx: str = "plate_detector.onnx"
):
    """Executes YOLOv8n detector training and exports ONNX model."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[!] Ultralytics not installed. Install via: pip install -r requirements.txt")
        sys.exit(1)

    yaml_path = Path(data_yaml)
    if not yaml_path.exists():
        print(f"[!] Error: Dataset configuration '{data_yaml}' not found!")
        print("    Run 'python download_dataset.py' to download an Indian license plate dataset,")
        print("    or run 'python download_dataset.py --generate-synthetic' for a dry-run test.")
        sys.exit(1)

    default_device, has_gpu = check_environment()
    target_device = device if device else default_device

    print(f"\n[*] Initializing YOLOv8n architecture with pretrained weights '{model_name}'...")
    model = YOLO(model_name)

    print("\n[*] Starting License Plate Detector Training...")
    print(f"    - Data config : {yaml_path.resolve()}")
    print(f"    - Model arch  : {model_name}")
    print(f"    - Epochs      : {epochs}")
    print(f"    - Image size  : {imgsz}x{imgsz}")
    print(f"    - Batch size  : {batch}")
    print(f"    - Device      : {target_device}")
    print(f"    - Output dir  : {project}/{name}\n")

    # Run training
    results = model.train(
        data=str(yaml_path.resolve()),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=target_device,
        project=project,
        name=name,
        exist_ok=True,
        plots=True,
        save=True,
        verbose=True
    )

    # Locate best checkpoint
    save_dir = Path(model.trainer.save_dir) if hasattr(model, "trainer") and model.trainer else Path(project) / name
    best_pt = save_dir / "weights" / "best.pt"

    if not best_pt.exists():
        print(f"[!] Warning: {best_pt} not found. Searching in {save_dir}...")
        pt_files = list(save_dir.glob("**/*.pt"))
        if pt_files:
            best_pt = pt_files[0]
        else:
            print("[!] Could not find trained weights (.pt) file.")
            return

    print("\n" + "=" * 80)
    print(" TRAINING COMPLETED SUCCESSFULLY")
    print("=" * 80)
    print(f" Best Weights Checkpoint : {best_pt.resolve()}")

    # Print Validation Metrics
    try:
        metrics = model.val()
        map50 = metrics.box.map50 if hasattr(metrics.box, "map50") else 0.0
        map50_95 = metrics.box.map if hasattr(metrics.box, "map") else 0.0
        precision = metrics.box.mp if hasattr(metrics.box, "mp") else 0.0
        recall = metrics.box.mr if hasattr(metrics.box, "mr") else 0.0
        print(f" Validation mAP@0.5      : {map50:.4f}")
        print(f" Validation mAP@0.5:0.95 : {map50_95:.4f}")
        print(f" Precision               : {precision:.4f}")
        print(f" Recall                  : {recall:.4f}")
    except Exception as e:
        print(f" [i] Validation metrics note: {e}")

    # Export to ONNX
    if export_onnx:
        print("\n[*] Exporting trained weights to ONNX format (imgsz=640, static mobile graph)...")
        # Load best model for clean export
        best_model = YOLO(str(best_pt))
        exported_path = best_model.export(
            format="onnx",
            imgsz=imgsz,
            dynamic=False,  # Fixed shape [1, 3, 640, 640] is optimal for ONNX Runtime Mobile
            opset=12,
            simplify=True
        )

        exported_onnx_file = Path(exported_path)
        final_output = Path(output_onnx)

        # Copy to output_onnx (plate_detector.onnx)
        shutil.copyfile(exported_onnx_file, final_output)
        
        # Also copy as best_float32.onnx to match repo convention
        shutil.copyfile(exported_onnx_file, "best_float32.onnx")

        file_size_mb = final_output.stat().st_size / (1024 * 1024)
        print("=" * 80)
        print(" ONNX EXPORT READY FOR MOBILE DEPLOYMENT")
        print("=" * 80)
        print(f" Primary Target : {final_output.resolve()} ({file_size_mb:.2f} MB)")
        print(f" Secondary Copy : best_float32.onnx ({file_size_mb:.2f} MB)")
        print("\nNext Steps:")
        print("1. Sanity-check detections with the validation script:")
        print(f"   python validate_onnx.py --model {final_output.name} --images test_images/")
        print("2. Copy to Android app assets directory:")
        print(f"   cp {final_output.name} ../urbaneye-mobile/app/src/main/assets/models/")
        print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8n Indian License Plate Detector & Export ONNX")
    parser.add_argument("--data", type=str, default="plates.yaml", help="Path to plates.yaml dataset configuration")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model weights (yolov8n.pt)")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs (default: 100)")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference and training image resolution (default: 640)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--device", type=str, default="", help="Device: '0' (CUDA GPU), 'cpu', 'mps'")
    parser.add_argument("--no-export", action="store_true", help="Skip automatic ONNX export after training")
    parser.add_argument("--output", type=str, default="plate_detector.onnx", help="Final ONNX export filename")
    args = parser.parse_args()

    run_training(
        data_yaml=args.data,
        model_name=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        export_onnx=not args.no_export,
        output_onnx=args.output
    )

if __name__ == "__main__":
    main()
