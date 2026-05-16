"""
Analyse und Reparatur start_sprites.png:
1. Linke Kante: dunkle Artefaktpixel finden und durch Chroma-Grün ersetzen
2. Wappen-Frames zeigen
3. Info über Frame-Nutzung
"""
from PIL import Image
import numpy as np
import os

SRC = "start_sprites.png"
COLS = 8
ROWS_USED = 14
ROWS_TOTAL = 25

img = Image.open(SRC).convert("RGB")
arr = np.array(img)

W, H = img.width, img.height
fw = W // COLS
fh = H // ROWS_TOTAL

print(f"Bild: {W}×{H}px, Frame: {fw}×{fh}px")
print(f"Genutzte Rows: {ROWS_USED} von {ROWS_TOTAL}")
print(f"Genutzte Frames: {ROWS_USED * COLS} von {ROWS_TOTAL * COLS}")
print()

# ---- 1. Linke Kante analysieren ----
# Prüfe die ersten 8 Pixel jedes Frames in Spalte 0
print("=== Linke Kante — erste 8 Pixel jedes Frames (Row 0-3, Col 0) ===")
for row in range(min(4, ROWS_USED)):
    y0 = row * fh
    x0 = 0
    region = arr[y0:y0+fh, x0:x0+8]

    # Zähle nicht-grüne Pixel (schwarz/dunkel)
    r = region[:,:,0].astype(float)
    g = region[:,:,1].astype(float)
    b = region[:,:,2].astype(float)

    # Chroma-Key: g >= 60, g > r*1.2, g > b*1.2
    not_keyed = ~((g >= 60) & (g > r * 1.2) & (g > b * 1.2))
    dark = (r < 40) & (g < 40) & (b < 40)

    print(f"  Row {row}: {not_keyed.sum()} Pixel nicht-grün, {dark.sum()} schwarz/dunkel")

    # Zeige die ersten 5 Pixel der Mittellinie
    mid = fh // 2
    line = region[mid, :5]
    print(f"    Pixelwerte (Mitte, x=0..4): {line.tolist()}")

print()

# ---- 2. Sample-Frame für Wappen extrahieren ----
# Das Wappen ist im Intro sichtbar — Frame 0 (erste Position)
for frame_idx in [0, 1, 2, 3]:
    col = frame_idx % COLS
    row = frame_idx // COLS
    x0 = col * fw
    y0 = row * fh
    frame_arr = arr[y0:y0+fh, x0:x0+fw]
    frame_img = Image.fromarray(frame_arr)
    frame_img.save(f"_frame_{frame_idx:03d}.png")

print("Frame 0-3 als _frame_000.png bis _frame_003.png gespeichert")
print()

# ---- 3. Chroma-Grün im Bild bestimmen ----
# Suche nach der dominanten Hintergrundfarbe (grün)
green_mask = (arr[:,:,1].astype(float) > arr[:,:,0].astype(float) * 1.2) & \
             (arr[:,:,1].astype(float) > arr[:,:,2].astype(float) * 1.2) & \
             (arr[:,:,1] >= 60)
green_pixels = arr[green_mask]
if len(green_pixels) > 0:
    avg_green = green_pixels.mean(axis=0).astype(int)
    print(f"Durchschnittliche Chroma-Grün Farbe: RGB{tuple(avg_green)}")

    # Häufigste Grünfarbe
    from collections import Counter
    pixel_tuples = [tuple(p) for p in green_pixels]
    most_common = Counter(pixel_tuples).most_common(5)
    print("Häufigste Grün-Pixel:")
    for color, count in most_common:
        print(f"  {color}: {count}x")

print()

# ---- 4. Reparatur: Linke Kante fixen ----
# Strategie: In den ersten 3 Pixel-Spalten jedes Frames alle Pixel,
# die nicht durch den Chroma-Key entfernt werden, mit dem häufigsten Grün ersetzen
fix_arr = arr.copy()

# Referenz-Grün: häufigste Grünfarbe aus dem Hintergrund
ref_green = most_common[0][0] if 'most_common' in dir() and most_common else (0, 200, 0)

EDGE_WIDTH = 4  # Pixel von der linken Kante pro Frame

fixed_count = 0
for row in range(ROWS_USED):
    for col in range(COLS):
        x0 = col * fw
        y0 = row * fh

        # Linke Randzone dieses Frames
        for px in range(EDGE_WIDTH):
            x = x0 + px
            column_pixels = fix_arr[y0:y0+fh, x]
            r = column_pixels[:,0].astype(float)
            g = column_pixels[:,1].astype(float)
            b = column_pixels[:,2].astype(float)

            # Pixel, die der Chroma-Key NICHT entfernen würde (nicht-grün)
            # aber dunkel sind (Artefakte)
            dark_mask = (r < 50) & (g < 80) & (b < 50)

            if dark_mask.any():
                fix_arr[y0:y0+fh, x][dark_mask] = ref_green
                fixed_count += dark_mask.sum()

print(f"Linke Kante: {fixed_count} dunkle Artefakt-Pixel durch Chroma-Grün ersetzt")

# ---- 5. Croppen auf genutzte Frames ----
crop_h = ROWS_USED * fh
fix_arr_cropped = fix_arr[:crop_h, :]

out_img = Image.fromarray(fix_arr_cropped)
out_img.save("_start_sprites_fixed.png")
print(f"Gespeichert: _start_sprites_fixed.png ({out_img.width}×{out_img.height}px)")
print(f"Original: {W}×{H}px → Reduziert um {100*(1-out_img.width*out_img.height/(W*H)):.1f}%")
