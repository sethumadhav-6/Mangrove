"""Replace ground-station GPS in an app export with the drone's own position, taken from the DJI .SRT
telemetry file recorded with the video. In the DJI app, turn on "Video caption" / subtitles so the .SRT is saved.

    python geotag_from_srt.py --export mangrove-live-id_survey_2026-10-18.zip --srt DJI_0123.SRT [--srt DJI_0124.SRT] --tz +05:30

This writes <export>_drone.csv and <export>_drone.geojson. The position is the drone's, which is the point under
the camera when the gimbal points straight down (-90°). With an oblique gimbal, the snapped object is ahead of
the drone.

It handles the common DJI SRT styles:
  [latitude: 10.01234] [longitude: 76.23456] [rel_alt: 30.0 abs_alt: 35.2]   (Mini 3/4, Air 2S, Mavic 3)
  GPS(76.23456,10.01234,30)  plus a "2026-10-18 07:52:10" line           (older Phantom / Mavic)
"""
import argparse
import bisect
import csv
import io
import json
import re
import zipfile
from datetime import datetime, timedelta, timezone

DT = re.compile(r'(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:[.,](\d+))?')
LAT = re.compile(r'latitude\s*:\s*(-?\d+\.\d+)')
LON = re.compile(r'longitude\s*:\s*(-?\d+\.\d+)')
REL = re.compile(r'rel_alt\s*:\s*(-?\d+\.?\d*)')
ABS = re.compile(r'abs_alt\s*:\s*(-?\d+\.?\d*)')
OLD = re.compile(r'GPS\s*\(\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.?\d*)')


def parse_tz(s):
    sign = -1 if s.startswith('-') else 1
    h, m = s.lstrip('+-').split(':')
    return timezone(sign * timedelta(hours=int(h), minutes=int(m)))


def read_srt(path, tz):
    pts = []
    text = open(path, encoding='utf-8', errors='ignore').read()
    for block in re.split(r'\n\s*\n', text):
        d = DT.search(block)
        if not d:
            continue
        frac = (d.group(3) or '0')[:6].ljust(6, '0')
        t = datetime.strptime(f'{d.group(1)} {d.group(2)}.{frac}', '%Y-%m-%d %H:%M:%S.%f').replace(tzinfo=tz)
        lat, lon, alt = LAT.search(block), LON.search(block), REL.search(block) or ABS.search(block)
        if lat and lon:
            pts.append((t.timestamp(), float(lat.group(1)), float(lon.group(1)), float(alt.group(1)) if alt else None))
            continue
        o = OLD.search(block)
        if o:
            pts.append((t.timestamp(), float(o.group(2)), float(o.group(1)), float(o.group(3))))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--export', required=True, help='ZIP exported from the app (or its snapshots.csv)')
    ap.add_argument('--srt', action='append', required=True)
    ap.add_argument('--tz', default='+05:30', help='time zone of the SRT clock (drone/controller local time)')
    ap.add_argument('--max-gap', type=float, default=3.0, help='max seconds between snap and nearest SRT record')
    a = ap.parse_args()

    tz = parse_tz(a.tz)
    pts = sorted(p for s in a.srt for p in read_srt(s, tz))
    if not pts:
        raise SystemExit('No positions found in the SRT file(s).')
    times = [p[0] for p in pts]

    if a.export.endswith('.zip'):
        with zipfile.ZipFile(a.export) as z:
            rows = list(csv.DictReader(io.StringIO(z.read('snapshots.csv').decode('utf-8'))))
    else:
        rows = list(csv.DictReader(open(a.export, encoding='utf-8')))

    feats, matched = [], 0
    for r in rows:
        t = datetime.fromisoformat(r['timestamp_utc'].replace('Z', '+00:00')).timestamp()
        i = bisect.bisect_left(times, t)
        best = min((j for j in (i - 1, i) if 0 <= j < len(pts)), key=lambda j: abs(times[j] - t))
        gap = abs(times[best] - t)
        if gap <= a.max_gap:
            _, lat, lon, alt = pts[best]
            r.update(drone_lat=lat, drone_lon=lon, drone_rel_alt_m=alt, srt_gap_s=round(gap, 2))
            matched += 1
            feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                          'properties': {k: r.get(k) for k in ('id', 'timestamp_utc', 'label', 'verified_label', 'scientific_name', 'category', 'confidence', 'frame_file')} | {'drone_rel_alt_m': alt}})
        else:
            r.update(drone_lat='', drone_lon='', drone_rel_alt_m='', srt_gap_s=round(gap, 2))

    base = a.export.rsplit('.', 1)[0]
    with open(f'{base}_drone.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(f'{base}_drone.geojson', 'w'), indent=1)
    print(f'{matched}/{len(rows)} snaps matched to drone positions -> {base}_drone.csv, {base}_drone.geojson')


if __name__ == '__main__':
    main()
