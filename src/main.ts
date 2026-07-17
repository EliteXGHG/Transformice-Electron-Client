import { app, globalShortcut, BrowserWindow, crashReporter, ipcMain, shell } from "electron";
import { TeGames } from "./te-enums";
import { TeWindow } from "./TeWindow";
import { WindowTransformice } from "./WindowTransformice";
import { WindowDeadMaze } from "./WindowDeadMaze";
import { retrieveServer } from "./te-server";
import { initIpc, uninstallFlashWorker } from "./flashrel/flashrel";
import { ArgpObject } from "./argparser";
import { initLogger, logger } from "./logger";
import { exportSettings, importSettings } from "./settings-io";
import * as electronSets from "electron-settings";
import * as path from "path";
import * as fs from "fs";

crashReporter.start({ submitURL: "" });
initLogger();

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-dev-shm-usage");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("ignore-gpu-driver-bugs");
app.commandLine.appendSwitch("enable-webgl");
app.commandLine.appendSwitch("enable-webgl2");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("force_high_performance_gpu");
app.commandLine.appendSwitch("high-dpi-support", "1");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

const flashFiles: Record<string, string> = { win32: "pepflashplayer64_32_0_0_371.dll", linux: "libpepflashplayer64_32_0_0_371.so", darwin: "PepperFlashPlayer.plugin" };
const platformMap: Record<string, string> = { win32: "win", darwin: "mac", linux: "lnx" };

const ALLOWED_DOMAINS = ["transformice.com", "atelier801.com", "github.com"];
app.on("web-contents-created", (_, contents) => {
    contents.on("will-navigate", (e, url) => {
        try { if (!ALLOWED_DOMAINS.includes(new URL(url).hostname)) e.preventDefault(); } catch { e.preventDefault(); }
    });
    contents.on("new-window", (e, url) => {
        try { if (!ALLOWED_DOMAINS.includes(new URL(url).hostname)) { e.preventDefault(); return; } } catch { e.preventDefault(); }
        shell.openExternal(url);
    });
});

const getFlashPath = () => {
    const flashFile = flashFiles[process.platform];
    const platform = platformMap[process.platform];
    return app.isPackaged
        ? path.join(process.resourcesPath, "app.asar.unpacked", "flash-plugin", platform, flashFile)
        : path.join(__dirname, "..", "flash-plugin", platform, flashFile);
};

const processCustomFlashPlugin = (): boolean => {
    try {
        uninstallFlashWorker();
        const customPath = electronSets.getSync("flash.path") as string;
        if (electronSets.getSync("flash.enable") && customPath) {
            app.commandLine.appendSwitch("ppapi-flash-path", path.join(app.getPath("userData"), customPath));
            return true;
        }
    } catch { }
    return false;
};

const addFlashPlugin = () => {
    if (processCustomFlashPlugin()) return;
    const flashFile = flashFiles[process.platform];
    if (flashFile) app.commandLine.appendSwitch("ppapi-flash-path", getFlashPath());
};

const createWindow = (gameType: TeGames, httpUrl: string): TeWindow => {
    if (gameType === TeGames.DEADMAZE) return new WindowDeadMaze(httpUrl);
    return new WindowTransformice(httpUrl);
};

const shot = (win: BrowserWindow) => {
    const d = path.join(app.getPath("pictures"), "Elite Electron Client");
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    win.webContents.capturePage().then((img: any) => {
        if (img && img.toPNG().length > 0) {
            fs.writeFileSync(path.join(d, `screenshot_${Date.now()}.png`), img.toPNG());
        }
    }).catch(() => {});
};

const zoom = (() => {
    let t: NodeJS.Timeout;
    return (win: BrowserWindow, dir: number) => {
        clearTimeout(t);
        t = setTimeout(() => {
            if (win.isDestroyed()) return;
            const step = (parseFloat(electronSets.getSync("window.zoomStep") as string) || 1) / 100;
            win.webContents.setZoomFactor(Math.min(Math.max(win.webContents.getZoomFactor() + (dir > 0 ? step : -step), 0.25), 5));
        }, 16);
    };
})();

const regShortcuts = (win: BrowserWindow) => {
    const reg = (k: string, fn: () => void) => {
        try { globalShortcut.register(k, () => { if (win && !win.isDestroyed()) fn(); }); } catch { }
    };
    
    reg("CmdOrCtrl+Shift+T", () => win.setAlwaysOnTop(!win.isAlwaysOnTop()));
    reg("CmdOrCtrl+Shift+S", () => shot(win));
    reg("CmdOrCtrl+Shift+I", () => win.webContents.toggleDevTools());
    reg("F11", () => win.setFullScreen(!win.isFullScreen()));
    reg("CmdOrCtrl+Plus", () => zoom(win, 1));
    reg("CmdOrCtrl+=", () => zoom(win, 1));
    reg("CmdOrCtrl+Minus", () => zoom(win, -1));
    reg("CmdOrCtrl+0", () => win.webContents.setZoomFactor(1));
    reg("CmdOrCtrl+R", () => win.webContents.reload());

    const custom = (electronSets.getSync("shortcuts.custom") as Record<string, string>) || {};
    const actions: Record<string, () => void> = {
        "toggle-fullscreen": () => win.setFullScreen(!win.isFullScreen()),
        "toggle-always-on-top": () => win.setAlwaysOnTop(!win.isAlwaysOnTop()),
        "screenshot": () => shot(win),
        "zoom-in": () => zoom(win, 1),
        "zoom-out": () => zoom(win, -1),
        "reset-zoom": () => win.webContents.setZoomFactor(1),
        "reload": () => win.webContents.reload(),
        "devtools": () => win.webContents.toggleDevTools(),
        "clear-cache": () => win.webContents.session.clearCache(),
        "toggle-menu": () => win.setMenuBarVisibility(!win.isMenuBarVisible())
    };
    Object.keys(custom).forEach(k => { const a = actions[custom[k]]; if (a) reg(k, a); });
};

addFlashPlugin();
initIpc();

ipcMain.on("set-always-on-top", (_, enable: boolean) => {
    if (mainWindow) mainWindow.browserWindow.setAlwaysOnTop(enable);
});

ipcMain.on("clear-cache", async (event) => {
    if (!mainWindow) return;
    try {
        const before = await mainWindow.browserWindow.webContents.session.getCacheSize();
        await mainWindow.browserWindow.webContents.session.clearCache();
        event.reply("cache-cleared", { freed: before });
    } catch { event.reply("cache-cleared", { freed: 0 }); }
});

ipcMain.on("export-settings", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.send("export-settings-result", await exportSettings(win));
});

ipcMain.on("import-settings", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.send("import-settings-result", await importSettings(win));
});

let mainWindow: TeWindow | null = null;

ipcMain.on("set-menu-hide-mode", (_, mode: string) => {
    if (mainWindow) mainWindow.updateMenuBar();
});

ipcMain.on("get-logs", (event) => {
    try {
        const logPath = path.join(app.getPath("userData"), "logs", "main.log");
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, "utf-8");
            event.reply("get-logs-result", content.slice(-50000));
        } else {
            event.reply("get-logs-result", "(no log file)");
        }
    } catch { event.reply("get-logs-result", "(error reading log)"); }
});

ipcMain.on("get-diagnostics", async (event) => {
    try {
        const cacheSize = mainWindow ? await mainWindow.browserWindow.webContents.session.getCacheSize() : 0;
        const b = mainWindow ? mainWindow.browserWindow.getBounds() : null;
        const platform = process.platform + " " + process.arch;
        const flashBundled = flashFiles[process.platform] || "none";
        const flashInstalled = electronSets.getSync("flash.currentVersion") as string || "None";
        const flashEnabled = !!electronSets.getSync("flash.enable");
        const winSize = b ? b.width + "x" + b.height : "?";
        const uptime = Math.floor(process.uptime()) + "s";
        event.reply("get-diagnostics-result", {
            platform, flashBundled, flashInstalled, flashEnabled,
            cacheSize: cacheSize > 0 ? (cacheSize / 1024).toFixed(1) + " KB" : "0 KB",
            windowSize: winSize, uptime, electron: process.versions.electron
        });
    } catch { event.reply("get-diagnostics-result", {}); }
});

ipcMain.on("open-log-folder", () => {
    const logPath = path.join(app.getPath("userData"), "logs");
    shell.openPath(logPath);
});

ipcMain.on("open-screenshot-folder", () => {
    const dir = path.join(app.getPath("pictures"), "Elite Electron Client");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
});

ipcMain.on("clear-logs", async (event) => {
    try {
        const logPath = path.join(app.getPath("userData"), "logs", "main.log");
        if (fs.existsSync(logPath)) fs.writeFileSync(logPath, "");
        event.reply("clear-logs-result", true);
    } catch {
        event.reply("clear-logs-result", false);
    }
});

ipcMain.on("settings-get", (event, key: string) => {
    event.returnValue = electronSets.getSync(key);
});
ipcMain.on("settings-set", (event, key: string, value: any) => {
    electronSets.setSync(key, value);
    event.returnValue = true;
});

ipcMain.on("get-cache-info", async (event) => {
    try {
        const cachePath = app.getPath("cache");
        const size = await (mainWindow ? mainWindow.browserWindow.webContents.session.getCacheSize() : Promise.resolve(0));
        event.reply("cache-info", { size, path: cachePath });
    } catch { event.reply("cache-info", { size: 0, path: "" }); }
});

app.whenReady().then(async () => {
    logger.info("Starting...");
    const httpUrl = await retrieveServer();
    const argp = new ArgpObject(process.argv);
    const id = argp.getFlag("game-id");
    const gameId = (id && Object.values(TeGames).includes(+id)) ? +id : TeGames.TRANSFORMICE;
    
    mainWindow = createWindow(gameId, httpUrl);
    regShortcuts(mainWindow.browserWindow);
    mainWindow.load();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });