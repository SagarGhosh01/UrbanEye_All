#!/usr/bin/env python3
"""
Roboflow Universe Dataset Downloader & Setup Guide for Indian License Plate Detection
------------------------------------------------------------------------------------
This script facilitates downloading an Indian license plate dataset from Roboflow Universe
formatted for YOLOv8 bounding-box detection (single class: 'license_plate').

Search keywords on Roboflow Universe (https://universe.roboflow.com):
- "Indian license plate detection"
- "ANPR India"
- "Indian vehicle number plate"
- "Indian car license plate"

Usage:
  # Via Roboflow Python SDK (Interactive or with arguments):
  python download_dataset.py --api-key YOUR_API_KEY --project PROJECT_NAME --version 1

  # Or set environment variables:
  export ROBOFLOW_API_KEY="your_api_key_here"
  python download_dataset.py --workspace WORKSPACE_NAME --project PROJECT_NAME --version 1

  # To generate a small synthetic dataset for local pipeline dry-runs:
  python download_dataset.py --generate-synthetic
"""

import os
import sys
import argparse
import shutil
from pathlib import Path

def print_manual_instructions():
    print("=" * 80)
    print(" MANUAL DATASET DOWNLOAD INSTRUCTIONS (NO API KEY REQUIRED)")
    print("=" * 80)
    print("""
1. Go to Roboflow Universe: https://universe.roboflow.com
2. In the search bar, search for:
   - "Indian license plate detection"
   - "ANPR India"
   - "Indian vehicle number plate"
3. Select a dataset with good coverage of Indian standard plates (white/yellow plates,
   high contrast, diverse lighting conditions and angles).
4. Click "Download Dataset" (top right).
5. Choose export format: "YOLOv8" (NOT YOLOv5 or COCO).
6. Choose "download zip to computer" or copy the provided cURL / Roboflow SDK snippet.
7. Unzip the downloaded folder into:
   anpr-training/dataset/
   
   The directory should have this structure:
   anpr-training/
     dataset/
       train/
         images/
         labels/
       valid/ (or val/)
         images/
         labels/
       test/
         images/
         labels/
       data.yaml
8. Copy or adapt dataset/data.yaml to plates.yaml using:
   python download_dataset.py --sync-yaml
""")
    print("=" * 80)

def sync_roboflow_yaml(dataset_dir: Path, target_yaml: Path = Path("plates.yaml")):
    """Inspects downloaded Roboflow data.yaml and adapts it to plates.yaml."""
    src_yaml = dataset_dir / "data.yaml"
    if not src_yaml.exists():
        # Check parent or subdirectories
        yaml_candidates = list(dataset_dir.glob("*.yaml")) + list(dataset_dir.glob("*/*.yaml"))
        if yaml_candidates:
            src_yaml = yaml_candidates[0]
        else:
            print(f"[!] Warning: Could not find data.yaml in {dataset_dir}. Generating template plates.yaml...")
            shutil.copyfile("plates.yaml.example", target_yaml)
            return

    try:
        import yaml
        with open(src_yaml, "r") as f:
            data = yaml.safe_load(f)

        # Standardize paths
        data["path"] = str(dataset_dir.resolve())
        if "train" in data and not os.path.isabs(str(data["train"])):
            data["train"] = str((dataset_dir / data["train"]).resolve())
        if "val" in data and not os.path.isabs(str(data["val"])):
            data["val"] = str((dataset_dir / data["val"]).resolve())
        if "test" in data and not os.path.isabs(str(data["test"])):
            data["test"] = str((dataset_dir / data["test"]).resolve())

        # Ensure single class label consistency
        data["nc"] = 1
        data["names"] = {0: "license_plate"}

        with open(target_yaml, "w") as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        print(f"[+] Successfully adapted {src_yaml.name} -> {target_yaml.resolve()}")
    except Exception as e:
        print(f"[!] Error syncing YAML: {e}. Falling back to default plates.yaml template.")
        shutil.copyfile("plates.yaml.example", target_yaml)

def download_via_roboflow(api_key: str, workspace: str, project: str, version: int, dest_dir: Path):
    """Downloads dataset using the official roboflow Python SDK."""
    try:
        from roboflow import Roboflow
    except ImportError:
        print("[!] 'roboflow' package not installed. Installing via pip...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "roboflow"])
        from roboflow import Roboflow

    print(f"[*] Connecting to Roboflow Universe ({workspace}/{project} v{version})...")
    rf = Roboflow(api_key=api_key)
    proj = rf.workspace(workspace).project(project)
    ver = proj.version(version)
    
    print(f"[*] Downloading YOLOv8 export to {dest_dir}...")
    dataset = ver.download("yolov8", location=str(dest_dir.resolve()))
    print(f"[+] Download complete at: {dataset.location}")
    sync_roboflow_yaml(dest_dir)

def generate_synthetic_dataset(dest_dir: Path):
    """Generates a small synthetic dataset for verifying the pipeline without a large download."""
    print(f"[*] Generating synthetic test dataset at {dest_dir} for dry-run validation...")
    try:
        from PIL import Image, ImageDraw
        import numpy as np
    except ImportError:
        print("[!] Pillow/numpy required for synthetic dataset generation.")
        return

    splits = ["train", "val", "test"]
    counts = {"train": 16, "val": 4, "test": 4}

    for split in splits:
        img_dir = dest_dir / "images" / split
        lbl_dir = dest_dir / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        for i in range(counts[split]):
            # Create synthetic car & plate image (640x640)
            img = Image.new("RGB", (640, 640), color=(100 + (i * 5) % 80, 110 + (i * 7) % 80, 120 + (i * 3) % 80))
            draw = ImageDraw.Draw(img)

            # Draw car bumper/body
            draw.rectangle([80, 200, 560, 520], fill=(40, 45, 55), outline=(20, 20, 20), width=3)
            draw.ellipse([100, 450, 200, 550], fill=(15, 15, 15)) # Left wheel
            draw.ellipse([440, 450, 540, 550], fill=(15, 15, 15)) # Right wheel

            # Plate coords (x1, y1, x2, y2)
            px1, py1, px2, py2 = 230, 360, 410, 410
            # Draw white plate with yellow/black border typical of Indian plates
            draw.rectangle([px1, py1, px2, py2], fill=(245, 245, 245), outline=(10, 10, 10), width=3)
            # Add blue IND stripe
            draw.rectangle([px1, py1, px1 + 22, py2], fill=(20, 50, 180))

            # Draw mock plate characters
            draw.line([px1 + 35, py1 + 25, px2 - 20, py1 + 25], fill=(20, 20, 20), width=6)

            img_path = img_dir / f"synthetic_{split}_{i:03d}.jpg"
            img.save(img_path, "JPEG")

            # YOLO bounding box: class x_center y_center width height (normalized)
            cx = ((px1 + px2) / 2.0) / 640.0
            cy = ((py1 + py2) / 2.0) / 640.0
            w = (px2 - px1) / 640.0
            h = (py2 - py1) / 640.0

            lbl_path = lbl_dir / f"synthetic_{split}_{i:03d}.txt"
            with open(lbl_path, "w") as f:
                f.write(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")

    # Create plates.yaml
    yaml_content = f"""# Synthetic Indian License Plate Dataset Configuration
path: {str(dest_dir.resolve())}
train: images/train
val: images/val
test: images/test

nc: 1
names:
  0: license_plate
"""
    with open("plates.yaml", "w") as f:
        f.write(yaml_content)

    print(f"[+] Synthetic dataset generated successfully in {dest_dir}!")
    print("[+] Created plates.yaml pointing to synthetic dataset.")

def main():
    parser = argparse.ArgumentParser(description="Download & prepare Indian license plate dataset for YOLOv8")
    parser.add_argument("--api-key", type=str, default=os.getenv("ROBOFLOW_API_KEY"), help="Roboflow API key")
    parser.add_argument("--workspace", type=str, default="roboflow-100", help="Roboflow workspace name")
    parser.add_argument("--project", type=str, default=None, help="Roboflow project name (e.g. indian-license-plates)")
    parser.add_argument("--version", type=int, default=1, help="Roboflow dataset version number")
    parser.add_argument("--dest", type=str, default="./dataset", help="Target download directory")
    parser.add_argument("--sync-yaml", action="store_true", help="Sync existing downloaded dataset data.yaml to plates.yaml")
    parser.add_argument("--generate-synthetic", action="store_true", help="Generate synthetic dataset for dry-run pipeline testing")
    args = parser.parse_args()

    dest_path = Path(args.dest)

    if args.generate_synthetic:
        generate_synthetic_dataset(dest_path)
        return

    if args.sync_yaml:
        sync_roboflow_yaml(dest_path)
        return

    if not args.api_key or not args.project:
        print_manual_instructions()
        print("\n[?] Or enter your Roboflow credentials below to download automatically:")
        api_key = args.api_key or input("Roboflow API Key (or press Enter to skip): ").strip()
        if not api_key:
            print("[*] No API key provided. Follow the manual download instructions above.")
            return

        workspace = input("Workspace name (default: universe): ").strip() or "universe"
        project = input("Project slug (e.g., indian-license-plates): ").strip()
        if not project:
            print("[!] Project slug cannot be empty. Aborting.")
            return

        version_str = input("Version number (default: 1): ").strip() or "1"
        version = int(version_str)

        download_via_roboflow(api_key, workspace, project, version, dest_path)
    else:
        download_via_roboflow(args.api_key, args.workspace, args.project, args.version, dest_path)

if __name__ == "__main__":
    main()
