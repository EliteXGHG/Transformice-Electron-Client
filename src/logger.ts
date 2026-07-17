import log from "electron-log";
import * as path from "path";
import { app } from "electron";

export function initLogger() {
    log.transports.file.resolvePathFn = () => path.join(app.getPath("userData"), "logs", "main.log");
    log.transports.file.level = "info";
    log.transports.console.level = "debug";
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] {text}";
    log.transports.console.format = "[{h}:{i}:{s}] {text}";
    
    process.on("uncaughtException", (e) => log.error("Uncaught:", e.message));
    process.on("unhandledRejection", (e) => log.error("Unhandled:", e));
}

export const logger = {
    info: (msg: string, ...args: unknown[]) => log.info(msg, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(msg, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(msg, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(msg, ...args)
};