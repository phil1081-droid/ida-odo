/* -----------------------------------------------------------
   ida.js — Spielfigur

   Pre-rendered Glow-Canvas für Boost (ersetzt shadowBlur)
   und gecachter Magnet-Gradient (ersetzt createRadialGradient/Frame)
----------------------------------------------------------- */

// Einmaliger Mess-Canvas für measureText in showSpeech
const _idaSpeechCtx = document.createElement('canvas').getContext('2d');

let _boostGlowCanvas = null;
let _boostGlowForW   = 0;

function _drawBoostGlow(ctx, ida) {
    if (!_boostGlowCanvas || _boostGlowForW !== ida.w) {
        const pad = 20;
        const gc  = document.createElement('canvas');
        gc.width  = ida.w + pad * 2;
        gc.height = ida.h + pad * 2;
        const gx  = gc.getContext('2d');
        const cx  = gc.width  / 2;
        const cy  = gc.height / 2;
        const r   = Math.max(ida.w, ida.h) / 2 + pad;
        const grad = gx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0,   'rgba(255,255,255,0.5)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        gx.fillStyle = grad;
        gx.fillRect(0, 0, gc.width, gc.height);
        _boostGlowCanvas = gc;
        _boostGlowForW   = ida.w;
    }
    const pad = 20;
    ctx.drawImage(_boostGlowCanvas, ida.x - pad, ida.y - pad);
}

let _magnetGradCanvas = null;
let _magnetGradR      = 0;

function _getMagnetGradCanvas(r) {
    if (_magnetGradCanvas && Math.abs(_magnetGradR - r) < 0.5) return _magnetGradCanvas;
    const size = Math.ceil(r * 2) + 4;
    const gc   = document.createElement('canvas');
    gc.width = gc.height = size;
    const gx   = gc.getContext('2d');
    const c    = size / 2;
    const grad = gx.createRadialGradient(c, c, 0, c, c, r);
    grad.addColorStop(0.0,  'rgba(120,220,255,0.55)');
    grad.addColorStop(0.25, 'rgba(120,200,255,0.35)');
    grad.addColorStop(0.6,  'rgba(120,200,255,0.15)');
    grad.addColorStop(1.0,  'rgba(120,200,255,0)');
    gx.fillStyle = grad;
    gx.fillRect(0, 0, size, size);
    _magnetGradCanvas = gc;
    _magnetGradR      = r;
    return gc;
}

/* -----------------------------------------------------------
   Erbt von Entity (entity-base.js)
   Wird global via window.Ida bereitgestellt
   Minimal-invasiv, robust: verwaltet Walk/Idle, Frozen, Present
----------------------------------------------------------- */

class Ida extends Entity {
    constructor(opts = {}) {
        super({
            x: opts.x ?? 0,
            y: opts.y ?? 0,
            w: opts.w ?? 100,
            h: opts.h ?? 100,
            frames: opts.frames || [], // fallback
            type: opts.type || "ida"
        });

        // Frames (extern vorbelegt beim Erzeugen aus main.js)
        this.walkFrames    = opts.walkFrames || this.frames || [];
        this.frozenFrames  = opts.frozenFrames || [];
        this.presentFrames = opts.presentFrames || [];

        // Zustand
        this.state = "idle"; // 'idle'|'walk'|'frozen'|'present'
        this.speed = opts.speed || 4;
        this.vx = 0;

        // Grenzen (werden von main gesetzt)
        this.posLimitLeft = 0;
        this.posLimitRight = 0;

        // Timer / Zeitpunkte (in ms)
        this._now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
        this.frozenUntil = 0;
        this.presentUntil = 0;
        this.pendingPuddleCleanup = false;  // Geschenk wartet auf Ende der Present-Animation

        // Pro-animation Indizes + timestamps (separat, damit Wechsel sauber ist)
        this._idx = {
            walk: 0,
            frozen: 0,
            present: 0
        };
        
        this._ts = {
            walk: 0,
            frozen: 0,
            present: 0
        };

        // Render/FPS config (nutzt die globalen Konstanten, falls vorhanden)
        this.walkFps = (typeof ANIM_FPS !== "undefined") ? ANIM_FPS : 10;
        this.presentFps = (typeof IDA_PRESENT_FPS !== "undefined") ? IDA_PRESENT_FPS : 18;
        // frozen uses global idaIceAnimSpeed (ms per frame) if available, otherwise 80ms
        this.frozenFrameMs = (typeof idaIceAnimSpeed !== "undefined") ? idaIceAnimSpeed : 80;

        // kleine Hilfsflags
        this.isBusy = false; // blockiert externe Aktionen wenn true (keine Steuerung)
        
        // speech bubble state
        this.speech = {
            text: "",
            until: 0,
            textWidth: 0
        };
    }

    // Steuerungs-API (main.js verwendet diese)
    moveLeft() {
        if (this.state === "present") {
            // Bewegung ja, aber Present NICHT überschreiben
            this.vx = -this.speed;
            return;
        }
        if (!this._controlBlocked()) {
            this.vx = -this.speed;
            this.state = "walk";
        }
    }

    moveRight() {
        if (this.state === "present") {
            this.vx = this.speed;
            return;
        }
        if (!this._controlBlocked()) {
            this.vx = this.speed;
            this.state = "walk";
        }
    }

    stop() {
        if (this.state === "present") {
            // bei Present nur Bewegung stoppen, Animation läuft weiter
            this.vx = 0;
            return;
        }
        if (!this._controlBlocked()) {
            this.vx = 0;
            if (this.state === "walk") this.state = "idle";
        }
    }

    // Intern: Kontrolle blockiert bei Frozen
    _controlBlocked() {
        if (this.state === "frozen") return true;
        return false;
    }

    isInBlockingAnimation() {
        return this.state === "frozen";
    }

    // triggerFrozen: akzeptiert entweder ms (z.B. 5000) oder "frames" (kleine Zahl).
    // Wenn duration < 1000, interpretieren wir als frames -> ms = frames * (1000/ANIM_FPS)
    triggerFrozen(duration = 60) {
        const now = this._now();
        let ms;
        if (duration >= 1000) ms = duration;
        else {
            const baseFps = (typeof ANIM_FPS !== "undefined") ? ANIM_FPS : this.walkFps;
            ms = duration * (1000 / baseFps);
        }

        this.state = "frozen";
        this.isBusy = true;
        this.vx = 0;
        this.pendingPuddleCleanup = false;
        this._idx.frozen = 0;
        this._ts.frozen = now;
        // ensure we play whole frozen animation AND stay frozen for at least the given ms
        const animationDuration = (this.frozenFrames.length || 1) * this.frozenFrameMs;
        this.frozenUntil = now + Math.max(ms, animationDuration, 5000); // mind. 5s wenn gewünscht
    }

    triggerPresent(duration = 45) {
        const now = this._now();
        let ms;
        if (duration >= 1000) ms = duration;
        else {
            const pf = (typeof IDA_PRESENT_FPS !== "undefined") ? IDA_PRESENT_FPS : this.presentFps;
            ms = duration * (1000 / pf);
        }

        this.state = "present";
        this.isBusy = false; // Präsentation blockiert Bewegung nicht (wie gewünscht)
        this._idx.present = 0;
        this._ts.present = now;
        // ensure the present animation plays fully (determined by frames/presentFps)
        const animMs = (this.presentFrames.length || 1) * (1000 / ((typeof IDA_PRESENT_FPS !== "undefined") ? IDA_PRESENT_FPS : this.presentFps));
        
        this.presentUntil = now + Math.max(ms, animMs);
        this.pendingPuddleCleanup = true;
    }

    handleIdaCollecting(state) {
        if (!state.ida) return;
        const lumps = state.lumps;
        let write = 0;
        for (let i = 0; i < lumps.length; i++) {
            const e = lumps[i];
            // nur normale Lump — KEINE Blink-Lump, KEINE Platsch-Lump
            if (e.mode !== "blink" && e.mode !== "platsch" && !e.collected) {
                const collides =
                (e.x + e.w > state.ida.x + state.ida.w * 0.15 &&
                 e.x < state.ida.x + state.ida.w * 0.7 &&
                 e.y + e.h > state.ida.y + 10 &&
                 e.y < state.ida.y + state.ida.h * 0.8);
                if (collides) {
                    e.collected = true;
                    state.score++;
                    playCollect();
                    if (state.activeBlinkLumpId === e.id) state.activeBlinkLumpId = null;
                    continue;
                }
            }
            lumps[write++] = e;
        }
        lumps.length = write;
        state.ida.speed = state.boost.active ? 8 : 4;
        if (!state.ida.isInBlockingAnimation()) {
            if (state.dir < 0) state.ida.moveLeft();
            else if (state.dir > 0) state.ida.moveRight();
            else state.ida.stop();
        }

        state.ida.x = Math.max(0, Math.min(state.ida.x, DESIGN_W - state.ida.w));
    }
    
    // update() wird jede Frame von main aufgerufen: ida.update();
    update() {
        const now = this._now();

        // 1) State: frozen -> play frozen frames then hold last frame until frozenUntil
        if (this.state === "frozen") {
            // block movement
            this.vx = 0;
            this.isBusy = true;

            // step frames by frozenFrameMs
            if ((now - this._ts.frozen) >= this.frozenFrameMs) {
                this._ts.frozen = now;
                if (this.frozenFrames && this.frozenFrames.length > 0) {
                    this._idx.frozen = Math.min(this._idx.frozen + 1, this.frozenFrames.length - 1);
                } else {
                    this._idx.frozen = 0;
                }
            }

            // if frozen time expired -> leave frozen, show last frame briefly then go idle
            if (now >= this.frozenUntil) {
                // stay on the last frozen-frame for the rest of this frame then reset to idle
                this.state = "idle";
                this.isBusy = false;
                // reset frozen index so it restarts when frozen again
                this._idx.frozen = 0;
            }

            // ensure no movement while frozen
            return true;
        }

        // 2) State: present -> play frames fully until presentUntil, then switch to idle.
        if (this.state === "present") {
            // present animation runs independent of movement
            const frameMs = 1000 / ((typeof IDA_PRESENT_FPS !== "undefined") ? IDA_PRESENT_FPS : this.presentFps);
            if ((now - this._ts.present) >= frameMs) {
                this._ts.present = now;
                if (this.presentFrames && this.presentFrames.length > 0) {
                    this._idx.present++;
                    if (this._idx.present >= this.presentFrames.length) {
                        // clamp to last frame (we let presentUntil govern when to return)
                        this._idx.present = this.presentFrames.length - 1;
                    }
                } else {
                    this._idx.present = 0;
                }
            }

            if (now >= this.presentUntil) {
                // Cleanup NACH der Animation
                if (this.pendingPuddleCleanup && typeof overflow !== "undefined") {
                    const removed = overflow.removeTop();
                    if (removed && typeof playBulldozerSweep === "function") {
                        playBulldozerSweep();
                    }
                    this.pendingPuddleCleanup = false;
                }

                this.state = "idle";
                this._idx.present = 0;
            }


            // note: present does NOT block movement (spec)
            // apply movement if requested
            if (this.vx !== 0) {
                // Bewegung JA...
                this.x += this.vx;
                this.x = Math.max(this.posLimitLeft, Math.min(this.x, this.posLimitRight));
                // ... aber KEIN state-Wechsel – Present bleibt aktiv!
            }

            return true;
        }

        // 3) Normal state: idle / walk - always animate walkFrames even when idle
        // advance walk animation by ANIM_FPS (or configured)
        const walkFrameMs = 1000 / (this.walkFps || 10);
        if ((now - this._ts.walk) >= walkFrameMs) {
            this._ts.walk = now;
            if (this.walkFrames && this.walkFrames.length > 0) {
                this._idx.walk = (this._idx.walk + 1) % this.walkFrames.length;
            } else {
                this._idx.walk = 0;
            }
        }

        // apply horizontal movement
        if (this.vx !== 0) {
            this.x += this.vx;
            this.x = Math.max(this.posLimitLeft, Math.min(this.x, this.posLimitRight));
            // keep state walk
            this.state = "walk";
        } else {
            // no velocity -> idle but keep animating
            this.state = "idle";
        }

        return true;
    }

    // draw(ctx) wird von main aufgerufen: ida.draw(ctx)
    draw(ctx, withMagnet, withBoost) {
        if (!ctx) return;

        const now = this._now();
        const prevAlpha = ctx.globalAlpha;

        if (withBoost) {
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
            ctx.globalAlpha = 0.7 + pulse * 0.25;
            _drawBoostGlow(ctx, this);
        }
        if (withMagnet) {
            const t  = now * 0.0025;
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h * 0.45;
            const r  = this.w * 1.15;

            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            // Pre-rendered Gradient — kein createRadialGradient pro Frame
            const gc   = _getMagnetGradCanvas(r);
            const half = gc.width / 2;
            ctx.drawImage(gc, cx - half, cy - half);

            // Field Lines — alle in einem beginPath/stroke statt 16 Einzelaufrufen
            const cosT = Math.cos(t), sinT = Math.sin(t);
            ctx.translate(cx, cy);
            ctx.strokeStyle = "rgba(200,240,255,0.35)";
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            const COUNT = 16;
            for (let i = 0; i < COUNT; i++) {
                const a  = (i / COUNT) * Math.PI * 2;
                const bx = Math.cos(a), by = Math.sin(a);
                // Inline komplexe Rotation — keine Objekt-Allokation
                ctx.moveTo(bx * r * 0.2  * cosT - by * r * 0.2  * sinT,
                           bx * r * 0.2  * sinT + by * r * 0.2  * cosT);
                ctx.lineTo(bx * r * 0.95 * cosT - by * r * 0.95 * sinT,
                           bx * r * 0.95 * sinT + by * r * 0.95 * cosT);
            }
            ctx.stroke();
            ctx.restore();
        }


        let frame = null;

        // --- frozen ---
        if (this.state === "frozen") {
            const idx = Math.min(this._idx.frozen, this.frozenFrames.length - 1);
            frame = this.frozenFrames[idx] || this.walkFrames[0] || null;
        }

        // --- present ---
        else if (this.state === "present") {
            const idx = Math.min(this._idx.present, this.presentFrames.length - 1);
            frame = this.presentFrames[idx] || this.walkFrames[0] || null;
        }

        // --- idle / walk ---
        else {
            const idx = this._idx.walk % this.walkFrames.length;
            frame = this.walkFrames[idx] || null;
        }

        // --- draw Ida sprite ---
        if (frame) {
            ctx.drawImage(frame, this.x, this.y, this.w, this.h);
        }

        // --- SPEECH BUBBLE (immer nach der Figur zeichnen) ---
        if (this.speech && this.speech.text && now < this.speech.until) {

            const text = this.speech.text;
            ctx.save();
            ctx.font = "16px sans-serif";
            ctx.textBaseline = "middle";

            const paddingX = 10;
            const paddingY = 6;
            const boxW = this.speech.textWidth + paddingX * 2;
            const boxH = 24 + paddingY * 2;

            // Position above Ida
            let bx = this.x + (this.w / 2) - (boxW / 2);
            let by = this.y - boxH - 8;

            const cW = ctx.canvas.width;
            const cH = ctx.canvas.height;

            if (bx < 4) bx = 4;
            if (bx + boxW > cW - 4) bx = cW - boxW - 4;
            if (by < 4) by = this.y + this.h + 8;

            // Bubble BG
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = "#fff";

            const r = 8;
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
            ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
            ctx.arcTo(bx, by + boxH, bx, by, r);
            ctx.arcTo(bx, by, bx + boxW, by, r);
            ctx.closePath();
            ctx.fill();

            // Border
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Text
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = "#000";
            ctx.fillText(text, bx + paddingX, by + boxH / 2);

            ctx.restore();
        }

        // Sicherheits-Reset: shadowBlur darf nie für nachfolgende Draws aktiv bleiben
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = prevAlpha;
    }

    
    // Show a speech bubble for ms milliseconds
    showSpeech(text, ms = 2000) {
        this.speech.text  = text || "";
        this.speech.until = this._now() + (ms || 2000);
        _idaSpeechCtx.font = "16px sans-serif";
        this.speech.textWidth = Math.ceil(_idaSpeechCtx.measureText(this.speech.text).width);
    }
}

function activateBoost() {
    if (!state || !state.ida) return;
    if (state.ida.state === "frozen") return;

    const now = Date.now();

    // Re-trigger erlaubt: verlängert Boost
    state.boost.active = true;
    state.boost.until = now + 1000;

    // Fallback: falls speed direkt gesetzt wird
    if (typeof state.ida.speed === "number") {
        state.ida.speed = state.boostSpeed ?? 8;
    }

    // Audio (defensiv)
    try {
        ensureAudioContext?.();
        playBoostSound?.();
    } catch {}
}

function activateMagnet() {
    if (!state || !state.ida) return;
    if (state.ida.state === "frozen") return;

    const now = Date.now();

    state.magnet.active = true;
    state.magnet.until = now + 3000;

    try {
        ensureAudioContext?.();
        playMagnetSound?.();
    } catch {}
}

function updateBoostAndMagnet(state) {
    const now = Date.now();

    if (state.boost.active && now > state.boost.until) {
        state.boost.active = false;

        // Fallback-Speed zurücksetzen
        if (state.ida && typeof state.ida.speed === "number") {
            state.ida.speed = state.normalSpeed ?? 4;
        }
    }

    if (state.magnet.active && now > state.magnet.until) {
        state.magnet.active = false;
    }
}

window.Ida = Ida;
