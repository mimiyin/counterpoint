# counterpoint

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
