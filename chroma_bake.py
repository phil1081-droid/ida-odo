#!/usr/bin/env python3
"""
chroma_bake.py
Portiert chromaKeyImageData() aus loader.js 1:1, ergänzt Despill.
Originale werden in backup_sprites/ gesichert, dann überschrieben.

Usage:
    python chroma_bake.py           # verarbeitet alle Sprites
    python chroma_bake.py --dry-run # zeigt nur was passieren würde
    python chroma_bake.py --restore # stellt Originale aus Backup wieder her
"""

import sys
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

# ── Presets (exakt aus loader.js CHROMA_PRESETS) ───────────────
PRESETS = {
    "ida":      dict(minG=60, ratio=1.2,  hardCut=60, domFactor=2.0, minSat=0.05),
    "odo":      dict(minG=60, ratio=1.25, hardCut=60, domFactor=2.0, minSat=0.05),
    "lump":     dict(minG=80, ratio=0.6,  hardCut=40, domFactor=1.0, minSat=0.02),
    "ride":     dict(minG=60, ratio=1.25, hardCut=60, domFactor=2.0, minSat=0.05),
    "grab":     dict(minG=60, ratio=1.15, hardCut=40, domFactor=1.5, minSat=0.02),
    "platsch":  dict(minG=80, ratio=1.2,  hardCut=80, domFactor=3.0, minSat=0.05),
    "obstacle": dict(minG=60, ratio=1.15, hardCut=60, domFactor=2.0, minSat=0.05),
}

# ── Sprite-Dateien und ihre Presets ────────────────────────────
SPRITES = [
    ("ida_sprites.png",         "ida"),
    ("ida-ice_sprites.png",     "ida"),
    ("ida-present_sprites.png", "ida"),
    ("odo-fall_sprites.png",    "odo"),
    ("odo-ride_sprites.png",    "ride"),
    ("odo-grab_sprites.png",    "grab"),
    ("bollen_sprites.png",      "lump"),
    ("platsch_sprites.png",     "platsch"),
    ("obstacles.png",           "obstacle"),
]


def apply_chroma_key(rgba_f32, preset):
    """
    1:1-Port von chromaKeyImageData() aus loader.js.
    Zusätzlich Despill: Grünkanal in erkannten Grünpixeln → max(R, B).
    rgba_f32: float32-Array (H, W, 4), Werte 0–255.
    Gibt uint8-Array zurück.
    """
    minG       = preset["minG"]
    ratio      = preset["ratio"]
    hard_cut   = preset["hardCut"]
    dom_factor = preset["domFactor"]
    min_sat    = preset["minSat"]

    r = rgba_f32[:, :, 0]
    g = rgba_f32[:, :, 1]
    b = rgba_f32[:, :, 2]
    a = rgba_f32[:, :, 3].copy()

    max_rgb = np.maximum(np.maximum(r, g), b)
    min_rgb = np.minimum(np.minimum(r, g), b)
    sat = np.where(max_rgb == 0, 0.0, (max_rgb - min_rgb) / max_rgb)

    dominance = g - np.maximum(r, b)
    ratio_ok  = (g > r * ratio) & (g > b * ratio)

    is_green = (g >= minG) & (sat >= min_sat) & (ratio_ok | (dominance > 8))

    fully_transparent = is_green & (dominance > hard_cut)
    semi              = is_green & ~fully_transparent

    a[fully_transparent] = 0
    semi_alpha = np.clip(255 - np.round(dominance * dom_factor), 0, 255)
    a[semi] = semi_alpha[semi]

    result = rgba_f32.copy()
    result[:, :, 3] = a

    # Despill: Grünkanal auf max(R, B) setzen → kein grüner Farbsaum
    result[:, :, 1] = np.where(is_green, np.maximum(r, b), g)

    return np.clip(result, 0, 255).astype(np.uint8)


def process(src_path, preset_name, backup_dir, dry_run=False):
    preset = PRESETS[preset_name]
    backup_path = backup_dir / src_path.name

    if dry_run:
        img = Image.open(src_path)
        print(f"  würde verarbeiten: {src_path.name}  ({preset_name})  {img.width}x{img.height}px")
        return

    if not backup_path.exists():
        shutil.copy2(src_path, backup_path)

    img    = Image.open(src_path).convert("RGBA")
    rgba   = np.array(img, dtype=np.float32)
    result = apply_chroma_key(rgba, preset)
    Image.fromarray(result, "RGBA").save(src_path, "PNG", optimize=False)

    changed = int(np.sum(result[:, :, 3] < np.array(img)[:, :, 3]))
    print(f"  OK {src_path.name:<30} {preset_name:<9}  {img.width}x{img.height}  "
          f"-> {changed:,} Pixel transparent gemacht")


def restore(base, backup_dir):
    restored = 0
    for filename, _ in SPRITES:
        src = backup_dir / filename
        dst = base / filename
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  <- {filename}")
            restored += 1
        else:
            print(f"  !! kein Backup: {filename}")
    print(f"\n{restored} Datei(en) wiederhergestellt.")


def main():
    dry_run = "--dry-run" in sys.argv
    do_restore = "--restore" in sys.argv

    base       = Path(__file__).parent
    backup_dir = base / "backup_sprites"
    backup_dir.mkdir(exist_ok=True)

    if do_restore:
        print("Stelle Originale wieder her …\n")
        restore(base, backup_dir)
        return

    mode = " (DRY RUN)" if dry_run else ""
    print(f"chroma_bake.py{mode}\nBackup-Verzeichnis: {backup_dir}\n")

    missing = 0
    for filename, preset_name in SPRITES:
        path = base / filename
        if not path.exists():
            print(f"  !! nicht gefunden: {filename}")
            missing += 1
            continue
        process(path, preset_name, backup_dir, dry_run=dry_run)

    if not dry_run:
        print(f"\nFertig. Originale in backup_sprites/ gesichert.")
        print("Zum Rückgängigmachen: python chroma_bake.py --restore")
    if missing:
        print(f"\n{missing} Datei(en) nicht gefunden.")


if __name__ == "__main__":
    main()
