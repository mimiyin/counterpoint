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

## Test VIVE without a tracker

A fake tracker can stand in for a real one, so the whole chain can be tested on one computer: calibration, saving the config, loading it in a sketch, and positions arriving in `tags`. The fake tracker turns canvas pixels into made-up tracker units and adds a little jitter, so a calibration made with it fits the fake tracker only.

### Make a fake calibration

1. In `sandbox/grid_vive_calibration/sketch.js`, switch the source in `setup()` to the fake one:

```js
connectFake(store, fakeRoomTracker(fakeTrackerPos));
// connectSocket(store);
```

2. Open the sketch fullscreen, at the same size as the sketch you want to test. The fake tracker sits on each target by itself, so just press ENTER at every step. In the free step it moves around on its own.

3. Press ENTER to save. The server writes a new `grid_vive_calibration_<time>.json` to `sandbox/config/`.

To see a failed check instead, uncomment the lines at the top of `fakeTrackerPos()`. The fake tracker then lands off the bottom-right target.

### Run a Pozyx sketch on the fake tracker

The `grid_pozyx_*` sketches get positions from `sandbox/pozyx.js`. In that file:

1. Select the VIVE source:

```js
// const SOURCE = 'pozyx';
const SOURCE = 'vive';
```

2. Set `VIVE_CONFIG` to the fake calibration you just saved, for example `'/config/grid_vive_calibration_2026-10-28_15-30-05.json'`.

3. Uncomment the fake tracker in `listen_vive()`. `fake1` follows the mouse. Also uncomment `fake2`, which mirrors the mouse, for sketches that need two movers, such as `grid_pozyx_notes` and `grid_pozyx_rhythms`.

```js
connectFake({ update: on_trackers }, fakeRoomTracker(() => ({ x: mouseX, y: mouseY })));
connectFake({ update: on_trackers }, fakeRoomTracker(() => ({ x: width - mouseX, y: mouseY }), 'fake2'));
```

4. Open the sketch at the same fullscreen size and hover the mouse. A mover should follow it within a quarter of a second, the time it takes to collect the 15 readings each position is averaged over. In `grid_pozyx_one_tag_interaction`, press `i` first to switch to tracker input.

If nothing shows up, check the console for `VIVE tracking did not start: ...`.

### Before committing

- Comment the `connectFake` lines out again, in both `pozyx.js` and the calibration sketch, and switch the calibration sketch back to `connectSocket(store)`.
- Set `SOURCE` back to the source the sketches should use.
- Delete the fake calibration from `sandbox/config/`, and point `VIVE_CONFIG` at a real one.
