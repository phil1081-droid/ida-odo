"""
Prüfe das reparierte Sprite-Sheet: extrahiere Frame 0 aus _start_sprites_fixed.png
"""
from PIL import Image
import numpy as np

COLS = 8
ROWS = 14

img = Image.open("_start_sprites_fixed.png").convert("RGB")
W, H = img.width, img.height
fw = W // COLS
fh = H // ROWS

print(f"Fixed: {W}x{H}px, Frame: {fw}x{fh}px")

# Extrahiere Frame 0
x0, y0 = 0, 0
frame0 = img.crop((x0, y0, x0+fw, y0+fh))
frame0.save("_frame_000_fixed.png")
print("_frame_000_fixed.png gespeichert")

# Prüfe linke Kante
arr = np.array(frame0)
left4 = arr[:, :4]
dark = (left4[:,:,0] < 50) & (left4[:,:,1] < 80) & (left4[:,:,2] < 50)
print(f"Dunkle Pixel in linken 4px: {dark.sum()} (war: {4*fh})")

# Zeige Pixelwerte der Mitte
mid = fh // 2
print(f"Pixelwerte Mitte (x=0..4): {arr[mid, :5].tolist()}")

# Extrahiere auch Frame 1 (naechste in Row 0)
x1 = fw
frame1 = img.crop((x1, 0, x1+fw, fh))
frame1.save("_frame_001_fixed.png")
print("_frame_001_fixed.png gespeichert")

# Wappen-Zoom: obere Haelfte von Frame 0
wappen = frame0.crop((0, 0, fw, fh//2))
wappen_scaled = wappen.resize((fw*2, fh), Image.NEAREST)
wappen_scaled.save("_wappen_zoom.png")
print("_wappen_zoom.png gespeichert (2x Zoom obere Haelfte)")
