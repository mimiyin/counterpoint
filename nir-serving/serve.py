"""NIR detector source: overhead camera (or MP4) -> existing Counterpoint Socket.IO.

No persistent person IDs: every message is a complete snapshot of positions.
The Counterpoint Node server handles Socket.IO; this producer POSTs locally to /nir.
"""
import argparse
import json
import math
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / 'config.json'

# `replay` re-sends detections.jsonl, recorded on the old camera setup; it only needs this crop shape.
REPLAY_ROI = (800, 400, 2350, 2300)
# `infer` precedence: command-line flag > config.json > these defaults (current venue).
DEFAULTS = {
    'source': 'http://192.168.0.90/axis-cgi/mjpg/video.cgi?resolution=2992x2992&fps=4',
    'rotate': 61.0,  # degrees clockwise, applied to the whole frame before cropping
    'roi': (621, 621, 2371, 2371),  # x0,y0,x1,y1 pixels of the rotated frame
    'fps': 4.0,
    'confidence': 0.25,
    'device': 'auto',
}
LIVE_RELOAD = ('rotate', 'roi', 'fps', 'confidence')  # applied without restart; source/device need one


def parse_roi(value):
    try:
        parts = tuple(int(v) for v in value.split(','))
    except ValueError as exc:
        raise argparse.ArgumentTypeError('ROI must be x0,y0,x1,y1') from exc
    if len(parts) != 4 or parts[2] <= parts[0] or parts[3] <= parts[1]:
        raise argparse.ArgumentTypeError('ROI must be x0,y0,x1,y1 and x1>x0, y1>y0')
    return parts


def _number(raw, key, low, high, low_open=False):
    value = raw[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{key} must be a number')
    if value < low or value > high or (low_open and value == low):
        raise ValueError(f'{key} out of range')
    return float(value)


def validate_config(raw):
    """Check known keys, return a clean dict. Unknown keys are ignored."""
    if not isinstance(raw, dict):
        raise ValueError('config must be a JSON object')
    out = {}
    if 'source' in raw:
        if not isinstance(raw['source'], str) or not raw['source'].strip():
            raise ValueError('source must be a non-empty string')
        out['source'] = raw['source'].strip()
    if 'rotate' in raw:
        out['rotate'] = _number(raw, 'rotate', -360, 360)
    if 'roi' in raw:
        roi = raw['roi']
        if (not isinstance(roi, (list, tuple)) or len(roi) != 4
                or not all(isinstance(n, int) and not isinstance(n, bool) for n in roi)
                or roi[2] <= roi[0] or roi[3] <= roi[1]):
            raise ValueError('roi must be [x0,y0,x1,y1] integers with x1>x0 and y1>y0')
        out['roi'] = tuple(roi)
    if 'fps' in raw:
        out['fps'] = _number(raw, 'fps', 0, 60, low_open=True)
    if 'confidence' in raw:
        out['confidence'] = _number(raw, 'confidence', 0, 1, low_open=True)
    if 'device' in raw:
        if raw['device'] not in ('auto', 'cpu', 'cuda'):
            raise ValueError('device must be auto, cpu or cuda')
        out['device'] = raw['device']
    return out


class Settings:
    """Effective settings for `infer`; re-reads config.json when it changes.

    Command-line flags always win. A bad edit of the file is reported and ignored
    while running (the previous values stay active); at startup it is an error.
    """

    def __init__(self, cli, path):
        self.cli = validate_config({k: v for k, v in cli.items() if v is not None})
        self.path = path
        self.mtime = None
        self.values = dict(DEFAULTS)
        self._load(initial=True)

    def _load(self, initial=False):
        try:
            mtime = self.path.stat().st_mtime_ns
        except FileNotFoundError:
            mtime = None
        if mtime == self.mtime and not initial:
            return set()
        self.mtime = mtime
        try:
            from_file = validate_config(json.loads(self.path.read_text('utf8'))) if mtime else {}
        except (ValueError, OSError) as exc:
            if initial:
                raise ValueError(f'{self.path}: {exc}') from exc
            print(f'config.json ignored ({exc}); keeping previous settings', flush=True)
            return set()
        new = {**DEFAULTS, **from_file, **self.cli}
        changed = set()
        for key, value in new.items():
            if value != self.values[key]:
                if initial or key in LIVE_RELOAD:
                    changed.add(key)
                else:
                    print(f'config.json: {key} changed; restart serve.py to apply it', flush=True)
                    new[key] = self.values[key]
        self.values = new
        return changed

    def poll(self):
        """Return the set of live-reloadable keys that changed since the last call."""
        return self._load()


def roi_size(roi):
    return {'width': roi[2] - roi[0], 'height': roi[3] - roi[1]}


def publish(url, people, video_time, roi):
    payload = {
        'videoTime': video_time,
        'roi': roi_size(roi),
        'people': people,
    }
    body = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    request = Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urlopen(request, timeout=5) as response:
            if response.status != 204:
                raise RuntimeError(f'Relay returned HTTP {response.status}')
    except URLError as exc:
        raise ConnectionError(f'Cannot POST to {url}; is `node server.js` running?') from exc


def load_model(weights, device):
    import torch
    from rapid_minimal import RAPiD

    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if device == 'cuda' and not torch.cuda.is_available():
        raise RuntimeError('CUDA requested but PyTorch reports it is unavailable')
    if not weights.is_file():
        raise FileNotFoundError(f'RAPiD weights missing: {weights}')
    if device == 'cpu':
        torch.set_num_threads(min(4, torch.get_num_threads()))
    checkpoint = torch.load(weights, map_location='cpu', weights_only=True)
    model = RAPiD()
    model.load_state_dict(checkpoint['model'], strict=True)
    return model.eval().to(device), device


def crop_rotated(frame, roi, rotate):
    """Rotate the whole frame `rotate` degrees clockwise about its centre, then crop roi.

    Same geometry as sandbox/nir-tracking/inspect.html. Only the crop is warped.
    Areas that fall outside the original frame are black.
    """
    import cv2

    x0, y0, x1, y1 = roi
    if rotate % 360 == 0:
        return frame[y0:y1, x0:x1]
    image_height, image_width = frame.shape[:2]
    # OpenCV: positive angle = counter-clockwise, so negate for clockwise.
    matrix = cv2.getRotationMatrix2D((image_width / 2, image_height / 2), -rotate, 1.0)
    matrix[0, 2] -= x0
    matrix[1, 2] -= y0
    return cv2.warpAffine(frame, matrix, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR)


def detect(model, frame, roi, threshold, size=1024, rotate=0.0):
    import cv2
    import numpy as np
    import torch

    x0, y0, x1, y1 = roi
    image_height, image_width = frame.shape[:2]
    if x0 < 0 or y0 < 0 or x1 > image_width or y1 > image_height:
        raise ValueError(f'ROI {roi} outside image {image_width}x{image_height}')
    crop = crop_rotated(frame, roi, rotate)
    h, w = crop.shape[:2]
    scale = size / max(h, w)
    rw, rh = round(w * scale), round(h * scale)
    resized = cv2.resize(crop, (rw, rh))
    left, top = (size - rw) // 2, (size - rh) // 2
    square = np.zeros((size, size, 3), dtype=np.uint8)
    square[top:top + rh, left:left + rw] = resized
    rgb = cv2.cvtColor(square, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0
    tensor = tensor.to(next(model.parameters()).device)
    with torch.inference_mode():
        predictions = model(tensor)[0].cpu().numpy()
    predictions = predictions[predictions[:, 5] >= threshold]
    if not len(predictions):
        return []
    predictions = predictions[np.argsort(-predictions[:, 5])][:650]
    rectangles = [((float(d[0]), float(d[1])),
                   (float(max(d[2], 1)), float(max(d[3], 1))), float(d[4]))
                  for d in predictions]
    keep = cv2.dnn.NMSBoxesRotated(
        rectangles, predictions[:, 5].astype(float).tolist(), threshold, 0.45
    )
    if len(keep) == 0:
        return []
    positions = []
    for d in predictions[np.asarray(keep).reshape(-1)]:
        x = (float(d[0]) - left) / rw
        y = (float(d[1]) - top) / rh
        bw = float(d[2]) / rw * w
        bh = float(d[3]) / rh * h
        if not (0 <= x <= 1 and 0 <= y <= 1):
            continue
        if not (10 <= bw <= 900 and 12 <= bh <= 950):
            continue
        positions.append({'x': round(x, 5), 'y': round(y, 5)})
    return positions


def replay(args):
    """Smoke test with no camera, GPU or model: replay recorded detections at their original pace."""
    if not args.cache.exists():
        raise FileNotFoundError(f'Detections file missing: {args.cache}')
    records = [json.loads(row) for row in args.cache.read_text('utf8').splitlines() if row.strip()]
    if not records:
        raise ValueError(f'Empty detections file: {args.cache}')
    print(f'Replaying {len(records)} snapshots -> {args.url}; Ctrl+C to stop', flush=True)
    while True:
        base = float(records[0]['videoTime'])
        started = time.monotonic()
        for record in records:
            due = started + float(record['videoTime']) - base
            time.sleep(max(0, due - time.monotonic()))
            publish(args.url, record['people'], record['videoTime'], REPLAY_ROI)
        publish(args.url, [], None, REPLAY_ROI)  # prevent stale dots at loop boundary
        if args.once:
            break


def infer(args, settings):
    """Online inference: read MP4 or camera stream and emit detections immediately after inference.

    rotate/roi/fps/confidence come from `settings` and are re-read while running, so edits
    saved from the configure page apply within a frame or two.

    For files, skip source frames when CPU inference is slow so output stays near
    real playback time. Live streams are not tuned for low-latency buffering: keep the
    camera's own fps parameter equal to the fps setting.
    """
    import cv2
    model, device = load_model(args.weights, settings.values['device'])
    source = settings.values['source']
    is_file = not source.lower().startswith(('rtsp://', 'rtsps://', 'http://', 'https://'))
    print(f'RAPiD live inference {device}; source={source}; settings from {settings.path.name} '
          f'(+ command-line flags) -> {args.url}', flush=True)
    print('live settings: ' + ', '.join(f'{k}={settings.values[k]}' for k in LIVE_RELOAD), flush=True)
    last_error = None
    while True:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            raise FileNotFoundError(f'Cannot open video source: {source}')
        source_fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        start = time.monotonic()
        emitted = 0
        last_index = -1
        next_due = start
        try:
            while True:
                changed = settings.poll()
                if changed:
                    print('config reloaded: ' + ', '.join(f'{k}={settings.values[k]}' for k in sorted(changed)), flush=True)
                s = settings.values
                if is_file:
                    if source_fps <= 0 or frame_count <= 0:
                        raise ValueError('MP4 must have FPS and finite frame count')
                    # Process by wall clock, dropping frames when inference lags.
                    elapsed = time.monotonic() - start
                    index = int(elapsed * source_fps)
                    if index >= frame_count:
                        break
                    if index == last_index:
                        time.sleep(0.005)
                        continue
                    cap.set(cv2.CAP_PROP_POS_FRAMES, index)
                    last_index = index
                    timestamp = index / source_fps
                else:
                    timestamp = time.monotonic() - start
                ok, frame = cap.read()
                if not ok:
                    break
                now = time.monotonic()
                if now < next_due:
                    time.sleep(next_due - now)
                # Live stream: this simple reader may lag if inference is slower than capture.
                try:
                    positions = detect(model, frame, s['roi'], s['confidence'], rotate=s['rotate'])
                except ValueError as exc:  # e.g. ROI outside the frame after a config edit
                    if str(exc) != last_error:
                        print(f'skipping frame: {exc}', flush=True)
                        last_error = str(exc)
                    time.sleep(0.5)
                    continue
                last_error = None
                publish(args.url, positions, round(timestamp, 4), s['roi'])
                emitted += 1
                if emitted % 10 == 0:
                    print(f'infer: {emitted} snapshots, video={timestamp:.1f}s, count={len(positions)}', flush=True)
                next_due = time.monotonic() + 1 / s['fps']
        finally:
            cap.release()
        publish(args.url, [], None, settings.values['roi'])
        if args.once or not is_file:
            break
        print('MP4 loop complete; restarting', flush=True)


def main():
    parser = argparse.ArgumentParser(
        description='Counterpoint NIR detection serving. With no arguments: live inference using '
                    'nir-serving/config.json (edit it from /nir-tracking/configure.html).')
    parser.add_argument('mode', nargs='?', choices=['infer', 'replay'], default='infer',
                        help='infer (default): live detection; replay: re-send recorded detections.jsonl (no camera/GPU/model needed)')
    parser.add_argument('--source', default=None, help='overrides config.json: camera URL, RTSP URL or MP4 path')
    parser.add_argument('--weights', type=Path, default=HERE / 'weights/pL1_MWHB1024_Mar11_4000.ckpt')
    parser.add_argument('--cache', type=Path, default=HERE / 'detections.jsonl', help='detections file used by replay')
    parser.add_argument('--roi', type=parse_roi, default=None, help='overrides config.json: crop x0,y0,x1,y1 in pixels, applied AFTER --rotate')
    parser.add_argument('--rotate', type=float, default=None, help='overrides config.json: rotate frame clockwise by this many degrees (about the centre) before cropping')
    parser.add_argument('--fps', type=float, default=None, help='overrides config.json: max detections per second')
    parser.add_argument('--confidence', type=float, default=None, help='overrides config.json')
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default=None, help='overrides config.json')
    parser.add_argument('--url', default='http://127.0.0.1:8001/nir')
    parser.add_argument('--once', action='store_true', help='stop after one MP4 / replay loop')
    args = parser.parse_args()
    settings = None
    if args.mode == 'infer':
        try:
            settings = Settings({k: getattr(args, k) for k in ('source', 'roi', 'rotate', 'fps', 'confidence', 'device')}, CONFIG_PATH)
        except ValueError as exc:
            parser.error(str(exc))
    try:
        if settings:
            infer(args, settings)
        else:
            replay(args)
    except KeyboardInterrupt:
        try:
            publish(args.url, [], None, settings.values['roi'] if settings else REPLAY_ROI)
        except Exception:
            pass
        print('\nStopped NIR source')


if __name__ == '__main__':
    main()
