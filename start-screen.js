// =======================================================
// StartScreenAnimation
// - wiederverwendbar für Start & Game Over
// mode: 'contain' | 'cover' | 'width'
//   contain — in Bounds einpassen, zentriert (Standard / Game Over)
//   width   — Breite füllen, oben bündig, Höhe per Seitenverhältnis (Start-Screen)
//   cover   — Bounds füllen, mittig, Seiten abschneiden
// =======================================================

class StartScreenAnimation {
    constructor(canvas, spriteSrc, designW, designH, mode = 'contain') {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.designW = designW;
        this.designH = designH;
        this.mode = mode || 'contain';

        this.spriteSrc = spriteSrc;

        // Animation
        this.frames = [];
        this.frameW = 0;
        this.frameH = 0;

        this.phase = "static";

        // Control flags
        this.running = false;
        this._ready = false;
        this.autoClear = true;

        // Timing
        this.currentFrame = 0;
        this.dir = 1;
        this.acc = 0;
        this.fps = 12;
        this.lastTs = 0;

        this._tick = this._tick.bind(this);
    }

    /* ===================== public ===================== */

    start(numberOfRows) {
        if (this.running) return;
        this.running = true;
        this._loadAnimation(numberOfRows);
        requestAnimationFrame(this._tick);
    }

    stop() {
        this.running = false;
    }

    allowAnimation(delayMs = 0) {
        if (!this._ready) {
            setTimeout(() => this.allowAnimation(delayMs), 50);
            return;
        }
        setTimeout(() => { this.phase = "anim"; }, Math.max(0, delayMs));
    }

    /* ===================== loading ===================== */

    _loadAnimation(numberOfRows) {
        loadMultiFrameImages(
            this.spriteSrc,
            numberOfRows,
            CHROMA_PRESETS.ida,
            (frames, w, h) => {
                this.frames = frames;
                this.frameW = w;
                this.frameH = h;
                this._ready = true;
            }
        );
    }

    /* ===================== loop ===================== */

    _tick(ts) {
        if (!this.running) return;
        requestAnimationFrame(this._tick);

        if (!this.lastTs) this.lastTs = ts;
        const dt = ts - this.lastTs;
        this.lastTs = ts;

        if (!this._ready) return;

        if (this.phase === "anim") {
            this._updateAnimation(dt);
        }
        this._drawFrame();
    }

    /* ===================== animation ===================== */

    _updateAnimation(dt) {
        this.acc += dt;
        const step = 1000 / this.fps;

        while (this.acc >= step) {
            this.acc -= step;
            this.currentFrame += this.dir;

            if (this.currentFrame >= this.frames.length - 1) {
                this.currentFrame = this.frames.length - 1;
                this.dir = -1;
            } else if (this.currentFrame <= 0) {
                this.currentFrame = 0;
                this.dir = 1;
            }
        }
    }

    /* ===================== drawing ===================== */

    _drawFrame() {
        if (this.autoClear) {
            this.ctx.clearRect(0, 0, this.designW, this.designH);
        }

        const frame = this.frames[this.currentFrame];
        if (!frame) return;

        let scale, drawW, drawH, x, y;

        if (this.mode === 'width') {
            // Breite füllen, Höhe per Seitenverhältnis, oben bündig — identisch zu <img width:100%>
            scale = this.designW / this.frameW;
            drawW = this.designW;
            drawH = this.frameH * scale;
            x = 0;
            y = 0;
        } else if (this.mode === 'cover') {
            scale = Math.max(this.designW / this.frameW, this.designH / this.frameH);
            drawW = this.frameW * scale;
            drawH = this.frameH * scale;
            x = (this.designW - drawW) / 2;
            y = (this.designH - drawH) / 2;
        } else {
            // contain (Standard)
            scale = Math.min(this.designW / this.frameW, this.designH / this.frameH);
            drawW = this.frameW * scale;
            drawH = this.frameH * scale;
            x = (this.designW - drawW) / 2;
            y = (this.designH - drawH) / 2;
        }

        this.ctx.drawImage(frame, x, y, drawW, drawH);
    }
}
