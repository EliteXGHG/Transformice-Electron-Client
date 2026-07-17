import EventEmitter from "events";
import { ipcMain, webContents } from "electron";
import { BrowserWindow } from "electron";

const channels = new Map<string, { listener: (...args: any[]) => void; refs: Set<webContents["id"]> }>();
const emitters = new Map<number, EventEmitter>();

export class IpcListener {
    private emitter: EventEmitter;

    constructor(private wc: BrowserWindow) {
        this.emitter = new EventEmitter();
        emitters.set(wc.webContents.id, this.emitter);
        wc.on("closed", () => {
            this.removeAll();
            emitters.delete(wc.webContents.id);
        });
    }

    on(channel: string, fn: (e: Electron.IpcMainEvent, ...args: any[]) => void) {
        this.emitter.on(channel, fn);
        if (!channels.has(channel)) {
            const listener = (e: Electron.IpcMainEvent, ...args: any[]) => {
                const em = emitters.get(e.sender.id);
                if (em) em.emit(channel, e, ...args);
            };
            channels.set(channel, { listener, refs: new Set() });
        }
        channels.get(channel)!.refs.add(this.wc.webContents.id);
        return this;
    }

    off(channel: string, fn?: (...args: any[]) => void) {
        if (fn) this.emitter.off(channel, fn);
        else this.emitter.removeAllListeners(channel);
        if (!fn || this.emitter.listenerCount(channel) === 0) {
            const ch = channels.get(channel);
            if (ch) {
                ch.refs.delete(this.wc.webContents.id);
                if (ch.refs.size === 0) {
                    ipcMain.off(channel, ch.listener);
                    channels.delete(channel);
                }
            }
        }
        return this;
    }

    removeAll() {
        this.emitter.removeAllListeners();
        for (const [channel, ch] of channels) {
            if (ch.refs.has(this.wc.webContents.id)) {
                ch.refs.delete(this.wc.webContents.id);
                if (ch.refs.size === 0) {
                    ipcMain.off(channel, ch.listener);
                    channels.delete(channel);
                }
            }
        }
    }
}
