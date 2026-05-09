// =======================================================
// loader.js
// – LevelLoader      (BG-Bilder + Musik)
// – SpritePool       (alle Sprite-Frames gecacht)
// – CHROMA_PRESETS
// – chromaKeyImageData, extractSpriteFrames,
//   loadMultiFrameImages, loadPosterWithChroma,
//   recolorYellowToRed
// – preloadIdaWalk / preloadIdaIce / preloadIdaPresent
// – assignSpritesToInstance, waitForSprites
// – initSpriteLoading  (startet alle loadMultiFrameImages)
// =======================================================

// =======================================================
// LevelLoader – BG + Musik
// =======================================================
class LevelLoader {
    constructor(
        prefixBg = "bg_",
        prefixMusic = "music_",
        extBg = ".jpg",
        extMusic = ".mp3"
    ) {
        this.prefixBg = prefixBg;
        this.prefixMusic = prefixMusic;
        this.extBg = extBg;
        this.extMusic = extMusic;

        this.bgCache = new Map();
        this.musicCache = new Map();
        this.currentLevel = 1;

        this.fallbackBg = null;
        this.fallbackMusic = null;

        this._initFallbacks();
    }

    _indexToName(idx) {
        return String(idx).padStart(3, "0");
    }

    _loadImage(path) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = path;
        });
    }

    _loadAudio(path) {
        return new Promise(resolve => {
            const audio = new Audio();
            audio.preload = "auto";
            let done = false;
            const finish = ok => { if (!done) { done = true; resolve(ok ? audio : null); } };
            audio.oncanplaythrough = () => finish(true);
            audio.onerror = () => finish(false);
            setTimeout(() => finish(true), 1000);
            audio.src = path;
        });
    }

    async _initFallbacks() {
        this.fallbackBg    = await this._loadImage(`${this.prefixBg}001${this.extBg}`);
        this.fallbackMusic = await this._loadAudio(`${this.prefixMusic}001${this.extMusic}`);
        if (this.fallbackBg)    this.bgCache.set(1, this.fallbackBg);
        if (this.fallbackMusic) this.musicCache.set(1, this.fallbackMusic);
    }

    async loadBgForLevel(level) {
        if (this.bgCache.has(level)) return this.bgCache.get(level);
        for (let i = 0; i < 5; i++) {
            const tryLevel = Math.max(1, level - i);
            const img = await this._loadImage(`${this.prefixBg}${this._indexToName(tryLevel)}${this.extBg}`);
            if (img) { this.bgCache.set(level, img); return img; }
        }
        if (this.bgCache.has(1)) return this.bgCache.get(1);
        for (const img of this.bgCache.values()) if (img) return img;
        return this.fallbackBg;
    }

    async loadMusicForLevel(level) {
        if (this.musicCache.has(level)) return this.musicCache.get(level);
        for (let i = 0; i < 5; i++) {
            const tryLevel = Math.max(1, level - i);
            const audio = await this._loadAudio(`${this.prefixMusic}${this._indexToName(tryLevel)}${this.extMusic}`);
            if (audio) { this.musicCache.set(level, audio); return audio; }
        }
        if (this.musicCache.has(1)) return this.musicCache.get(1);
        for (const a of this.musicCache.values()) if (a) return a;
        return this.fallbackMusic;
    }

    async loadResourcesForLevel(level) {
        const [bg, music] = await Promise.all([
            this.loadBgForLevel(level),
            this.loadMusicForLevel(level)
        ]);
        return { bg, music };
    }

    getCurrentResources() {
        const lvl = this.currentLevel || 1;
        return {
            bg:    this.bgCache.get(lvl)    || this.fallbackBg,
            music: this.musicCache.get(lvl) || this.fallbackMusic
        };
    }

    getCurrent() { return this.getCurrentResources(); }
    setLevel(level) { this.currentLevel = level; }
}

window.LevelLoader = LevelLoader;
window.loader = new LevelLoader("bg_", "music_");

// =======================================================
// ChromaKey-Presets
// =======================================================
const CHROMA_PRESETS = {
    ida:      { minG: 60, ratio: 1.2,  hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    odo:      { minG: 60, ratio: 1.25, hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    lump:     { minG: 80, ratio: 0.6,  hardCut: 40, domFactor: 1.0, minSat: 0.02 },
    ride:     { minG: 60, ratio: 1.25, hardCut: 60, domFactor: 2.0, minSat: 0.05 },
    grab:     { minG: 60, ratio: 1.15, hardCut: 40, domFactor: 1.5, minSat: 0.02 },
    platsch:  { minG: 80, ratio: 1.2,  hardCut: 80, domFactor: 3.0, minSat: 0.05 },
    obstacle: { minG: 60, ratio: 1.15, hardCut: 60, domFactor: 2.0, minSat: 0.05 }
};
window.CHROMA_PRESETS = CHROMA_PRESETS;

// =======================================================
// SpritePool – zentrale Ablage aller geladenen Frames
// =======================================================
const SpritePool = {
    ida:        { yellow: null, red: null },
    idaIce:     { yellow: null, red: null },
    idaPresent: { yellow: null, red: null },
    odo: {
        fall: { yellow: null, red: null },
        ride: { yellow: null, red: null },
        grab: { yellow: null, red: null }
    },
    lump:      null,
    platsch:   null,
    obstacles: null
};
window.SpritePool = SpritePool;

// =======================================================
// ChromaKey-Algorithmus
// =======================================================
function chromaKeyImageData(imgData, cfg) {
    const d = imgData.data;
    const { minG = 60, ratio = 1.2, hardCut = 60, domFactor = 2.0, minSat = 0.05 } = cfg;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const dominance = g - Math.max(r, b);
        const ratioOK = g > r * ratio && g > b * ratio;

        if (g >= minG && sat >= minSat && (ratioOK || dominance > 8)) {
            if (dominance > hardCut) {
                d[i + 3] = 0;
            } else {
                d[i + 3] = Math.max(0, Math.min(255, 255 - Math.round(dominance * domFactor)));
            }
        }
    }
    return imgData;
}
window.chromaKeyImageData = chromaKeyImageData;

// =======================================================
// Sprite-Hilfsfunktionen
// =======================================================
function recolorYellowToRed(sourceCanvas) {
    const c = document.createElement("canvas");
    c.width = sourceCanvas.width;
    c.height = sourceCanvas.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && d[i] > 180 && d[i + 1] > 180 && d[i + 2] < 120) {
            d[i] = 220; d[i + 1] = 40; d[i + 2] = 40;
        }
    }
    ctx.putImageData(img, 0, 0);
    return c;
}
window.recolorYellowToRed = recolorYellowToRed;

function extractSpriteFrames(img, cols, rows, chromaPreset) {
    const frameW = Math.floor(img.width / cols);
    const frameH = Math.floor(img.height / rows);
    const tmp = document.createElement("canvas");
    tmp.width = frameW; tmp.height = frameH;
    const tctx = tmp.getContext("2d");
    const frames = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            tctx.clearRect(0, 0, frameW, frameH);
            tctx.drawImage(img, c * frameW, r * frameH, frameW, frameH, 0, 0, frameW, frameH);
            let id = tctx.getImageData(0, 0, frameW, frameH);
            id = chromaKeyImageData(id, chromaPreset);
            tctx.putImageData(id, 0, 0);
            const cv = document.createElement("canvas");
            cv.width = frameW; cv.height = frameH;
            cv.getContext("2d").drawImage(tmp, 0, 0);
            frames.push(cv);
        }
    }
    return { frames, frameW, frameH };
}
window.extractSpriteFrames = extractSpriteFrames;

function loadMultiFrameImages(src, rows, chromaPreset, callback, cols = 8) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        try {
            const frameW = Math.floor(img.width / cols);
            const frameH = Math.floor(img.height / rows);
            const frames = [];
            const off = document.createElement("canvas");
            off.width = frameW; off.height = frameH;
            const offCtx = off.getContext("2d");

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    offCtx.clearRect(0, 0, frameW, frameH);
                    offCtx.drawImage(img, c * frameW, r * frameH, frameW, frameH, 0, 0, frameW, frameH);
                    let imgData = offCtx.getImageData(0, 0, frameW, frameH);
                    imgData = chromaKeyImageData(imgData, chromaPreset);
                    offCtx.putImageData(imgData, 0, 0);
                    const cv = document.createElement("canvas");
                    cv.width = frameW; cv.height = frameH;
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
window.loadMultiFrameImages = loadMultiFrameImages;

function loadPosterWithChroma(src, chromaPreset, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        if (chromaPreset) {
            let imgData = ctx.getImageData(0, 0, cv.width, cv.height);
            imgData = chromaKeyImageData(imgData, chromaPreset);
            ctx.putImageData(imgData, 0, 0);
        }
        callback(cv);
    };
    img.onerror = () => { console.error("Cannot load poster:", src); callback(null); };
    img.src = src;
}
window.loadPosterWithChroma = loadPosterWithChroma;

// =======================================================
// Ida-Preloads (schreiben in SpritePool + setzen Globals)
// =======================================================

// Globals für Frame-Dimensionen — werden von ida.js / main.js gelesen
let idaWalkFrameW = 0, idaWalkFrameH = 0;
let idaIceFrameW  = 0, idaIceFrameH  = 0;
let idaIceAnimSpeed = 70;   // ms pro Frame
let idaPresentFrameW = 0, idaPresentFrameH = 0;
const IDA_PRESENT_FPS = 18;

// Frühzeitiger Browser-Cache-Kickoff
const idaImg = new Image();
idaImg.crossOrigin = "anonymous";
idaImg.src = "ida_sprites.png";

function preloadIdaWalk(instance) {
    return new Promise(resolve => {
        if (SpritePool.ida.yellow) {
            instance.idaWalkFrames = instance.colorMode === "red"
                ? SpritePool.ida.red || SpritePool.ida.yellow
                : SpritePool.ida.yellow;
            resolve(); return;
        }
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } = extractSpriteFrames(img, 8, 14, CHROMA_PRESETS.ida);
            SpritePool.ida.yellow = frames;
            SpritePool.ida.red    = frames.map(f => recolorYellowToRed(f));
            idaWalkFrameW = frameW; idaWalkFrameH = frameH;
            instance.idaWalkFrames = instance.colorMode === "red" ? SpritePool.ida.red : SpritePool.ida.yellow;
            console.log("Ida walk Frames:", frames.length);
            resolve();
        };
        img.onerror = () => { console.warn("ida_sprites.png nicht gefunden"); resolve(); };
        img.src = "ida_sprites.png";
    });
}

function preloadIdaIce(instance) {
    return new Promise(resolve => {
        if (SpritePool.idaIce.yellow) {
            instance.idaIceFrames = instance.colorMode === "red"
                ? SpritePool.idaIce.red || SpritePool.idaIce.yellow
                : SpritePool.idaIce.yellow;
            resolve(); return;
        }
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } = extractSpriteFrames(img, 8, 2, CHROMA_PRESETS.ida);
            SpritePool.idaIce.yellow = frames;
            SpritePool.idaIce.red    = frames.map(f => recolorYellowToRed(f));
            idaIceFrameW = frameW; idaIceFrameH = frameH;
            instance.idaIceFrames = instance.colorMode === "red" ? SpritePool.idaIce.red : SpritePool.idaIce.yellow;
            console.log("Ida Ice Frames:", frames.length);
            resolve();
        };
        img.onerror = () => { console.warn("ida-ice_sprites.png nicht gefunden"); resolve(); };
        img.src = "ida-ice_sprites.png";
    });
}

function preloadIdaPresent(instance) {
    return new Promise(resolve => {
        if (SpritePool.idaPresent.yellow) {
            instance.idaPresentFrames = instance.colorMode === "red"
                ? SpritePool.idaPresent.red || SpritePool.idaPresent.yellow
                : SpritePool.idaPresent.yellow;
            resolve(); return;
        }
        const img = new Image();
        img.onload = () => {
            const { frames, frameW, frameH } = extractSpriteFrames(img, 8, 13, CHROMA_PRESETS.ida);
            SpritePool.idaPresent.yellow = frames;
            SpritePool.idaPresent.red    = frames.map(f => recolorYellowToRed(f));
            idaPresentFrameW = frameW; idaPresentFrameH = frameH;
            instance.idaPresentFrames = instance.colorMode === "red" ? SpritePool.idaPresent.red : SpritePool.idaPresent.yellow;
            console.log("Ida Present Frames:", frames.length);
            resolve();
        };
        img.onerror = () => { console.warn("ida-present_sprites.png nicht gefunden"); resolve(); };
        img.src = "ida-present_sprites.png";
    });
}

window.preloadIdaWalk    = preloadIdaWalk;
window.preloadIdaIce     = preloadIdaIce;
window.preloadIdaPresent = preloadIdaPresent;

// =======================================================
// Nicht-Ida-Sprites: alle loadMultiFrameImages-Aufrufe
// =======================================================
let odoFallFrameW = 0, odoFallFrameH = 0;

// Lump-Globals (werden von lump.js gelesen)
let lumpFrames     = [];
let lumpTotalFrames = 8;
let lumpFrameW     = 464;
let lumpFrameH     = 688;
let platschFrames  = [];
let platschFrameW  = 390;
let platschFrameH  = 844;

function initSpriteLoading() {
    loadMultiFrameImages("odo-fall_sprites.png", 13, CHROMA_PRESETS.odo, (frames, frameW, frameH) => {
        SpritePool.odo.fall.yellow = frames;
        SpritePool.odo.fall.red    = frames.map(f => recolorYellowToRed(f));
        odoFallFrameW = frameW; odoFallFrameH = frameH;
    });

    loadMultiFrameImages("odo-ride_sprites.png", 5, CHROMA_PRESETS.ride, (frames) => {
        SpritePool.odo.ride.yellow = frames;
        SpritePool.odo.ride.red    = frames.map(f => recolorYellowToRed(f));
    });

    loadMultiFrameImages("odo-grab_sprites.png", 29, CHROMA_PRESETS.grab, (frames) => {
        SpritePool.odo.grab.yellow = frames;
        SpritePool.odo.grab.red    = frames.map(f => recolorYellowToRed(f));
    });

    loadMultiFrameImages("bollen_sprites.png", 11, CHROMA_PRESETS.lump, (frames, frameW, frameH) => {
        SpritePool.lump = frames;
        lumpFrameW = frameW; lumpFrameH = frameH;
        lumpTotalFrames = frames.length;
        console.log("Bollen-Sprites geladen:", frames.length, "Frames");
    });

    loadMultiFrameImages("platsch_sprites.png", 15, CHROMA_PRESETS.platsch, (frames, frameW, frameH) => {
        SpritePool.platsch = frames;
        platschFrameW = frameW; platschFrameH = frameH;
        console.log("Platsch-Sprites geladen:", frames.length, "Frames");
    });

    loadMultiFrameImages("obstacles.png", 2, CHROMA_PRESETS.obstacle, (frames) => {
        SpritePool.obstacles = frames;
        console.log("Obstacle-Sprites geladen:", frames.length, "Frames");
    }, 4);
}

// Sofort starten
initSpriteLoading();

// =======================================================
// assignSpritesToInstance + waitForSprites
// =======================================================
function assignSpritesToInstance(instance) {
    instance.idaWalkFrames    = SpritePool.ida[instance.colorMode];
    instance.idaIceFrames     = SpritePool.idaIce[instance.colorMode];
    instance.idaPresentFrames = SpritePool.idaPresent[instance.colorMode];
    instance.odoFallFrames    = SpritePool.odo.fall[instance.colorMode];
    instance.odoRideFrames    = SpritePool.odo.ride[instance.colorMode];
    instance.odoGrabFrames    = SpritePool.odo.grab[instance.colorMode];
    instance.lumpFrames       = SpritePool.lump;
    instance.platschFrames    = SpritePool.platsch;
    instance.obstaclesFrames  = SpritePool.obstacles;
    console.log(`Instance ${instance.suffix} (${instance.colorMode}): Sprites zugewiesen`);
}

function waitForSprites() {
    return new Promise(resolve => {
        const check = () => {
            if (
                SpritePool.lump &&
                SpritePool.platsch &&
                SpritePool.obstacles &&
                SpritePool.odo.fall.yellow &&
                SpritePool.odo.ride.yellow &&
                SpritePool.odo.grab.yellow &&
                SpritePool.ida.yellow &&
                SpritePool.idaIce.yellow &&
                SpritePool.idaPresent.yellow
            ) { resolve(); }
            else { setTimeout(check, 100); }
        };
        check();
    });
}

window.assignSpritesToInstance = assignSpritesToInstance;
window.waitForSprites          = waitForSprites;

console.log("loader.js geladen — LevelLoader, SpritePool, ChromaKey bereit.");
