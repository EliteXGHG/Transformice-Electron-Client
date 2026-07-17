var pages = {};
var currentTab = "general";
var es = window.electron ? window.electron.electronSets : null;
var searchQuery = "";

var themes = {
    dark: { bg: "#0a0a0c", bg2: "#101014", bg3: "#18181e", bg4: "#22222a", fg: "#c8c8d0", fg2: "#808088", fg3: "#505058", border: "#3a3a48", accent: "#ffffff" },
    amoled: { bg: "#000000", bg2: "#080808", bg3: "#101014", bg4: "#18181e", fg: "#c0c0c8", fg2: "#707078", fg3: "#484850", border: "#2a2a38", accent: "#ffffff" },
    light: { bg: "#f5f5f7", bg2: "#eaeaee", bg3: "#dddde4", bg4: "#cfcfd6", fg: "#16161e", fg2: "#555566", fg3: "#88889a", border: "#c0c0ce", accent: "#3a3a44" },
    vibrant: { bg: "#0e0e12", bg2: "#16161c", bg3: "#1e1e26", bg4: "#282832", fg: "#d0d0d8", fg2: "#70707e", fg3: "#50505a", border: "#323242", accent: "#ff6644", secondary: "#44bbdd" }
};

var defaults = themes.dark;
var historyStack = [];
var redoStack = [];
var maxHistory = 50;
var _themeCache = null;
var _themeDirty = true;
var _defaultTabs = [{ id: "general", title: "General" }, { id: "shortcuts", title: "Shortcuts" }, { id: "ui", title: "UI" }, { id: "flash", title: "Flash" }, { id: "logs", title: "Logs" }];

function getTheme() {
    if (!_themeDirty && _themeCache) return _themeCache;
    if (!es) return defaults;
    var mode = es.getSync("ui.mode") || "dark";
    var custom = es.getSync("ui.custom") || {};
    _themeCache = Object.assign({}, defaults, themes[mode] || defaults, custom);
    _themeDirty = false;
    return _themeCache;
}
function markThemeDirty() { _themeDirty = true; }

function el(id) { return document.getElementById(id); }
function newEl(tag) { return document.createElement(tag); }

function showToast(msg, type) {
    var t = el("toast");
    if (!t) {
        t = newEl("div");
        t.id = "toast";
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "toast " + type;
    t.style.display = "block";
    setTimeout(function() { t.style.display = "none"; }, 2500);
}

function save(k, v) { if (es) { es.setSync(k, v); if (k.indexOf("ui.") === 0) markThemeDirty(); } }
function get(k) { return es ? es.getSync(k) : undefined; }

function pushUndo(key, oldVal, action) {
    historyStack.push({ key: key, oldVal: oldVal, action: action, time: Date.now() });
    if (historyStack.length > maxHistory) historyStack.shift();
    redoStack = [];
    updateUndoBtn();
    updateRedoBtn();
}

function undoLast() {
    if (historyStack.length === 0) { showToast("Nothing to undo", "info"); return; }
    var h = historyStack.pop();
    var cur = es ? es.getSync(h.key) : undefined;
    redoStack.push({ key: h.key, oldVal: cur, action: h.action });
    save(h.key, h.oldVal);
    updateUndoBtn();
    updateRedoBtn();
    show(currentTab);
    applyTheme();
    showToast("Undone: " + h.action, "success");
}

function updateUndoBtn() {
    var btn = el("undo-btn");
    if (btn) btn.disabled = historyStack.length === 0;
}

function redoLast() {
    if (redoStack.length === 0) { showToast("Nothing to redo", "info"); return; }
    var h = redoStack.pop();
    var cur = es ? es.getSync(h.key) : undefined;
    historyStack.push({ key: h.key, oldVal: cur, action: h.action, time: Date.now() });
    save(h.key, h.oldVal);
    updateUndoBtn();
    updateRedoBtn();
    show(currentTab);
    applyTheme();
    showToast("Redone: " + h.action, "success");
}

function updateRedoBtn() {
    var btn = el("redo-btn");
    if (btn) btn.disabled = redoStack.length === 0;
}

function applyTheme() {
    if (!es) return;
    var theme = getTheme();
    var mode = es.getSync("ui.mode") || "dark";
    var anim = es.getSync("ui.animations") !== false;
    var compact = !!es.getSync("ui.compact");
    var labels = es.getSync("ui.labels") !== false;
    var hasMulti = theme.secondary;
    var rgb = hexToRgb(theme.accent);
    var lockText = !!es.getSync("ui.lockText");
    
    document.documentElement.style.setProperty("--bg", theme.bg);
    document.documentElement.style.setProperty("--bg2", theme.bg2);
    var linkBg3 = !!es.getSync("ui.linkBg3");
    if (linkBg3) {
        document.documentElement.style.setProperty("--bg3", darkenColor(theme.accent, 82));
        document.documentElement.style.setProperty("--bg4", darkenColor(theme.accent, 72));
    } else {
        document.documentElement.style.setProperty("--bg3", theme.bg3);
        document.documentElement.style.setProperty("--bg4", theme.bg4);
    }
    if (lockText) { theme.fg2 = theme.fg; theme.fg3 = theme.fg; }
    document.documentElement.style.setProperty("--fg", theme.fg);
    document.documentElement.style.setProperty("--fg2", theme.fg2);
    document.documentElement.style.setProperty("--fg3", theme.fg3);
    document.documentElement.style.setProperty("--border", theme.border);
    document.documentElement.style.setProperty("--accent", theme.accent);
    if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb.r + ", " + rgb.g + ", " + rgb.b);
    document.documentElement.style.setProperty("--accent-text", isLightColor(theme.accent) ? "#16161e" : "#ffffff");
    
    if (hasMulti) {
        document.documentElement.style.setProperty("--card-bg", darkenColor(theme.accent, 55));
        document.documentElement.style.setProperty("--card-border-width", "2px");
        document.documentElement.style.setProperty("--card-border-color", theme.accent);
        document.documentElement.style.setProperty("--nav-bg", darkenColor(theme.secondary, 55));
        document.documentElement.style.setProperty("--nav-border", "1px solid " + theme.secondary);
        document.documentElement.style.setProperty("--nav-active-bg", darkenColor(theme.secondary, 40));
        document.documentElement.style.setProperty("--section-title-color", "#ffffff");
        document.documentElement.style.setProperty("--nav-text-color", "#ffffff");
    } else {
        document.documentElement.style.setProperty("--card-bg", theme.bg2);
        document.documentElement.style.setProperty("--card-border-width", "1px");
        document.documentElement.style.setProperty("--card-border-color", theme.border);
        document.documentElement.style.setProperty("--nav-bg", theme.bg2);
        document.documentElement.style.setProperty("--nav-border", "1px solid " + theme.border);
        document.documentElement.style.setProperty("--nav-active-bg", theme.bg3);
        document.documentElement.style.setProperty("--section-title-color", theme.accent);
        document.documentElement.style.setProperty("--nav-text-color", theme.secondary || theme.accent);
    }
    
    document.documentElement.style.setProperty("--accent2", theme.secondary || theme.accent);
    var vRgb = hexToRgb(theme.secondary || theme.accent);
    if (vRgb) document.documentElement.style.setProperty("--accent2-rgb", vRgb.r + ", " + vRgb.g + ", " + vRgb.b);
    document.documentElement.style.setProperty("--accent2-text", isLightColor(theme.secondary || theme.accent) ? "#16161e" : "#ffffff");
    
    document.documentElement.style.setProperty("--radius", (es.getSync("ui.radius") || 4) + "px");
    document.documentElement.style.setProperty("--outline", (es.getSync("ui.outline") || 1) + "px");
    
    var font = es.getSync("ui.font") || "";
    var customFont = es.getSync("ui.customFont") || "";
    document.documentElement.style.setProperty("--font", customFont || font || "'Segoe UI', system-ui, -apple-system, sans-serif");
    
    document.body.classList.remove("mode-dark", "mode-amoled", "mode-light", "mode-vibrant", "mode-custom");
    document.body.classList.add("mode-" + mode);
    document.body.classList.toggle("compact-mode", compact);
    document.body.classList.toggle("no-animations", !anim);
    document.body.classList.toggle("no-labels", !labels);
}

function applyScale() {
    var scale = es.getSync("ui.scale") || 100;
    var factor = scale / 100;
    var body = document.body;
    body.style.zoom = factor;
    body.style.overflow = factor > 1 ? "auto" : "";
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function darkenColor(hex, percent) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var r = Math.round(rgb.r * (100 - percent) / 100);
    var g = Math.round(rgb.g * (100 - percent) / 100);
    var b = Math.round(rgb.b * (100 - percent) / 100);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function isLightColor(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return false;
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) > 160;
}

function createLockBtn(key, input, normalMin, normalMax, wideMin, wideMax) {
    var btn = document.createElement("button");
    btn.className = "icon-btn";
    var locked = get(key);
    if (locked === undefined) { locked = true; save(key, true); }
    function applyLock() {
        if (locked) {
            input.min = normalMin;
            input.max = normalMax;
        } else {
            input.removeAttribute("min");
            input.removeAttribute("max");
        }
        btn.textContent = locked ? "#" : "o";
        btn.classList.toggle("active", locked);
        btn.title = locked ? "# Locked — safe bounds" : "o Unlocked — no limits";
    }
    applyLock();
    btn.onclick = function() {
        save(key, !locked);
        pushUndo(key, locked, "Lock toggle");
        locked = !locked;
        applyLock();
    };
    return btn;
}

function createStepper(id, value, min, max, suffix, onChange, onCommit) {
    var wrap = document.createElement("div");
    wrap.className = "stepper-wrap";
    
    var btnMinus = document.createElement("button");
    btnMinus.className = "stepper-btn";
    btnMinus.textContent = "-";
    btnMinus.setAttribute("data-dir", "-1");
    btnMinus.title = "Decrease";
    
    var input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.min = min;
    input.max = max;
    input.value = value;
    
    var btnPlus = document.createElement("button");
    btnPlus.className = "stepper-btn";
    btnPlus.textContent = "+";
    btnPlus.setAttribute("data-dir", "1");
    btnPlus.title = "Increase";
    
    var suffixEl = document.createElement("span");
    suffixEl.className = "stepper-suffix";
    suffixEl.textContent = suffix;
    
    wrap.appendChild(btnMinus);
    wrap.appendChild(input);
    wrap.appendChild(btnPlus);
    wrap.appendChild(suffixEl);
    
    function change(delta) {
        var v = parseInt(input.value) || 0;
        var cm = parseInt(input.min), cx = parseInt(input.max);
        v = v + delta;
        if (!isNaN(cm)) v = Math.max(cm, v);
        if (!isNaN(cx)) v = Math.min(cx, v);
        input.value = v;
        if (onChange) onChange(v);
    }
    
    var timer = null, interval = null, activeDir = 0;
    
    function startHold(dir) {
        activeDir = dir;
        change(dir);
        timer = setTimeout(function() {
            interval = setInterval(function() { change(dir); }, 60);
        }, 200);
    }
    
    function stopHold() {
        activeDir = 0;
        if (timer) { clearTimeout(timer); timer = null; }
        if (interval) { clearInterval(interval); interval = null; }
        if (onCommit) onCommit(parseInt(input.value) || 0);
    }
    
    btnMinus.addEventListener("mousedown", function(e) { e.preventDefault(); startHold(-1); });
    btnPlus.addEventListener("mousedown", function(e) { e.preventDefault(); startHold(1); });
    btnMinus.addEventListener("mouseleave", function() { if (activeDir) stopHold(); });
    btnPlus.addEventListener("mouseleave", function() { if (activeDir) stopHold(); });
    document.addEventListener("mouseup", stopHold);
    
    input.addEventListener("input", function() {
        var v = parseInt(input.value);
        if (!isNaN(v)) {
            var cm = parseInt(input.min), cx = parseInt(input.max);
            var ok = true;
            if (!isNaN(cm) && v < cm) ok = false;
            if (!isNaN(cx) && v > cx) ok = false;
            if (ok && onChange) onChange(v);
        }
    });
    
    input.addEventListener("change", function() {
        var v = parseInt(input.value) || 0;
        if (v !== value && onCommit) onCommit(v);
    });
    
    return { wrap: wrap, input: input, setValue: function(v) { input.value = v; } };
}

function createToggle(key, value, label, hint, onChange) {
    var row = newEl("div");
    row.className = "setting-row";
    
    var labelEl = newEl("label");
    labelEl.textContent = label;
    labelEl.setAttribute("for", "toggle-" + key);
    labelEl.style.cursor = "pointer";
    
    var toggleWrap = newEl("div");
    toggleWrap.className = "toggle-switch";
    toggleWrap.onclick = function() {
        input.checked = !input.checked;
        var event = new Event('change');
        input.dispatchEvent(event);
    };
    
    var input = newEl("input");
    input.type = "checkbox";
    input.checked = value;
    input.id = "toggle-" + key;
    
    var slider = newEl("span");
    slider.className = "toggle-slider";
    
    toggleWrap.appendChild(input);
    toggleWrap.appendChild(slider);
    
    row.appendChild(labelEl);
    row.appendChild(toggleWrap);
    
    if (hint) {
        var hintEl = newEl("div");
        hintEl.className = "setting-hint";
        hintEl.textContent = hint;
        row.appendChild(hintEl);
    }
    
    input.onchange = function() {
        var old = es.getSync(key);
        es.setSync(key, input.checked);
        pushUndo(key, old, label);
        applyTheme();
        syncAllPages();
        if (onChange) onChange(input.checked);
    };
    
    return row;
}

function init() {
    pages.general = `
        <div class="section">
            <div class="section-title">Window</div>
            <div id="window-settings"></div>
        </div>
        <div class="section">
            <div class="section-title">Menu Bar</div>
            <div class="setting-row">
                <label>Visibility</label>
                <select id="hide-mode">
                    <option value="never">Always visible</option>
                    <option value="maximize">Hide on maximize</option>
                    <option value="fullscreen">Hide on fullscreen</option>
                    <option value="always">Always hidden</option>
                </select>
            </div>
        </div>
        <div class="section">
            <div class="section-title">Game Alignment</div>
            <div class="align-grid">
                <button class="ab" data-align="1,1">&#8598;</button>
                <button class="ab" data-align="2,1">&#8593;</button>
                <button class="ab" data-align="3,1">&#8599;</button>
                <button class="ab" data-align="1,2">&#8592;</button>
                <button class="ab selected" data-align="2,2">&#9679;</button>
                <button class="ab" data-align="3,2">&#8594;</button>
                <button class="ab" data-align="1,3">&#8601;</button>
                <button class="ab" data-align="2,3">&#8595;</button>
                <button class="ab" data-align="3,3">&#8600;</button>
            </div>
            <div class="setting-hint">Click to set game position relative to the window</div>
        </div>
        <div class="section">
            <div class="section-title">Backup</div>
            <div class="backup-buttons">
                <button id="export-settings" class="btn-export" title="Save settings to a file">Export</button>
                <button id="import-settings" class="btn-import" title="Load settings from a file">Import</button>
                <button id="copy-settings" class="btn-action" title="Copy settings as JSON">Copy</button>
                <button id="paste-settings" class="btn-action" title="Paste settings from JSON">Paste</button>
            </div>
            <p id="backup-status"></p>
        </div>
        <div class="section">
            <div class="section-title">Cache</div>
            <div class="setting-row"><label>Location</label><span id="cache-location" class="cache-location"></span></div>
            <div class="setting-row"><label>Current size</label><span id="cache-size" style="font-weight:600;"></span></div>
            <div class="backup-buttons">
                <button id="clear-cache" class="btn-danger" title="Clear all cached game data">Clear Cache</button>
                <button id="refresh-cache" class="btn-action" title="Refresh cache information">Refresh</button>
            </div>
            <p id="cache-status"></p>
        </div>
        <div class="section">
            <div class="section-title">Reset</div>
            <p class="setting-hint" style="margin-bottom:12px;">Clears every setting back to its default. This cannot be undone.</p>
            <button id="reset-all" class="btn-danger" style="width:100%;padding:12px;" title="Reset all settings to defaults">Reset all settings</button>
        </div>
    `;
    
    pages.shortcuts = `
        <div class="section">
            <div class="section-title">How to Add</div>
            <div class="help-box">
                <div class="help-step"><span class="step-num">1</span><span>Click an action below to select it</span></div>
                <div class="help-step"><span class="step-num">2</span><span>Press your key combination (e.g. Ctrl+Shift+P)</span></div>
                <div class="help-step"><span class="step-num">3</span><span>Click Add to save the shortcut</span></div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">Actions</div>
            <div class="action-row" id="action-row"></div>
        </div>
        <div class="section">
            <div class="section-title">Your Shortcuts</div>
            <div id="shortcuts-list" class="shortcuts-one-row"></div>
        </div>
        <div class="section">
            <div class="section-title">Add New</div>
            <input type="text" id="new-key" placeholder="Press keys..." class="key-input">
            <button id="add-shortcut" class="btn-install btn-full">Add Shortcut</button>
        </div>
    `;
    
    pages.ui = `
        <div class="section">
            <div class="section-title">Theme</div>
            <div class="setting-hint" style="margin-bottom:10px;">Choose a preset or customize every color</div>
            <div class="theme-btns">
                <button class="theme-btn" data-theme="dark" title="Dark blue-gray theme">Dark</button>
                <button class="theme-btn" data-theme="amoled" title="Pure black background theme">Amoled</button>
                <button class="theme-btn" data-theme="light" title="Light theme for bright environments">Light</button>
                <button class="theme-btn" data-theme="vibrant" title="Multi-accent vibrant theme">Vibrant</button>
                <button class="theme-btn" data-theme="custom" title="Customize every color">Custom</button>
            </div>
        </div>
        <div class="section">
            <div class="section-title">Colors</div>
            <div class="color-grid">
                <div class="color-col">
                    <div class="color-group-title">Background</div>
                    <div class="color-row"><label>Main</label><input type="color" id="c-bg"></div>
                    <div class="color-row"><label>Surface</label><input type="color" id="c-bg2"></div>
                    <div class="color-row"><label>Card</label><input type="color" id="c-bg3"></div>
                    <div class="color-row"><label>Hover</label><input type="color" id="c-bg4"></div>
                </div>
                <div class="color-col">
                    <div class="color-group-title">Text</div>
                    <div class="color-row"><label>Primary</label><span style="display:flex;align-items:center;gap:4px;"><input type="color" id="c-fg"><button id="lock-text-btn" class="icon-btn" title="Lock text colors together">#</button></span></div>
                    <div class="color-row"><label>Secondary</label><span><input type="color" id="c-fg2"></span></div>
                    <div class="color-row"><label>Muted</label><span><input type="color" id="c-fg3"></span></div>
                    <div class="color-row"><label>Border</label><span><input type="color" id="c-border"></span></div>
                </div>
                <div class="color-col accent-col">
                    <div class="color-group-title">Accent</div>
                    <div class="color-row"><label>Color</label><span style="display:flex;align-items:center;gap:4px;"><input type="color" id="c-accent"><button id="link-accent-btn" class="icon-btn" title="Cards independent">#</button></span></div>
                    <div class="color-row" id="c-secondary-row"><label>Secondary</label><span><input type="color" id="c-secondary"></span></div>
                </div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">Styling</div>
            <div class="setting-row">
                <label>Corner radius</label>
                <div id="ui-radius-wrap"></div>
            </div>
            <div class="setting-row">
                <label>Card outline</label>
                <div id="ui-outline-wrap"></div>
            </div>
            <div class="setting-row">
                <label>UI Scale</label>
                <div id="ui-scale-wrap"></div>
            </div>
            <div class="setting-row">
                <label>Font</label>
                <div class="font-row">
                    <select id="ui-font">
                        <option value="">System default</option>
                        <option value="'Segoe UI', system-ui, sans-serif">Segoe UI</option>
                        <option value="system-ui, -apple-system, sans-serif">System UI</option>
                        <option value="-apple-system, BlinkMacSystemFont, sans-serif">Apple System</option>
                        <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica Neue</option>
                        <option value="Arial, Helvetica, sans-serif">Arial</option>
                        <option value="Inter, system-ui, sans-serif">Inter</option>
                        <option value="'Open Sans', sans-serif">Open Sans</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Noto Sans', sans-serif">Noto Sans</option>
                        <option value="'Source Sans Pro', sans-serif">Source Sans</option>
                        <option value="'Ubuntu', sans-serif">Ubuntu</option>
                        <option value="'Cantarell', sans-serif">Cantarell</option>
                        <option value="'Fira Sans', sans-serif">Fira Sans</option>
                        <option value="'Liberation Sans', sans-serif">Liberation Sans</option>
                        <option value="'DejaVu Sans', sans-serif">DejaVu Sans</option>
                        <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
                        <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                        <option value="Verdana, Geneva, sans-serif">Verdana</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="'Courier New', monospace">Courier New</option>
                        <option value="'Fira Code', monospace">Fira Code</option>
                        <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                        <option value="monospace">Monospace</option>
                    </select>
                    <input type="text" id="ui-custom-font" placeholder="Custom font..." style="width:120px;">
                </div>
            </div>
        </div>
        <div class="section">
            <div class="section-title">Layout</div>
            <div id="ui-toggles"></div>
        </div>
    `;
    
    pages.flash = `
        <div class="section">
            <div class="section-title">Flash Player</div>
            <div id="flash-toggle"></div>
            <div class="flash-info">
                <span>Installed:</span>
                <span id="installed-version">None</span>
                <button id="uninstall" class="btn-danger" hidden>Remove</button>
            </div>
            <div class="flash-install">
                <select id="install_versions"><option>Loading...</option></select>
                <button id="install" class="btn-install">Install</button>
            </div>
        </div>
    `;

    pages.logs = `
        <div class="section">
            <div class="section-title">Diagnostics</div>
            <div id="diag-info" style="font-size:13px;line-height:1.8;"></div>
        </div>
        <div class="section">
            <div class="section-title">Log</div>
            <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <button id="refresh-log" class="btn-action">Refresh</button>
                <button id="open-log-folder" class="btn-action">Open Log Folder</button>
                <button id="clear-logs-btn" class="btn-danger">Clear Logs</button>
            </div>
            <pre id="log-content" style="background:var(--bg);border:2px solid var(--border);border-radius:var(--radius);padding:14px;font-size:11px;font-family:monospace;color:var(--fg2);max-height:400px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;"></pre>
        </div>
    `;
}

var actionList = [
    { id: "toggle-fullscreen", name: "Fullscreen", emoji: "&#9974;" },
    { id: "toggle-always-on-top", name: "Always on Top", emoji: "&#128204;" },
    { id: "toggle-menu", name: "Toggle Menu", emoji: "&#9776;" },
    { id: "screenshot", name: "Screenshot", emoji: "&#128247;" },
    { id: "zoom-in", name: "Zoom In", emoji: "+" },
    { id: "zoom-out", name: "Zoom Out", emoji: "-" },
    { id: "reset-zoom", name: "Reset Zoom", emoji: "&#8634;" },
    { id: "reload", name: "Reload", emoji: "&#8635;" },
    { id: "devtools", name: "DevTools", emoji: "&#9881;" },
    { id: "clear-cache", name: "Clear Cache", emoji: "&#128465;" }
];
actionList.sort(function(a, b) { return a.name.localeCompare(b.name); });

var actionMap = {};
actionList.forEach(function(a) { actionMap[a.id] = a; });

function renderNav() {
    var nav = el("nav-table");
    if (!nav) return;
    nav.innerHTML = "";
    var saved = es ? es.getSync("nav.order") : null;
    var tabMap = {};
    for (var ti = 0; ti < _defaultTabs.length; ti++) tabMap[_defaultTabs[ti].id] = _defaultTabs[ti];
    var tabs = [];
    if (saved && Array.isArray(saved)) {
        for (var si = 0; si < saved.length; si++) { var t = tabMap[saved[si]]; if (t) { tabs.push(t); delete tabMap[saved[si]]; } }
    }
    for (var key in tabMap) tabs.push(tabMap[key]);
    for (var tj = 0; tj < tabs.length; tj++) {
        var t = tabs[tj];
        var btn = newEl("button");
        btn.id = "nav-" + t.id;
        btn.textContent = t.title;
        btn.className = t.id === currentTab ? "active" : "";
        (function(tId) {
            btn.onclick = function() {
                var nav = el("nav-table");
                if (nav && nav._dragJustMoved) { nav._dragJustMoved = false; return; }
                show(tId);
            };
        })(t.id);
        nav.appendChild(btn);
    }
}

function formatBytes(b) {
    if (b === 0) return "0 B";
    var u = ["B", "KB", "MB", "GB"];
    var i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}

function refreshCacheInfo() {
    if (window.electron && window.electron.getCacheInfo) {
        window.electron.getCacheInfo().then(function(info) {
            var loc = el("cache-location");
            if (loc) loc.textContent = info.path || "Unknown";
            var sz = el("cache-size");
            if (sz) sz.textContent = formatBytes(info.size || 0);
        });
    }
}

function getAllSettings() {
    var keys = ["window.menuHideMode", "window.alwaysOnTop", "window.readyToShow", "window.zoomStep",
        "general.align", "ui.mode", "ui.custom", "ui.animations", "ui.compact", "ui.labels",
        "ui.linkBg3", "ui.radius", "ui.scale", "ui.font", "ui.customFont", "ui.lockText",
        "ui.outline", "shortcuts.custom", "nav.order", "window.bounds",
        "flash.enable", "flash.currentVersion", "lock.scale", "lock.radius",
        "lock.zoomStep"];
    var data = {};
    for (var ki = 0; ki < keys.length; ki++) { var v = get(keys[ki]); if (v !== undefined && v !== null) data[keys[ki]] = v; }
    return data;
}

function syncAllPages() {
    if (currentTab === "ui") {
        loadColorPickers();
    }
}

function applySearch() {
    var q = searchQuery;
    var content = el("settings-content");
    if (!content) return;
    
    if (!q) {
        show(currentTab);
        return;
    }
    
    var fragment = document.createDocumentFragment();
    var anyVisible = false;
    
    Object.keys(pages).forEach(function(tabId) {
        var wrapper = document.createElement("div");
        wrapper.innerHTML = pages[tabId];
        var sections = wrapper.querySelectorAll(".section");
        var tabMatch = false;
        
        sections.forEach(function(sec) {
            if (sec.textContent.toLowerCase().indexOf(q) !== -1) {
                if (!tabMatch) {
                    var label = document.createElement("div");
                    label.className = "search-tab-label";
                    var title = tabId.charAt(0).toUpperCase() + tabId.slice(1);
                    label.textContent = title;
                    label.setAttribute("data-tab", tabId);
                    label.onclick = function() {
                        var tab = this.getAttribute("data-tab");
                        if (searchBar) searchBar.value = "";
                        searchQuery = "";
                        show(tab);
                        setTimeout(function() {
                            var hl = document.querySelectorAll(".section-highlight");
                            for (var hi = 0; hi < hl.length; hi++) hl[hi].classList.remove("section-highlight");
                            var sections = document.querySelectorAll("#settings-content .section");
                            for (var si = 0; si < sections.length; si++) {
                                if (sections[si].textContent.toLowerCase().indexOf(q) !== -1) {
                                    sections[si].classList.add("section-highlight");
                                    sections[si].scrollIntoView({ behavior: "smooth", block: "center" });
                                    break;
                                }
                            }
                        }, 50);
                    };
                    fragment.appendChild(label);
                    tabMatch = true;
                }
                var clone = sec.cloneNode(true);
                clone.style.animationDelay = "0s";
                fragment.appendChild(clone);
                anyVisible = true;
            }
        });
    });
    
    content.innerHTML = "";
    if (!anyVisible) {
        var nr = document.createElement("div");
        nr.className = "search-no-results";
        nr.textContent = "No matching settings";
        content.appendChild(nr);
    } else {
        content.appendChild(fragment);
    }
    if (document.body.classList.contains("editor-mode")) initDragDrop();
}

function show(id) {
    var c = el("settings-content");
    if (!c || !pages[id]) return;
    currentTab = id;
    c.innerHTML = pages[id];
    var navTable = el("nav-table");
    if (navTable) { for (var ni = 0; ni < navTable.children.length; ni++) navTable.children[ni].classList.remove("active"); }
    var btn = el("nav-" + id);
    if (btn) btn.classList.add("active");
    try { loadTab(id); } catch(e) {}
    if (document.body.classList.contains("editor-mode")) initDragDrop();
}

var dragState = null;

function initDragDrop() {
    var container = el("settings-content");
    if (!container) return;
    var oldHandles = container.querySelectorAll(".drag-handle");
    for (var ohi = 0; ohi < oldHandles.length; ohi++) oldHandles[ohi].remove();
    var sections = container.querySelectorAll(".section");
    for (var si = 0; si < sections.length; si++) {
        var s = sections[si];
        var handle = document.createElement("div");
        handle.className = "drag-handle";
        s.insertBefore(handle, s.firstChild);
        (function(sec) {
            handle.addEventListener("mousedown", function(e) {
                if (!document.body.classList.contains("editor-mode")) return;
                e.preventDefault();
                var rect = sec.getBoundingClientRect();
                var clone = sec.cloneNode(true);
                clone.className = clone.className + " drag-clone";
                clone.style.position = "fixed";
                clone.style.pointerEvents = "none";
                clone.style.width = sec.offsetWidth + "px";
                clone.style.zIndex = "9999";
                clone.style.margin = "0";
                clone.style.left = rect.left + "px";
                clone.style.top = rect.top + "px";
                var ch = clone.querySelector(".drag-handle");
                if (ch) ch.remove();
                document.body.appendChild(clone);
                dragState = { el: sec, offsetY: e.clientY - rect.top, clone: clone };
                sec.classList.add("dragging");
            });
        })(s);
    }
    
    // nav delegation (only add once)
    if (!window._editorNavReady) {
        window._editorNavReady = true;
        var nav = el("nav-table");
        if (!nav) return;
        nav.addEventListener("mousedown", function(e) {
            if (!document.body.classList.contains("editor-mode")) return;
            var b = e.target.closest ? e.target.closest("button") : null;
            if (!b) return;
            dragState = { el: b, startX: e.clientX, startY: e.clientY, clone: null, offsetY: 0, isNav: true, moved: false };
        });
    }
}

function teardownDragDrop() {
    var container = el("settings-content");
    if (container) {
        var handles = container.querySelectorAll(".drag-handle");
        for (var hi = 0; hi < handles.length; hi++) handles[hi].remove();
    }
}

document.addEventListener("mousemove", function(e) {
    if (!dragState || !document.body.classList.contains("editor-mode")) return;
    
    if (dragState.isNav && !dragState.moved) {
        if (Math.abs(e.clientX - dragState.startX) < 5 && Math.abs(e.clientY - dragState.startY) < 5) return;
        dragState.moved = true;
        dragState.offsetY = e.clientY - dragState.el.getBoundingClientRect().top;
        var b = dragState.el;
        var rect = b.getBoundingClientRect();
        var clone = b.cloneNode(true);
        clone.className = clone.className + " drag-clone";
        clone.style.position = "fixed";
        clone.style.pointerEvents = "none";
        clone.style.width = b.offsetWidth + "px";
        clone.style.zIndex = "9999";
        clone.style.margin = "0";
        clone.style.left = rect.left + "px";
        clone.style.top = rect.top + "px";
        clone.style.borderRadius = "8px";
        document.body.appendChild(clone);
        dragState.clone = clone;
        b.classList.add("dragging");
        return;
    }
    
    if (!dragState.clone) return;
    dragState.clone.style.top = (e.clientY - dragState.offsetY) + "px";
    if (dragState.isNav) {
        var nav = el("nav-table");
        if (!nav) return;
        var navBtns = nav.querySelectorAll("button");
        for (var nbi = 0; nbi < navBtns.length; nbi++) navBtns[nbi].classList.remove("drag-over");
        var target = document.elementFromPoint(e.clientX, e.clientY);
        while (target && target !== nav) {
            if (target.tagName === "BUTTON" && target !== dragState.el) {
                target.classList.add("drag-over");
                break;
            }
            target = target.parentElement;
        }
    } else {
        var c = el("settings-content");
        if (!c) return;
        var sections = c.querySelectorAll(".section");
        for (var si = 0; si < sections.length; si++) sections[si].classList.remove("drag-over");
        var target = document.elementFromPoint(e.clientX, e.clientY);
        while (target && target !== c) {
            if (target.classList.contains("section") && target !== dragState.el) {
                target.classList.add("drag-over");
                break;
            }
            target = target.parentElement;
        }
    }
});

document.addEventListener("mouseup", function(e) {
    if (!dragState || !document.body.classList.contains("editor-mode")) return;
    
    if (dragState.isNav && !dragState.moved) {
        dragState = null;
        return;
    }
    
    dragState.el.classList.remove("dragging");
    if (dragState.clone) { dragState.clone.remove(); }
    if (dragState.isNav) {
        var nav = el("nav-table");
        if (nav) {
            var target = document.elementFromPoint(e.clientX, e.clientY);
            var dropBtn = null;
            while (target && target !== nav) {
                if (target.tagName === "BUTTON" && target !== dragState.el) {
                    dropBtn = target;
                    break;
                }
                target = target.parentElement;
            }
            if (dropBtn) {
                var all = nav.querySelectorAll("button");
                var fromIdx = Array.from(all).indexOf(dragState.el);
                var toIdx = Array.from(all).indexOf(dropBtn);
                if (fromIdx < toIdx) {
                    dropBtn.parentNode.insertBefore(dragState.el, dropBtn.nextSibling);
                } else {
                    dropBtn.parentNode.insertBefore(dragState.el, dropBtn);
                }
                dragState.el.classList.add("snap-back");
                setTimeout(function() { dragState.el.classList.remove("snap-back"); }, 300);
                nav._dragJustMoved = true;
                var order = [];
                var allNavBtns = nav.querySelectorAll("button");
                for (var obi = 0; obi < allNavBtns.length; obi++) order.push(allNavBtns[obi].id.replace("nav-", ""));
                save("nav.order", order);
            }
            var cleanNavBtns = nav.querySelectorAll("button");
            for (var cbi = 0; cbi < cleanNavBtns.length; cbi++) cleanNavBtns[cbi].classList.remove("drag-over");
        }
    } else {
        var c = el("settings-content");
        if (c) {
            var target = document.elementFromPoint(e.clientX, e.clientY);
            var dropSection = null;
            while (target && target !== c) {
                if (target.classList.contains("section") && target !== dragState.el) {
                    dropSection = target;
                    break;
                }
                target = target.parentElement;
            }
            if (dropSection) {
                var all = c.querySelectorAll(".section");
                var fromIdx = Array.from(all).indexOf(dragState.el);
                var toIdx = Array.from(all).indexOf(dropSection);
                if (fromIdx < toIdx) {
                    dropSection.parentNode.insertBefore(dragState.el, dropSection.nextSibling);
                } else {
                    dropSection.parentNode.insertBefore(dragState.el, dropSection);
                }
                dragState.el.classList.add("snap-back");
                setTimeout(function() { dragState.el.classList.remove("snap-back"); }, 300);
            }
            var cleanSections = c.querySelectorAll(".section");
            for (var csi = 0; csi < cleanSections.length; csi++) cleanSections[csi].classList.remove("drag-over");
        }
    }
    dragState = null;
});

function loadTab(id) {
    if (!es) return;
    
    if (id === "general") {
        var fa = get("general.align") || "2,2";
        document.querySelectorAll(".ab").forEach(function(b) {
            b.classList.toggle("selected", b.getAttribute("data-align") === fa);
            b.onclick = function() {
                var old = get("general.align");
                save("general.align", b.getAttribute("data-align"));
                pushUndo("general.align", old, "Alignment");
                document.querySelectorAll(".ab").forEach(function(x) { x.classList.remove("selected"); });
                b.classList.add("selected");
            };
        });
        
        var sel = el("hide-mode");
        if (sel) {
            sel.value = get("window.menuHideMode") || "never";
            sel.title = "Control when the menu bar is hidden";
            sel.onchange = function(e) {
                var old = get("window.menuHideMode");
                save("window.menuHideMode", e.target.value);
                pushUndo("window.menuHideMode", old, "Menu hide");
                if (window.electron && window.electron.setMenuHideMode) window.electron.setMenuHideMode(e.target.value);
            };
        }
        
        var winSettings = el("window-settings");
        if (winSettings) {
            winSettings.appendChild(createToggle("window.alwaysOnTop", !!get("window.alwaysOnTop"), "Always on top", "Keep window above other windows", function(checked) {
                if (window.electron && window.electron.setAlwaysOnTop) window.electron.setAlwaysOnTop(checked);
            }));
            winSettings.appendChild(createToggle("window.readyToShow", !!get("window.readyToShow"), "Ready to show", "Wait for ready signal before showing window (reduces white flash)"));
            
            var zoomRow = newEl("div");
            zoomRow.className = "setting-row";
            zoomRow.innerHTML = '<label>Zoom step</label><div id="zoom-step-wrap"></div>';
            winSettings.appendChild(zoomRow);
            
            var zw = el("zoom-step-wrap");
            if (zw && !zw.querySelector("input")) {
                var zv = parseFloat(get("window.zoomStep")) || 1;
                var zs = createStepper("zoom-step", zv, 1, 100, "%",
                    function(v) { save("window.zoomStep", v); }
                );
                zw.appendChild(zs.wrap);
                zw.appendChild(createLockBtn("lock.zoomStep", zs.input, 1, 100, 1, 500));
            }
        }
        
        el("export-settings").onclick = function() {
            window.electron.exportSettings().then(function(ok) {
                var st = el("backup-status");
                if (st) {
                    st.textContent = ok ? "Exported" : "Failed";
                    showToast(ok ? "Settings exported" : "Export failed", ok ? "success" : "error");
                    setTimeout(function() { st.textContent = ""; }, 2000);
                }
            }).catch(function() {
                showToast("Export failed", "error");
            });
        };
        el("import-settings").onclick = function() {
            window.electron.importSettings().then(function(ok) {
                var st = el("backup-status");
                if (st) {
                    st.textContent = ok ? "Imported" : "Failed";
                    showToast(ok ? "Settings imported" : "Import failed", ok ? "success" : "error");
                    setTimeout(function() { st.textContent = ""; }, 2000);
                }
            }).catch(function() {
                showToast("Import failed", "error");
            });
        };
        
        var copyBtn = el("copy-settings");
        if (copyBtn) {
            copyBtn.onclick = function() {
                var data = getAllSettings();
                try {
                    var str = JSON.stringify(data, null, 2);
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(str).then(function() {
                            showToast("Settings copied", "success");
                        }).catch(function() {
                            showToast("Copy failed", "error");
                        });
                    } else {
                        var ta = document.createElement("textarea");
                        ta.value = str;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                        showToast("Settings copied", "success");
                    }
                } catch(e) {
                    showToast("Copy failed", "error");
                }
            };
        }
        
        var pasteBtn = el("paste-settings");
        if (pasteBtn) {
            pasteBtn.onclick = function() {
                try {
                    var readClipboard = function(cb) {
                        if (navigator.clipboard && navigator.clipboard.readText) {
                            navigator.clipboard.readText().then(cb).catch(function() { cb(null); });
                        } else {
                            cb(null);
                        }
                    };
                    readClipboard(function(text) {
                        if (!text) { showToast("No text in clipboard", "error"); return; }
                        try {
                            var data = JSON.parse(text);
                            var count = 0;
                            for (var k in data) {
                                if (data.hasOwnProperty(k)) {
                                    save(k, data[k]);
                                    count++;
                                }
                            }
                            pushUndo("_batch", null, "Paste settings (" + count + " values)");
                            applyTheme();
                            syncAllPages();
                            showToast(count + " settings pasted", "success");
                        } catch(e) {
                            showToast("Invalid JSON in clipboard", "error");
                        }
                    });
                } catch(e) {
                    showToast("Paste failed", "error");
                }
            };
        }
        
        var resetBtn = el("reset-all");
        if (resetBtn) {
            resetBtn.onclick = function() {
                if (!confirm("Reset ALL settings to defaults? This cannot be undone.")) return;
                var allSettings = getAllSettings();
                var allKeyNames = Object.keys(allSettings);
                for (var ri = 0; ri < allKeyNames.length; ri++) {
                    es.setSync(allKeyNames[ri], undefined);
                }
                _themeDirty = true;
                historyStack = [];
                redoStack = [];
                updateUndoBtn();
                updateRedoBtn();
                applyTheme();
                syncAllPages();
                showToast("All settings reset", "success");
            };
        }
        
        var cc = el("clear-cache");
        if (cc) {
            cc.onclick = function() {
                if (window.electron && window.electron.clearCache) {
                    window.electron.clearCache().then(function(info) {
                        var freed = info ? info.freed : 0;
                        showToast("Cache cleared (" + formatBytes(freed) + ")", "success");
                        refreshCacheInfo();
                    });
                }
            };
        }
        
        var rc = el("refresh-cache");
        if (rc) rc.onclick = refreshCacheInfo;
        refreshCacheInfo();
    }
    
    if (id === "shortcuts") {
        renderShortcuts();
        var keyInput = el("new-key");
        var actionRow = el("action-row");
        actionRow.innerHTML = "";
        var selectedAction = null;
        
        keyInput.addEventListener("keydown", function(e) {
            e.preventDefault();
            var parts = [];
            if (e.ctrlKey) parts.push("Ctrl");
            if (e.shiftKey) parts.push("Shift");
            if (e.altKey) parts.push("Alt");
            if (e.metaKey) parts.push("Meta");
            var key = e.key;
            if (key !== "Control" && key !== "Shift" && key !== "Alt" && key !== "Meta") {
                parts.push(key.length === 1 ? key.toUpperCase() : key);
                keyInput.value = parts.join("+");
            }
        });
        
        actionList.forEach(function(a) {
            var item = newEl("div");
            item.className = "action-item";
            item.setAttribute("data-action", a.id);
            item.innerHTML = '<span class="action-emoji">' + a.emoji + '</span><span class="action-name">' + a.name + '</span>';
            item.onclick = function() {
                document.querySelectorAll(".action-item").forEach(function(x) { x.classList.remove("selected"); });
                item.classList.add("selected");
                selectedAction = a.id;
            };
            actionRow.appendChild(item);
        });
        
        el("add-shortcut").onclick = function() {
            var key = el("new-key").value.trim();
            if (!key) { keyInput.focus(); return; }
            if (!selectedAction) {
                showToast("Select an action first", "error");
                return;
            }
            var old = get("shortcuts.custom") || {};
            var shortcuts = Object.assign({}, old);
            shortcuts[key] = selectedAction;
            save("shortcuts.custom", shortcuts);
            pushUndo("shortcuts.custom", old, "Shortcut");
            el("new-key").value = "";
            document.querySelectorAll(".action-item").forEach(function(x) { x.classList.remove("selected"); });
            selectedAction = null;
            renderShortcuts();
            showToast("Shortcut added", "success");
        };
    }
    
    if (id === "ui") {
        var themeBtns = document.querySelectorAll(".theme-btn");
        var mode = get("ui.mode") || "dark";
        
        themeBtns.forEach(function(b) {
            b.classList.toggle("active", b.getAttribute("data-theme") === mode);
            b.onclick = function() {
                var t = b.getAttribute("data-theme");
                var old = get("ui.mode");
                var oldCustom = get("ui.custom");
                save("ui.mode", t);
                if (t !== "custom") {
                    save("ui.custom", {});
                }
                pushUndo("ui.mode", old, "Theme");
                if (t !== "custom" && oldCustom && Object.keys(oldCustom).length > 0) {
                    pushUndo("ui.custom", oldCustom, "Theme colors");
                }
                themeBtns.forEach(function(x) { x.classList.remove("active"); });
                b.classList.add("active");
                loadColorPickers();
                applyTheme();
                syncAllPages();
            };
        });
        
        loadColorPickers();
        
        var uiToggles = el("ui-toggles");
        if (uiToggles) {
            uiToggles.innerHTML = "";
            uiToggles.appendChild(createToggle("ui.animations", get("ui.animations") !== false, "Animations", "Enable UI transitions"));
            uiToggles.appendChild(createToggle("ui.compact", !!get("ui.compact"), "Compact mode", "Reduce spacing"));
            uiToggles.appendChild(createToggle("ui.labels", get("ui.labels") !== false, "Labels", "Show UI labels"));
        }
        
        var linkBtn = el("link-accent-btn");
        if (linkBtn) {
            function updateLinkBtn() {
                var linked = !!get("ui.linkBg3");
                linkBtn.textContent = linked ? "#" : "o";
                linkBtn.classList.toggle("active", linked);
                linkBtn.title = linked ? "Cards follow accent" : "Cards independent";
            }
            updateLinkBtn();
            linkBtn.onclick = function() {
                var old = !!get("ui.linkBg3");
                save("ui.linkBg3", !old);
                pushUndo("ui.linkBg3", old, "Link card to accent");
                updateLinkBtn();
                applyTheme();
                syncAllPages();
            };
        }
        
        var radiusWrap = el("ui-radius-wrap");
        if (radiusWrap && !radiusWrap.querySelector("input")) {
            var rv = get("ui.radius") || 4;
            var rs = createStepper("ui-radius", rv, 0, 40, "px",
                function(v) { save("ui.radius", v); },
                function(v) { pushUndo("ui.radius", get("ui.radius"), "Radius"); applyTheme(); }
            );
            radiusWrap.appendChild(rs.wrap);
            radiusWrap.appendChild(createLockBtn("lock.radius", rs.input, 0, 40, -50, 100));
        }
        
        var outlineWrap = el("ui-outline-wrap");
        if (outlineWrap && !outlineWrap.querySelector("input")) {
            var ov = get("ui.outline") || 1;
            var os = createStepper("ui-outline", ov, 0, 20, "px",
                function(v) { save("ui.outline", v); },
                function(v) { pushUndo("ui.outline", get("ui.outline"), "Card outline"); applyTheme(); }
            );
            outlineWrap.appendChild(os.wrap);
            outlineWrap.appendChild(createLockBtn("lock.outline", os.input, 0, 20, -10, 50));
        }
        
        function makeToggleBtn(id, key, label) {
            var btn = el(id);
            if (!btn) return;
            function update() {
                var on = !!get(key);
                btn.textContent = on ? "#" : "o";
                btn.classList.toggle("active", on);
                btn.title = on ? label + " on (white)" : label + " off (accent)";
            }
            update();
            btn.onclick = function() {
                var old = !!get(key);
                save(key, !old);
                pushUndo(key, old, label);
                update();
                applyTheme();
            };
        }
        makeToggleBtn("lock-text-btn", "ui.lockText", "Lock text colors");
        
        var scaleWrap = el("ui-scale-wrap");
        if (scaleWrap && !scaleWrap.querySelector("input")) {
            var sv = get("ui.scale") || 100;
            var ss = createStepper("ui-scale", sv, 50, 150, "%",
                function(v) { save("ui.scale", v); applyScale(); },
                function(v) { pushUndo("ui.scale", get("ui.scale"), "UI Scale"); applyScale(); }
            );
            scaleWrap.appendChild(ss.wrap);
            scaleWrap.appendChild(createLockBtn("lock.scale", ss.input, 50, 150, -100, 500));
        }
        
        applyScale();

        var fontSelect = el("ui-font");
        var customFontInput = el("ui-custom-font");
        if (fontSelect) {
            fontSelect.value = get("ui.font") || "";
            fontSelect.onchange = function() {
                var old = get("ui.font");
                save("ui.font", fontSelect.value);
                save("ui.customFont", "");
                customFontInput.value = "";
                pushUndo("ui.font", old, "Font");
                applyTheme();
            };
        }
        if (customFontInput) {
            customFontInput.value = get("ui.customFont") || "";
            customFontInput.onchange = function() {
                var old = get("ui.customFont");
                save("ui.customFont", customFontInput.value);
                if (customFontInput.value) { save("ui.font", ""); fontSelect.value = ""; }
                pushUndo("ui.customFont", old, "Custom font");
                applyTheme();
            };
        }
    }
    
    if (id === "flash") {
        var ft = el("flash-toggle");
        if (ft) {
            ft.appendChild(createToggle("flash.enable", !!get("flash.enable"), "Use downloaded Flash", "Enable custom downloaded Flash version instead of bundled"));
        }
        var iv = el("installed-version");
        if (iv) iv.textContent = get("flash.currentVersion") || "None";
        var sel = el("install_versions");
        if (sel && window.electron) {
            window.electron.getFlashReleases().then(function(r) {
                sel.innerHTML = "";
                if (r && r.releases) r.releases.forEach(function(rel) { sel.add(new Option(rel.name, rel.version)); });
            }).catch(function() {
                showToast("Failed to load versions", "error");
                sel.innerHTML = "<option>Error</option>";
            });
        }
        el("install").onclick = function() {
            var v = sel.value;
            if (!v || v === "Loading..." || v === "Error") return;
            var inst = el("install");
            inst.textContent = "...";
            inst.disabled = true;
            window.electron.installFlash(v).on("success", function() {
                inst.textContent = "Install";
                inst.disabled = false;
                if (iv) iv.textContent = v;
                showToast("Flash installed", "success");
            }).on("error", function(msg) {
                inst.textContent = "Install";
                inst.disabled = false;
                showToast("Install failed: " + msg, "error");
            });
        };
        el("uninstall").onclick = function() {
            window.electron.uninstallFlash().on("success", function() {
                if (iv) iv.textContent = "None";
                el("uninstall").hidden = true;
                showToast("Flash removed", "success");
            }).on("error", function(msg) {
                showToast("Remove failed: " + msg, "error");
            });
        };
    }

    if (id === "logs") {
        loadDiagnostics();
        loadLogs();
        var refreshBtn = el("refresh-log");
        if (refreshBtn) refreshBtn.onclick = loadLogs;
        var openBtn = el("open-log-folder");
        if (openBtn && window.electron && window.electron.openLogFolder) {
            openBtn.onclick = function() { window.electron.openLogFolder(); };
        }
        var clearBtn = el("clear-logs-btn");
        if (clearBtn) {
            clearBtn.onclick = clearLogs;
        }
    }
}

function loadDiagnostics() {
    var diag = el("diag-info");
    if (!diag || !window.electron) return;
    if (window.electron.getDiagnostics) {
        window.electron.getDiagnostics().then(function(info) {
            diag.innerHTML =
                '<div class="setting-row"><label>Platform</label><span>' + (info.platform || "?") + '</span></div>' +
                '<div class="setting-row"><label>Electron</label><span>' + (info.electron || "?") + '</span></div>' +
                '<div class="setting-row"><label>Flash bundled</label><span>' + (info.flashBundled || "?") + '</span></div>' +
                '<div class="setting-row"><label>Flash installed</label><span>' + (info.flashInstalled || "None") + '</span></div>' +
                '<div class="setting-row"><label>Flash enabled</label><span>' + (info.flashEnabled ? "Yes" : "No") + '</span></div>' +
                '<div class="setting-row"><label>Cache size</label><span>' + (info.cacheSize || "?") + '</span></div>' +
                '<div class="setting-row"><label>Window size</label><span>' + (info.windowSize || "?") + '</span></div>' +
                '<div class="setting-row"><label>Uptime</label><span>' + (info.uptime || "?") + '</span></div>';
        });
    }
}

function loadLogs() {
    var logEl = el("log-content");
    if (!logEl || !window.electron) return;
    if (window.electron.getLogs) {
        window.electron.getLogs().then(function(content) {
            logEl.textContent = content || "(no logs)";
            logEl.scrollTop = logEl.scrollHeight;
        }).catch(function() {
            logEl.textContent = "(failed to load logs)";
        });
    }
}

function loadColorPickers() {
    var colorIds = ["c-bg", "c-bg2", "c-bg3", "c-bg4", "c-fg", "c-fg2", "c-fg3", "c-border", "c-accent", "c-secondary"];
    var colorKeys = ["bg", "bg2", "bg3", "bg4", "fg", "fg2", "fg3", "border", "accent", "secondary"];
    var custom = get("ui.custom") || {};
    var mode = get("ui.mode") || "dark";
    var linkBg3 = !!es && !!es.getSync("ui.linkBg3");
    
    var showExtra = mode === "vibrant" || mode === "custom";
    var sr = el("c-secondary-row");
    if (sr) sr.style.display = showExtra ? "" : "none";
    
    colorIds.forEach(function(cid, i) {
        var inp = el(cid);
        if (inp) {
            inp.value = custom[colorKeys[i]] || themes[mode][colorKeys[i]];
            var colorKey = colorKeys[i];
            inp.oninput = function(e) {
                custom[colorKey] = e.target.value;
                save("ui.custom", custom);
                applyLiveUpdate(custom, mode, linkBg3);
            };
            inp.onchange = function(e) {
                pushUndo("ui.custom", Object.assign({}, custom), "Color: " + colorKey);
            };
        }
    });
}

function applyLiveUpdate(custom, mode, linkBg3) {
    var baseTheme = themes[mode] || themes.dark;
    var allKeys = ["bg", "bg2", "bg3", "bg4", "fg", "fg2", "fg3", "border", "accent"];
    for (var i = 0; i < allKeys.length; i++) {
        document.documentElement.style.setProperty("--" + allKeys[i], custom[allKeys[i]] || baseTheme[allKeys[i]]);
    }
    var ac = custom.accent || baseTheme.accent;
    var rgb = hexToRgb(ac);
    if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb.r + ", " + rgb.g + ", " + rgb.b);
    document.documentElement.style.setProperty("--accent-text", isLightColor(ac) ? "#16161e" : "#ffffff");

    var val = custom.secondary || baseTheme.secondary || baseTheme.accent;
    document.documentElement.style.setProperty("--accent2", val);
    var vRgb = hexToRgb(val);
    if (vRgb) document.documentElement.style.setProperty("--accent2-rgb", vRgb.r + ", " + vRgb.g + ", " + vRgb.b);
    document.documentElement.style.setProperty("--accent2-text", isLightColor(val) ? "#16161e" : "#ffffff");

    if (linkBg3) {
        document.documentElement.style.setProperty("--bg3", darkenColor(ac, 82));
        document.documentElement.style.setProperty("--bg4", darkenColor(ac, 72));
    }
}

function renderShortcuts() {
    if (!es) return;
    var list = el("shortcuts-list");
    var shortcuts = get("shortcuts.custom") || {};
    list.innerHTML = "";
    
    if (Object.keys(shortcuts).length === 0) {
        list.innerHTML = '<p class="no-shortcuts">No shortcuts</p>';
        return;
    }
    
    Object.keys(shortcuts).sort().forEach(function(key) {
        var action = actionMap[shortcuts[key]];
        var card = newEl("div");
        card.className = "shortcut-card";
        card.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            '<span class="shortcut-emoji">' + (action ? action.emoji : "") + '</span>' +
            '<span class="shortcut-action">' + (action ? action.name : shortcuts[key]) + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="shortcut-key">' + key + '</span>' +
            '<button class="btn-delete" data-key="' + key + '">x</button>' +
            '</div>';
        
        card.querySelector(".btn-delete").onclick = function() {
            var old = Object.assign({}, shortcuts);
            delete shortcuts[key];
            save("shortcuts.custom", shortcuts);
            pushUndo("shortcuts.custom", old, "Shortcut removed");
            renderShortcuts();
            showToast("Shortcut removed", "success");
        };
        list.appendChild(card);
    });
}

document.addEventListener("keydown", function(e) {
    var tag = document.activeElement ? document.activeElement.tagName : "";
    var inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault(); undoLast(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault(); redoLast(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault(); redoLast(); return;
    }
    if (e.key >= "1" && e.key <= "5" && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
        var idx = parseInt(e.key) - 1;
        var btns = el("nav-table");
        if (btns) { var b = btns.querySelector("button:nth-child(" + (idx + 1) + ")"); if (b) { b.click(); e.preventDefault(); } }
        return;
    }
    if (e.key === "Tab" && !inInput) {
        var navTable = el("nav-table");
        if (!navTable) return;
        var btns = navTable.children;
        var cur = 0;
        for (var bi = 0; bi < btns.length; bi++) { if (btns[bi].classList.contains("active")) { cur = bi; break; } }
        var nxt = (cur + (e.shiftKey ? -1 : 1) + btns.length) % btns.length;
        btns[nxt].click();
        e.preventDefault();
    }
});

window.addEventListener("focus", applyTheme);

/* ── Search ── */
var searchBar = el("search-bar");
if (searchBar) {
    searchBar.addEventListener("input", function() {
        searchQuery = searchBar.value.trim().toLowerCase();
        applySearch();
    });
}
var searchWrap = el("search-bar-inner");
if (searchWrap) {
    searchWrap.addEventListener("click", function() {
        if (searchBar) searchBar.focus();
    });
}

function clearLogs() {
    if (window.electron && window.electron.clearLogs) {
        window.electron.clearLogs().then(function(ok) {
            if (ok) {
                showToast("Logs cleared", "success");
                loadLogs();
            } else {
                showToast("Failed to clear logs", "error");
            }
        });
    }
}

init();
renderNav();
applyTheme();
show("general");
applyScale();
updateUndoBtn();

var undoBtn = el("undo-btn");
if (undoBtn) {
    undoBtn.onclick = undoLast;
}
var redoBtn = el("redo-btn");
if (redoBtn) {
    redoBtn.onclick = redoLast;
}
var editorBtn = el("editor-btn");
if (editorBtn) {
    editorBtn.onclick = function() {
        var on = document.body.classList.toggle("editor-mode");
        editorBtn.textContent = on ? "Done" : "Editor";
        if (on) initDragDrop();
        else teardownDragDrop();
    };
}


