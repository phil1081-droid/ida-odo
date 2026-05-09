//
//  empty.js
//  
//
//  Created by Philipp Leiß on 22.12.25.
//

/* -----------------------------
 main.js: Handle game loop, controls, falling lumps
 ----------------------------- */

/* ---------- Config ---------- */
const DESIGN_W = 390; // always refer to this width, never canvas !!
const DESIGN_H = 844; // always refer to this height, never canvas !!
const CONTROLS_H = 140;
const WORLD_H = DESIGN_H - CONTROLS_H;
const ANIM_FPS = 10;           // animation frames per second
const FRAME_FALL_BASE = 2.2;   // base falling speed multiplier (tuned)
const LEVEL_SPEED_FACTOR = 1.1; // per level multiplier

/* ---------- Sprites ---------- */
const CHROMA_PRESETS = {
    ida:    { minG: 60, ratio: 1.2, hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    lump:   { minG: 80, ratio: 0.6, hardCut: 40, domFactor: 1.0, minSat: 0.02 },
    odo:    { minG: 60, ratio: 1.25, hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    ride:   { minG: 60, ratio: 1.25, hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    grab:   { minG: 60, ratio: 1.15, hardCut: 40, domFactor: 1.5, minSat: 0.02 },
    platsch:{minG: 80, ratio: 1.2,  hardCut: 80, domFactor: 3.0, minSat: 0.05 },
    obstacle: {
        minG: 60,
        ratio: 1.15,
        hardCut: 60,
        domFactor: 2.0,
        minSat: 0.05
    }
};

/**
 * Lädt ein SpriteSheet mit IMMER 8 Spalten und variablen Zeilen.
 * Rückgabe: frames[], frameW, frameH
 * Lädt eine Multi-Frame Sprite-Sheet Bilddatei
 * und extrahiert ALLE Frames (horizontal angeordnet).
 *
 * @param {string} src  – Pfad zur Sprite-PNG
 * @param {function} callback – (framesArray, frameW, frameH)
 */
function loadMultiFrameImages(src, rows, chromaPreset, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
        try {
            const cols = 8;             // immer 8 pro Reihe
            const frameW = Math.floor(img.width / cols);
            const frameH = Math.floor(img.height / rows);

            const frames = [];

            // Offscreen zum extrahieren
            const off = document.createElement("canvas");
            off.width = frameW;
            off.height = frameH;
            const offCtx = off.getContext("2d");

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {

                    offCtx.clearRect(0, 0, frameW, frameH);

                    offCtx.drawImage(
                        img,
                        c * frameW, r * frameH, frameW, frameH,
                        0, 0, frameW, frameH
                    );

                    let imgData = offCtx.getImageData(0, 0, frameW, frameH);
                    imgData = chromaKeyImageData(imgData, chromaPreset);
                    offCtx.putImageData(imgData, 0, 0);

                    const cv = document.createElement("canvas");
                    cv.width = frameW;
                    cv.height = frameH;
                    cv.getContext("2d").drawImage(off, 0, 0);
                    frames.push(cv);
                }
            }

            callback(frames, frameW, frameH);

        } catch (err) {
            console.error("loadMultiFrameImages ERROR:", err);
        }
    };

    img.onerror = () => console.error("Cannot load sprite:", src);
    img.src = src;
}

function loadPosterWithChroma(src, chromaPreset, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;

        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);

        if (chromaPreset) {
            let imgData = ctx.getImageData(0, 0, cv.width, cv.height);
            imgData = chromaKeyImageData(imgData, chromaPreset);
            ctx.putImageData(imgData, 0, 0);
        }

        callback(cv);
    };

    img.onerror = () => {
        console.error("Cannot load poster:", src);
        callback(null);
    };

    img.src = src;
}

function recolorYellowToRed(sourceCanvas) {
    const c = document.createElement("canvas");
    c.width = sourceCanvas.width;
    c.height = sourceCanvas.height;

    const ctx = c.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);

    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];

        if (a > 0 && r > 180 && g > 180 && b < 120) {
            d[i]     = 220; // R
            d[i + 1] = 40;  // G
            d[i + 2] = 40;  // B
        }
    }

    ctx.putImageData(img, 0, 0);
    return c;
}

// Globale Sprites (einmal laden)
let odoFramesYellow = [];
let odoFramesRed = [];
let odoRideFramesYellow = [];
let odoRideFramesRed = [];
let odoGrabFramesYellow = [];
let odoGrabFramesRed = [];
// ... füge für alle Sprites (ida, lump etc.) hinzu – ähnlich

// Lade Sprites einmal (asynchron)
function loadAllSprites() {
    return new Promise((resolve) => {
        loadMultiFrameImages(
            "odo-fall_sprites.png",
            13,
            CHROMA_PRESETS.odo,
            (frames, w, h) => {
                odoFramesYellow = frames;
                odoFramesRed = frames.map(recolorYellowToRed);
                odoFrameW = w;
                odoFrameH = h;
            }
        );

        loadMultiFrameImages(
            "odo-ride_sprites.png",
            5,
            CHROMA_PRESETS.ride,
            (frames, w, h) => {
                odoRideFramesYellow = frames;
                odoRideFramesRed = frames.map(recolorYellowToRed);
                odoRideFrameW = w;
                odoRideFrameH = h;
            }
        );

        loadMultiFrameImages(
            "odo-grab_sprites.png",
            29,
            CHROMA_PRESETS.grab,
            (frames, w, h) => {
                odoGrabFramesYellow = frames;
                odoGrabFramesRed = frames.map(recolorYellowToRed);
                odoGrabFrameW = w;
                odoGrabFrameH = h;
            }
        );

        // ... Lade alle anderen Sprites ähnlich (ida, lump etc.)
        // z. B. für ida:
        // loadIdaSprites();  // Deine preload-Functions anpassen

        resolve();
    });
}

// Warte auf Sprites, bevor Games starten
loadAllSprites().then(() => {
    initGames();
});

// Init-Funktion: Single oder Multi
function initGames() {
    if (document.querySelector('#multiGameContainer')) {
        // Multi-Mode
        initMultiGame();
    } else {
        // Single-Mode (index.html)
        initSingleGame();
    }
}

// Single-Game Init (original)
function initSingleGame() {
    const frameEl = document.getElementById('gameFrame');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('startOverlay');
    const startButton = document.getElementById('startButton');

    overflow = new OverflowManager(12);
    overflow.onOverflow = () => {
        state.gameOver = true;
        state.gameOverTime = performance.now();

        gameOverAnim = new StartScreenAnimation(
            canvas,
            "gameover_sprites.png",
            DESIGN_W,
            DESIGN_H
        );

        gameOverAnim.autoClear = true;
        gameOverAnim.allowAnimation();
        gameOverAnim.start(9);
    };

    state = new GameState();
    input = new InputManager();

    // ... Der Rest deines originalen Codes (DOM, Sprites Zuweisung mit Yellow, etc.)

    tryAutoStart();  // Original
}

// Multi-Game Init
function initMultiGame() {
    // Game 1: Gelb (links)
    const game1 = initGameInstance('1', 'yellow');

    // Game 2: Rot (rechts)
    const game2 = initGameInstance('2', 'red');

    // Start beide
    tryAutoStartInstance(game1);
    tryAutoStartInstance(game2);
}

// Instance-Init-Funktion (pro Game)
function initGameInstance(suffix, colorMode) {
    const frameEl = document.getElementById(`gameFrame${suffix}`);
    const canvas = document.getElementById(`gameCanvas${suffix}`);
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById(`startOverlay${suffix}`);
    const startButton = document.getElementById(`startButton${suffix}`);
    const leftBtn = document.getElementById(`leftBtn${suffix}`);
    const rightBtn = document.getElementById(`rightBtn${suffix}`);
    const scoopBtn = document.getElementById(`scoopBtn${suffix}`);
    const pauseBtn = document.getElementById(`pauseBtn${suffix}`);

    const overflow = new OverflowManager(12);
    overflow.onOverflow = () => {/* GameOver pro Instance */};

    const state = new GameState();
    const input = new InputManager();

    // Sprites zuweisen basierend auf colorMode
    const odoFrames = colorMode === 'red' ? odoFramesRed : odoFramesYellow;
    // ... gleiches für alle Sprites

    // Skalierung anpassen (half-width)
    const instanceDesignW = DESIGN_W / 2;  // Anpassen, falls nötig
    // ... scaleFrame und resizeCanvas anpassen

    return { suffix, colorMode, frameEl, canvas, ctx, overlay, startButton, leftBtn, rightBtn, scoopBtn, pauseBtn, overflow, state, input };
}

// tryAutoStart für Instance
async function tryAutoStartInstance(game) {
    game.overlay.style.display = "flex";
    // ... ähnlich wie tryAutoStart, aber mit game.canvas, game.state etc.
    // Lade Resources, Ida, Loop pro Instance
    // z. B. game.state.ida = new Ida(...);
    // game.loop = new GameLoop({ state: game.state, input: game.input, ... });
    // game.loop.start();
}

// ... Der Rest deines Codes (Functions wie updateAll, drawAll etc.) bleibt gleich – sie werden pro Instance aufgerufen.
