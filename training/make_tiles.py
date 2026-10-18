"""Cut drone photos and/or flight videos into tiles that match what the live app classifies.

The app splits each frame into a grid of square-ish tiles (Settings -> "Canopy grid rows", default 3).
Training tiles must look the same, so use the same --rows value you fly with.

    python make_tiles.py --input D:/flights/puthuvype --out tiles_unlabelled --rows 3 --every 2

Sort the tiles into folders named after the species ids in js/kb.js (e.g. avicennia_officinalis/,
rhizophora_mucronata/, acanthus_ilicifolius/, open_water/, mudflat/ ...). Then run prepare_dataset.py.
"""
import argparse
from pathlib import Path

import cv2

IMG = {'.jpg', '.jpeg', '.png', '.tif', '.tiff'}
VID = {'.mp4', '.mov', '.mkv', '.avi'}


def tiles(img, rows):
    h, w = img.shape[:2]
    th = h / rows
    cols = max(1, round(w / th))
    tw = w / cols
    for r in range(rows):
        for c in range(cols):
            y0, y1, x0, x1 = int(r * th), int((r + 1) * th), int(c * tw), int((c + 1) * tw)
            yield r, c, img[y0:y1, x0:x1]


def frames_from_video(path, every_s, max_w):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(round(fps * every_s)))
    i = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if i % step == 0:
            ok, f = cap.retrieve()
            if ok:
                yield i / fps, resize(f, max_w)
        i += 1
    cap.release()


def resize(img, max_w):
    h, w = img.shape[:2]
    if w <= max_w:
        return img
    s = max_w / w
    return cv2.resize(img, (max_w, int(h * s)), interpolation=cv2.INTER_AREA)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='folder with drone photos and/or videos')
    ap.add_argument('--out', default='tiles_unlabelled')
    ap.add_argument('--rows', type=int, default=3)
    ap.add_argument('--every', type=float, default=2.0, help='seconds between video frames')
    ap.add_argument('--max-width', type=int, default=1920, help='match the live feed resolution')
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in sorted(Path(a.input).rglob('*')):
        ext = p.suffix.lower()
        if ext in IMG:
            src = [(0, resize(cv2.imread(str(p)), a.max_width))]
        elif ext in VID:
            src = frames_from_video(p, a.every, a.max_width)
        else:
            continue
        for t, img in src:
            if img is None:
                continue
            for r, c, tile in tiles(img, a.rows):
                cv2.imwrite(str(out / f'{p.stem}_t{t:07.1f}_r{r}c{c}.jpg'), tile, [cv2.IMWRITE_JPEG_QUALITY, 92])
                n += 1
    print(f'{n} tiles written to {out}')


if __name__ == '__main__':
    main()
