# 🚗 UrbanEye ANPR: Indian License Plate Detection Pipeline

A standalone, offline Python training and validation pipeline for training an **Indian Vehicle License Plate DETECTOR** using **Ultralytics YOLOv8n**.

> [!IMPORTANT]
> **Bounding Box Detection Only — No OCR in this Pipeline**
> This pipeline trains a pure object detector to localize license plate bounding boxes `[x, y, width, height]`.
> Plate text recognition (OCR) is handled **separately on-device** within the Android app using **Google ML Kit Text Recognition** on the cropped plate regions.

---

## 📋 Architecture & Design Principles

| Parameter | Specification | Note |
| :--- | :--- | :--- |
| **Base Architecture** | `YOLOv8n` (Nano) | Identical backbone & head to UrbanEye's road defect detector (`best_float32.onnx`) |
| **Classes** | `1` (`license_plate`) | Single-class detector for optimal inference latency on edge devices |
| **Input Tensor** | `[1, 3, 640, 640]` | Float32, normalized `[0.0, 1.0]`, RGB format |
| **Output Tensor** | `[1, 5, 8400]` | `[cx, cy, w, h, confidence]` for 8,400 multi-scale anchor proposals |
| **Primary Export** | `plate_detector.onnx` | Static graph optimized for Android ONNX Runtime Mobile |
| **Mirror Export** | `best_float32.onnx` | Consistency alias matching UrbanEye repository standards |

---

## 📁 Directory Structure

```
anpr-training/
├── README.md                           # This guide & integration manual
├── requirements.txt                    # Python dependencies
├── plates.yaml.example                 # YOLOv8 dataset configuration template
├── download_dataset.py                 # Roboflow Universe dataset downloader & setup script
├── train.py                            # Standalone training script with automated ONNX export
├── export_onnx.py                      # ONNX export utility
├── validate_onnx.py                    # Standalone ONNX validation & visual verification script
├── anpr_plate_detection_colab.ipynb    # 1-Click ready-to-run Google Colab Notebook (Free T4 GPU)
├── test_images/                        # Test images for visual sanity checking
│   └── sample_indian_car.jpg           # (Auto-generated or user supplied test frames)
└── inference_outputs/                  # Output directory for annotated validation results
```

---

## 🔍 Step 1: Dataset Acquisition (Roboflow Universe)

Roboflow Universe contains diverse community datasets of Indian vehicle license plates with varying angles, lighting conditions, high-security registration plates (HSRP), and state variations (e.g. MH, DL, WB, KA, TN, UP).

### Recommended Search Keywords
Navigate to [Roboflow Universe](https://universe.roboflow.com) and search for:
- `"Indian license plate detection"`
- `"ANPR India"`
- `"Indian vehicle number plate"`
- `"Indian car license plate"`

### Option A: Automatic Download via Roboflow API (Recommended)

1. Obtain your free API key from your [Roboflow Account Settings](https://app.roboflow.com).
2. Run `download_dataset.py`:

```bash
# Using CLI flags:
python download_dataset.py \
  --api-key "YOUR_ROBOFLOW_API_KEY" \
  --workspace "universe" \
  --project "indian-license-plates" \
  --version 1 \
  --dest "./dataset"

# Or set environment variable:
export ROBOFLOW_API_KEY="YOUR_ROBOFLOW_API_KEY"
python download_dataset.py --project "indian-license-plates" --version 1
```

### Option B: Manual Download (No API Key Required)

1. Open your chosen Indian license plate dataset on [Roboflow Universe](https://universe.roboflow.com).
2. Click **Download Dataset** in the top right.
3. Select format: **YOLOv8** (do not select COCO or YOLOv5).
4. Select **download zip to computer**.
5. Extract the `.zip` archive directly into `anpr-training/dataset/`.
6. Adapt the configuration YAML to `plates.yaml`:
   ```bash
   python download_dataset.py --sync-yaml
   ```

### Dataset Directory Layout
Your extracted dataset should resemble:
```
anpr-training/
└── dataset/
    ├── train/
    │   ├── images/
    │   └── labels/
    ├── valid/  (or val/)
    │   ├── images/
    │   └── labels/
    ├── test/
    │   ├── images/
    │   └── labels/
    └── data.yaml
```

---

## 🚀 Step 2: Training the License Plate Detector

### Hardware Considerations & Speed
- **Google Colab (Recommended)**: Free NVIDIA T4 GPU completes 100 epochs in **15–20 minutes**.
- **Local NVIDIA GPU (CUDA)**: Completes 100 epochs in **10–25 minutes**.
- **Local CPU**: Training 100 epochs on CPU will take **4–8+ hours**.
  > If training on CPU locally, reduce epochs to `--epochs 10 --batch 4` for quick dry-runs, or use the included Google Colab notebook.

### Method 1: Google Colab (1-Click T4 GPU)
1. Open [`anpr_plate_detection_colab.ipynb`](./anpr_plate_detection_colab.ipynb) in Google Colab.
2. Select **Runtime -> Change runtime type -> T4 GPU**.
3. Run all cells sequentially.
4. Cell 9 will automatically download the exported `plate_detector.onnx` to your computer.

### Method 2: Command Line Training (Ultralytics CLI)
```bash
yolo detect train data=plates.yaml model=yolov8n.pt epochs=100 imgsz=640 batch=16 project=runs/detect name=plate_train
```

### Method 3: Standalone Python Script (Auto-Exports to ONNX)
```bash
# Full training with auto-export
python train.py --data plates.yaml --epochs 100 --batch 16 --imgsz 640

# Dry-run on CPU with lower epochs
python train.py --data plates.yaml --epochs 5 --batch 4 --device cpu
```

---

## 📦 Step 3: Exporting to ONNX Format

The model must be exported with static input dimensions `[1, 3, 640, 640]` to ensure maximum hardware acceleration and zero-allocation execution inside Android's ONNX Runtime:

```bash
# Using Ultralytics CLI
yolo export model=runs/detect/plate_train/weights/best.pt format=onnx imgsz=640 dynamic=False opset=12

# Or using our export script:
python export_onnx.py --weights runs/detect/plate_train/weights/best.pt --output plate_detector.onnx
```

This generates:
- `plate_detector.onnx` (~12 MB Float32 static ONNX model)
- `best_float32.onnx` (mirror copy matching existing repository naming)

---

## 🧪 Step 4: ONNX Validation & Visual Sanity Check

Before deploying the ONNX model to the Android app, run the validation script against test images:

```bash
# Validate against test_images/ folder
python validate_onnx.py --model plate_detector.onnx --images test_images/ --conf 0.25 --iou 0.45
```

### What `validate_onnx.py` does:
1. Loads `plate_detector.onnx` into `onnxruntime.InferenceSession`.
2. Emulates the exact preprocessing of the Android app:
   - Letterbox resizing with padding to 640x640.
   - BGR to RGB color conversion.
   - Normalization: `pixel / 255.0` (Float32).
   - Tensor shape: `[1, 3, 640, 640]`.
3. Runs inference and parses output tensor `[1, 5, 8400]`.
4. Executes Non-Maximum Suppression (NMS).
5. Draws emerald-green bounding boxes, confidence badges, and crop indicators.
6. Saves visual outputs to `inference_outputs/val_<image>.jpg`.

---

## 📊 Performance Benchmarks & Expected Metrics

When trained on 1,500+ Indian vehicle images for 100 epochs, expected benchmarks are:

| Metric | Target Score | Notes |
| :--- | :--- | :--- |
| **mAP@0.5** | **0.88 – 0.95+** | License plates are rectangular high-contrast objects; high mAP is expected |
| **mAP@0.5:0.95** | **0.62 – 0.74** | Robustness across varying aspect ratios and perspective skews |
| **Precision (P)** | **0.89 – 0.94** | Minimal false positives against bumpers and grilles |
| **Recall (R)** | **0.85 – 0.92** | Detects plates in night, rainy, and glare conditions |
| **Mobile Inference Latency** | **8 – 14 ms** | Measured with NNAPI / XNNPACK on Snapdragon 7+ / 8 series chips |

---

## 📲 Step 5: Android App Integration Guide

### 1. Copy the ONNX Model to Android Assets
Copy `plate_detector.onnx` into the Android app's assets directory:

```bash
# Windows PowerShell
Copy-Item anpr-training/plate_detector.onnx urbaneye-mobile/app/src/main/assets/models/plate_detector.onnx

# Linux / macOS
cp anpr-training/plate_detector.onnx urbaneye-mobile/app/src/main/assets/models/plate_detector.onnx
```

### 2. Verify Asset Location
Check that the asset exists at:
```
urbaneye-mobile/app/src/main/assets/models/
├── road_defect_detector.onnx    (Existing Pothole Model)
└── plate_detector.onnx          (New License Plate Model)
```

### 3. Android Kotlin Integration Pattern

In `urbaneye-mobile`, the plate detector is invoked inside the camera analysis loop.
Once a plate bounding box is detected, the region is cropped and passed to ML Kit:

```kotlin
// 1. Initialize ONNX Runtime Session for License Plate Detector
val env = OrtEnvironment.getEnvironment()
val modelBytes = context.assets.open("models/plate_detector.onnx").use { it.readBytes() }
val plateSession = env.createSession(modelBytes, OrtSession.SessionOptions())

// 2. Run ONNX Inference on oriented Camera Frame
val plateBoxes: List<RectF> = detectPlateBoundingBoxes(frameBitmap, plateSession)

// 3. Crop Plate & Hand off to Google ML Kit Text Recognition (OCR)
val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

for (box in plateBoxes) {
    val plateCrop = Bitmap.createBitmap(
        frameBitmap,
        box.left.toInt().coerceAtLeast(0),
        box.top.toInt().coerceAtLeast(0),
        box.width().toInt().coerceAtMost(frameBitmap.width - box.left.toInt()),
        box.height().toInt().coerceAtMost(frameBitmap.height - box.top.toInt())
    )
    val inputImage = InputImage.fromBitmap(plateCrop, 0)
    recognizer.process(inputImage)
        .addOnSuccessListener { visionText ->
            val rawPlateText = visionText.text
            val cleanedIndianPlate = cleanIndianLicensePlate(rawPlateText)
            Log.d("ANPR", "Detected Indian Plate: $cleanedIndianPlate (Conf: ${box.score})")
        }
}
```

---

## 🛠️ Troubleshooting & Tips

- **CUDA Out of Memory**: If training fails with OOM, reduce batch size: `--batch 8` or `--batch 4`.
- **Plate Detection vs Small Frames**: License plates on distant vehicles may be fewer than 30 pixels across. Use `imgsz=640` (default) rather than `320` to preserve high frequency edge details for text readability.
- **Two-Wheeler Plates**: Ensure your Roboflow dataset includes Indian two-wheelers (motorcycles, scooters) which often have square/stacked rear plates (e.g., `MH 12` on row 1, `AB 1234` on row 2).
