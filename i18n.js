// =======================================================
// i18n.js  –  Lokalisierungs-Kern (nur Logik, kein Text)
// Texte liegen in locales/de.js, locales/en.js, locales/fr.js …
//
// API:
//   t(key, params)  → übersetzter String  (params: {n:5} ersetzt {n})
//   tArr(key)       → übersetzte Array
//   applyI18n()     → befüllt data-i18n / data-i18n-placeholder im DOM
//   window.LANG     → aktiv genutztes Sprachkürzel
//
// Sprache erzwingen: URL-Parameter ?lang=en / ?lang=fr / ?lang=de
// =======================================================

// ── Sprachermittlung ─────────────────────────────────────────
function _detectLang() {
    const urlLang = new URLSearchParams(location.search).get("lang");
    if (urlLang && window.I18N && window.I18N[urlLang]) return urlLang;

    const nav = (navigator.language || navigator.userLanguage || "de").toLowerCase();
    if (nav.startsWith("de")) return "de";
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("it")) return "it";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("tr")) return "tr";
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("pt")) return "pt";
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("pl")) return "pl";
    if (nav.startsWith("nl")) return "nl";
    if (nav.startsWith("ar")) return "ar";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("th")) return "th";
    if (nav.startsWith("ko")) return "ko";
    if (nav.startsWith("id")) return "id";
    if (nav.startsWith("he")) return "he";
    // "ae" (Altägyptisch) ist ein Easter Egg — nur via ?lang=ae erreichbar, kein Browser meldet "ae"
    if (nav.startsWith("hi")) return "hi";
    if (nav.startsWith("ur")) return "ur";
    if (nav.startsWith("bn")) return "bn";
    if (nav.startsWith("ro")) return "ro";
    if (nav.startsWith("vi")) return "vi";
    if (nav.startsWith("fa")) return "fa";
    if (nav.startsWith("sw")) return "sw";
    if (nav.startsWith("hr")) return "hr";
    if (nav.startsWith("sr")) return "hr";
    if (nav.startsWith("bs")) return "hr";
    return "en";
}

const LANG = _detectLang();
window.LANG = LANG;

// RTL-Sprachen: dir-Attribut sofort setzen (vor DOMContentLoaded)
const RTL_LANGS = new Set(["ar", "he", "ur", "fa"]);
if (RTL_LANGS.has(LANG)) {
    document.documentElement.setAttribute("dir", "rtl");
}

// ── Übersetzungsfunktionen ───────────────────────────────────
function t(key, params) {
    const I18N   = window.I18N || {};
    const strings = I18N[LANG] || I18N.de || {};
    let str = strings[key] ?? (I18N.de || {})[key] ?? key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, v);
        }
    }
    return str;
}

function tArr(key) {
    const I18N   = window.I18N || {};
    const strings = I18N[LANG] || I18N.de || {};
    return strings[key] ?? (I18N.de || {})[key] ?? [];
}

// ── DOM-Anwendung ────────────────────────────────────────────
function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
}

document.addEventListener("DOMContentLoaded", applyI18n);

window.t         = t;
window.tArr      = tArr;
window.applyI18n = applyI18n;
