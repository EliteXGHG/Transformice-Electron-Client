import * as electronSets from "electron-settings";
import { TeWindow } from "./TeWindow";

export class WindowTransformice extends TeWindow {
    private win32 = process.platform === "win32";

    constructor(httpUrl: string) {
        super(httpUrl);
        this.windowTitle = "Transformice";
        this.windowBgColor = "#6A7495";
        this.ipc.on("tfm-fullscreen-mode", (_, mode: number) => {
            const w = this.browserWindow;
            if (mode === 1) { if (this.win32) { w.blur(); w.maximize(); w.focus(); } else w.maximize(); }
            else { if (this.win32) { w.blur(); w.setFullScreen(false); w.unmaximize(); w.focus(); } else { w.setFullScreen(false); w.unmaximize(); } }
        });
    }

    load() {
        let align = "";
        try {
            const a = electronSets.getSync("general.align") as string;
            if (a?.includes(",")) {
                const s = a.split(",");
                if (s.length >= 2) {
                    align = (s[1] === "1" ? "t" : s[1] === "3" ? "b" : "") + (s[0] === "1" ? "l" : s[0] === "3" ? "r" : "");
                }
            }
        } catch { }
        this.browserWindow.loadURL(this.httpUrl + "/tfm.html?align=" + align);
    }
}