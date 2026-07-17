import { app, BrowserWindow, dialog, Menu, nativeImage, shell as electronShell } from "electron";
import { TeGames } from "./te-enums";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { APP_NAME } from "./te-consts";
import { newTEProcess } from "./te-process";
import { retrieveServer } from "./te-server";
import { IpcListener } from "./IpcListener";
import { exportSettings, importSettings } from "./settings-io";
import * as electronSets from "electron-settings";

const BASE_DIR = app.isPackaged ? path.join(process.resourcesPath, "app.asar") : path.join(__dirname, "..");
const FILE_BASE = "file://" + BASE_DIR;

export abstract class TeWindow {
    httpUrl: string;
    browserWindow: BrowserWindow;
    prefsWin: BrowserWindow;
    linksWin: BrowserWindow;
    ipc: IpcListener;
    windowTitle = APP_NAME;
    windowBgColor = "#6A7495";
    windowWidth = 800;
    windowHeight = 625;

    protected constructor(httpUrl: string) {
        this.httpUrl = httpUrl;
        const bounds = this.loadBounds();
        this.browserWindow = new BrowserWindow({
            width: bounds.width || this.windowWidth,
            height: bounds.height || this.windowHeight,
            x: bounds.x,
            y: bounds.y,
            frame: true,
            show: false,
            minWidth: 750,
            minHeight: 540,
            backgroundColor: this.windowBgColor,
            title: this.windowTitle,
            autoHideMenuBar: false,
            icon: path.join(BASE_DIR, "resources", "icon.png"),
            webPreferences: {
                plugins: true,
                contextIsolation: true,
                preload: path.join(__dirname, "preload.js"),
                webgl: true,
                backgroundThrottling: false
            }
        });
        this.init();
        if (electronSets.getSync("window.readyToShow")) {
            this.browserWindow.once("ready-to-show", () => this.browserWindow.show());
        } else {
            this.browserWindow.show();
        }
        try { os.setPriority(this.browserWindow.webContents.getProcessId(), -10); } catch {}
    }

    private init() {
        this.buildMenu();
        if (this.loadBounds().isMaximized) this.browserWindow.maximize();
        this.browserWindow.setAlwaysOnTop(!!electronSets.getSync("window.alwaysOnTop"));
        this.browserWindow.on("close", () => this.saveBounds());
        this.browserWindow.on("enter-fullscreen" as any, () => setTimeout(() => this.updateMenuBar(), 50));
        this.browserWindow.on("leave-fullscreen" as any, () => setTimeout(() => this.updateMenuBar(), 50));
        this.browserWindow.on("maximize", () => this.updateMenuBar());
        this.browserWindow.on("unmaximize", () => this.updateMenuBar());
        this.browserWindow.webContents.on("did-fail-load", (_, __, d) => this.onFail(d));
        this.browserWindow.webContents.on("did-finish-load", () => {
            this.updateMenuBar();
        });
        this.browserWindow.webContents.on("page-title-updated", e => e.preventDefault());
        this.ipc = new IpcListener(this.browserWindow);
        this.ipc.on("send-te-error", e => (e as any).reply("send-te-error", ""));
        this.ipc.on("run-action", (_, a) => this.execute(a));
    }

    private execute(action: string) {
        const w = this.browserWindow;
        switch (action) {
            case "settings": this.showPrefs(); break;
            case "links": this.showLinks(); break;
            case "fullscreen": w.setFullScreen(!w.isFullScreen()); break;
            case "always-on-top": w.setAlwaysOnTop(!w.isAlwaysOnTop()); break;
            case "screenshot": this.screenshot(); break;
            case "reload": this.reload(); break;
            case "clear-cache": w.webContents.session.clearCache(); break;
            case "devtools": w.webContents.toggleDevTools(); break;
            case "tfm": newTEProcess(TeGames.TRANSFORMICE); break;
            case "deadmaze": newTEProcess(TeGames.DEADMAZE); break;
            case "forum": electronShell.openExternal("https://atelier801.com"); break;
        }
    }

    private buildMenu() {
        const w = this.browserWindow;
        const getZoomStep = () => (parseFloat(electronSets.getSync("window.zoomStep") as string) || 1) / 100;
        const getZoom = () => w.webContents.getZoomFactor();
        const setZoom = (z: number) => w.webContents.setZoomFactor(Math.min(Math.max(z, 0.25), 5));
        
        const updateTitle = () => w.setTitle(this.windowTitle + " [" + Math.round(getZoom() * 100) + "%]");
        
        const menuTemplate: Electron.MenuItemConstructorOptions[] = [
            { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: () => { setZoom(getZoom() + getZoomStep()); updateTitle(); } },
            { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => { setZoom(getZoom() - getZoomStep()); updateTitle(); } },
            { label: "Zoom Reset", accelerator: "CmdOrCtrl+0", click: () => { setZoom(1); updateTitle(); } },
            { label: "View", submenu: [
                { label: "50%", click: () => { setZoom(0.5); updateTitle(); } },
                { label: "75%", click: () => { setZoom(0.75); updateTitle(); } },
                { label: "100%", click: () => { setZoom(1); updateTitle(); } },
                { label: "125%", click: () => { setZoom(1.25); updateTitle(); } },
                { label: "150%", click: () => { setZoom(1.5); updateTitle(); } },
                { label: "200%", click: () => { setZoom(2); updateTitle(); } },
            ]},
            { label: "Screenshot", accelerator: "CmdOrCtrl+Shift+S", click: () => this.screenshot() },
            { label: "Game", submenu: [
                { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => this.reload() },
                { label: "Restart", accelerator: "CmdOrCtrl+Shift+R", click: () => { app.relaunch(); app.exit(); } },
                { type: "separator" },
                { label: "Fullscreen", accelerator: "F11", click: () => w.setFullScreen(!w.isFullScreen()) },
                { label: "Fit Window", click: () => { w.unmaximize(); w.setFullScreen(false); w.setContentSize(this.windowWidth, this.windowHeight); } },
                { type: "separator" },
                { label: "DevTools", accelerator: "CmdOrCtrl+Shift+I", click: () => w.webContents.openDevTools() },
            ]},
            { label: "Settings", accelerator: "CmdOrCtrl+,", click: () => this.showPrefs() },
            { label: "Links", click: () => this.showLinks() },
            { label: "More Games", submenu: [
                { label: "Transformice", click: () => newTEProcess(TeGames.TRANSFORMICE) },
                { label: "DeadMaze", click: () => newTEProcess(TeGames.DEADMAZE) },
            ]},
            { label: "About", click: () => this.showAbout() },
        ];
        
        w.setMenu(Menu.buildFromTemplate(menuTemplate));
    }

    screenshot() {
        const d = path.join(app.getPath("pictures"), "Elite Electron Client");
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        const name = `screenshot_${Date.now()}.png`;
        this.browserWindow.webContents.capturePage().then((img: any) => {
            if (img && img.toPNG().length > 0) {
                fs.writeFileSync(path.join(d, name), img.toPNG());
                const dataUrl = img.toDataURL();
                this.browserWindow.webContents.executeJavaScript(`
                    (function(){
                        var e=document.getElementById('tfm-shot');
                        if(e)e.remove();
                        e=document.createElement('div');
                        e.id='tfm-shot';
                        e.style.cssText='position:fixed;bottom:24px;right:24px;z-index:99999;background:#18181e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;display:flex;align-items:center;gap:14px;padding:10px 16px 10px 10px;box-shadow:0 8px 40px rgba(0,0,0,0.5);transition:transform 0.15s ease,box-shadow 0.15s ease;font-family:var(--font,"Segoe UI",system-ui,sans-serif);';
                        e.innerHTML='<img src="${dataUrl}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0;">' +
                            '<div style="display:flex;flex-direction:column;gap:3px;">' +
                            '<span style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;">Screenshot saved</span>' +
                            '<span style="color:rgba(255,255,255,0.3);font-size:10px;">${name.slice(0,30)}</span>' +
                            '<div style="display:flex;gap:8px;margin-top:3px;">' +
                            '<span id="tfm-shot-open" style="color:rgba(255,255,255,0.45);font-size:10px;cursor:pointer;">Open folder</span>' +
                            '<span style="color:rgba(255,255,255,0.15);font-size:10px;">|</span>' +
                            '<span id="tfm-shot-dismiss" style="color:rgba(255,255,255,0.25);font-size:10px;cursor:pointer;">Dismiss</span>' +
                            '</div></div>';
                        document.body.appendChild(e);
                        e.onmouseenter=function(){e.style.transform='scale(1.03)';e.style.boxShadow='0 8px 40px rgba(0,0,0,0.6)';};
                        e.onmouseleave=function(){e.style.transform='';e.style.boxShadow='0 6px 32px rgba(0,0,0,0.5)';};
                        e.onclick=function(ev){
                            var t=ev.target.id;
                            if(t==='tfm-shot-dismiss'){e.remove();return;}
                            if(t==='tfm-shot-open'&&window.electron&&window.electron.openScreenshotFolder)window.electron.openScreenshotFolder();
                        };
                        setTimeout(function(){if(e.parentNode){e.style.transition='opacity 0.3s ease,transform 0.3s ease';e.style.opacity='0';e.style.transform='translateY(8px)';setTimeout(function(){if(e.parentNode)e.remove();},300);}},6000);
                    })();
                `).catch(() => {});
            }
        }).catch(() => {});
    }

    private reload() {
        retrieveServer(true).then(url => { this.httpUrl = url; this.load(); });
    }

    private aboutWin: BrowserWindow;

    private showAbout() {
        if (this.aboutWin) { this.aboutWin.focus(); return; }
        
        const theme = this.getCurrentTheme();
        const iconPath = path.join(BASE_DIR, "resources", "icon.png");
        const iconDataUrl = nativeImage.createFromPath(iconPath).toDataURL();
        const bgPath = path.join(BASE_DIR, "resources", "about-bg.png");
        const bgDataUrl = "data:image/png;base64," + fs.readFileSync(bgPath).toString("base64");
        this.aboutWin = new BrowserWindow({
            width: 460, height: 340, frame: true, title: "About " + APP_NAME,
            icon: iconPath, parent: this.browserWindow, backgroundColor: theme.bg, resizable: false
        });
        this.aboutWin.on("closed", () => { this.aboutWin = null; this.browserWindow.focus(); });
        this.aboutWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <style>
                *{margin:0;padding:0;box-sizing:border-box;}
                ::-webkit-scrollbar{width:5px;height:5px;}
                ::-webkit-scrollbar-track{background:transparent;}
                ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
                ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.25);}
                body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
                    position:relative;background:rgba(10,10,12,0.75);
                    color:${theme.fg};font-family:${theme.font};
                    text-align:center;padding:28px 24px;user-select:none;overflow-y:auto;}
                body::before{content:"";position:fixed;inset:0;background:url('${bgDataUrl}') repeat;
                    filter:blur(10px);transform:scale(1.15);z-index:-1;}
                body::after{content:"";position:fixed;inset:0;
                    background:linear-gradient(135deg,rgba(10,10,12,0.88),rgba(20,20,28,0.7),rgba(10,10,12,0.88));
                    z-index:-1;}
                .card{background:${theme.bg2};border:1px solid ${theme.border};border-radius:18px;
                    padding:28px 28px 24px;
                    box-shadow:0 12px 48px rgba(0,0,0,0.5);max-width:340px;width:100%;}
                .icon{width:64px;height:64px;border-radius:16px;margin-bottom:10px;
                    box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.06);}
                .name{font-size:22px;font-weight:800;color:${theme.fg};margin:0 0 2px;letter-spacing:0.01em;}
                .sub{font-size:12px;color:${theme.fg2};font-weight:400;margin-bottom:14px;letter-spacing:0.04em;}
                .version{font-size:13px;color:${theme.accent};font-weight:800;margin-bottom:16px;
                    background:${theme.accent}22;padding:5px 20px;border-radius:20px;border:1.5px solid ${theme.accent}44;
                    display:inline-block;letter-spacing:0.03em;}
                .divider{width:32px;height:2px;background:${theme.accent};border-radius:2px;margin:0 auto 14px;opacity:0.25;}
                .links{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}
                .links a{font-size:12px;color:${theme.fg2};font-weight:600;text-decoration:none;padding:5px 14px;
                    border:1px solid ${theme.border};border-radius:8px;
                    transition:all 0.15s ease;background:transparent;}
                .links a:hover{color:${theme.accent};border-color:${theme.accent};background:${theme.accent}18;}
                .credit-line{font-size:12px;color:${theme.fg2};line-height:1.7;margin-bottom:10px;}
                .credit-line span{color:${theme.fg};font-weight:600;}
                .tech{font-size:10px;color:${theme.fg2};margin-top:8px;letter-spacing:0.02em;opacity:0.65;line-height:1.6;}
            </style>
            </head>
            <body>
                <div class="card">
                    <img src="${iconDataUrl}" class="icon">
                    <div class="name">Elite's Electron Client</div>
                    <div class="sub">for Transformice</div>
                    <div class="version">v${app.getVersion()}</div>
                    <div class="divider"></div>
                    <div class="credit-line"><span>Eliteghg#2151</span> · Discord: eliteghg</div>
                    <div class="links">
                        <a href="https://github.com/Cassolette/Transformice-Electron" target="_blank">Original</a>
                        <a href="https://github.com/EliteXGHG/Transformice-Electron-Client" target="_blank">Fork</a>
                    </div>
                    <div class="tech">Electron ${process.versions.electron} · Chrome ${process.versions.chrome} · Node ${process.versions.node}</div>
                    <div class="tech">${process.platform} ${process.arch} · ${process.getSystemVersion() || ""}</div>
                    <div class="tech">Flash ${electronSets.getSync("flash.currentVersion") as string || "bundled"}</div>
                </div>
            </body>
            </html>
        `));
    }

    private getCurrentTheme() {
        const mode = (electronSets.getSync("ui.mode") as string) || "dark";
        const themes: Record<string, any> = {
            dark: { bg: "#0a0a0c", bg2: "#101014", bg3: "#18181e", fg: "#c8c8d0", fg2: "#808088", fg3: "#505058", border: "#3a3a48", accent: "#ffffff" },
            amoled: { bg: "#000000", bg2: "#080808", bg3: "#101014", fg: "#c0c0c8", fg2: "#707078", fg3: "#484850", border: "#2a2a38", accent: "#ffffff" },
            light: { bg: "#f5f5f7", bg2: "#eaeaee", bg3: "#dddde4", fg: "#16161e", fg2: "#555566", fg3: "#88889a", border: "#c0c0ce", accent: "#3a3a44" },
            vibrant: { bg: "#0e0e12", bg2: "#16161c", bg3: "#1e1e26", fg: "#d0d0d8", fg2: "#70707e", fg3: "#50505a", border: "#323242", accent: "#ff6644" }
        };
        const t = themes[mode] || themes.dark;
        const custom = (electronSets.getSync("ui.custom") as any) || {};
        const font = (electronSets.getSync("ui.font") as string) || "";
        const customFont = (electronSets.getSync("ui.customFont") as string) || "";
        t.font = customFont || font || "'Segoe UI', system-ui, -apple-system, sans-serif";
        for (const k in custom) t[k] = custom[k];
        return t;
    }

    private onFail(err: string) {
        if (!this.browserWindow.isDestroyed()) this.browserWindow.loadURL(FILE_BASE + "/resources/failure.html");
    }

    showPrefs() {
        if (this.prefsWin) { this.prefsWin.focus(); return; }
        this.prefsWin = new BrowserWindow({
            width: 680, height: 450, frame: true, title: APP_NAME,
            icon: path.join(BASE_DIR, "resources", "icon.png"), parent: this.browserWindow, backgroundColor: "#1a1a2e",
            webPreferences: { contextIsolation: false, preload: path.join(BASE_DIR, "resources", "prefs", "preload_prefs.js") }
        });
        this.prefsWin.on("closed", () => { this.prefsWin = null; this.browserWindow.focus(); });
        this.prefsWin.loadURL(FILE_BASE + "/resources/prefs/prefs.html");
    }

    showLinks() {
        if (this.linksWin) { this.linksWin.focus(); return; }
        this.linksWin = new BrowserWindow({
            width: 650, height: 550, frame: true, title: "Links - " + APP_NAME,
            icon: path.join(BASE_DIR, "resources", "icon.png"), parent: this.browserWindow, backgroundColor: "#1a1a2e",
            webPreferences: { contextIsolation: false, preload: path.join(BASE_DIR, "resources", "prefs", "preload_prefs.js") }
        });
        this.linksWin.on("closed", () => { this.linksWin = null; this.browserWindow.focus(); });
        this.linksWin.loadURL(FILE_BASE + "/resources/prefs/links.html");
    }

    async exportSettings() {
        const ok = await exportSettings(this.browserWindow);
        if (ok) dialog.showMessageBox(this.browserWindow, { type: "info", title: "Export Complete", message: "Settings exported!" });
    }

    async importSettings() {
        const r = await dialog.showMessageBox(this.browserWindow, { type: "question", title: "Import Settings", message: "Overwrite current settings?", buttons: ["Cancel", "Import"], defaultId: 1 });
        if (r.response === 1) {
            const ok = await importSettings(this.browserWindow);
            if (ok) dialog.showMessageBox(this.browserWindow, { type: "info", title: "Import Complete", message: "Restart required for some changes." });
        }
    }

    abstract load(): void;

    injectFpsOverlay() {}
    removeFpsOverlay() {}
    updateFpsOverlay(count: number) {}

    updateMenuBar() {
        const mode = electronSets.getSync("window.menuHideMode") as string || "never";
        const w = this.browserWindow;
        let hidden = false;
        switch (mode) {
            case "always": hidden = true; break;
            case "maximize": hidden = w.isMaximized(); break;
            case "fullscreen": hidden = w.isFullScreen() || w.isMaximized(); break;
        }
        w.setMenuBarVisibility(!hidden);
        w.autoHideMenuBar = hidden;
    }

    private loadBounds() {
        const defaultW = this.windowWidth, defaultH = this.windowHeight;
        try { const b = electronSets.getSync("window.bounds") as any; if (b?.width >= defaultW && b?.height >= defaultH) return b; } catch { }
        return { width: defaultW, height: defaultH, isMaximized: false };
    }

    private saveBounds() {
        const w = this.browserWindow;
        const m = w.isMaximized();
        const b = m ? w.getNormalBounds() : w.getBounds();
        electronSets.set("window.bounds", { x: b.x, y: b.y, width: b.width, height: b.height, isMaximized: m });
    }
}