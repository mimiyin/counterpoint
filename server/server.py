import argparse
import time

import socketio
from aiohttp import web

from openvr_tracker import OpenVRTracker

PORT = 8002
RATE = 60  # Broadcasts per second

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)


@sio.event
async def connect(sid, environ):
    print('Connected: ', sid)


@sio.event
async def disconnect(sid, reason):
    print('Disconnected: ', sid, 'reason: ', reason)


TRACKERS = {
    'openvr': OpenVRTracker,
}


def ask_tracker():
    names = list(TRACKERS)
    print('Tracker options:')
    for n, name in enumerate(names):
        print('  ' + str(n + 1) + '. ' + name)
    while True:
        answer = input('Select tracker [1]: ').strip().lower() or '1'
        if answer in TRACKERS:
            return answer
        if answer.isdigit() and 0 < int(answer) <= len(names):
            return names[int(answer) - 1]
        print('Not an option: ' + answer)


async def broadcast(source):
    try:
        while True:
            trackers = source.read()
            await sio.emit('trackers', {'ts': time.time(), 'trackers': trackers})
            await sio.sleep(1 / RATE)
    except Exception as e:
        print('Stopped reading trackers:', repr(e))
    finally:
        source.close()


async def start(app):
    app['broadcast'] = sio.start_background_task(broadcast, app['source'])


async def stop(app):
    app['broadcast'].cancel()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=PORT)
    args = parser.parse_args()
    tracker = ask_tracker()
    # TODO: set up the headsetless config if open vr tracker is selected
    app['source'] = TRACKERS[tracker]()
    print('Reading trackers from', tracker)

    app.on_startup.append(start)
    app.on_cleanup.append(stop)
    web.run_app(app, port=args.port)
