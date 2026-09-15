"""
UrbanEye — Unified edge dataset builder.

Merges several YOLO-format datasets into ONE label space so a single on-device model
can cover every detection category, instead of running multiple models on the phone.

The unified class order is FROZEN for indices 0-6 so it stays byte-compatible with the
model currently shipped in the Android app. New categories append at index 7+, which
means an existing install keeps working and only new branches need adding to
OnnxRoadDefectDetector.kt.

Run this before train_edge_model.py. Both are written for a Colab T4 session.
"""

import argparse
import random
import shutil
from pathlib import Path

import yaml

# ── Frozen unified label space ────────────────────────────────────────────────
# Indices 0-6 MUST NOT be reordered: the deployed model and the Kotlin `when` block
# in OnnxRoadDefectDetector.kt both depend on this exact order.
UNIFIED_CLASSES = [
    "longitudinal_crack",     # 0  (RDD D00)
    "transverse_crack",       # 1  (RDD D10)
    "alligator_crack",        # 2  (RDD D20)
    "pothole",                # 3  (RDD D40)
    "faded_zebra_crossing",   # 4  (RDD D43)
    "faded_lane_marking",     # 5  (RDD D44)
    "utility_cover",          # 6  (RDD D50)
    # ── New categories: append only, never insert ──
    "waterlogging",           # 7
    "damaged_signboard",      # 8
    "traffic_sign",           # 9  intact sign — needed to tell "damaged" from "absent"
    "road_divider",           # 10 present divider — absence is inferred, not detected
]

# Maps whatever a source dataset calls a class onto the unified name.
# Source names are lowercased before lookup. Anything unmapped is DROPPED with a count
# reported at the end, so a silent taxonomy mismatch can't slip through unnoticed.
DEFAULT_ALIASES = {
    # RDD / Japan-style D-codes
    "d00": "longitudinal_crack",
    "d01": "longitudinal_crack",
    "d10": "transverse_crack",
    "d11": "transverse_crack",
    "d20": "alligator_crack",
    "d40": "pothole",
    "d43": "faded_zebra_crossing",
    "d44": "faded_lane_marking",
    "d50": "utility_cover",
    # Common plain-English variants found on Roboflow Universe
    "longitudinal crack": "longitudinal_crack",
    "transverse crack": "transverse_crack",
    "lateral crack": "transverse_crack",
    "alligator crack": "alligator_crack",
    "fatigue crack": "alligator_crack",
    "crocodile crack": "alligator_crack",
    "pothole": "pothole",
    "potholes": "pothole",
    "hole": "pothole",
    "crosswalk blur": "faded_zebra_crossing",
    "faded crosswalk": "faded_zebra_crossing",
    "zebra crossing": "faded_zebra_crossing",
    "white line blur": "faded_lane_marking",
    "faded lane": "faded_lane_marking",
    "lane marking": "faded_lane_marking",
    "manhole": "utility_cover",
    "utility hole": "utility_cover",
    "water": "waterlogging",
    "waterlogging": "waterlogging",
    "flood": "waterlogging",
    "standing water": "waterlogging",
    "damaged sign": "damaged_signboard",
    "damaged signboard": "damaged_signboard",
    "broken sign": "damaged_signboard",
    "traffic sign": "traffic_sign",
    "signboard": "traffic_sign",
    "road sign": "traffic_sign",
    "divider": "road_divider",
    "median": "road_divider",
    "road divider": "road_divider",
}


def load_source_classes(source: Path) -> list[str]:
    """Reads a YOLO dataset's data.yaml and returns its class names in index order."""
    for candidate in ("data.yaml", "data.yml"):
        cfg_path = source / candidate
        if cfg_path.exists():
            cfg = yaml.safe_load(cfg_path.read_text())
            names = cfg.get("names")
            if isinstance(names, dict):  # {0: 'a', 1: 'b'}
                return [names[k] for k in sorted(names, key=int)]
            if isinstance(names, list):
                return names
    raise FileNotFoundError(f"No data.yaml with a 'names' field found in {source}")


def find_split_dirs(source: Path) -> list[tuple[Path, Path]]:
    """Returns (images_dir, labels_dir) pairs for every split present in the source."""
    pairs = []
    for split in ("train", "valid", "val", "test"):
        img_dir = source / split / "images"
        lbl_dir = source / split / "labels"
        if not img_dir.exists():
            img_dir = source / "images" / split
            lbl_dir = source / "labels" / split
        if img_dir.exists() and lbl_dir.exists():
            pairs.append((img_dir, lbl_dir))
    if not pairs:
        raise FileNotFoundError(f"No image/label split directories found under {source}")
    return pairs


def remap_dataset(
    source: Path,
    out_dir: Path,
    alias_overrides: dict[str, str],
    unified_index: dict[str, int],
    stats: dict,
) -> None:
    """Copies one source dataset into the unified tree, rewriting class indices."""
    source_classes = load_source_classes(source)
    aliases = {**DEFAULT_ALIASES, **alias_overrides}

    # Build this source's index -> unified index translation up front.
    translation: dict[int, int] = {}
    for idx, raw_name in enumerate(source_classes):
        key = str(raw_name).strip().lower()
        unified_name = aliases.get(key, key if key in unified_index else None)
        if unified_name is None or unified_name not in unified_index:
            stats["dropped_classes"].setdefault(f"{source.name}:{raw_name}", 0)
            continue
        translation[idx] = unified_index[unified_name]

    print(f"\n[{source.name}] class translation:")
    for idx, raw_name in enumerate(source_classes):
        target = translation.get(idx)
        arrow = f"-> {UNIFIED_CLASSES[target]} ({target})" if target is not None else "-> DROPPED"
        print(f"    {idx:>2} {raw_name:<28} {arrow}")

    for img_dir, lbl_dir in find_split_dirs(source):
        for img_path in sorted(img_dir.iterdir()):
            if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp"}:
                continue
            lbl_path = lbl_dir / f"{img_path.stem}.txt"
            if not lbl_path.exists():
                continue

            kept_lines = []
            for line in lbl_path.read_text().splitlines():
                parts = line.split()
                if len(parts) < 5:
                    continue
                src_idx = int(float(parts[0]))
                if src_idx not in translation:
                    stats["dropped_boxes"] += 1
                    continue
                kept_lines.append(" ".join([str(translation[src_idx])] + parts[1:]))

            # An image whose every box was dropped still has value as a hard negative,
            # but only in moderation — too many empties suppress recall.
            if not kept_lines and random.random() > stats["negative_keep_rate"]:
                continue

            # Prefix with the source name so identically-named files can't collide.
            stem = f"{source.name}__{img_path.stem}"
            split = "train" if random.random() < 0.85 else "val"
            shutil.copy2(img_path, out_dir / "images" / split / f"{stem}{img_path.suffix}")
            (out_dir / "labels" / split / f"{stem}.txt").write_text("\n".join(kept_lines))

            stats["images"] += 1
            stats["boxes"] += len(kept_lines)
            for line in kept_lines:
                cls = int(line.split()[0])
                stats["per_class"][cls] = stats["per_class"].get(cls, 0) + 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge YOLO datasets into UrbanEye's unified label space.")
    parser.add_argument("sources", nargs="+", help="Paths to YOLO-format dataset roots (each needs a data.yaml).")
    parser.add_argument("--out", default="unified_edge_dataset", help="Output dataset directory.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--negative-keep-rate",
        type=float,
        default=0.1,
        help="Fraction of images with no surviving boxes to keep as hard negatives (0-1).",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    out_dir = Path(args.out)
    for split in ("train", "val"):
        (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    unified_index = {name: i for i, name in enumerate(UNIFIED_CLASSES)}
    stats = {
        "images": 0,
        "boxes": 0,
        "dropped_boxes": 0,
        "per_class": {},
        "dropped_classes": {},
        "negative_keep_rate": args.negative_keep_rate,
    }

    for src in args.sources:
        remap_dataset(Path(src), out_dir, {}, unified_index, stats)

    data_yaml = {
        "path": str(out_dir.resolve()),
        "train": "images/train",
        "val": "images/val",
        "nc": len(UNIFIED_CLASSES),
        "names": {i: n for i, n in enumerate(UNIFIED_CLASSES)},
    }
    (out_dir / "data.yaml").write_text(yaml.safe_dump(data_yaml, sort_keys=False))

    print("\n" + "=" * 68)
    print(f"Unified dataset written to {out_dir.resolve()}")
    print(f"  images: {stats['images']}   boxes kept: {stats['boxes']}   boxes dropped: {stats['dropped_boxes']}")
    print("\n  per-class box counts:")
    for i, name in enumerate(UNIFIED_CLASSES):
        count = stats["per_class"].get(i, 0)
        flag = "  <-- NO DATA, model cannot learn this class" if count == 0 else ""
        warn = "  <-- thin, expect poor recall" if 0 < count < 200 else ""
        print(f"    {i:>2} {name:<24} {count:>7}{flag}{warn}")
    if stats["dropped_classes"]:
        print("\n  source classes with no unified mapping (add them to DEFAULT_ALIASES):")
        for key in stats["dropped_classes"]:
            print(f"    - {key}")
    print("=" * 68)


if __name__ == "__main__":
    main()
