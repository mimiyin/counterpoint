// Utils for setting up SteamVR config for Vive Tracker without headset
// reference: https://www.youtube.com/watch?v=oCfvbJk-cx0

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const STEAMVR_APP_ID = '250820';

const SECTION_DRIVER_NULL = 'driver_null';
const SECTION_STEAMVR     = 'steamvr';
const FIELD_ENABLE        = 'enable';
const FIELD_REQUIRE_HMD              = 'requireHmd';
const FIELD_FORCED_DRIVER            = 'forcedDriver';
const FIELD_ACTIVATE_MULTIPLE_DRIVERS = 'activateMultipleDrivers';

const getSteamPath = () => {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'C:/Program Files (x86)/Steam';
    }
    throw new Error(`Unsupported platform: ${platform}`);
};

const sleepSync = (ms) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const stopSteamVR = () => {
    try {
        execSync('taskkill /f /im vrserver.exe', { stdio: 'ignore' });
    } catch (_) {}
    sleepSync(2000);
};

const startSteamVR = (steamPath) => {
    const steam = path.join(steamPath, 'steam.exe');
    spawn(steam, ['-applaunch', STEAMVR_APP_ID], { detached: true, stdio: 'ignore' }).unref();
    console.log('SteamVR launching...');
};

const getConfigPaths = (steamPath) => {
    const steamvrPath = path.join(steamPath, 'steamapps/common/SteamVR');
    const nullSettings = path.join(steamvrPath, 'drivers/null/resources/settings/default.vrsettings');
    const vrSettings   = path.join(steamvrPath, 'resources/settings/default.vrsettings');
    return {
        nullSettings,
        nullBackup: nullSettings + '.bak',
        vrSettings,
        vrBackup: vrSettings + '.bak',
    };
};

const setup = () => {
    const steamPath = getSteamPath();
    const { nullSettings, nullBackup, vrSettings, vrBackup } = getConfigPaths(steamPath);

    // --- Pre-flight checks ---
    if (fs.existsSync(nullBackup)) {
        throw new Error(`Backup already exists: ${nullBackup}\nRun recover() first.`);
    }
    if (fs.existsSync(vrBackup)) {
        throw new Error(`Backup already exists: ${vrBackup}\nRun recover() first.`);
    }

    const cfg = JSON.parse(fs.readFileSync(nullSettings, 'utf8'));
    if (!(SECTION_DRIVER_NULL in cfg)) {
        throw new Error(`Section '${SECTION_DRIVER_NULL}' not found in null driver settings — unexpected config structure.`);
    }
    if (!(FIELD_ENABLE in cfg[SECTION_DRIVER_NULL])) {
        throw new Error(`Field '${SECTION_DRIVER_NULL}.${FIELD_ENABLE}' not found in null driver settings — unexpected config structure.`);
    }
    if (cfg[SECTION_DRIVER_NULL][FIELD_ENABLE] === true) {
        throw new Error(`${SECTION_DRIVER_NULL}.${FIELD_ENABLE} is already true — looks like setup was already applied.`);
    }

    const vr = JSON.parse(fs.readFileSync(vrSettings, 'utf8'));
    if (!(SECTION_STEAMVR in vr)) {
        throw new Error(`Section '${SECTION_STEAMVR}' not found in SteamVR settings — unexpected config structure.`);
    }
    const sv = vr[SECTION_STEAMVR];
    [FIELD_REQUIRE_HMD, FIELD_FORCED_DRIVER, FIELD_ACTIVATE_MULTIPLE_DRIVERS].forEach(field => {
        if (!(field in sv)) {
            throw new Error(`Field '${SECTION_STEAMVR}.${field}' not found in SteamVR settings — unexpected config structure.`);
        }
    });
    if (sv[FIELD_REQUIRE_HMD] === false || sv[FIELD_FORCED_DRIVER] === 'null' || sv[FIELD_ACTIVATE_MULTIPLE_DRIVERS] === true) {
        throw new Error('SteamVR settings already have setup values applied.');
    }

    // --- Apply patches ---
    stopSteamVR();

    fs.copyFileSync(nullSettings, nullBackup);
    console.log(`Backed up: ${nullBackup}`);
    cfg[SECTION_DRIVER_NULL][FIELD_ENABLE] = true;
    fs.writeFileSync(nullSettings, JSON.stringify(cfg, null, 4), 'utf8');
    console.log(`${SECTION_DRIVER_NULL}.${FIELD_ENABLE} = true`);

    fs.copyFileSync(vrSettings, vrBackup);
    console.log(`Backed up: ${vrBackup}`);
    sv[FIELD_REQUIRE_HMD]              = false;
    sv[FIELD_FORCED_DRIVER]            = 'null';
    sv[FIELD_ACTIVATE_MULTIPLE_DRIVERS] = true;
    fs.writeFileSync(vrSettings, JSON.stringify(vr, null, 4), 'utf8');
    console.log('steamvr: requireHmd=false, forcedDriver=null, activateMultipleDrivers=true');

    startSteamVR(steamPath);
};

const recover = () => {
    const steamPath = getSteamPath();
    const { nullSettings, nullBackup, vrSettings, vrBackup } = getConfigPaths(steamPath);

    // --- Pre-flight checks ---
    if (!fs.existsSync(nullSettings)) {
        throw new Error(`File not found: ${nullSettings}\nCheck the Steam path in getSteamPath().`);
    }
    if (!fs.existsSync(vrSettings)) {
        throw new Error(`File not found: ${vrSettings}\nCheck the Steam path in getSteamPath().`);
    }
    if (!fs.existsSync(nullBackup) && !fs.existsSync(vrBackup)) {
        throw new Error('No backups found — setup() may not have been run.');
    }

    // --- Restore and delete backups ---
    stopSteamVR();

    if (fs.existsSync(nullBackup)) {
        fs.copyFileSync(nullBackup, nullSettings);
        fs.unlinkSync(nullBackup);
        console.log('Restored null driver settings.');
    } else {
        console.warn(`Warning: backup not found: ${nullBackup}`);
    }

    if (fs.existsSync(vrBackup)) {
        fs.copyFileSync(vrBackup, vrSettings);
        fs.unlinkSync(vrBackup);
        console.log('Restored SteamVR settings.');
    } else {
        console.warn(`Warning: backup not found: ${vrBackup}`);
    }

    startSteamVR(steamPath);
};

module.exports = { setup, recover };
