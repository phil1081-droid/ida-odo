/* -----------------------------
 main.js: Handle game loop, controls, falling lumps
 ----------------------------- */
let state;
let input;
let overflow;
let canvas;
let ctx;
let frameEl;
let overlay;
let gameOverAnim = null;
let startAnim = null;
let startButton;  // Ergänzen für tryAutoStartForInstance

/* ---------- Config ---------- */
const DESIGN_W = 390; // always refer to this width, never canvas !!
const DESIGN_H = 844; // always refer to this height, never canvas !!
const CONTROLS_H = 140;
const WORLD_H = DESIGN_H - CONTROLS_H;
const COLOR_MODE = window.GAME_COLOR_MODE || "yellow";

// Globale Defaults für Single-Mode
let instances = [];  // Array für Single/Multi Instances
const ANIM_FPS = 10;           // animation frames per second
const FRAME_FALL_BASE = 2.2;   // base falling speed multiplier (tuned)
const LEVEL_SPEED_FACTOR = 1.1; // per level multiplier

// lumps
let lumpAnimIndex = 0;
let lumpLastAnimTS = performance.now();
const frameDelay = 80; // ~12.5 FPS

function createInstance(suffix = '', colorMode = 'yellow') {
    const instance = {
        suffix: suffix,
        colorMode: colorMode,
        frameEl: document.getElementById(`gameFrame${suffix}`),
        canvas: document.getElementById(`gameCanvas${suffix}`),
        ctx: null,
        overflow: new OverflowManager(12),
        state: new GameState(),
        input: new InputManager(),  // Direkt setzen – KEIN null!
        startAnim: null,
        gameOverAnim: null,
        // Sprites ...
        odoFallFrames: null,
        odoRideFrames: null,
        odoGrabFrames: null,
        idaWalkFrames: null,
        idaIceFrames: null,
        idaPresentFrames: null,
        lumpFrames: null,
        platschFrames: null,
        obstaclesFrames: null,
    };

    if (instance.canvas) {
        instance.ctx = instance.canvas.getContext('2d');
        instance.overflow.setCanvasSize(DESIGN_W, WORLD_H);  // Setzt auf 390x704 – passend zum sichtbaren Bereich
    } else {
        console.error(`Canvas mit ID gameCanvas${suffix} nicht gefunden!`);
        return null;
    }

    // Input binden (jetzt ist input definiert!)
    instance.input._bind();

    // Overflow-Handler
    instance.overflow.onOverflow = () => {
        instance.state.gameOver = true;
        instance.state.gameOverTime = performance.now();

        instance.gameOverAnim = new StartScreenAnimation(
            instance.canvas,
            "gameover_sprites.png",
            DESIGN_W,
            DESIGN_H
        );

        instance.gameOverAnim.autoClear = true;
        instance.gameOverAnim.allowAnimation();
        instance.gameOverAnim.start(9);
    };
    
    instance.startAnim = new StartScreenAnimation(
        instance.canvas,
        "start_sprites.png",
        DESIGN_W,
        DESIGN_H
        // kein posterSrc
    );
    
    return instance;
}

/* ---------- Sprites ---------- */
const SpritePool = {
    ida: {
        yellow: null,
        red: null
    },
    idaIce: {
        yellow: null,
        red: null
    },
    idaPresent: {
        yellow: null,
        red: null
    },
    odo: {
        fall: { yellow: null, red: null },
        ride: { yellow: null, red: null },
        grab: { yellow: null, red: null }
    },
    lump: null,
    platsch: null,
    obstacles: null
};

const CHROMA_PRESETS = {
    ida: {
        minG: 60,
        ratio: 1.2,
        hardCut: 60,
        domFactor: 2.0,
        minSat: 0.05
    },
    odo: {
        minG: 60,
        ratio: 1.25,
        hardCut: 60,
        domFactor: 2.0,
        minSat: 0.05
    },
    lump:   { minG: 80, ratio: 0.6, hardCut: 40, domFactor: 1.0, minSat: 0.02 },
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

function loadMultiFrameImages(src, rows, chromaPreset, callback, cols = 8) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        try {
            const frameW = Math.floor(img.width / cols);
            const frameH = Math.floor(img.height / rows);
            const frames = [];
            const off = document.createElement("canvas");
            off.width = frameW;
            off.height = frameH;
            const offCtx = off.getContext("2d");
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    offCtx.clearRect(0, 0, frameW, frameH);
                    offCtx.drawImage(img, c * frameW, r * frameH, frameW, frameH, 0, 0, frameW, frameH);
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
            console.log(`Loaded ${frames.length} frames from ${src}`);
            callback(frames, frameW, frameH);
        } catch (err) {
            console.error(`Error loading ${src}:`, err);
        }
    };
    img.onerror = () => console.error(`Failed to load sprite: ${src}`);
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

// Background später nachladen
const loader = new LevelLoader("bg_", "music_");
loader.loadResourcesForLevel(1).then(res => {
    // tbd (lädt noch nicht immer zuverlässig. Ggf Hintergrundbild durch die Transparenzflächen zeigen)
});

function scaleFrame() {
    if (!frameEl) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const scale = vh / DESIGN_H;
    const maxScaleByWidth = vw / DESIGN_W;
    const finalScale = Math.min(scale, maxScaleByWidth);

    frameEl.style.transform = `scale(${finalScale})`;
    frameEl.style.transformOrigin = "top left";  // FIX: Von oben links skalieren
    frameEl.style.position = "absolute";  // FIX: Absolut positionieren
    frameEl.style.left = "0";  // FIX: Links oben fixieren
    frameEl.style.top = "0";  // FIX: Keine Verschiebung
}

function resizeCanvas() {
    if (!canvas || !overflow) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = DESIGN_W * dpr;
    canvas.height = (DESIGN_H - CONTROLS_H) * dpr;  // 704 * dpr

    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    overflow.setCanvasSize(DESIGN_W, WORLD_H);  // FIX: WORLD_H=704 statt DESIGN_H=844
}

function scaleFrameMulti(instance) {
    if (!instance.frameEl) return;

    const vw = window.innerWidth / 2;  // Half-width für Multi
    const vh = window.innerHeight;

    const scale = vh / DESIGN_H;
    const maxScaleByWidth = vw / DESIGN_W;
    const finalScale = Math.min(scale, maxScaleByWidth);

    instance.frameEl.style.transform = `scale(${finalScale})`;
    instance.frameEl.style.transformOrigin = "top left";
    instance.frameEl.style.position = "absolute";
    instance.frameEl.style.left = instance.suffix === '1' ? "0" : "50%";  // Links 0%, rechts 50%
    instance.frameEl.style.top = "0";
    instance.frameEl.style.width = "50vw";  // Half viewport
}

// Listener und Initialaufruf
window.addEventListener("resize", () => {
    scaleFrame();
    resizeCanvas();
});

// Sofort aufrufen
scaleFrame();
resizeCanvas();

function cssWidth(instance) {
    if (!instance || !instance.canvas) {
        // console.error("cssWidth(): instance oder canvas fehlt", instance);
        return DESIGN_W; // sinnvoller Fallback
    }
    
    return parseFloat(getComputedStyle(instance.canvas).width);
}

function cssHeight(instance) {
    if (!instance || !instance.canvas) {
        // console.error("cssHeight(): instance oder canvas fehlt", instance);
        return DESIGN_H; // sinnvoller Fallback
    }
    
    return parseFloat(getComputedStyle(instance.canvas).height);
}

/* ---------- Game state ---------- */
let paused = false;
let gameStarted = false;
let bgColor = 'hsl(100 60% 50%)';

// ==== Odo Code-Bausteine ====
const ODO_WIDTH_MULTIPLIER = 2.0;
const ODO_SPAWN_PER_BOLL = 0.05;
let odoFallFrameW = 0, odoFallFrameH = 0;
let odoRideFrameW = 0, odoRideFrameH = 0;
let odoGrabFrameW = 0, odoGrabFrameH = 0;

loadMultiFrameImages(
    "odo-fall_sprites.png",
    13,
    CHROMA_PRESETS.odo,
    (frames, frameW, frameH) => {
        SpritePool.odo.fall.yellow = frames;
        SpritePool.odo.fall.red = frames.map(f => recolorYellowToRed(f));
        odoFallFrameW    = frameW;
        odoFallFrameH    = frameH;
    }
);

loadMultiFrameImages(
    "odo-ride_sprites.png",
    5,                       // 8×5
    CHROMA_PRESETS.ride,
    (frames, frameW, frameH) => {
        SpritePool.odo.ride.yellow = frames;
        SpritePool.odo.ride.red = frames.map(f => recolorYellowToRed(f));
        odoRideFrameW    = frameW;
        odoRideFrameH    = frameH;
    }
);

loadMultiFrameImages(
    "odo-grab_sprites.png",
    29,                      // 8×28
    CHROMA_PRESETS.grab,
    (frames, frameW, frameH) => {
        SpritePool.odo.grab.yellow = frames;
        SpritePool.odo.grab.red = frames.map(f => recolorYellowToRed(f));
        odoGrabFrameW    = frameW;
        odoGrabFrameH    = frameH;
    }
);

// Nach dem Laden von bollen_sprites.png
loadMultiFrameImages("bollen_sprites.png", 11, CHROMA_PRESETS.lump, (frames, frameW, frameH) => {
    SpritePool.lump = frames;
    lumpFrameW = frameW;
    lumpFrameH = frameH;
    lumpTotalFrames = frames.length; // Sollte 88 sein (8 cols x 11 rows)
    console.log("Bollen-Sprites geladen:", frames.length, "Frames");
});

// Korrekt – explizite Anzahl Zeilen (passe an dein Sprite-Sheet an!)
loadMultiFrameImages("platsch_sprites.png", 15, CHROMA_PRESETS.platsch, (frames, frameW, frameH) => {
    SpritePool.platsch = frames;
    console.log("Platsch-Sprites geladen:", frames.length, "Frames");
});

// Obstacles einheitlich laden – wie Platsch (8 Frames in 4 cols × 2 rows)
loadMultiFrameImages("obstacles.png", 2, CHROMA_PRESETS.obstacle, (frames, frameW, frameH) => {
    SpritePool.obstacles = frames;  // 8 Frames (Brigate bis Geschenk)
    obsFrameW = frameW;
    obsFrameH = frameH;
    console.log("Obstacle-Sprites geladen:", frames.length, "Frames");
}, 4);

function assignSpritesToInstance(instance) {
    instance.idaWalkFrames = SpritePool.ida[instance.colorMode];
    instance.idaIceFrames = SpritePool.idaIce[instance.colorMode];
    instance.idaPresentFrames = SpritePool.idaPresent[instance.colorMode];
    console.log(`Instance ${instance.suffix} (${instance.colorMode}):`,
            `idaWalkFrames:`, instance.idaWalkFrames?.length,
            `idaIceFrames:`, instance.idaIceFrames?.length,
            `idaPresentFrames:`, instance.idaPresentFrames?.length);
    
    instance.odoFallFrames = SpritePool.odo.fall[instance.colorMode];
    instance.odoRideFrames = SpritePool.odo.ride[instance.colorMode];
    instance.odoGrabFrames = SpritePool.odo.grab[instance.colorMode];
    instance.lumpFrames = SpritePool.lump;
    instance.platschFrames = SpritePool.platsch;
    instance.obstaclesFrames = SpritePool.obstacles;
}

/* -----------------------------------
   🎨 Background Image + Music Handling
--------------------------------------*/
res = loader.getCurrentResources();
let bgImage = res.bg;
let bgMusic = res.music;
let lastLevelUpTime = 0;
const LEVELUP_DEBOUNCE_MS = 800;

function ensureMusicStarted() {
    if (state.musicPlaying) return;

    ensureAudioContext();
    startMusicForLevel(state.level);
    state.musicPlaying = true;
}

/* === IDA SPRITE === */
const idaImg = new Image();
idaImg.crossOrigin = "anonymous";
idaImg.src = "ida_sprites.png";
let preFrames = []; // offscreen canvases
let totalFrames = 0;
let framesPerRow = 0;
let frameW = 0, frameH = 0;
let animIndex = 0;
let lastAnimTS = 0;

/* ----- Ida Present Animation (8×13) ----- */
let idaPresentImg = new Image();
idaPresentImg.src = "ida-present_sprites.png";

let idaPresentFrames = [];
let idaPresentFrameW = 0;
let idaPresentFrameH = 0;
let idaPresentPlaying = false;
let idaPresentIndex = 0;
let idaPresentLastTS = 0;
const IDA_PRESENT_FPS = 18; // oder was dir gefällt

function extractSpriteFrames(img, cols, rows, chromaPreset) {
    const frameW = Math.floor(img.width / cols);
    const frameH = Math.floor(img.height / rows);

    const tmp = document.createElement("canvas");
    tmp.width = frameW;
    tmp.height = frameH;
    const tctx = tmp.getContext("2d");

    const frames = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {

            // Frame in temp zeichnen
            tctx.clearRect(0, 0, frameW, frameH);
            tctx.drawImage(
                img,
                c * frameW, r * frameH, frameW, frameH,
                0, 0, frameW, frameH
            );

            // ChromaKey
            let id = tctx.getImageData(0, 0, frameW, frameH);
            id = chromaKeyImageData(id, chromaPreset);
            tctx.putImageData(id, 0, 0);

            // echtes Frame erzeugen
            const cv = document.createElement("canvas");
            cv.width = frameW;
            cv.height = frameH;
            cv.getContext("2d").drawImage(tmp, 0, 0);

            frames.push(cv);
        }
    }

    return { frames, frameW, frameH };
}

function preloadIdaWalk(instance) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } =
                extractSpriteFrames(img, 8, 14, CHROMA_PRESETS.ida);

            instance.idaWalkFrames = (instance.colorMode === "red")
                ? frames.map(f => recolorYellowToRed(f))
                : frames;
            
            idaWalkFrameW = frameW;
            idaWalkFrameH = frameH;

            console.log("Ida walk Frames:", frames.length);
            resolve();
        };

        img.src = "ida_sprites.png";
    });
}

function preloadIdaIce(instance) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } =
                extractSpriteFrames(img, 8, 2, CHROMA_PRESETS.ida);

            instance.idaIceFrames = (instance.colorMode === "red")
                ? frames.map(f => recolorYellowToRed(f))
                : frames;
            
            idaIceFrameW = frameW;
            idaIceFrameH = frameH;

            console.log("Ida Ice Frames:", frames.length);
            resolve();
        };

        img.src = "ida-ice_sprites.png";
    });
}

function preloadIdaPresent(instance) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } =
                extractSpriteFrames(img, 8, 13, CHROMA_PRESETS.ida);

            instance.idaPresentFrames = (instance.colorMode === "red")
                ? frames.map(f => recolorYellowToRed(f))
                : frames;
            
            idaPresentFrameW = frameW;
            idaPresentFrameH = frameH;

            console.log("Ida Present Frames:", frames.length);
            resolve();
        };

        img.src = "ida-present_sprites.png";
    });
}

let idaWalkFrames = [];   // Array der 16 Frames
let idaWalkFrameW = 0;
let idaWalkFrameH = 0;
let idaFrozen = false;
let idaFrozenUntil = 0;
let idaIceFrames = [];   // Array der 16 Frames
let idaIceFrameIndex = 0;
let idaIceFrameW = 0;
let idaIceFrameH = 0;
let idaIceAnimSpeed = 70; // ms pro Frame
let idaIceLastFrameTS = 0;

idaImg.onload = () => {
    // loadIdaFrames();
    resizeCanvas();
    // tryAutoStart();
};

idaImg.onerror = () => {
    console.warn("ida sprite not found: " + SPRITE_SRC + " — using placeholder Ida.");
    resizeCanvas();
};

// === BOLLEN SPRITE ===
let lumpImg = new Image();
lumpImg.crossOrigin = "anonymous";
lumpImg.src = "bollen_sprites.png";  // dein Sprite mit Erde
let lumpFrames = [];
let lumpTotalFrames = 8; // oder wie viele Frames dein Lump-Sheet hat
let lumpFrameW = 464;     // Breite eines Einzel-Frames
let lumpFrameH = 688;     // Höhe eines Einzel-Frames

lumpImg.onload = () => {
    const cols = 8;
    const rows = 11;
    
    lumpFrameW = Math.floor(lumpImg.width / cols);
    lumpFrameH = Math.floor(lumpImg.height / rows);
    lumpTotalFrames = cols * rows;
    
    lumpFrames = [];
    
    const off = document.createElement("canvas");
    off.width = lumpFrameW;
    off.height = lumpFrameH;
    const offCtx = off.getContext("2d");
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            
            offCtx.clearRect(0, 0, lumpFrameW, lumpFrameH);
            
            offCtx.drawImage(
                             lumpImg,
                             c * lumpFrameW, r * lumpFrameH, lumpFrameW, lumpFrameH,
                             0, 0, lumpFrameW, lumpFrameH
                             );
            
            // === Greenscreen (tolerant) ===
            let imgData = offCtx.getImageData(0, 0, lumpFrameW, lumpFrameH);
            imgData = chromaKeyImageData(imgData, CHROMA_PRESETS.lump);
            offCtx.putImageData(imgData, 0, 0);
            
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = lumpFrameW;
            frameCanvas.height = lumpFrameH;
            frameCanvas.getContext("2d").drawImage(off, 0, 0);
            
            lumpFrames.push(frameCanvas);
        }
    }
};

// === BOLLEN PLATSCH ===
let platschImg = new Image();
platschImg.src = "platsch_sprites.png";

let platschFrames = [];
let platschFrameW = 390;  // Breite der Platsch-Frames
let platschFrameH = 844;  // Höhe der Platsch-Frames
let platschTotal = 0;

platschImg.onload = () => {
    const cols = 8;
    const rows = 15;
    
    platschFrameW = Math.floor(platschImg.width / cols);
    platschFrameH = Math.floor(platschImg.height / rows);
    platschTotal = cols * rows;
    
    const off = document.createElement("canvas");
    const offctx = off.getContext("2d");
    off.width = platschFrameW;
    off.height = platschFrameH;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            offctx.clearRect(0, 0, platschFrameW, platschFrameH);
            offctx.drawImage(platschImg,
                             c * platschFrameW, r * platschFrameH,
                             platschFrameW, platschFrameH,
                             0, 0,
                             platschFrameW, platschFrameH
                             );
            
            // greenscreen entfernen
            let imgData = offctx.getImageData(0, 0, platschFrameW, platschFrameH);
            imgData = chromaKeyImageData(imgData, CHROMA_PRESETS.platsch);
            offctx.putImageData(imgData, 0, 0);
            
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = platschFrameW;
            frameCanvas.height = platschFrameH;
            frameCanvas.getContext("2d").drawImage(off, 0, 0);
            
            platschFrames.push(frameCanvas);
        }
    }
};

/* ---------- Obstacles (new) ---------- */
/*
let obstaclesImg = new Image();
obstaclesImg.src = "obstacles.png";

let obstaclesFrames = [];       // 8 Frames
let obsFrameW = 0;
let obsFrameH = 0;
*/

// Spawn-Wahrscheinlichkeiten (%)
const OBSTACLE_CHANCES = [
    { type: 0, chance: 16 }, // brigate
    { type: 1, chance: 14 }, // pylon
    { type: 2, chance: 12 }, // ice
    { type: 3, chance: 10 }, // bomb
    { type: 4, chance:  8 }, // box
    { type: 5, chance:  6 }, // nail
    { type: 6, chance:  4 }, // skull
    { type: 7, chance:  150 }  // Geschenk
];

/*
obstaclesImg.onload = () => {
    const cols = 4;
    const rows = 2;

    obsFrameW = Math.floor(obstaclesImg.width / cols);
    obsFrameH = Math.floor(obstaclesImg.height / rows);

    const off = document.createElement("canvas");
    off.width = obsFrameW;
    off.height = obsFrameH;
    const offCtx = off.getContext("2d");

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            offCtx.clearRect(0, 0, obsFrameW, obsFrameH);
            offCtx.drawImage(
                obstaclesImg,
                c * obsFrameW, r * obsFrameH,
                obsFrameW, obsFrameH,
                0, 0, obsFrameW, obsFrameH
            );

            const cv = document.createElement("canvas");
            cv.width = obsFrameW;
            cv.height = obsFrameH;
            const cctx = cv.getContext("2d");
            cctx.drawImage(off, 0, 0);

            // Chromakey wie bei Odo-Grab:
            let imgData = cctx.getImageData(0, 0, obsFrameW, obsFrameH);
            imgData = chromaKeyImageData(imgData, CHROMA_PRESETS.obstacle);
            cctx.putImageData(imgData, 0, 0);

            obstaclesFrames.push(cv);
        }
    }
};
*/

/**
 A common green screen should be applied to all the sprites
 */
function chromaKeyImageData(imgData, cfg) {
    const d = imgData.data;

    const {
        minG      = 60,
        ratio     = 1.2,
        hardCut   = 60,
        domFactor = 2.0,
        minSat    = 0.05
    } = cfg;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max; // grobe Sättigung

        const dominance = g - Math.max(r, b);
        const ratioOK = g > r * ratio && g > b * ratio;

        if (g >= minG && sat >= minSat && (ratioOK || dominance > 8)) {
            if (dominance > hardCut) {
                d[i + 3] = 0; // komplett transparent
            } else {
                const alpha = Math.max(
                    0,
                    Math.min(255, 255 - Math.round(dominance * domFactor))
                );
                d[i + 3] = alpha;
            }
        }
    }

    return imgData;
}

function drawGameOverScreen(ctx, state, now) {
    // Hintergrund bleibt stehen
    drawGround(ctx);
    if (gameOverAnim) {
        gameOverAnim.draw(ctx, now);
    }

    if (gameOverAnim?.finished) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", DESIGN_W / 2, DESIGN_H / 2 + 120);

        ctx.font = "18px sans-serif";
        ctx.fillText("Tippen / Taste für Neustart", DESIGN_W / 2, DESIGN_H / 2 + 160);
    }
}

function startIdaPresentAnimation(state) {
    if (state.ida) state.ida.triggerPresent(45);
}

function triggerIdaFrozen(state) {
    if (!state.ida) return;
    // show little speech bubble for ~2s
    if (typeof state.ida.showSpeech === "function") {
        state.ida.showSpeech("brrr.", 2000);
    }
    // then actually freeze
    state.ida.triggerFrozen(60);
}

function loadIdaFrames(color) {
    const cols = 8;
    const rows = 14;
    
    frameW = Math.floor(idaImg.width / cols);
    frameH = Math.floor(idaImg.height / rows);
    totalFrames = cols * rows;
    preFrames = [];
    
    const off = document.createElement("canvas");
    off.width = frameW;
    off.height = frameH;
    const offCtx = off.getContext("2d");
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            
            // Frame zeichnen
            offCtx.clearRect(0, 0, frameW, frameH);
            offCtx.drawImage(
                             idaImg,
                             c * frameW, r * frameH, frameW, frameH,
                             0, 0, frameW, frameH
                             );
            
            // === Chromakey ===
            let imgData = offCtx.getImageData(0, 0, frameW, frameH);
            imgData = chromaKeyImageData(imgData, CHROMA_PRESETS.ida);
            offCtx.putImageData(imgData, 0, 0);
            
            // in Frame-Liste speichern
            const cv = document.createElement("canvas");
            cv.width = frameW;
            cv.height = frameH;
            cv.getContext("2d").drawImage(off, 0, 0);
            
            let finalFrame = cv;
            if (color === "red") {
                finalFrame = recolorYellowToRed(cv);
            }
            
            preFrames.push(finalFrame);
        }
    }
    
    console.log("Ida Frames inkl. ChromaKey geladen:", totalFrames);
}

/* ---------- Lump spawn ---------- */
function spawnLump(instance) {
    const cssW = cssWidth(instance);
    const cssH = cssHeight(instance);

    // 3% Chance pro Aufruf, einen neuen Lump zu spawnen
    if (Math.random() >= 0.03) return;

    const size = Math.random() * 20 + 20; // Größe zwischen 20 und 40
    const x = Math.random() * (cssW - size);
    const y = -size;

    // Sicherstellen, dass wir Frames haben – sonst Fallback-Animation (einfacher Kreis)
    const hasFrames = instance.lumpFrames && Array.isArray(instance.lumpFrames) && instance.lumpFrames.length > 0;
    const frameCount = hasFrames ? instance.lumpFrames.length : 1;

    const newLump = new Lump({
        x: x,
        y: y,
        w: size,
        h: size,
        speed: 2 + Math.random(),

        // === Animation ===
        frames: hasFrames ? instance.lumpFrames : null, // null = kein Sprite, draw() malt Fallback
        frame: Math.floor(Math.random() * frameCount),
        animSpeed: 0.3 + Math.random() * 0.2,
        animOffset: Math.floor(Math.random() * frameCount),

        // Fallback-Farbe für den Fall, dass keine Frames da sind
        color: '#8B4513',
    });

    newLump.id = instance.state.nextLumpId++;
    instance.state.lumps.push(newLump);

    // === Odo-Spawn-Chance (unverändert) ===
    if (
        instance.state.ida &&
        !instance.state.odo &&
        performance.now() > 5000 &&
        Math.random() < ODO_SPAWN_PER_BOLL
    ) {
        instance.state.odo = new Odo({
            x: Math.random() * (cssW - odoFallFrameW * 0.25),
            y: -odoFallFrameH,
            w: odoFallFrameW * 0.25,
            h: odoFallFrameH * 0.25,
            frames: instance.odoFallFrames,
            rideFrames: instance.odoRideFrames,
            grabFrames: instance.odoGrabFrames,
            speed: 3 + Math.random() * 0.5
        });
    }
}

function spawnFallingThing(instance, level) {
    // Fallback: Wenn level noch 0 oder undefined → mindestens Level 1 annehmen (für Multiplayer)
    const effectiveLevel = level >= 1 ? level : 1;
    const chances = getObstacleChancesForLevel(effectiveLevel);
    
    // Immer eine kleine Basis-Chance für frühe Obstacles, auch wenn chances leer
    if (!chances.length || Math.random() > 0.92) {  // 3% Chance auf Obstacle auch bei leeren chances
        const earlyTypes = OBSTACLE_TYPES.filter(t => t.levelAppearance <= 2); // Brigate + Pylon
        if (earlyTypes.length > 0 && Math.random() < 0.04) {  // kleine fixe Chance
            const def = earlyTypes[Math.floor(Math.random() * earlyTypes.length)];
            spawnObstacle(instance, def.nr);
            return;
        }
    }

    const totalChance = chances.reduce((s, o) => s + o.chance, 0);
    if (totalChance <= 0 || Math.random() * 100 >= totalChance) {
        spawnLump(instance);
        return;
    }

    let r = Math.random() * totalChance;
    for (const o of chances) {
        r -= o.chance;
        if (r <= 0) {
            spawnObstacle(instance, o.type);
            return;
        }
    }
    spawnLump(instance);
}

function spawnObstacle(instance, type) {
    if (type === undefined || !instance.obstaclesFrames || !instance.obstaclesFrames[type]) {
        console.warn("spawnObstacle: invalid type oder Frames fehlen", type, "für Instanz", instance.suffix);
        return;
    }

    const frame = instance.obstaclesFrames[type];
    const cssW = cssWidth(instance);
    const w = frame.width * 0.25;   // Größe aus dem echten Frame nehmen (sicherer!)
    const h = frame.height * 0.25;

    instance.state.obstacles.push(
        new Obstacle({
            type,
            x: Math.random() * (cssW - w),
            y: -h,
            w,
            h,
            speed: 3 + Math.random() * 2.8,
            frames: [frame]  // Direkt den Canvas-Frame aus SpritePool
        })
    );
}

function getObstacleChancesForLevel(level) {
    return OBSTACLE_TYPES
        .filter(o => level >= o.levelAppearance)
        .map(o => ({
            type: o.nr,
            chance: o.initialChance + (level - o.levelAppearance) * o.chanceIncrease
        }));
}

function updateObstacles(instance, dt) {
    const cssH = cssHeight(instance);
    instance.state.obstacles = instance.state.obstacles.filter(o => {
        let state = instance.state;
        let overflow = instance.overflow;
        const alive = o.update(cssH, {
            state,
            triggerIdaFrozen,
            startIdaPresentAnimation,
            playObstacleSound,
            playBulldozerSweep,
            overflow
        });

        return alive && !o.dead;
    });
}

function activateBoost(instance) {
    const state = instance.state;
    if (state.ida.state === "frozen") return;

    state.boost.active = true;
    state.boost.until = Date.now() + 1000;
}

function activateMagnet(instance) {
    const state = instance.state;
    if (state.ida.state === "frozen") return;

    state.magnet.active = true;
    state.magnet.until = Date.now() + 3000;
}

function updateLumps(instance, dt) {
    const cssH = cssHeight(instance);
    const survivors = [];
    const toTransfer = [];

    for (let lump of instance.state.lumps) {
        if (lump.update(cssH, dt, instance)) {
            survivors.push(lump);
        } else if (lump.dead && lump.state === "hit" && lump.targetInstanceId) {
            toTransfer.push(lump);
        }
    }

    toTransfer.forEach(lump => {
        const targetInstance = gameInstances.find(inst => inst.suffix === lump.targetInstanceId);
        if (targetInstance) {
            lump.state = "fall";
            lump.dead = false;
            lump.seen = false;
            lump.decisionMade = false;
            lump.y = -lump.h;
            lump.x = Math.random() * (cssWidth(targetInstance) - lump.w);
            targetInstance.state.lumps.push(lump);
        }
    });

    instance.state.lumps = survivors;
}

function updateGlobalLumpAnimation() {
    const now = performance.now();
    if (lumpTotalFrames > 1 && now - lumpLastAnimTS > frameDelay) {
        lumpAnimIndex = (lumpAnimIndex + 1) % lumpTotalFrames;
        lumpLastAnimTS = now;
    }
}

function updateAll(instance, dt) {
    if (paused) return;
    if (!instance || !instance.input) {
                console.warn("Instance oder input nicht bereit – update überspringen");
                return;
            }
    
    const state = instance.state;
    if (!state.ida || state.gameOver) return;

    const inputState = instance.input.poll(instance.colorMode === "red" ? 1 : 0);
    if (inputState.boost) activateBoost(instance);  // später instanzbasiert
    if (inputState.magnet) activateMagnet(instance);
    updateBoostAndMagnet(state);

    // Input → GameState
    if (inputState.left && !inputState.right) {
        state.dir = -1;
    } else if (inputState.right && !inputState.left) {
        state.dir = 1;
    } else {
        state.dir = 0;
    }

    spawnFallingThing(instance, state.level);
    if (state.ida) {
            state.ida.update();
            state.ida.y = Math.min(state.ida.y, cssHeight(instance) - state.ida.h);
            if (state.odo) {
                let lumpsParam = state.lumps;
                let score = state.score;
                const alive = state.odo.update(cssHeight(instance), {
                    state: state,
                    lumpsParam,
                    playOdoCollect,
                    playCollect
                });

                // Wenn Odo fertig ist → löschen
                if (!alive || state.odo.dead) {
                    state.odo = null;
                }
            }
        }

    updateLumps(instance, dt);
    updateObstacles(instance, dt);
    state.ida.handleIdaCollecting(state);
    checkLevelUp(instance);

    if (!state.gameOver && instance.overflow.overflowReached()) {
        triggerGameOver(instance);  // später instanzbasiert
    }
}

function drawObstacles(instance) {
    for (let o of instance.state.obstacles) {
        o.draw(instance.ctx);
    }
}

function drawGround(ctx) {
    const cssW = DESIGN_W;
    const cssH = WORLD_H;
    const res = loader.getCurrentResources();
    const bg = res.bg;

    if (!bg) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cssW, cssH);
        return;
    }

    if (bg.complete && bg.naturalWidth > 0) {
        const imgAspect = bg.width / bg.height;
        const canvasAspect = cssW / cssH;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > canvasAspect) {
            drawH = cssH;
            drawW = imgAspect * cssH;
            drawX = -(drawW - cssW) / 2;
            drawY = 0;
        } else {
            drawH = cssW / imgAspect;
            drawW = cssW;
            drawX = 0;
            drawY = -(drawH - cssH) / 2;
        }

        ctx.drawImage(
            bg,
            drawX,
            drawY,
            drawW,
            drawH
        );
    }
}

function drawScore(instance) {
    instance.ctx.fillStyle = '#000';
    instance.ctx.font = "bold 18px sans-serif";
    instance.ctx.fillText("🪨 Erde gesammelt: " + instance.state.score, 12, 24);
}

const logic = {
    update(instance, dt) {
        if (!instance || !instance.input) return;

        const state = instance.state;
        const inputState = instance.input.poll(instance.colorMode === "red" ? 1 : 0);

        // 1️⃣ META-INPUT IMMER
        if (inputState.pause) {
            togglePause(instance);
        }

        // 2️⃣ WENN PAUSIERT → HIER ABBRECHEN
        if (paused) return;

        // 3️⃣ WENN SPIEL VORBEI → ABBRECHEN
        if (state.gameOver) return;

        // 4️⃣ HIT-AKTION
        if (inputState.hit) {
            // Bestimme Zielinstanz (andere Instanz)
            const targetInstanceId = instance.suffix === "1" ? "2" : "1";
            handleIdaHit(instance, targetInstanceId);
        }

        // 5️⃣ INTENTS
        if (inputState.boost) {
            state.boost.active = true;
            state.boost.until = Date.now() + 1000;
        }
        if (inputState.magnet) {
            state.magnet.active = true;
            state.magnet.until = Date.now() + 3000;
        }

        // 6️⃣ TIMER-ABLAUF
        const now = Date.now();
        if (state.boost.active && now > state.boost.until) {
            state.boost.active = false;
        }
        if (state.magnet.active && now > state.magnet.until) {
            state.magnet.active = false;
        }

        // 7️⃣ RESTLICHES GAMEPLAY
        updateAll(instance, dt);
    }
};

async function checkLevelUp(instance) {
    const now = performance.now();
    if (now - lastLevelUpTime < LEVELUP_DEBOUNCE_MS) return;

    if (instance.state.score >= instance.state.nextLevelScore) {
        lastLevelUpTime = now;
        instance.state.level++;
        instance.state.nextLevelScore += 100;

        instance.state.fallSpeedMultiplier *= LEVEL_SPEED_FACTOR;
        bpmFactor *= 1.06;

        loader.setLevel(instance.state.level);
        const res = await loader.loadResourcesForLevel(instance.state.level);
        instance.state.backgroundImage = res.bg;
        startMusicForLevel(instance.state.level);
    }
}

function triggerGameOver(instance) {
    instance.state.gameOver = true;

    stopAllSounds?.();     // optional, je nach sound.js
    startGameOverAnimation();
    bindGameOverRestart();
}

function startGameOverAnimation() {
    gameOverAnim = new StartScreenAnimation(
        canvas,
        "gameover_sprites.png",
        DESIGN_W,
        DESIGN_H,
        null   // kein Poster
    );

    gameOverAnim.start({
        playOnce: true,
        onFinished: () => {
            gameOverAnim.finished = true;
        }
    });
}

function bindGameOverRestart() {
    const restart = () => {
        window.location.reload();
    };

    window.addEventListener("keydown", restart, { once: true });
    canvas.addEventListener("pointerdown", restart, { once: true });
}

// Globale Instanz(en) – wird nach Sprite-Laden initialisiert
let gameInstances = [];

// Warte auf Sprite-Laden (falls du loadAllSprites hast, sonst direkt aufrufen)
window.addEventListener('load', () => {
    initGameInstances();
});

function initGameInstances() {
    if (document.querySelector('#multiGameContainer')) {
        // Multiplay-Modus: Zwei Instanzen
            const instance1 = createInstance('1', 'yellow');
            const instance2 = createInstance('2', 'red');
            assignSpritesToInstance(instance1);
            assignSpritesToInstance(instance2);
        
            if (instance1 && instance2) {
                gameInstances = [instance1, instance2];
                console.log("Multiplay: Gelb (1) + Rot (2) gestartet");

                // Separate Skalierung für Multi (half-width)
                scaleFrameMulti(instance1);
                scaleFrameMulti(instance2);

                tryAutoStartForInstance(instance1);
                tryAutoStartForInstance(instance2);
            }
    } else {
        // Single-Modus: Instanz erstellen und alten Code nutzen
        const instance = createInstance('', 'yellow');
        assignSpritesToInstance(instance);
        if (instance) {
            gameInstances = [instance];
            console.log("Single-Modus: 1 Instanz erstellt (gelb)");

            // Globale Variablen mit Instanz-Werten füllen – FIX für scaleFrame, resizeCanvas
            canvas = instance.canvas;
            ctx = instance.ctx;
            frameEl = instance.frameEl;  // FIX für scaleFrame()
            overflow = instance.overflow;  // FIX für resizeCanvas()
            state = instance.state;
            input = instance.input;
            startAnim = instance.startAnim;
            gameOverAnim = instance.gameOverAnim;

            // Overlay und StartButton
            overlay = document.getElementById('startOverlay');
            startButton = document.getElementById('startButton');

            // Initiale Skalierung – das behebt den Fehler!
            scaleFrame();
            resizeCanvas();

            tryAutoStartForInstance(instance);
        } else {
            console.error("Instanz konnte nicht erstellt werden!");
        }
    }
}

async function tryAutoStartForInstance(instance) {
    const overlay = document.getElementById(`startOverlay${instance.suffix}`);
    const startButton = document.getElementById(`startButton${instance.suffix}`);
    if (!overlay) return;

    overlay.style.display = "flex";

    // Warte, bis alle globalen Sprites geladen sind, dann erst Animation starten
    await waitForSprites();
    assignSpritesToInstance(instance);

    instance.startAnim.start(14);       // Poster → dann Bounce-Loop
    instance.startAnim.allowAnimation(); // sofort zur Anim, kein Warten auf User

    // ← CSS-Poster sofort ausblenden wenn Animation startet
    const host = instance.canvas.closest(".gameHost, #gameFrame");
    if (host) host.style.backgroundImage = "none";
    
    let started = false;
    const startNow = async () => {
        if (started) return;
        started = true;

        // ── Audio ZUERST, in derselben User-Gesture ──
        ensureAudioContext();
        audioAllowed = true;
        startMusicForLevel(1);           // startet hier, AudioContext ist unlocked

        instance.state.level = 1;
        instance.state.score = 0;
        instance.state.nextLevelScore = 100;

        await loader.loadResourcesForLevel(1);
        await preloadIdaWalk(instance);
        await preloadIdaIce(instance);
        await preloadIdaPresent(instance);

        instance.state.ida = new Ida({
            x: Math.max(0, (cssWidth(instance) - (idaWalkFrameW || 100)) / 2),
            y: cssHeight(instance) - 40,
            w: idaWalkFrameW || 100,
            h: idaWalkFrameH || 100,
            walkFrames: instance.idaWalkFrames || [],
            frozenFrames: instance.idaIceFrames || [],
            presentFrames: instance.idaPresentFrames || [],
            speed: 4
        });
        instance.state.ida.posLimitLeft = 0;
        instance.state.ida.posLimitRight = cssWidth(instance) - instance.state.ida.w;

        instance.startAnim.stop();
        overlay.style.display = "none";
        
        // ← CSS-Poster wegräumen, Spiel übernimmt ab jetzt
        const host = instance.canvas.closest(".gameHost, #gameFrame");
        if (host) host.style.backgroundImage = "none";
        
        instance.state.gameStarted = true;

        if (!instance.loop) {
            instance.loop = new GameLoop({
                instance,
                logic,
                renderer: { draw() { drawAllForInstance(instance); } }
            });
            instance.loop.start();
        }
    };

    startButton.addEventListener("click", startNow, { once: true });
    overlay.addEventListener("pointerdown", startNow, { once: true });
    window.addEventListener("keydown", (e) => {
        if (!started && overlay.style.display !== "none") startNow();
    }, { once: true });
}

// ── 4. Hilfsfunktion: warten bis Sprites bereit ──────────────────────────────
function waitForSprites() {
    return new Promise(resolve => {
        const check = () => {
            if (
                SpritePool.lump &&
                SpritePool.platsch &&
                SpritePool.obstacles &&
                SpritePool.odo.fall.yellow &&
                SpritePool.odo.ride.yellow &&
                SpritePool.odo.grab.yellow
            ) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

function drawAllForInstance(instance) {
    if (instance.state.gameOver) return;

    // Temporärer Hack: Globalen ctx auf instance.ctx setzen
    const globalCtxBackup = ctx;
    ctx = instance.ctx;

    drawGround(ctx);
    instance.overflow.drawPuddles(ctx);
    updateGlobalLumpAnimation();
    
    ctx.save();
    ctx.translate(0, -(instance.overflow.getOffsetY?.() || 0));

    // Lumps zeichnen – jetzt per Klasse!
    for (let lump of instance.state.lumps) {
        lump.draw(ctx, instance);
    }
    
    drawObstacles(instance);
    if (instance.state.odo) instance.state.odo.draw(ctx);
    if (instance.state.ida) instance.state.ida.draw(ctx, instance.state.magnet.active, instance.state.boost.active);

    ctx.restore();
    drawScore(instance);

    // Globalen ctx wiederherstellen
    ctx = globalCtxBackup;
}

function handleIdaHit(instance, targetInstanceId) {
    if (!instance.state.ida) return;
    const survivors = [];
    let hitTriggered = false;

    for (let e of instance.state.lumps) {
        if (e.state === "hit" || e.decisionMade) {
            survivors.push(e);
            continue;
        }

        // Kollisionsprüfung: Ist der Lump über Ida?
        const collides =
            (e.x + e.w > instance.state.ida.x + instance.state.ida.w * 0.15 &&
             e.x < instance.state.ida.x + instance.state.ida.w * 0.7 &&
             e.y + e.h > instance.state.ida.y + 10 &&
             e.y < instance.state.ida.y + instance.state.ida.h * 0.8);

        if (collides && !hitTriggered) {
            // Lump wird nach oben geschleudert
            e.mode = "hit";
            e.targetInstanceId = targetInstanceId;
            if (typeof playHitSound === "function") {
                playHitSound();
            }
            hitTriggered = true; // Nur ein Lump pro Hit
            survivors.push(e);
        } else {
            survivors.push(e);
        }
    }

    instance.state.lumps = survivors;
}
