import { app, dialog, BrowserWindow } from "electron";
import * as electronSets from "electron-settings";
import * as path from "path";
import * as fs from "fs";
import { logger } from "./logger";

const SETTINGS_KEYS = [
    "window.bounds", "window.zoomStep", "window.menuHideMode", "window.alwaysOnTop",
    "flash.enable", "flash.path", "flash.currentVersion", "shortcuts.custom", "general.align",
    "ui.mode", "ui.custom", "ui.animations", "ui.compact", "ui.labels", "ui.radius", "ui.scale"
];

export async function exportSettings(parentWin: BrowserWindow): Promise<boolean> {
    try {
        const result = await dialog.showSaveDialog(parentWin, {
            title: "Export Settings",
            defaultPath: path.join(app.getPath("documents"), "elite-client-settings.json"),
            filters: [{ name: "JSON", extensions: ["json"] }]
        });
        
        if (result.canceled || !result.filePath) return false;
        
        const settings: Record<string, any> = {};
        SETTINGS_KEYS.forEach(key => {
            const value = electronSets.getSync(key as any);
            if (value !== undefined) {
                settings[key] = value;
            }
        });
        
        fs.writeFileSync(result.filePath, JSON.stringify(settings, null, 2));
        logger.info(`Settings exported to ${result.filePath}`);
        return true;
    } catch (err) {
        logger.error("Export settings failed:", err);
        return false;
    }
}

export async function importSettings(parentWin: BrowserWindow): Promise<boolean> {
    try {
        const result = await dialog.showOpenDialog(parentWin, {
            title: "Import Settings",
            defaultPath: app.getPath("documents"),
            filters: [{ name: "JSON", extensions: ["json"] }],
            properties: ["openFile"]
        });
        
        if (result.canceled || !result.filePaths[0]) return false;
        
        const data = fs.readFileSync(result.filePaths[0], "utf8");
        const settings = JSON.parse(data);
        
        Object.keys(settings).forEach(key => {
            electronSets.set(key as any, settings[key]);
        });
        
        logger.info(`Settings imported from ${result.filePaths[0]}`);
        return true;
    } catch (err) {
        logger.error("Import settings failed:", err);
        return false;
    }
}