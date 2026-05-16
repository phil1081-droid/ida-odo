"""
Reparatur start_sprites.png — Scan-and-Stop-Ansatz:
Von jeder Kante einwaerts scannen, dunkle Pixel ersetzen,
STOPPEN beim ersten gruenen Pixel.
Kein Flood-Fill: keine inneren Charakter-Pixel werden beruehrt.
"""
from PIL import Image
import numpy as np

SRC = "start_sprites_ORIG.png"
OUT = "start_sprites.png"
COLS = 8
ROWS_USED = 14
ROWS_TOTAL = 25
MAX_DEPTH = 35   # absolute Sicherheitsgrenze (groesser als der 21px Strip)

CHROMA_GREEN = np.array([109, 253, 75], dtype=np.uint8)

def is_green(r, g, b):
    """Pixel ist 'gruen genug' um als Hintergrund zu gelten."""
    return (int(g) > int(r) * 1.15 and int(g) > int(b) * 1.15 and int(g) >= 55)

def fix_frame_edges(frame_arr):
    """
    Scannt von allen 4 Kanten einwaerts.
    Ersetzt dunkle Pixel bis zum ersten gruenen Pixel.
    """
    h, w = frame_arr.shape[:2]
    result = frame_arr.copy()

    # Links -> Rechts
    for y in range(h):
        for x in range(min(MAX_DEPTH, w)):
            r, g, b = int(result[y,x,0]), int(result[y,x,1]), int(result[y,x,2])
            if is_green(r, g, b):
                break  # ab hier echter Hintergrund, stop
            # Dunkel: ersetzen
            if r < 80 and g < 120 and b < 80:
                result[y, x] = CHROMA_GREEN
            else:
                break  # nicht dunkel, nicht gruen -> Charakter-Content, stop

    # Rechts -> Links
    for y in range(h):
        for x in range(w-1, max(w-1-MAX_DEPTH, -1), -1):
            r, g, b = int(result[y,x,0]), int(result[y,x,1]), int(result[y,x,2])
            if is_green(r, g, b):
                break
            if r < 80 and g < 120 and b < 80:
                result[y, x] = CHROMA_GREEN
            else:
                break

    # Oben -> Unten
    for x in range(w):
        for y in range(min(MAX_DEPTH, h)):
            r, g, b = int(result[y,x,0]), int(result[y,x,1]), int(result[y,x,2])
            if is_green(r, g, b):
                break
            if r < 80 and g < 120 and b < 80:
                result[y, x] = CHROMA_GREEN
            else:
                break

    # Unten -> Oben
    for x in range(w):
        for y in range(h-1, max(h-1-MAX_DEPTH, -1), -1):
            r, g, b = int(result[y,x,0]), int(result[y,x,1]), int(result[y,x,2])
            if is_green(r, g, b):
                break
            if r < 80 and g < 120 and b < 80:
                result[y, x] = CHROMA_GREEN
            else:
                break

    return result

img = Image.open(SRC).convert("RGB")
arr = np.array(img)
W, H = img.width, img.height
fw = W // COLS
fh = H // ROWS_TOTAL

print(f"Quelle: {W}x{H}px, Frame: {fw}x{fh}px")
print(f"Bearbeite {ROWS_USED}x{COLS} Frames...")

fix_arr = arr.copy()
total_changed = 0

for row in range(ROWS_USED):
    for col in range(COLS):
        x0 = col * fw
        y0 = row * fh
        frame = fix_arr[y0:y0+fh, x0:x0+fw].copy()
        fixed = fix_frame_edges(frame)
        diff = (frame != fixed).any(axis=2).sum()
        total_changed += diff
        fix_arr[y0:y0+fh, x0:x0+fw] = fixed
    if (row+1) % 4 == 0:
        print(f"  Row {row+1}/{ROWS_USED} done...")

print(f"Ersetzt: {total_changed} Pixel")

# Crop auf genutzte Rows
crop_h = ROWS_USED * fh
out_img = Image.fromarray(fix_arr[:crop_h, :])
out_img.save(OUT)
print(f"Gespeichert: {OUT} ({out_img.width}x{out_img.height}px)")

# Validierung: wie viele Pixel wurden im Inneren (>35px vom Rand) geaendert?
orig_arr = arr[:crop_h, :]
out_arr  = np.array(out_img)
diff_mask = (orig_arr != out_arr).any(axis=2)
ys, xs = np.where(diff_mask)
inner = 0
for i in range(len(xs)):
    xi, yi = xs[i], ys[i]
    # Position innerhalb des Frames
    lx = xi % fw
    ly = yi % fh
    if lx >= MAX_DEPTH and lx < fw-MAX_DEPTH and ly >= MAX_DEPTH and ly < fh-MAX_DEPTH:
        inner += 1
print(f"Innere Pixel veraendert (>35px vom Rand): {inner}  (sollte 0 sein)")

# Vorschauen
out_img.crop((0, 0, fw, fh)).save("_frame_000_v4.png")
out_img.crop((2*fw, 2*fh, 3*fw, 3*fh)).save("_frame_r2c2_v4.png")
out_img.crop((5*fw, 11*fh, 6*fw, 12*fh)).save("_frame_r11c5_v4.png")
print("Vorschauen: _frame_000_v4.png, _frame_r2c2_v4.png, _frame_r11c5_v4.png")
