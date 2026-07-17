var es = window.electron ? window.electron.electronSets : null;

var themes = {
    dark: { bg: "#0a0a0c", bg2: "#101014", bg3: "#18181e", bg4: "#22222a", fg: "#c8c8d0", fg2: "#808088", fg3: "#505058", border: "#3a3a48", accent: "#ffffff" },
    amoled: { bg: "#000000", bg2: "#080808", bg3: "#101014", bg4: "#18181e", fg: "#c0c0c8", fg2: "#707078", fg3: "#484850", border: "#2a2a38", accent: "#ffffff" },
    light: { bg: "#f5f5f7", bg2: "#eaeaee", bg3: "#dddde4", bg4: "#cfcfd6", fg: "#16161e", fg2: "#555566", fg3: "#88889a", border: "#c0c0ce", accent: "#3a3a44" },
    vibrant: { bg: "#0e0e12", bg2: "#16161c", bg3: "#1e1e26", bg4: "#282832", fg: "#d0d0d8", fg2: "#70707e", fg3: "#50505a", border: "#323242", accent: "#ff6644", secondary: "#44bbdd" }
};

var defaults = themes.dark;

function getTheme() {
    if (!es) return defaults;
    var mode = es.getSync("ui.mode") || "dark";
    var custom = es.getSync("ui.custom") || {};
    var theme = Object.assign({}, themes[mode] || defaults);
    for (var k in custom) theme[k] = custom[k];
    return theme;
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

function applyTheme() {
    if (!es) return;
    var theme = getTheme();
    var mode = es.getSync("ui.mode") || "dark";
    var anim = es.getSync("ui.animations") !== false;
    var compact = !!es.getSync("ui.compact");
    var labels = es.getSync("ui.labels") !== false;
    var radius = es.getSync("ui.radius") || 4;
    var hasMulti = theme.secondary;
    var rgb = hexToRgb(theme.accent);
    var lockText = es && !!es.getSync("ui.lockText");

    document.documentElement.style.setProperty("--bg", theme.bg);
    document.documentElement.style.setProperty("--bg2", theme.bg2);
    var linkBg3 = !!es && !!es.getSync("ui.linkBg3");
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

    document.documentElement.style.setProperty("--radius", radius + "px");
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

var officialData = [
    { name: "Transformice", url: "https://www.transformice.com/", desc: "Official game website" },
    { name: "Atelier 801", url: "https://atelier801.com", desc: "Forums & community hub" },
    { name: "Wiki", url: "https://transformice.fandom.com", desc: "Maps, guides, and mechanics" }
];

var toolsData = [
    { name: "PenAttention", url: "http://www.math.uaa.alaska.edu/~afkjm/PenAttention/download.html", desc: "Cursor highlight tool" },
    { name: "TCP Optimizer", url: "https://www.speedguide.net/downloads.php", desc: "Network optimization for gaming" }
];

var survivorData = [
    { name: "Global TFM UwU", url: "https://globaltransformiceuwu.rf.gd/en/", desc: "Community resources and tools" },
    { name: "Cheese For Mice", url: "https://cheeseforice.com/", desc: "Player statistics and rankings" },
    { name: "P10 Maps", url: "https://docs.google.com/spreadsheets/d/1Q-UOpUErax4u_IsSubol0U_LtyS-C9kvqSmnHW9L_cw/edit?pli=1&gid=0#gid=0", desc: "Community-tracked permed/depermed map database" }
];

function renderLinks(items) {
    return items.map(function(l) {
        return '<a href="' + l.url + '" target="_blank" class="link-item">' +
            '<span class="link-name">' + l.name + '</span>' +
            '<span class="link-desc">' + l.desc + '</span>' +
            '</a>';
    }).join("");
}

function render() {
    var content = document.getElementById("content");
    if (!content) return;

    content.innerHTML =
        '<div class="links-hero">' +
            '<h1 class="links-title">Links</h1>' +
            '<p class="links-subtitle">Resources, tools, and community maps</p>' +
        '</div>' +

        '<div class="section links-section">' +
            '<div class="section-title">Official</div>' +
            renderLinks(officialData) +
        '</div>' +

        '<div class="section links-section">' +
            '<div class="section-title">Survivor</div>' +
            renderLinks(survivorData) +
        '</div>' +

        '<div class="section links-section">' +
            '<div class="section-title">Tools</div>' +
            renderLinks(toolsData) +
        '</div>';

    applyTheme();
}

document.addEventListener("visibilitychange", function() {
    if (!document.hidden) applyTheme();
});
window.addEventListener("focus", applyTheme);

render();
