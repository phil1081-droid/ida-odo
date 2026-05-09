/* -------------------------------------------------------
   game-loop.js
   – GameLoop-Klasse
   – scaleFrame, scaleFrameMulti, resizeCanvas
   – cacheInstanceSize, cssWidth, cssHeight
------------------------------------------------------- */

class GameLoop {
    constructor({ instance, logic, renderer }) {
        this.instance  = instance;
        this.logic     = logic;
        this.renderer  = renderer;
        this._running  = false;
        this._lastTs   = null;
        this._tick     = this._tick.bind(this);
    }

    start() {
        if (this._running) return;
        this._running = true;
        this._lastTs  = null;
        requestAnimationFrame(this._tick);
    }

    stop() { this._running = false; }

    _tick(ts) {
        if (!this._running) return;
        requestAnimationFrame(this._tick);

        let dt = 0;
        if (this._lastTs !== null) dt = ts - this._lastTs;
        this._lastTs = ts;

        this.logic.update(this.instance, dt);
        this.renderer.draw(this.instance.state);
    }
}

/* -------------------------------------------------------
   Layout-Skalierung (Single + Multi)
------------------------------------------------------- */

function scaleFrame() {
    // Single-Modus: globales frameEl (wird in initGameInstances gesetzt)
    if (!frameEl) return;
    const scale = Math.min(window.innerHeight / DESIGN_H, window.innerWidth / DESIGN_W);
    frameEl.style.transform       = `scale(${scale})`;
    frameEl.style.transformOrigin = "top left";
    frameEl.style.position        = "absolute";
    frameEl.style.left            = "0";
    frameEl.style.top             = "0";
}

function scaleFrameMulti(instance) {
    if (!instance.frameEl) return;
    const vw    = window.innerWidth / 2;
    const scale = Math.min(window.innerHeight / DESIGN_H, vw / DESIGN_W);
    instance.frameEl.style.transform       = `scale(${scale})`;
    instance.frameEl.style.transformOrigin = "top left";
    instance.frameEl.style.position        = "absolute";
    instance.frameEl.style.left            = instance.suffix === '1' ? "0" : "50%";
    instance.frameEl.style.top             = "0";
    instance.frameEl.style.width           = "50vw";
}

function resizeCanvas() {
    // Single-Modus: globales canvas / overflow
    if (!canvas || !overflow) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = DESIGN_W * dpr;
    canvas.height = (DESIGN_H - CONTROLS_H) * dpr;
    canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    overflow.setCanvasSize(DESIGN_W, WORLD_H);
}

/* -------------------------------------------------------
   CSS-Dimensionen-Cache (vermeidet teuren getComputedStyle
   60×/Sekunde im Game-Loop)
------------------------------------------------------- */

function cacheInstanceSize(instance) {
    if (!instance || !instance.canvas) return;
    instance._cssW = parseFloat(getComputedStyle(instance.canvas).width)  || DESIGN_W;
    instance._cssH = parseFloat(getComputedStyle(instance.canvas).height) || WORLD_H;
}

function cssWidth(instance)  { return instance?._cssW ?? DESIGN_W; }
function cssHeight(instance) { return instance?._cssH ?? WORLD_H;  }

window.cssWidth        = cssWidth;
window.cssHeight       = cssHeight;
window.cacheInstanceSize = cacheInstanceSize;
window.scaleFrame      = scaleFrame;
window.scaleFrameMulti = scaleFrameMulti;
window.resizeCanvas    = resizeCanvas;

console.log("game-loop.js geladen — GameLoop + Layout bereit.");
