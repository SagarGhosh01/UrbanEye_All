#!/usr/bin/env python3
"""
ONNX Validation & Visual Sanity Check Script for License Plate Detector
=======================================================================
Runs exported ONNX model (plate_detector.onnx) against test images,
simulating the preprocessing & postprocessing executed on Android by ONNX Runtime.

Usage:
    python validate_onnx.py --model plate_detector.onnx --images test_images/
    python validate_onnx.py --model plate_detector.onnx --conf 0.25 --iou 0.45
"""

import os
import sys
import argparse
from pathlib import Path
import numpy as np

def letterbox(img, target_shape=(640, 640), color=(114, 114, 114)):
    """Resizes and pads image to target_shape while maintaining aspect ratio."""
    import cv2
    shape = img.shape[:2]  # [height, width]
    
    # Scale ratio (new / old)
    r = min(target_shape[0] / shape[0], target_shape[1] / shape[1])
    
    # Compute padding
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = target_shape[1] - new_unpad[0], target_shape[0] - new_unpad[1]
    
    dw /= 2  # divide padding into 2 sides
    dh /= 2

    if shape[::-1] != new_unpad:
        img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)

    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    
    return img, r, (dw, dh)

def generate_sample_test_image(output_path: Path):
    """Creates a realistic synthetic Indian vehicle scene with a license plate for testing."""
    import cv2
    # 800x600 test frame
    img = np.zeros((600, 800, 3), dtype=np.uint8)
    # Background asphalt road & street scene
    img[:250, :] = [180, 160, 140]  # Urban horizon
    img[250:, :] = [45, 45, 45]     # Asphalt road
    
    # Road lane markings
    cv2.line(img, (400, 250), (100, 600), (255, 255, 255), 4)
    cv2.line(img, (400, 250), (700, 600), (255, 255, 255), 4)

    # Car body (White SUV / Hatchback)
    cv2.rectangle(img, (180, 220), (620, 520), (230, 230, 235), -1)
    cv2.rectangle(img, (180, 220), (620, 520), (50, 50, 50), 3)
    
    # Rear windshield
    pts = np.array([[240, 240], [560, 240], [600, 340], [200, 340]], np.int32)
    cv2.fillPoly(img, [pts], (30, 30, 40))

    # Tail lamps
    cv2.rectangle(img, (185, 360), (260, 400), (0, 0, 200), -1)
    cv2.rectangle(img, (540, 360), (615, 400), (0, 0, 200), -1)

    # Bumper indentation
    cv2.rectangle(img, (290, 420), (510, 490), (190, 190, 195), -1)

    # Indian Standard High Security Registration Plate (HSRP)
    # White reflective plate with blue IND strip on left
    px1, py1, px2, py2 = 310, 435, 490, 475
    cv2.rectangle(img, (px1, py1), (px2, py2), (250, 250, 250), -1)
    cv2.rectangle(img, (px1, py1), (px2, py2), (20, 20, 20), 2)
    # Blue strip
    cv2.rectangle(img, (px1, py1), (px1 + 18, py2), (180, 60, 20), -1)
    
    # Realistic Indian plate text (e.g. WB 02 AD 1234 or DL 01 AB 4567)
    font = cv2.FONT_HERSHEY_DUPLEX
    cv2.putText(img, "MH 12 AB 1234", (px1 + 24, py1 + 28), font, 0.65, (15, 15, 15), 2, cv2.LINE_AA)

    cv2.imwrite(str(output_path), img)
    print(f"[+] Generated sample Indian vehicle test image at: {output_path}")

def run_validation(
    model_path: str = "plate_detector.onnx",
    images_dir: str = "test_images",
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
    output_dir: str = "inference_outputs"
):
    try:
        import cv2
    except ImportError:
        print("[!] OpenCV not installed. Run: pip install opencv-python")
        sys.exit(1)

    try:
        import onnxruntime as ort
    except ImportError:
        print("[!] onnxruntime not installed. Run: pip install onnxruntime")
        sys.exit(1)

    model_file = Path(model_path)
    if not model_file.exists():
        # Check fallback names
        for fallback in ["best_float32.onnx", "runs/detect/plate_train/weights/best.onnx"]:
            if Path(fallback).exists():
                model_file = Path(fallback)
                break

    if not model_file.exists():
        print(f"[!] ONNX model file not found: {model_path}")
        print("    Please train the model using 'python train.py' or export with 'python export_onnx.py'.")
        sys.exit(1)

    print("=" * 80)
    print(" ONNX LICENSE PLATE DETECTOR VALIDATION")
    print("=" * 80)
    print(f" Model File      : {model_file.resolve()}")
    print(f" Conf Threshold  : {conf_threshold}")
    print(f" IoU Threshold   : {iou_threshold}")
    
    # Load ONNX session
    session = ort.InferenceSession(str(model_file), providers=["CPUExecutionProvider"])
    input_info = session.get_inputs()[0]
    output_info = session.get_outputs()[0]
    input_name = input_info.name
    output_name = output_info.name
    input_shape = input_info.shape  # Expected: [1, 3, 640, 640]
    print(f" Tensor Input    : name='{input_name}', shape={input_shape}, type={input_info.type}")
    print(f" Tensor Output   : name='{output_name}', shape={output_info.shape}, type={output_info.type}")
    print("=" * 80)

    # Collect images
    img_dir = Path(images_dir)
    img_dir.mkdir(parents=True, exist_ok=True)
    valid_exts = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]
    image_paths = [p for p in img_dir.iterdir() if p.suffix.lower() in valid_exts]

    if not image_paths:
        sample_img = img_dir / "sample_indian_car.jpg"
        generate_sample_test_image(sample_img)
        image_paths = [sample_img]

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    total_detections = 0

    for idx, img_path in enumerate(image_paths, start=1):
        orig_img = cv2.imread(str(img_path))
        if orig_img is None:
            print(f"[!] Warning: Could not read {img_path.name}")
            continue

        orig_h, orig_w = orig_img.shape[:2]

        # 1. Preprocessing: Letterbox resize to 640x640
        input_h = input_shape[2] if len(input_shape) >= 4 and isinstance(input_shape[2], int) else 640
        input_w = input_shape[3] if len(input_shape) >= 4 and isinstance(input_shape[3], int) else 640
        padded_img, ratio, (dw, dh) = letterbox(orig_img, target_shape=(input_h, input_w))

        # 2. Color conversion BGR -> RGB, uint8 -> float32, normalize [0, 1]
        rgb = cv2.cvtColor(padded_img, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0

        # 3. Transpose HWC -> CHW and add batch dimension -> [1, 3, H, W]
        tensor = np.transpose(tensor, (2, 0, 1))
        tensor = np.expand_dims(tensor, axis=0)

        # 4. Run ONNX inference
        outputs = session.run([output_name], {input_name: tensor})
        raw_output = outputs[0]  # Shape typically [1, 5, 8400] or [1, 8400, 5]

        # Standardize to [num_proposals, 5]
        if raw_output.ndim == 3:
            if raw_output.shape[1] < raw_output.shape[2]:
                # Shape is [1, 5, 8400] -> transpose to [8400, 5]
                preds = np.transpose(raw_output[0], (1, 0))
            else:
                preds = raw_output[0]
        else:
            preds = raw_output

        # 5. Extract boxes and scores
        # YOLOv8 single class format: [cx, cy, w, h, score]
        boxes = []
        confidences = []
        class_ids = []

        for pred in preds:
            cx, cy, w, h = pred[0], pred[1], pred[2], pred[3]
            if len(pred) == 5:
                score = float(pred[4])
                cls_id = 0
            else:
                class_scores = pred[4:]
                cls_id = int(np.argmax(class_scores))
                score = float(class_scores[cls_id])

            if score >= conf_threshold:
                # Convert center xywh to top-left xywh (in letterbox coordinates)
                x1 = cx - w / 2.0
                y1 = cy - h / 2.0
                
                # Transform back to original image space
                orig_x = (x1 - dw) / ratio
                orig_y = (y1 - dh) / ratio
                orig_box_w = w / ratio
                orig_box_h = h / ratio

                # Clip to image boundaries
                orig_x = max(0, min(orig_w - 1, orig_x))
                orig_y = max(0, min(orig_h - 1, orig_y))
                orig_box_w = max(1, min(orig_w - orig_x, orig_box_w))
                orig_box_h = max(1, min(orig_h - orig_y, orig_box_h))

                boxes.append([int(orig_x), int(orig_y), int(orig_box_w), int(orig_box_h)])
                confidences.append(score)
                class_ids.append(cls_id)

        # 6. Non-Maximum Suppression (NMS)
        indices = cv2.dnn.NMSBoxes(boxes, confidences, conf_threshold, iou_threshold)
        
        detected_in_image = 0
        annotated_img = orig_img.copy()

        if len(indices) > 0:
            indices = indices.flatten() if hasattr(indices, "flatten") else indices
            for i in indices:
                bx, by, bw, bh = boxes[i]
                conf = confidences[i]
                detected_in_image += 1
                total_detections += 1

                # Draw high-visibility Emerald Green bounding box
                box_color = (0, 230, 80) # BGR
                cv2.rectangle(annotated_img, (bx, by), (bx + bw, by + bh), box_color, 3)

                # Label text
                label = f"Plate {conf:.1%}"
                (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                
                # Label background badge
                cv2.rectangle(
                    annotated_img,
                    (bx, max(0, by - lh - 10)),
                    (bx + lw + 12, max(0, by)),
                    box_color,
                    -1
                )
                cv2.putText(
                    annotated_img,
                    label,
                    (bx + 6, max(lh + 4, by - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (10, 10, 10),
                    2,
                    cv2.LINE_AA
                )

                # Add simulated ML Kit crop guidance indicator
                cv2.putText(
                    annotated_img,
                    "[Crop -> ML Kit OCR]",
                    (bx, by + bh + 18),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (0, 255, 255),
                    1,
                    cv2.LINE_AA
                )

                print(f"  -> [{img_path.name}] Found License Plate at [{bx}, {by}, {bx+bw}, {by+bh}] Conf: {conf:.2%}")

        # Save annotated image
        save_path = out_dir / f"val_{img_path.stem}.jpg"
        cv2.imwrite(str(save_path), annotated_img)
        print(f"[{idx}/{len(image_paths)}] Processed {img_path.name}: {detected_in_image} plate(s) detected -> Saved to {save_path.name}")

    print("\n" + "=" * 80)
    print(" VALIDATION SUMMARY")
    print("=" * 80)
    print(f" Total Images Processed  : {len(image_paths)}")
    print(f" Total Plates Detected   : {total_detections}")
    print(f" Output Directory        : {out_dir.resolve()}")
    print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Validate ONNX License Plate Detector on Images")
    parser.add_argument("--model", type=str, default="plate_detector.onnx", help="Path to ONNX model")
    parser.add_argument("--images", type=str, default="test_images", help="Directory containing test images")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold (default: 0.45)")
    parser.add_argument("--output", type=str, default="inference_outputs", help="Output directory for annotated images")
    args = parser.parse_args()

    run_validation(
        model_path=args.model,
        images_dir=args.images,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        output_dir=args.output
    )

if __name__ == "__main__":
    main()
