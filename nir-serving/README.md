# NIR people detection for Counterpoint

Uses an overhead NIR camera (AXIS fisheye) to detect people with the [RAPiD](https://github.com/duanzhiihao/RAPiD) model and drives the `nir-tracking` sketch. It sits beside the existing Pozyx setup and does not change it.

```text
AXIS camera --MJPEG--> serve.py (RAPiD, Python) --POST /nir--> sandbox/server.js (relay.js)
                                                                  --Socket.IO "nir"--> browser sketch
```

- `serve.py` reads frames, rotates and crops them, detects people and POSTs the positions to the local Node server.
- `relay.js` (loaded by `sandbox/server.js`) rebroadcasts them as the `nir` Socket.IO event and serves `GET/PUT /nir/config`.
- `sandbox/nir-tracking/` is the p5.js sketch (white circles) and `configure.html`, the page used to aim the camera.

## Requirements

- git, [Node.js](https://nodejs.org) 18 or newer
- An NVIDIA GPU is strongly recommended (CPU works but is slow, well under 1 frame per second)
- Network access to the camera (see Camera network)
- About 5 GB of disk for the Python environment with CUDA PyTorch

Python and uv do not need to be installed beforehand; the setup script handles uv and creates an isolated environment in `nir-serving/.venv`.

## Install

From the repository root:

```bash
node nir-serving/setup.js
```

The script is safe to re-run. It:

1. runs `npm install` in `sandbox/`
2. finds [uv](https://docs.astral.sh/uv/), or offers to install it with the official installer
3. creates `nir-serving/.venv` (Python 3.11)
4. detects the NVIDIA driver and installs the matching PyTorch build (CUDA 12.8 for driver 570+, CUDA 12.6 for 525+, otherwise CPU), then the packages in `requirements.txt`
5. checks that the model weights are present

Options: `--cpu` forces the CPU build, `--cuda cu126` forces a specific CUDA build.

### Model weights (manual download)

Download `pL1_MWHB1024_Mar11_4000.ckpt` (about 246 MB) from
<https://drive.google.com/drive/folders/1vjXdGT9oiqAUCPA6TDGyumSLaI-vW11I>
and save it as:

```text
nir-serving/weights/pL1_MWHB1024_Mar11_4000.ckpt
```

The weights are not stored in git. Re-run the setup script to confirm they are found.

## Camera network

The camera is at `192.168.0.90` with anonymous viewing enabled. The computer must be on the same subnet:

- Plug into the camera network by Ethernet. If it does not get an address automatically (`192.168.0.x`), set a static one such as `192.168.0.50`, netmask `255.255.255.0`, no gateway.
- Check with `ping 192.168.0.90`, or open `http://192.168.0.90/axis-cgi/mjpg/video.cgi?resolution=2992x2992&fps=1` in a browser.

The camera serves only a few streams at once: the configure page and `serve.py` each use one.

## Run

Two terminals, both starting from the repository root.

```bash
# Terminal 1: Node / Socket.IO server (port 8001)
cd sandbox
node server.js
```

```bash
# Terminal 2: detection (uses nir-serving/config.json)
node nir-serving/run.js
```

Then open:

- <http://localhost:8001/nir-tracking/> the sketch
- <http://localhost:8001/nir-tracking/configure.html> live preview to set rotation and crop

The Pozyx MQTT connection error printed by the server is harmless when that broker is unreachable. Restart `server.js` after pulling changes that touch it.

## Configure

Open the configure page with `serve.py` running. It shows the camera as `serve.py` sees it: rotated, then cropped, with the live detections drawn on top. Adjust rotate (positive is clockwise), crop (numbers or drag the box), fps and confidence, then Save (or Ctrl+S). Saving is refused if the crop leaves the frame.

The settings are stored in `nir-serving/config.json`:

```json
{
  "source": "http://192.168.0.90/axis-cgi/mjpg/video.cgi?resolution=2992x2992&fps=4",
  "rotate": 61,
  "roi": [621, 621, 2371, 2371],
  "fps": 4,
  "confidence": 0.25,
  "device": "auto"
}
```

| Field | Meaning | Applied |
| --- | --- | --- |
| `source` | Camera URL, RTSP URL or MP4 path | restart |
| `rotate` | Degrees clockwise, whole frame about its centre, done before the crop | live |
| `roi` | `[x0, y0, x1, y1]` crop in pixels of the rotated frame | live |
| `fps` | Maximum detections per second | live |
| `confidence` | Detection threshold, 0 to 1 | live |
| `device` | `auto`, `cpu` or `cuda` | restart |

You can also edit the file by hand. Precedence: command-line flag (for example `node nir-serving/run.js --confidence 0.4`) over `config.json` over built-in defaults. Keep `fps=` in the `source` URL equal to `fps` (the page does this for you); if the camera sends more frames than the GPU can process, the picture lags increasingly.

## Test without camera, GPU or weights

With `server.js` running:

```bash
node nir-serving/run.js replay
```

This replays the recorded `detections.jsonl` in a loop; the sketch should show moving circles. The recording uses an older camera geometry, so positions only illustrate the data flow.

## Data contract

`serve.py` POSTs a full snapshot per frame; `server.js` broadcasts it as the `nir` event:

```json
{
  "ts": 1792160000.0,
  "videoTime": null,
  "roi": { "width": 1750, "height": 1750 },
  "count": 2,
  "people": [{ "x": 0.40, "y": 0.55 }, { "x": 0.60, "y": 0.37 }]
}
```

`x` and `y` are normalized to the crop (0 to 1), not ground-plane metres, and mark the centre of the detected box. Each message replaces the previous one; there are no persistent person IDs. `count` is the number of detected candidates, so false positives and misses occur. The relay only accepts `POST /nir` and `/nir/config` from the local machine (loopback).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Python environment not found` | Run `node nir-serving/setup.js` |
| `EADDRINUSE` on port 8001 | `server.js` is already running; use it, or set `PORT` |
| Cannot reach camera | Check the cable, `ping 192.168.0.90`, and that the PC has a `192.168.0.x` address |
| Preview or stream refuses to start | Another client holds the camera's stream slots; close other viewers |
| Save refused: crop outside frame | Reduce the crop or change the rotation; the rotated frame is 2992 x 2992 |
| Very slow detection | CPU build in use. Run `nir-serving/.venv/bin/python -c "import torch; print(torch.cuda.is_available())"` (`.venv\Scripts\python.exe` on Windows); if `False`, update the NVIDIA driver and re-run setup |
| Dots lag behind reality | Lower `fps` (and the `fps=` in the URL) to what the GPU sustains |

## Files

| Path | Purpose |
| --- | --- |
| `setup.js` | One-time installation |
| `run.js` | Starts `serve.py` in the environment; extra arguments are passed through |
| `serve.py` | Reads the camera, detects people, POSTs to the server |
| `rapid_minimal.py` | Inference-only adaptation of RAPiD |
| `relay.js` | Express and Socket.IO hooks used by `sandbox/server.js` |
| `config.json` | Live settings |
| `detections.jsonl` | Recorded detections for `replay` |
| `weights/` | Model weights (downloaded manually, not in git) |

## License

RAPiD is released under a modified MIT license, non-commercial; see `RAPiD_LICENSE.txt` and <https://github.com/duanzhiihao/RAPiD>. Check the terms before any commercial use.
