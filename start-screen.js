// =======================================================
// StartScreenAnimation
// - wiederverwendbar für Start & Game Over
// =======================================================

class StartScreenAnimation {
    constructor(canvas, spriteSrc, designW, designH, posterSrc = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.designW = designW;
        this.designH = designH;

        this.spriteSrc = spriteSrc;
        this.posterSrc = null;

        // Animation
        this.frames = [];
        this.frameW = 0;
        this.frameH = 0;

        // Poster
        this.posterCanvas = null;
        this.phase = "anim";

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

        // FX
        this.bollen = [];

        this._tick = this._tick.bind(this);
    }

    /* ===================== public ===================== */

    start(numberOfRows) {
        this.running = true;

        if (this.posterSrc) {
            this._loadPoster();
        }

        this._loadAnimation(numberOfRows);
        requestAnimationFrame(this._tick);
    }

    stop() {
        this.running = false;
    }

    allowAnimation() {
        if (!this._ready) return;
        this.phase = "anim";
    }

    /* ===================== loading ===================== */

    _loadPoster() {
        loadPosterWithChroma(
            this.posterSrc,
            CHROMA_PRESETS.ida,
            (cv) => {
                this.posterCanvas = cv;
            }
        );
    }

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

                this._initBollen();
            }
        );
    }

    /* ===================== bollen ===================== */

    _initBollen() {
        this.bollen = [];
        for (let i = 0; i < 8; i++) {
            this.bollen.push(this._newBolle());
        }
    }

    _newBolle() {
        return {
            x: Math.random() * this.designW,
            y: Math.random() * this.designH,
            r: 4 + Math.random() * 6,
            v: 20 + Math.random() * 40
        };
    }

    _updateBollen(dt) {
        for (const b of this.bollen) {
            b.y += b.v * (dt / 1000);
            if (b.y > this.designH + b.r) {
                b.y = -b.r;
                b.x = Math.random() * this.designW;
            }
        }
    }

    _drawBollen() {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (const b of this.bollen) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ===================== loop ===================== */

    _tick(ts) {
        if (!this.running) return;
        requestAnimationFrame(this._tick);

        if (!this.lastTs) this.lastTs = ts;
        const dt = ts - this.lastTs;
        this.lastTs = ts;

        // ← Bollen und Poster-Phase komplett entfernen
        // _drawBollen() weg — zeichnet verzerrt auf das 704px-Canvas
        // phase "poster" weg — CSS übernimmt das

        if (!this._ready) return;  // noch nichts laden → nichts zeichnen

        this._updateAnimation(dt);
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

    _drawPoster() {
        const scale = this.designW / this.posterCanvas.width;
        const drawH = this.posterCanvas.height * scale;
        const y = (this.designH - drawH) / 2;

        this.ctx.drawImage(
            this.posterCanvas,
            0,
            y,
            this.designW,
            drawH
        );
    }

    _drawFrame() {
        if (this.autoClear) {
            this.ctx.clearRect(0, 0, this.designW, this.designH);
        }

        const frame = this.frames[this.currentFrame];
        if (!frame) return;

        const scale = this.designW / this.frameW;
        const drawH = this.frameH * scale;
        const y = (this.designH - drawH) / 2;

        this.ctx.drawImage(
            frame,
            0,
            y,
            this.designW,
            drawH
        );
    }
}
