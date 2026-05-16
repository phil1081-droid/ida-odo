"""
Reparatur start_sprites.png:
1. Schwarze Randstreifen (links UND rechts jedes Frames) durch Chroma-Gruen ersetzen
2. Crop auf 14 genutzte Rows
3. Ausgabe: start_sprites_fixed.png (bereit zum Einsetzen)
"""
from PIL import Image
import numpy as np

SRC = "start_sprites.png"
OUT = "start_sprites_fixed.png"
COLS = 8
ROWS_USED = 14
ROWS_TOTAL = 25
EDGE_WIDTH = 10  # px die wir links+rechts pro Frame pruefen

CHROMA_GREEN = np.array([109, 253, 75], dtype=np.uint8)

img = Image.open(SRC).convert("RGB")
arr = np.array(img)

W, H = img.width, img.height
fw = W // COLS
fh = H // ROWS_TOTAL

print(f"Quelle: {W}x{H}px, Frame: {fw}x{fh}px")

# Analysiere zuerst: wie weit reicht der schwarze Strip?
print("\nBreite des schwarzen Strips (Row 0, Col 0):")
row0_frame = arr[0:fh, 0:fw]
mid = fh // 2
for x in range(min(20, fw)):
    px = row0_frame[mid, x]
    is_dark = int(px[0]) < 50 and int(px[1]) < 80 and int(px[2]) < 50
    flag = "<-- DUNKEL" if is_dark else ""
    print(f"  x={x:2d}: {tuple(px)} {flag}")

print("\nRechter Rand (Row 0, Col 0), letzten 10 Pixel:")
for x in range(fw-10, fw):
    px = row0_frame[mid, x]
    is_dark = int(px[0]) < 50 and int(px[1]) < 80 and int(px[2]) < 50
    flag = "<-- DUNKEL" if is_dark else ""
    print(f"  x={x:3d}: {tuple(px)} {flag}")

# Reparatur
fix_arr = arr.copy()
total_fixed = 0

for row in range(ROWS_USED):
    for col in range(COLS):
        x0 = col * fw
        y0 = row * fh

        # Linker Rand
        for px in range(EDGE_WIDTH):
            x = x0 + px
            col_pix = fix_arr[y0:y0+fh, x].astype(int)
            dark = (col_pix[:,0] < 50) & (col_pix[:,1] < 80) & (col_pix[:,2] < 50)
            if dark.any():
                fix_arr[y0:y0+fh, x][dark] = CHROMA_GREEN
                total_fixed += int(dark.sum())

        # Rechter Rand
        for px in range(EDGE_WIDTH):
            x = x0 + fw - 1 - px
            col_pix = fix_arr[y0:y0+fh, x].astype(int)
            dark = (col_pix[:,0] < 50) & (col_pix[:,1] < 80) & (col_pix[:,2] < 50)
            if dark.any():
                fix_arr[y0:y0+fh, x][dark] = CHROMA_GREEN
                total_fixed += int(dark.sum())

print(f"\nArtefakte repariert: {total_fixed} Pixel")

# Crop auf genutzte Rows
crop_h = ROWS_USED * fh
out_arr = fix_arr[:crop_h, :]

out_img = Image.fromarray(out_arr)
out_img.save(OUT, optimize=False)
print(f"Gespeichert: {OUT} ({out_img.width}x{out_img.height}px)")

# Originalgroesse vs. neu
orig_size = W * H
new_size = out_img.width * out_img.height
print(f"Frame-Reduktion: {ROWS_TOTAL} -> {ROWS_USED} Rows = {100*(1-new_size/orig_size):.1f}% kleiner")

# Preview: Frame 0 speichern fuer Vergleich
frame0 = out_img.crop((0, 0, fw, fh))
frame0.save("_frame_000_v2.png")
print("Vorschau: _frame_000_v2.png")
