"""Build an Ultralytics classification dataset (train/val) from:
  * app exports (ZIP files from the gallery, which contain dataset/<tile|bird>/<label>/*.jpg), and/or
  * your own folders of labelled tiles (<label>/*.jpg, e.g. from make_tiles.py).

    python prepare_dataset.py --zips exports/*.zip --folders tiles_labelled --kind tile --out ds_tiles
    python prepare_dataset.py --zips exports/*.zip --kind bird --out ds_birds

Classes with fewer than --min images are dropped, and the script prints what was kept.
"""
import argparse
import glob
import random
import shutil
import zipfile
from collections import defaultdict
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zips', nargs='*', default=[])
    ap.add_argument('--folders', nargs='*', default=[])
    ap.add_argument('--kind', choices=['tile', 'bird'], default='tile')
    ap.add_argument('--out', required=True)
    ap.add_argument('--val', type=float, default=0.2)
    ap.add_argument('--min', type=int, default=15)
    ap.add_argument('--seed', type=int, default=42)
    a = ap.parse_args()

    out = Path(a.out)
    tmp = out / '_collect'
    if out.exists():
        shutil.rmtree(out)
    tmp.mkdir(parents=True)
    by_cls = defaultdict(list)

    zips = [z for pat in a.zips for z in glob.glob(pat)]
    for z in zips:
        with zipfile.ZipFile(z) as zf:
            for name in zf.namelist():
                parts = name.split('/')
                if len(parts) == 4 and parts[0] == 'dataset' and parts[1] == a.kind and parts[3]:
                    label = parts[2]
                    dst = tmp / label / f'{Path(z).stem}_{parts[3]}'
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    dst.write_bytes(zf.read(name))
                    by_cls[label].append(dst)

    for f in a.folders:
        for d in Path(f).iterdir():
            if d.is_dir():
                for img in d.glob('*.*'):
                    if img.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                        by_cls[d.name].append(img)

    random.seed(a.seed)
    kept = {}
    for label, files in sorted(by_cls.items()):
        if label == 'false_positive' or len(files) < a.min:
            print(f'  skip {label:32s} {len(files):5d} images')
            continue
        random.shuffle(files)
        nv = max(1, int(len(files) * a.val))
        for split, subset in (('val', files[:nv]), ('train', files[nv:])):
            d = out / split / label
            d.mkdir(parents=True, exist_ok=True)
            for i, f in enumerate(subset):
                shutil.copy2(f, d / f'{i:06d}{f.suffix.lower()}')
        kept[label] = len(files)
        print(f'  keep {label:32s} {len(files):5d} images')
    shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{len(kept)} classes -> {out}  (train/ and val/)')


if __name__ == '__main__':
    main()
