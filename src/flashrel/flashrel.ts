import { app, ipcMain } from "electron";
import { FlashReleaseConfig } from "./release_config";
import { ESettingsFlash } from "./flash_settings";
import { createWriteStream, existsSync, unlinkSync, promises as fsPromises } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import * as electronSets from "electron-settings";
import * as path from "path";
import * as url from "url";
import * as tar from "tar";
import got from "got";

const RELEASE_CONFIG = "https://raw.githubusercontent.com/Cassolette/flash-binaries/master/release.json";

var is_installing = false;

interface ReleasePerPlatform {
    version: string;
    name: string;
    url: string;
}

async function getReleaseConfig(): Promise<FlashReleaseConfig> {
    return await got(RELEASE_CONFIG).json() as FlashReleaseConfig;
}

const ARCH_64: { [arch: string]: boolean } = {
    "x64": true,
    "arm64": true,
    "ppc64": true
};

const MAP_TO_FPLATFORM: { [platform: string]: "win" | "lnx" | "mac" } = {
    "win32": "win",
    "linux": "lnx",
    "darwin": "mac"
};

async function getReleasePerPlatform() {
    const farch: "_64" | "_32" = ARCH_64[process.arch] ? "_64" : "_32";
    const rel_config = await getReleaseConfig();
    const fplatform = MAP_TO_FPLATFORM[process.platform];
    const freleases: ReleasePerPlatform[] = [];

    rel_config[fplatform].releases.forEach((rel) => {
        freleases.push({
            version: rel.version,
            name: rel.name,
            url: rel[farch]
        });
    });

    return {
        latest: rel_config[fplatform].latest[farch],
        releases: freleases
    };
}

async function installFlash(version: string) {
    const uninstalls = electronSets.getSync("flash.uninstall") as ESettingsFlash['uninstall'];
    if (Array.isArray(uninstalls) && uninstalls.length > 0) {
        const idx = uninstalls.findIndex(u => u.version == version);
        if (idx !== -1) {
            await electronSets.set("flash.currentVersion", version);
            await electronSets.set("flash.path", uninstalls[idx].path);
            uninstalls.splice(idx, 1);
            if (uninstalls.length > 0) {
                electronSets.setSync("flash.uninstall", uninstalls);
            } else {
                electronSets.unsetSync("flash.uninstall");
            }
            return;
        }
    }

    const releases = (await getReleasePerPlatform()).releases;
    const rel = releases.find(r => r.version == version);

    if (!rel) throw `No such version found.`;

    const filename = path.basename(url.parse(rel.url).pathname);
    const fileExt = path.extname(filename);
    const absoluteFile = path.join(app.getPath("userData"), filename);

    const writeStream = createWriteStream(absoluteFile);
    const streamPipeline = promisify(pipeline);
    try {
        await streamPipeline(got.stream(rel.url), writeStream);
    } catch (e) {
        throw `Unexpected response: ${e}`;
    }

    let finalPath = filename;

    if (fileExt == ".tar") {
        const pluginPath = path.join(app.getPath("userData"), `PepperFlash.${version}.plugin`);

        try {
            await fsPromises.access(pluginPath);
            await fsPromises.rm(pluginPath, { recursive: true });
        } catch (e) {}
        await fsPromises.mkdir(pluginPath, { recursive: true });

        await tar.x({
            file: absoluteFile,
            cwd: pluginPath
        });

        finalPath = pluginPath;
    }

    try {
        await uninstallFlash();
    } catch (e) {}

    await electronSets.set("flash.currentVersion", version);
    await electronSets.set("flash.path", finalPath);
}

async function uninstallFlash() {
    const uninstall_paths = await electronSets.get("flash.uninstall") as ESettingsFlash['uninstall'] || [];
    const fpath = await electronSets.get("flash.path") as ESettingsFlash['path'];
    const version = await electronSets.get("flash.currentVersion") as ESettingsFlash['currentVersion'];

    if (!fpath || !version) throw "No Flash installation is detected";

    uninstall_paths.push({
        path: fpath,
        version: version
    });

    await electronSets.unset("flash.path");
    await electronSets.unset("flash.currentVersion");
    await electronSets.set("flash.uninstall", uninstall_paths);
}

export function initIpc() {
    ipcMain.on("flash-release", (event) => {
        getReleasePerPlatform().then((obj) => {
            event.reply("flash-release", obj);
        }).catch();
    });

    ipcMain.on("install-flash", (event, version) => {
        if (is_installing) {
            event.reply("install-flash-error", "Installation is still in progress.");
            return;
        }
        is_installing = true;
        installFlash(version).then(() => {
            is_installing = false;
            event.reply("install-flash-success");
        }).catch((err) => {
            is_installing = false;
            event.reply("install-flash-error", err);
        });
    });

    ipcMain.on("uninstall-flash", (event) => {
        if (is_installing) {
            event.reply("uninstall-flash-error", "Installation is still in progress.");
            return;
        }
        is_installing = true;
        uninstallFlash().then(() => {
            is_installing = false;
            event.reply("uninstall-flash-success");
        }).catch((err) => {
            is_installing = false;
            event.reply("uninstall-flash-error", err);
        });
    });
}

export function uninstallFlashWorker() {
    const uninstalls = electronSets.getSync("flash.uninstall") as ESettingsFlash['uninstall'];
    if (Array.isArray(uninstalls) && uninstalls.length > 0) {
        const remaining: typeof uninstalls = [];
        for (let i = 0; i < uninstalls.length; i++) {
            const fpath = path.join(app.getPath("userData"), uninstalls[i].path);
            if (existsSync(fpath)) {
                try {
                    unlinkSync(fpath);
                    console.log(`Uninstalled ${uninstalls[i].version}`);
                } catch (e) {
                    console.error(`Could not delete file ${uninstalls[i].path}: ${e}`);
                    remaining.push(uninstalls[i]);
                }
            } else {
                console.log(`Already removed ${uninstalls[i].version}`);
            }
        }

        if (remaining.length > 0) {
            electronSets.setSync("flash.uninstall", remaining);
        } else {
            electronSets.unsetSync("flash.uninstall");
        }
    } else if (uninstalls) {
        electronSets.unsetSync("flash.uninstall");
    }
}
