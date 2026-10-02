#!/usr/bin/env python3
"""Bir sprite sayfasındaki ayrı nesneleri (alfa bağlantılı bileşenler) bulur."""
import sys, json
from PIL import Image, ImageDraw
import numpy as np

def components(path, gap=2, min_area=40):
    im = Image.open(path).convert('RGBA')
    A = np.array(im)[:, :, 3] > 8
    # yakın pikselleri birleştirmek için genişlet
    from collections import deque
    H, W = A.shape
    if gap > 0:
        B = A.copy()
        for dy in range(-gap, gap + 1):
            for dx in range(-gap, gap + 1):
                B |= np.roll(np.roll(A, dy, 0), dx, 1)
    else:
        B = A
    lab = np.zeros((H, W), dtype=np.int32)
    n = 0
    boxes = []
    for y in range(H):
        for x in range(W):
            if B[y, x] and lab[y, x] == 0:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                x0 = x1 = x; y0 = y1 = y
                while q:
                    cy, cx = q.popleft()
                    for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0 <= ny < H and 0 <= nx < W and B[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                            x0 = min(x0, nx); x1 = max(x1, nx); y0 = min(y0, ny); y1 = max(y1, ny)
                # gerçek (genişletilmemiş) sınırlar
                sub = A[y0:y1+1, x0:x1+1] & (lab[y0:y1+1, x0:x1+1] == n)
                if sub.sum() < min_area:
                    continue
                ys, xs = np.where(sub)
                boxes.append((int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max() + 1), int(y0 + ys.max() + 1)))
    boxes.sort(key=lambda b: (b[1] // 16, b[0]))
    return im, boxes

if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    gap = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    im, boxes = components(path, gap)
    z = 2 if im.width <= 512 else 1
    bg = Image.new('RGBA', im.size, (60, 90, 60, 255)); bg.alpha_composite(im)
    bg = bg.resize((im.width * z, im.height * z), Image.NEAREST)
    d = ImageDraw.Draw(bg)
    for i, b in enumerate(boxes):
        d.rectangle([b[0]*z, b[1]*z, b[2]*z-1, b[3]*z-1], outline=(255, 0, 0))
        d.text((b[0]*z + 1, b[1]*z), str(i), fill=(255, 255, 0))
    bg.save(out)
    json.dump(boxes, open(out + '.json', 'w'))
    print(len(boxes), 'bileşen')
