// optimize-sprites.js — PNG-Sprites mit sharp komprimieren
// Aufruf: node optimize-sprites.js
// Ergebnis landet in ./optimized/ zur Prüfung vor dem Ersetzen

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const sprites = [
    'platsch_sprites.png',
    'start_sprites.png',
    'gameover_sprites.png',
    'odo-grab_sprites.png',
    'odo-fall_sprites.png',
    'ida_sprites.png',
    'ida-present_sprites.png',
    'odo-ride_sprites.png',
    'ida-ice_sprites.png',
    'bollen_sprites.png',
    'obstacles.png',
    'start_007.png',
];

const outDir = path.join(__dirname, 'optimized');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

let totalBefore = 0, totalAfter = 0;

async function optimize(file) {
    const input  = path.join(__dirname, file);
    const output = path.join(outDir, file);
    const before = fs.statSync(input).size;

    await sharp(input)
        .png({ palette: true, quality: 85, effort: 10 })
        .toFile(output);

    const after = fs.statSync(output).size;
    const pct   = Math.round((1 - after / before) * 100);
    totalBefore += before;
    totalAfter  += after;
    console.log(`  ${file.padEnd(28)} ${(before/1e6).toFixed(1).padStart(5)} MB → ${(after/1e6).toFixed(1).padStart(5)} MB  (-${pct}%)`);
}

(async () => {
    console.log('\nOptimiere Sprites...\n');
    for (const f of sprites) await optimize(f);
    const saved = Math.round((1 - totalAfter / totalBefore) * 100);
    console.log(`\nGesamt: ${(totalBefore/1e6).toFixed(1)} MB → ${(totalAfter/1e6).toFixed(1)} MB  (-${saved}%)`);
    console.log('Ergebnis in ./optimized/ — bitte visuell prüfen, dann:\n');
    console.log('  node optimize-sprites.js --apply   (ersetzt Originale)\n');
})();

// --apply: optimierte Dateien über Originale kopieren
if (process.argv.includes('--apply')) {
    for (const f of sprites) {
        const src = path.join(__dirname, 'optimized', f);
        const dst = path.join(__dirname, f);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            console.log(`  ✓ ${f}`);
        }
    }
    console.log('\nOriginale ersetzt.');
}
