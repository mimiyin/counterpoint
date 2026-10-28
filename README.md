# counterpoint

## NIR camera people detection

Overhead NIR camera feed drives the `nir-tracking` sketch. Install and usage: [nir-serving/README.md](nir-serving/README.md).

## HTC VIVE Setup Without Headset

SteamVR normally refuses to start tracking unless a headset is connected. The scripts in `utils/vive-tracker-headsetless/` change two SteamVR settings files so that VIVE Trackers work with only base stations, and can put the files back afterwards.

### Notes

- Currently, the scripts only support PC.
- Steam installed at `C:/Program Files (x86)/Steam`, with SteamVR installed through it. If Steam is somewhere else, change the path in `getSteamPath()` in `utils/vive-tracker-headsetless/index.js`.
- Base stations powered on, and each VIVE Tracker with its USB dongle plugged in.
- The approach follows this walkthrough: https://www.youtube.com/watch?v=oCfvbJk-cx0

### Turn headset-less mode on

1. Run the following command from the repository root:

```sh
node utils/vive-tracker-headsetless/setup.js
```

2. Turn on the tracker, and you should see it in the SteamVR panel.

### Turn it off again

1. Run the following command from the repository root:

```sh
node utils/vive-tracker-headsetless/recover.js
```

## VIVE Calibration

The `grid_vive_calibration` sketch maps VIVE Tracker positions onto the projected grid. You place a tracker on four points of the grid; the sketch works out how tracker coordinates turn into canvas pixels, checks the result, and saves it as a config file that other sketches can load.

### Notes

- Set up headset-less mode first (above), and turn on only one tracker. The sketch calibrates with the first tracker it hears from.
- The sketch listens over socket.io on port 8001 for `trackers` messages in the format `{ ts, trackers: [{ id, x, y, z }, ...] }`. Whatever provides the tracker data needs to send that.
- Run the sketch fullscreen on the projector, at the same size as the sketches that will use the calibration. The saved distances and offsets are in canvas pixels, so they only fit a canvas of that size.
- The four targets are inset from the edges of the canvas: two cells in from the left and right, one cell in from the top and bottom.

### Run the calibration

1. Open the `grid_vive_calibration` sketch on the projector and make it fullscreen.

2. For each target in turn (top left, top right, bottom left, bottom right), place the tracker on the circle and press ENTER. Keep the tracker still while the prompt shows `Capturing`; each capture takes 1.5 seconds and averages the last 60 readings.

3. At the bottom-right target, the green circle is the target and the red circle is where the calibration puts the tracker. The step passes if they are within a tenth of a cell of each other on both axes.

4. The sketch then switches to free movement: the cell under the tracker turns red. Walk the tracker around the floor to check it follows.

5. Press ENTER to save the calibration. The sketch sends it to the sandbox server, which writes it to `sandbox/config/` as a new file named by local time, for example `grid_vive_calibration_2026-10-28_15-30-05.json`, so earlier calibrations are never overwritten. Nothing is downloaded by the browser. The top-left corner of the screen shows the saved file's name, or why the save failed.

### If a step fails

ENTER repeats the current step. Reloading the page starts the whole calibration again.

| Message | What it means | What to do |
| --- | --- | --- |
| `No tracker data.` | No tracker is sending data, or it went quiet for more than half a second. | Check that the tracker shows in SteamVR and that tracker data is being sent, then press ENTER. |
| `Room calibration failed: ...` (after the bottom-left target) | The first three points do not form a right-angled corner: two were taken at the same spot, they are on one line, or the angle or the scale along the two edges is off. | Reload and redo all four targets, placing the tracker carefully. |
| `Calibration check failed: off by x ... px, z ... px (limit ...)` | The calibration misses the bottom-right target by more than a tenth of a cell. | Press ENTER to measure the bottom-right target again. If it still fails, reload and redo all four. |

### Use the saved calibration in a sketch

Choose a calibration file from `sandbox/config/` and build the store's transformer from it. Positions then come out in canvas pixels: `x` across, `z` down. `y` is height.

```js
import { TrackerStore, connectSocket, createRoomTransformerFromConfig } from '../tracker/index.js';

let config, store;

function preload() {
  config = loadJSON('../config/grid_vive_calibration_2026-10-28_15-30-05.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  store = new TrackerStore(createRoomTransformerFromConfig(config));
  connectSocket(store);
}

window.preload = preload;
window.setup = setup;
```
