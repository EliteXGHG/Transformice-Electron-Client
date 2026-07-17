import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { logger } from "./logger";

const BASE_DIR = app.isPackaged ? path.join(process.resourcesPath, "app.asar") : path.join(__dirname, "..");
const SERVER_URL_FILE = path.join(app.getPath("userData"), "server.te");
const SERVER_TEST = "/TeServerTest";
const MAX_SIZE = 100 * 1024 * 1024;
const CACHE_MAX_AGE = 3600000; // 1 hour

const TYPES: Record<string, string> = {
    ".js": "application/javascript", ".css": "text/css", ".swf": "application/x-shockwave-flash",
    ".html": "text/html", ".json": "application/json", ".xml": "application/xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".txt": "text/plain", ".dat": "application/octet-stream"
};

class Cache {
    private map = new Map<string, { data: Buffer; type: string; mtime: number; size: number; hits: number; timestamp: number }>();
    private bytes = 0;
    private readonly maxEntries = 50;
    private readonly maxBytes = 100 * 1024 * 1024;

    get(fp: string) { 
        const e = this.map.get(fp); 
        if (e && Date.now() - e.timestamp < CACHE_MAX_AGE) {
            e.hits++; 
            return e; 
        }
        if (e) this.map.delete(fp);
        return undefined;
    }

    set(fp: string, data: Buffer, type: string) {
        if (this.map.size >= this.maxEntries || this.bytes + data.length > this.maxBytes) this.evict();
        this.map.set(fp, { data, type, mtime: Date.now(), size: data.length, hits: 0, timestamp: Date.now() });
        this.bytes += data.length;
    }

    private evict() {
        const entries = [...this.map.entries()];
        entries.sort((a, b) => {
            const scoreA = a[1].hits * 0.3 - a[1].size * 0.001;
            const scoreB = b[1].hits * 0.3 - b[1].size * 0.001;
            return scoreA - scoreB;
        });
        const toRemove = Math.min(Math.ceil(this.maxEntries * 0.2), entries.length);
        for (let i = 0; i < toRemove; i++) {
            if (entries[i]) { 
                this.bytes -= entries[i][1].size; 
                this.map.delete(entries[i][0]); 
            }
        }
    }

    get stats() { return { size: this.map.size, bytes: this.bytes }; }
}

const cache = new Cache();
const getType = (p: string) => TYPES[path.extname(p).toLowerCase()] || "application/octet-stream";
const sanitize = (p: string) => {
    const normalized = path.normalize(p).replace(/\\/g, "/");
    return normalized.includes("..") ? "" : normalized;
};

export async function startHttpServer() {
    const server = http.createServer((req, res) => {
        const url = sanitize(req.url.split("?")[0]);
        res.setTimeout(5000);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("Cache-Control", "public, max-age=3600");

        if (url === SERVER_TEST) { res.writeHead(200); res.end(SERVER_TEST); return; }

        const fp = path.join(BASE_DIR, "resources", url);
        if (!fp.startsWith(path.join(BASE_DIR, "resources"))) { res.writeHead(403); res.end(); return; }

        const cached = cache.get(fp);
        if (cached) { 
            res.writeHead(200, { "Content-Type": cached.type, "Content-Length": cached.size, "Cache-Control": "public, max-age=3600", "X-Cache": "HIT", "ETag": `"${cached.mtime}"` }); 
            res.end(cached.data); 
            return; 
        }

        fs.promises.stat(fp).then(st => {
            if (!st.isFile()) { res.writeHead(404); res.end(); return; }
            if (st.size > MAX_SIZE) { res.writeHead(413); res.end(); return; }
            fs.promises.readFile(fp).then(data => {
                const type = getType(fp);
                cache.set(fp, data, type);
                res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": "public, max-age=3600", "X-Cache": "MISS", "ETag": `"${st.mtime}"` });
                res.end(data);
            }).catch(() => { res.writeHead(404); res.end(); });
        }).catch(() => { res.writeHead(404); res.end(); });
    });

    server.on("connection", s => { s.setNoDelay(true); s.setKeepAlive(true, 30000); });
    const port = await require("get-port")();
    server.listen(port, "127.0.0.1");
    logger.info(`Server: ${port}`);
    return "http://localhost:" + port;
}

export async function testHttpServer(url: string) {
    return new Promise((resolve, reject) => {
        const req = http.get(url + SERVER_TEST, { timeout: 50 }, r => r.statusCode === 200 ? resolve(true) : reject(false));
        req.on("error", reject).on("timeout", () => { req.destroy(); reject(false); });
    });
}

export async function retrieveServer(force = false) {
    if (!force) {
        try {
            const u = fs.readFileSync(SERVER_URL_FILE, "utf8").trim();
            if (u.startsWith("http")) { try { await testHttpServer(u); return u; } catch { } }
        } catch { }
    }
    const url = await startHttpServer();
    try { fs.writeFileSync(SERVER_URL_FILE, url); } catch { }
    return url;
}