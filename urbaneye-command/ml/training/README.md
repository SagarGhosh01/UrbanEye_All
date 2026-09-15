# Edge model training

Trains the model that runs **on the phone**. Distinct from the scripts in `../` (those
target 640px server-side segmentation); everything here is built around the 320px ONNX
contract the Android decoder expects.

Run on a Colab **T4**. Do not train locally.

## What needs a new model, and what doesn't

The model currently shipped in the app already detects 7 classes. You do **not** need to
retrain for potholes, cracks, faded zebra crossings, faded lane markings or utility
covers — those work today.

Retraining is only needed to add:

| Category | Status | Notes |
|---|---|---|
| `waterlogging` | no class exists | Currently claimed but not detected. Highest priority. |
| `damaged_signboard` | no class exists | Needs `traffic_sign` too, to distinguish damaged from intact. |
| `traffic_sign` | no class exists | The intact case. |
| `road_divider` | no class exists | Present dividers only — see the absence note below. |

Vehicles and pedestrians need **no training at all**: a stock COCO-pretrained YOLOv8n
already detects `person`, `car`, `bus`, `truck`, `motorcycle`. Use it directly.

### You cannot train "missing"

The problem statement asks for *missing* dividers and *missing* zebra crossings. You
cannot annotate an absence — there is no box to draw around a thing that isn't there.

The workable approach is two-stage: train the model to detect the object when it **is**
present, then infer absence by comparing a bus's travelled route against expected road
furniture from OpenStreetMap. If the route passes a junction that OSM says has a
crossing and no crossing was detected on any recent pass, that's the missing case.
Stage one is what these scripts cover.

## Where to get the data

Verify every link before relying on it — dataset URLs move, and Roboflow Universe
projects are user-published and get renamed or deleted.

**1. RDD2022 / Road Damage Dataset — start here.**
This is where your current 7 classes came from. Re-downloading it gives you the full
multi-country set including **India**, which your present model was not trained on (its
metadata shows a Japan-derived export).
Search for the `sekilab/RoadDamageDetector` GitHub repository, which links the current
figshare download. Classes: `D00 D10 D20 D40` across all countries, plus `D43 D44 D50`
in the Japanese subset. `prepare_dataset.py` already maps every one of these codes.

**2. Roboflow Universe** — `universe.roboflow.com`
You already have a workspace (`urbaneye-ai`), so export straight into Colab. Useful
search terms, roughly in order of how well-served they are:
- `pothole detection` — plentiful
- `road damage` — plentiful
- `waterlogging` / `flooded road` / `standing water` — moderate
- `traffic sign india` — moderate
- `damaged traffic sign` — **sparse; expect to annotate your own**

**3. India Driving Dataset (IDD)** — `idd.insaan.iiit.ac.in` (IIIT Hyderabad)
Indian road scenes with road furniture annotations. Requires registration. The most
representative data you'll find for Indian junction and signage conditions, which
matters because a model trained only on Japanese roads will underperform here.

**4. Mapillary Traffic Sign Dataset** — global street-level signs at scale, if you need
more sign data than IDD provides.

### On damaged signboards

There is no good public dataset for *damaged* signage. Budget for annotating your own:
roughly 300–500 images with augmentation is enough for a demo-grade class, and dashcam
footage from a single afternoon's drive will supply them. Annotate in Roboflow and pull
it in as another source.

Watch the class balance — `prepare_dataset.py` prints per-class box counts and flags any
class under 200 boxes. A class with 40 examples will produce confident nonsense, which
is worse than not having the class at all.

## Running it

```python
# Colab cell 1 — confirm you actually got a T4
!nvidia-smi
!pip install -q ultralytics onnx onnxslim onnxruntime roboflow
```

```python
# Colab cell 2 — pull your datasets (repeat per source)
from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_KEY")
rf.workspace("urbaneye-ai").project("YOUR_PROJECT").version(1).download("yolov8")
```

```bash
# Colab cell 3 — merge everything into one label space
!python prepare_dataset.py \
    /content/RDD2022 /content/waterlogging-1 /content/traffic-signs-2 \
    --out /content/unified_edge_dataset
```

Read the per-class table it prints before going further. Any class showing `NO DATA`
will not be learned, and shipping it as `phase: 1` would repeat exactly the overclaim
the project just finished cleaning up.

```bash
# Colab cell 4 — train and export
!python train_edge_model.py \
    --data /content/unified_edge_dataset/data.yaml \
    --epochs 120 --batch 64 --device 0 \
    --export-to /content/road_defect_detector.onnx
```

Expect roughly 1.5–3 hours on a T4 for 120 epochs at 320px, depending on dataset size.
Keep `--imgsz 320`: the Android decoder's anchor count is derived from it.

## Wiring the new model in

`train_edge_model.py` prints the exact Kotlin `when` block at the end. Use it verbatim.

1. Copy the `.onnx` to `urbaneye-mobile/app/src/main/assets/models/road_defect_detector.onnx`
2. Update `numClasses` in `OnnxRoadDefectDetector.kt` to the new class count
3. Paste the generated `when` block over the existing one
4. Add each new category to `web/src/constants/detectionCategories.ts` with `phase: 1`
5. Give each new type a metrics branch in `backend/src/events/events.router.ts`
   (dimensions, deterioration, and the right repair rate card — markings repaint,
   cavities patch)

Step 3 is the one that has already bitten this project. The mapping is silent when it's
wrong: detections keep arriving with high confidence, just labelled as the wrong thing.
Verify against the exported model's own metadata before you trust it:

```python
import onnx
m = onnx.load("road_defect_detector.onnx")
print({p.key: p.value for p in m.metadata_props})   # includes the real class names
```
