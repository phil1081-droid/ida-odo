"""
Reparatur start_sprites.png — Flood-Fill-Ansatz:
Nur schwarze Pixel ersetzen, die vom Frame-Rand aus ERREICHBAR sind
(ohne grüne Pixel zu überqueren). Charakter-Umrisse innen bleiben intact.
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = "start_sprites_ORIG.png"   # immer vom Original arbeiten
OUT = "start_sprites.png"
COLS = 8
ROWS_USED = 14
ROWS_TOTAL = 25

CHROMA_GREEN = np.array([109, 253, 75], dtype=np.uint8)

img = Image.open(SRC).convert("RGB")
arr = np.array(img)
W, H = img.width, img.height
fw = W // COLS
fh = H // ROWS_TOTAL

print(f"Quelle: {W}x{H}px, Frame: {fw}x{fh}px")
print(f"Bearbeite {ROWS_USED}x{COLS} = {ROWS_USED*COLS} Frames...")

fix_arr = arr.copy()
total_filled = 0

def flood_fill_from_edges(frame_slice, chroma_green):
    """
    BFS vom Rand: Ersetzt schwarze/dunkle Pixel, die vom Bildrand aus erreichbar sind.
    Grüne Pixel stoppen die Ausbreitung (sie sind der 'echte' Hintergrund).
    """
    h, w = frame_slice.shape[:2]
    r = frame_slice[:,:,0].astype(np.int32)
    g = frame_slice[:,:,1].astype(np.int32)
    b = frame_slice[:,:,2].astype(np.int32)

    # Pixel ist "dunkel" (Artefakt-Kandidat): sehr dunkle Werte
    dark = (r < 60) & (g < 100) & (b < 60)

    filled = np.zeros((h, w), dtype=bool)
    q = deque()

    # Alle Rand-Pixel die dunkel sind, als Start-Seeds
    for x in range(w):
        if dark[0, x] and not filled[0, x]:
            q.append((0, x)); filled[0, x] = True
        if dark[h-1, x] and not filled[h-1, x]:
            q.append((h-1, x)); filled[h-1, x] = True
    for y in range(1, h-1):
        if dark[y, 0] and not filled[y, 0]:
            q.append((y, 0)); filled[y, 0] = True
        if dark[y, w-1] and not filled[y, w-1]:
            q.append((y, w-1)); filled[y, w-1] = True

    # BFS: expandiere nur auf dunkle Nachbarn
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = cy+dy, cx+dx
            if 0 <= ny < h and 0 <= nx < w and not filled[ny,nx] and dark[ny,nx]:
                filled[ny,nx] = True
                q.append((ny, nx))

    return filled

for row in range(ROWS_USED):
    for col in range(COLS):
        x0 = col * fw
        y0 = row * fh

        frame = fix_arr[y0:y0+fh, x0:x0+fw]
        filled_mask = flood_fill_from_edges(frame, CHROMA_GREEN)

        # Setze gefüllte Pixel auf Chroma-Grün
        frame[filled_mask] = CHROMA_GREEN
        total_filled += int(filled_mask.sum())

    if (row+1) % 2 == 0:
        print(f"  Row {row+1}/{ROWS_USED} fertig...")

print(f"Flood-Fill: {total_filled} Rand-Artefakt-Pixel ersetzt")

# Crop auf 14 Rows
crop_h = ROWS_USED * fh
out_img = Image.fromarray(fix_arr[:crop_h, :])
out_img.save(OUT)
print(f"Gespeichert: {OUT} ({out_img.width}x{out_img.height}px)")

orig_size_kb = W * H * 3 // 1024
new_size_kb  = out_img.width * out_img.height * 3 // 1024
print(f"Rohdaten: {orig_size_kb} KB -> {new_size_kb} KB")

# Vorschau
out_img.crop((0, 0, fw, fh)).save("_frame_000_ff.png")
mid_row = 5
out_img.crop((0, mid_row*fh, fw, (mid_row+1)*fh)).save(f"_frame_r{mid_row}c0_ff.png")
print("Vorschau: _frame_000_ff.png, _frame_r5c0_ff.png")
