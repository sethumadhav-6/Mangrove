"""Train and export models for Mangrove Live ID (Ultralytics YOLO11).

Species classifier for canopy tiles (or bird crops):
    python train.py cls --data ds_tiles --name kerala-mangrove-cls --model yolo11s-cls.pt --imgsz 224 --epochs 100

Detector for birds and nests (YOLO-format dataset annotated in CVAT / Label Studio / Roboflow):
    python train.py det --data birds_nests.yaml --name kerala-birds-nests --model yolo11s.pt --imgsz 640 --epochs 150

Each run exports <name>.onnx and prints the block to paste into models/config.json.
Copy the .onnx file into the app's models/ folder and redeploy.
"""
import argparse
import json
import shutil
from pathlib import Path

from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('task', choices=['cls', 'det'])
    ap.add_argument('--data', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--model', default=None)
    ap.add_argument('--imgsz', type=int, default=None)
    ap.add_argument('--epochs', type=int, default=100)
    ap.add_argument('--batch', type=int, default=32)
    ap.add_argument('--device', default=None, help='0 for first GPU, cpu for CPU')
    a = ap.parse_args()

    if a.task == 'cls':
        model = YOLO(a.model or 'yolo11s-cls.pt')
        imgsz = a.imgsz or 224
        # Aerial tiles have no "up", so flips are safe. Keep colour jitter mild: canopy colour is a species cue.
        model.train(data=a.data, imgsz=imgsz, epochs=a.epochs, batch=a.batch, device=a.device, name=a.name,
                    fliplr=0.5, flipud=0.5, degrees=180, hsv_h=0.01, hsv_s=0.3, hsv_v=0.3, patience=25)
    else:
        model = YOLO(a.model or 'yolo11s.pt')
        imgsz = a.imgsz or 640
        model.train(data=a.data, imgsz=imgsz, epochs=a.epochs, batch=a.batch, device=a.device, name=a.name,
                    fliplr=0.5, flipud=0.5, degrees=90, mosaic=1.0, patience=40)

    best = Path(model.trainer.best)
    print('validation:', YOLO(best).val(data=a.data, imgsz=imgsz).results_dict if a.task == 'det' else 'see training log')
    onnx = Path(YOLO(best).export(format='onnx', imgsz=imgsz, opset=12, simplify=True, dynamic=False))
    final = Path(f'{a.name}.onnx')
    shutil.copy2(onnx, final)
    names = YOLO(best).names
    labels = [names[i] for i in range(len(names))]

    if a.task == 'cls':
        block = {'tile': {'engine': 'yolo-cls', 'url': f'models/{final.name}', 'imgsz': imgsz, 'labels': labels}}
        hint = 'Use key "tile" for canopy tiles, or rename to "bird" for a bird-crop classifier.'
    else:
        block = {'detector': {'url': f'models/{final.name}', 'imgsz': imgsz, 'labels': labels, 'keep': []},
                 'bird': {'engine': 'none'}}
        hint = 'With a species-level bird detector, set bird.engine to "none" so labels come straight from the detector.'
    print(f'\nExported {final}  ({final.stat().st_size / 1e6:.1f} MB)')
    print('Paste into models/config.json:\n' + json.dumps(block, indent=2))
    print(hint)


if __name__ == '__main__':
    main()
