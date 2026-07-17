const { ipcRenderer } = require("electron");

window.electron = {
    electronSets: {
        getSync: function(key) { return ipcRenderer.sendSync("settings-get", key); },
        setSync: function(key, value) { ipcRenderer.sendSync("settings-set", key, value); }
    },
    getFlashReleases: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("flash-release");
            ipcRenderer.once("flash-release", function(_, obj) { resolve(obj); });
        });
    },
    installFlash: function(version) {
        var cbs = {};
        ipcRenderer.once("install-flash-error", function(_, msg) { if (cbs.error) cbs.error(msg); });
        ipcRenderer.once("install-flash-success", function() { if (cbs.success) cbs.success(); });
        ipcRenderer.send("install-flash", version);
        return { on: function(ev, cb) { cbs[ev] = cb; } };
    },
    uninstallFlash: function() {
        var cbs = {};
        ipcRenderer.once("uninstall-flash-error", function(_, msg) { if (cbs.error) cbs.error(msg); });
        ipcRenderer.once("uninstall-flash-success", function() { if (cbs.success) cbs.success(); });
        ipcRenderer.send("uninstall-flash");
        return { on: function(ev, cb) { cbs[ev] = cb; } };
    },
    exportSettings: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("export-settings");
            ipcRenderer.once("export-settings-result", function(_, ok) { resolve(ok); });
        });
    },
    importSettings: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("import-settings");
            ipcRenderer.once("import-settings-result", function(_, ok) { resolve(ok); });
        });
    },
    setAlwaysOnTop: function(enable) { ipcRenderer.send("set-always-on-top", enable); },
    clearCache: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("clear-cache");
            ipcRenderer.once("cache-cleared", function(_, info) { resolve(info); });
        });
    },
    getCacheInfo: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("get-cache-info");
            ipcRenderer.once("cache-info", function(_, info) { resolve(info); });
        });
    },
    setMenuHideMode: function(mode) { ipcRenderer.send("set-menu-hide-mode", mode); },
    getLogs: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("get-logs");
            ipcRenderer.once("get-logs-result", function(_, content) { resolve(content); });
        });
    },
    getDiagnostics: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("get-diagnostics");
            ipcRenderer.once("get-diagnostics-result", function(_, info) { resolve(info); });
        });
    },
    openLogFolder: function() { ipcRenderer.send("open-log-folder"); },
    clearLogs: function() {
        return new Promise(function(resolve) {
            ipcRenderer.send("clear-logs");
            ipcRenderer.once("clear-logs-result", function(_, ok) { resolve(ok); });
        });
    }
};
