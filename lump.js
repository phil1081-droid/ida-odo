/* -----------------------------------------------------------
   lump.js — Lump-Klasse + Spawn/Update-Funktionen
   Zustände: fall → blink → platsch → (dead)
            fall → hit
----------------------------------------------------------- */

class Lump extends FallingEntity {
    constructor(opts = {}) {
        super({
            ...opts,
            speed: opts.speed || 2 + Math.random()
        });

        this.mode = "fall";
        this.id = opts.id || Math.random().toString(36).slice(2);
        this.seen = false;
        this.decisionMade = false;
        this.prevY = this.y;

        // Blink
        this.blinkTimer = 0;
        this.blinkCount = 0;
        this.visible = true;

        // Platsch
        this.platschTimer = 0;
        this.platschFrameIdx = 0;
        this.megaTriggered = false;
        this._soundPlayed = false;
        this._platschEndY = null;
        this._slotId = -1;  // Slot-ID vom OverflowManager

        // Animation
        this.frames = opts.frames || [];
        this.frame = opts.frame || 0;
        this.animSpeed = opts.animSpeed || 0.3;
        this.animOffset = opts.animOffset || 0;
        this.animTimer = 0;
    }

    update(cssH, dt, instance) {
        if (this.dead || this.toDelete) return false;
        const groundY = WORLD_H - 30;
        const state = instance.state;

        // === BLINK ===
        if (this.mode === "blink") {
            this.blinkTimer += dt;
            if (this.blinkTimer >= 500) {
                this.blinkTimer = 0;
                this.visible = !this.visible;
                this.blinkCount++;
            }
            if (this.blinkCount >= 6) {
                this.mode = "platsch";
                this.visible = true;
                this.platschTimer = 0;
                this.platschFrameIdx = 0;
                this.megaTriggered = false;
                this._soundPlayed = false;
                this._platschEndY = null;
                this._slotId = -1;
                state.activeBlinkLumpId = null;
            }
            return true;
        }

        // === PLATSCH ===
        if (this.mode === "platsch") {
            if (!instance.platschFrames || !instance.platschFrames.length) {
                this.dead = true;
                return false;
            }

            // ~24 FPS = 42ms pro Frame
            const MS_PER_FRAME = 42;
            this.platschTimer += dt;
            this.platschFrameIdx = Math.min(
                Math.floor(this.platschTimer / MS_PER_FRAME),
                instance.platschFrames.length - 1
            );

            // Sound + Hochrücken beim Aufprall: Frame ~50 = Bollen trifft den Boden
            const IMPACT_FRAME = 50;
            if (!this._soundPlayed && this.platschFrameIdx >= IMPACT_FRAME) {
                this._soundPlayed = true;
                if (typeof playMegaPlatschSound === "function") {
                    playMegaPlatschSound();
                }
                // Slot reservieren — gibt eindeutige ID zurück
                this._slotId = instance.overflow.reserveSlot(instance.platschFrames);
            }

            // Letztes Frame 300ms halten, dann Pfütze final committen
            const lastFrameHoldMs = (instance.platschFrames.length - 1) * MS_PER_FRAME + 300;

            if (!this.megaTriggered && this.platschTimer >= lastFrameHoldMs) {
                this.megaTriggered = true;
                instance.overflow.commitPuddle(instance.platschFrames, this._slotId);
                this.dead = true;
                return false;
            }

            return true;
        }

        // === FALL / HIT ===
        if (!this.seen && this.y + this.h > 0) this.seen = true;

        // Magnet
        if (state.magnet.active && !this.decisionMade && this.mode === "fall") {
            const dx = (state.ida.x + state.ida.w / 2) - (this.x + this.w / 2);
            const dy = (state.ida.y + state.ida.h / 2) - (this.y + this.h / 2);
            const dist = Math.hypot(dx, dy) || 0.01;
            if (dist < state.magnet.range) {
                this.x += dx / dist * state.magnet.pull * (dt / 16.67);
                this.y += dy / dist * state.magnet.pull * (dt / 16.67);
            }
        }

        // Bodenkollision
        const hitGround =
            this.prevY + this.h < groundY &&
            this.y + this.h >= groundY &&
            this.mode === "fall";

        if (hitGround && !this.decisionMade) {
            this.decisionMade = true;

            if (state.activeBlinkLumpId !== null) {
                state.score = Math.max(0, state.score - 1);
                this.dead = true;
                return false;
            }

            if (Math.random() < 0.1) {
                this.mode = "blink";
                this.y = groundY - this.h;
                this.blinkTimer = 0;
                this.blinkCount = 0;
                this.visible = true;
                state.activeBlinkLumpId = this.id;
                return true;
            }

            state.score = Math.max(0, state.score - 1);
            this.dead = true;
            return false;
        }

        // Bewegung
        this.prevY = this.y;
        if (this.mode === "hit") {
            this.y -= FRAME_FALL_BASE * state.fallSpeedMultiplier * (dt / 16.67) * 3;
            if (this.y < -this.h) {
                this.dead = true;
                return false;
            }
        } else {
            this.y += FRAME_FALL_BASE * state.fallSpeedMultiplier * (dt / 16.67);
        }

        if (this.y > cssH + 200) {
            state.score = Math.max(0, state.score - 1);
            this.dead = true;
            return false;
        }

        return true;
    }

    draw(ctx, instance) {
        if (!this.visible) return;

        // === PLATSCH: Bollen fällt von oben ins Bild, Pfütze landet am Boden ===
        if (this.mode === "platsch") {
            if (!instance.platschFrames || !instance.platschFrames.length) return;
            const frameCanvas = instance.platschFrames[this.platschFrameIdx];
            if (!frameCanvas) return;

            const { drawX, drawY, drawW, drawH } = _platschDrawRect(instance);

            if (this._platschEndY === null) {
                this._platschEndY = drawY - instance.overflow.getOffsetY();
            }
            const endY   = this._platschEndY;
            const startY = endY - drawH;

            const totalFrames = instance.platschFrames.length;
            const fallFrames  = Math.floor(totalFrames * 0.45);
            const t     = Math.min(this.platschFrameIdx / Math.max(fallFrames, 1), 1.0);
            const eased = t * t;
            const animDrawY = startY + (endY - startY) * eased;

            ctx.drawImage(frameCanvas, drawX, animDrawY, drawW, drawH);
            return;
        }

        // === NORMALER FALL / BLINK / HIT ===
        const hasFrames = instance.lumpFrames && instance.lumpFrames.length > 0;
        if (hasFrames) {
            const localFrame = (lumpAnimIndex + (this.animOffset || 0)) % lumpTotalFrames;
            const frame = instance.lumpFrames[localFrame];
            if (frame) {
                const aspect = lumpFrameH / lumpFrameW;
                const scale = 2;
                const dw = this.w * scale;
                const dh = dw * aspect;
                const dx = this.x - (dw - this.w) / 2;
                const dy = this.y - (dh - this.h) / 2;
                ctx.drawImage(frame, dx, dy, dw, dh);
            }
        } else {
            ctx.fillStyle = "#8B4513";
            ctx.beginPath();
            ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

}

/* -----------------------------------------------------------
   _platschDrawRect — gemeinsame Positionierungslogik
----------------------------------------------------------- */
function _platschDrawRect(instance) {
    const firstFrame = instance.platschFrames[0];
    const drawW = DESIGN_W;
    const scale = drawW / firstFrame.width;
    const drawH = firstFrame.height * scale;
    const PUDDLE_BOTTOM_PX = 644;
    const drawY = WORLD_H - PUDDLE_BOTTOM_PX * scale;
    return { drawX: 0, drawY, drawW, drawH };
}

/* -----------------------------------------------------------
   Lump-Spawn + Update-Hilfsfunktionen
   (hierher aus main.js ausgelagert)
----------------------------------------------------------- */

function spawnLump(instance) {
    const cssW = cssWidth(instance);

    if (Math.random() >= 0.03) return;

    const size = Math.random() * 20 + 20;
    const x    = Math.random() * (cssW - size);

    const hasFrames  = instance.lumpFrames && Array.isArray(instance.lumpFrames) && instance.lumpFrames.length > 0;
    const frameCount = hasFrames ? instance.lumpFrames.length : 1;

    const newLump = new Lump({
        x, y: -size,
        w: size, h: size,
        speed: 2 + Math.random(),
        frames: hasFrames ? instance.lumpFrames : null,
        frame: Math.floor(Math.random() * frameCount),
        animSpeed: 0.3 + Math.random() * 0.2,
        animOffset: Math.floor(Math.random() * frameCount),
        color: '#8B4513',
    });

    newLump.id = instance.state.nextLumpId++;
    instance.state.lumps.push(newLump);

    // Odo-Spawn-Chance
    if (
        instance.state.ida &&
        !instance.state.odo &&
        performance.now() > 5000 &&
        Math.random() < ODO_SPAWN_PER_BOLL
    ) {
        instance.state.odo = new Odo({
            x: Math.random() * (cssW - odoFallFrameW * 0.5),
            y: -odoFallFrameH,
            w: odoFallFrameW * 0.5,
            h: odoFallFrameH * 0.5,
            frames:      instance.odoFallFrames,
            rideFrames:  instance.odoRideFrames,
            grabFrames:  instance.odoGrabFrames,
            speed: 3 + Math.random() * 0.5
        });
    }
}

// Pre-allokiert — nie neu erzeugt, nur geleert
const _lumpTransfer = [];

function updateLumps(instance, dt) {
    const cssH  = cssHeight(instance);
    const lumps = instance.state.lumps;
    _lumpTransfer.length = 0;
    let write = 0;

    for (let i = 0; i < lumps.length; i++) {
        const lump = lumps[i];
        if (lump.update(cssH, dt, instance)) {
            lumps[write++] = lump;
        } else if (lump.dead && lump.mode === "hit" && lump.targetInstanceId) {
            _lumpTransfer.push(lump);
        }
    }
    lumps.length = write;

    for (let i = 0; i < _lumpTransfer.length; i++) {
        const lump = _lumpTransfer[i];
        const targetInstance = gameInstances.find(inst => inst.suffix === lump.targetInstanceId);
        if (targetInstance) {
            lump.mode         = "fall";
            lump.dead         = false;
            lump.seen         = false;
            lump.decisionMade = false;
            lump.y = -lump.h;
            lump.x = Math.random() * (cssWidth(targetInstance) - lump.w);
            targetInstance.state.lumps.push(lump);
        }
    }
}

function updateGlobalLumpAnimation() {
    const now = performance.now();
    if (lumpTotalFrames > 1 && now - lumpLastAnimTS > frameDelay) {
        lumpAnimIndex  = (lumpAnimIndex + 1) % lumpTotalFrames;
        lumpLastAnimTS = now;
    }
}

window.Lump                    = Lump;
window._platschDrawRect        = _platschDrawRect;
window.spawnLump               = spawnLump;
window.updateLumps             = updateLumps;
window.updateGlobalLumpAnimation = updateGlobalLumpAnimation;
