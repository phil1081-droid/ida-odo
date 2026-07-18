/**
 * build.js — Kopiert alle Spieldateien nach www/
 * (Schließt node_modules, ios, android, .git, archive etc. aus)
 * Aufruf: node build.js
 */
const fs   = require('fs');
const path = require('path');

const SRC  = __dirname;
const DEST = path.join(__dirname, 'www');

const INCLUDE_EXTS = new Set([
    '.html', '.js', '.css', '.png', '.jpg', '.jpeg',
    '.ico', '.mp3', '.webmanifest', '.htaccess', '.json'
]);

const EXCLUDE_DIRS = new Set([
    'node_modules', 'ios', 'android', 'www', '.git', 'archive', '.claude', 'resources', 'screenshots'
]);

const EXCLUDE_FILES = new Set([
    'package.json', 'package-lock.json', 'capacitor.config.json',
    'build.js', 'chroma_bake.py', 'server.py', 'deploy.ps1'
]);

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST);

let copied = 0;

function copyDir(src, dest) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry.name)) continue;
            const d = path.join(dest, entry.name);
            fs.mkdirSync(d, { recursive: true });
            copyDir(path.join(src, entry.name), d);
        } else {
            if (EXCLUDE_FILES.has(entry.name)) continue;
            const ext = path.extname(entry.name).toLowerCase();
            // Erlaubte Extensions + .htaccess (kein ext)
            if (!INCLUDE_EXTS.has(ext) && entry.name !== '.htaccess') continue;
            fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
            copied++;
        }
    }
}

copyDir(SRC, DEST);
console.log(`✓ Build: ${copied} Dateien → www/`);
