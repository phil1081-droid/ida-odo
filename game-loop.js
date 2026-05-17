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
        if (this._lastTs !== null) dt = Math.min(ts - this._lastTs, 100);
        this._lastTs = ts;

        this.logic.update(this.instance, dt);
        this.renderer.draw(this.instance.state);
    }
}

/* -------------------------------------------------------
   Layout-Skalierung (Single + Multi)
------------------------------------------------------- */

function scaleFrame() {
    if (!frameEl) return;
    const sab   = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
    const avail = window.innerHeight - sab;
    const scale = Math.min(avail / DESIGN_H, window.innerWidth / DESIGN_W);
    const left  = Math.round((window.innerWidth - DESIGN_W * scale) / 2);
    const top   = Math.round((avail - DESIGN_H * scale) / 2);
    frameEl.style.transform       = `scale(${scale})`;
    frameEl.style.transformOrigin = "top left";
    frameEl.style.position        = "absolute";
    frameEl.style.left            = `${Math.max(0, left)}px`;
    frameEl.style.top             = `${Math.max(0, top)}px`;
}

function scaleFrameMulti(instance) {
    if (!instance.frameEl) return;
    const vw    = window.innerWidth / 2;
    const scale = Math.min(window.innerHeight / DESIGN_H, vw / DESIGN_W);
    const top   = Math.round((window.innerHeight - DESIGN_H * scale) / 2);
    const left  = instance.suffix === '1'
        ? Math.round((vw - DESIGN_W * scale) / 2)
        : Math.round(vw + (vw - DESIGN_W * scale) / 2);
    instance.frameEl.style.transform       = `scale(${scale})`;
    instance.frameEl.style.transformOrigin = "top left";
    instance.frameEl.style.position        = "absolute";
    instance.frameEl.style.left            = `${Math.max(0, left)}px`;
    instance.frameEl.style.top             = `${Math.max(0, top)}px`;
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
