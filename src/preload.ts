import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
    getTeError: () => {
        return new Promise((resolve) => {
            ipcRenderer.send("send-te-error");
            ipcRenderer.once("send-te-error", (_, errDesc) => resolve(errDesc));
        });
    },
    sendTFMFullscreenMode: (mode: number) => {
        ipcRenderer.send("tfm-fullscreen-mode", mode);
    },
    openScreenshotFolder: () => {
        ipcRenderer.send("open-screenshot-folder");
    }
});