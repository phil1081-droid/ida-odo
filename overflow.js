/* ----------------------------------
   overflow.js
   Verwaltet den Pfützen-Stapel.

   Konzept:
   - Jede Pfütze = letztes Frame der Platsch-Animation,
     auf DESIGN_W skaliert, Unterkante bündig am Spielboden.
   - Pro Pfütze rückt der Spielinhalt um PUDDLE_STACK_STEP px
     nach oben (via getOffsetY()).
   - Game Over wenn offsetY >= WORLD_H.
----------------------------------- */

// Wie viele Pixel rückt das Spiel pro Pfütze nach oben?
// = sichtbare Pfützen-Höhe (644 - 424 = 220px im Frame, skaliert auf DESIGN_W)
// Wird beim ersten addPuddle() aus den echten Frame-Dimensionen berechnet.
const PUDDLE_STACK_STEP_DEFAULT = 80; // px, Fallback bis Frames bekannt sind

class OverflowManager {
    constructor(maxLevels = 8) {
        this.maxLevels = maxLevels;

        // Pfützen-Stapel: jeder Eintrag = { canvas: OffscreenCanvas }
        this.puddleStack = [];

        // Gesamtzahl hinzugefügter Pfützen (für Game-Over-Logik)
        this.totalPuddles = 0;

        // Callback wenn Game Over durch Overflow
        this.onOverflow = null;

        // Canvas-Maße (für Referenz)
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Berechneter Stack-Step (px nach oben pro Pfütze)
        this._stackStep = PUDDLE_STACK_STEP_DEFAULT;

        // Legacy: activePlatsch wird nicht mehr benötigt, bleibt für Kompatibilität
        this.activePlatsch  = null;
        this._slotCounter   = 0;
        this._mergedCanvas  = null;  // zusammengeführter Puddle-Canvas
    }

    /* ---------- Setup ---------- */

    setCanvasSize(w, h) {
        this.canvasWidth = w;
        this.canvasHeight = h;
    }

    setCanvasHeight(h) {
        this.setCanvasSize(this.canvasWidth, h);
    }

    /* ---------- Pfütze hinzufügen ---------- */

    /**
     * Wird von lump.js aufgerufen wenn die Platsch-Animation fertig ist.
     * platschFrames: Array aller Frames aus instance.platschFrames
     * Das letzte Frame wird als Pfütze eingefroren.
     */
    addPuddle(platschFrames) {
        // Direkter Aufruf: reservieren und sofort committen
        const idx = this.reserveSlot(platschFrames);
        this.commitPuddle(platschFrames, idx);
    }

    /**
     * Beim Aufprall: Platzhalter-Slot anlegen, Spiel rückt sofort hoch.
     * Gibt den Stack-Index des neuen Slots zurück (für commitPuddle).
     */
    reserveSlot(platschFrames) {
        if (!platschFrames || !platschFrames.length) return -1;

        const lastFrame = platschFrames[platschFrames.length - 1];
        const scale  = DESIGN_W / lastFrame.width;
        const drawW  = DESIGN_W;
        const drawH  = Math.round(lastFrame.height * scale);

        const PUDDLE_TOP_PX    = 424;
        const PUDDLE_BOTTOM_PX = 644;
        // 0.275: sichtbare Pfützenzone macht ~27.5 % der skalierten Frame-Höhe aus
        this._stackStep = Math.round((PUDDLE_BOTTOM_PX - PUDDLE_TOP_PX) * scale * 0.275);

        // Platzhalter-Canvas (wird von commitPuddle befüllt)
        const placeholder = document.createElement("canvas");
        placeholder.width  = drawW;
        placeholder.height = drawH;

        const slotId = ++this._slotCounter;  // eindeutige ID pro Slot

        this.puddleStack.push({
            canvas: placeholder,
            drawW, drawH,
            originalScale: scale,
            slotId,         // für commitPuddle
            pending: true
        });
        this.totalPuddles++;

        if (this.puddleStack.length > this.maxLevels) {
            this.puddleStack.shift();
        }

        if (this.overflowReached() && typeof this.onOverflow === "function") {
            this.onOverflow();
        }

        this._rebuildMerged();
        return slotId;
    }

    /**
     * Am Ende der Animation: letztes Frame in den richtigen Slot zeichnen.
     * slotId kommt von reserveSlot().
     */
    commitPuddle(platschFrames, slotId) {
        if (!platschFrames || !platschFrames.length) return;
        if (slotId === undefined || slotId < 0) return;

        const lastFrame = platschFrames[platschFrames.length - 1];
        const scale = DESIGN_W / lastFrame.width;
        const drawW = DESIGN_W;
        const drawH = Math.round(lastFrame.height * scale);

        // Den Slot mit der passenden ID finden und befüllen
        for (let i = this.puddleStack.length - 1; i >= 0; i--) {
            if (this.puddleStack[i].slotId === slotId && this.puddleStack[i].pending) {
                const c = this.puddleStack[i].canvas;
                c.getContext("2d").drawImage(lastFrame, 0, 0, drawW, drawH);
                this.puddleStack[i].pending = false;
                this._rebuildMerged();
                break;
            }
        }
    }

    /* ---------- Game-Over-Logik ---------- */

    overflowReached() {
        return this.getOffsetY() >= WORLD_H * 0.85;
    }

    reset() {
        this.puddleStack   = [];
        this.activePlatsch = null;
        this.totalPuddles  = 0;
        this._stackStep    = PUDDLE_STACK_STEP_DEFAULT;
        this._slotCounter  = 0;
        this._mergedCanvas = null;
    }

    /* ---------- Welt-Offset ---------- */

    getOffsetY() {
        return this.puddleStack.length * this._stackStep;
    }

    /* ---------- Merged-Canvas neu aufbauen ---------- */

    _rebuildMerged() {
        if (!this.puddleStack.length) { this._mergedCanvas = null; return; }

        if (!this._mergedCanvas) {
            this._mergedCanvas = document.createElement('canvas');
            this._mergedCanvas.width  = DESIGN_W;
            this._mergedCanvas.height = WORLD_H;
        }
        const mc   = this._mergedCanvas;
        const mctx = mc.getContext('2d');
        mctx.clearRect(0, 0, mc.width, mc.height);

        const PUDDLE_BOTTOM_PX = 644;
        for (let i = 0; i < this.puddleStack.length; i++) {
            const item = this.puddleStack[i];
            if (!item || !item.canvas) continue;
            const sc       = item.originalScale;
            const baseDrawY = WORLD_H - PUDDLE_BOTTOM_PX * sc;
            const drawY    = baseDrawY - i * this._stackStep;
            mctx.drawImage(item.canvas, 0, drawY, item.drawW, item.drawH);
        }
    }

    /* ---------- Pfützen zeichnen — ein einziger drawImage-Aufruf ---------- */

    drawPuddles(ctx) {
        if (!this.puddleStack.length || !this._mergedCanvas) return;
        ctx.drawImage(this._mergedCanvas, 0, 0);
    }

    /* ---------- Kompatibilität (wird von ida.js / obstacle.js aufgerufen) ---------- */

    removeTop() {
        // Nur committete Pfützen entfernen — pending-Slots (laufende Animation)
        // werden übersprungen, damit commitPuddle() den Slot noch findet.
        for (let i = this.puddleStack.length - 1; i >= 0; i--) {
            if (!this.puddleStack[i].pending) {
                this.puddleStack.splice(i, 1);
                this.totalPuddles = Math.max(0, this.totalPuddles - 1);
                this._rebuildMerged();
                return true;
            }
        }
        return false;
    }

    // Legacy-Methoden, nicht mehr aktiv genutzt
    startMegaPlatsch() {}
    addPuddleFromFrame() {}
}
