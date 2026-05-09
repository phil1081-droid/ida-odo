/*
==============================================================
=  Odo-Klasse
=  (Spezialfall: Fallen → Ride → Greifen)
==============================================================
*/

class Odo extends FallingEntity {
    constructor(opts = {}) {
        super(opts);

        this.state = "fall";  // fall, ride, grab
        this.fallFrames  = opts.frames || [];       // <-- WICHTIG: Fall-Frames (odo-fall_sprites.png)
        this.rideFrames  = opts.rideFrames || [];
        this.grabFrames  = opts.grabFrames || [];
        this.frameIndex  = 0;
        this.speed       = opts.speed || 3;
        
        this.currentFrames = this.fallFrames;       // Start mit Fall-Animation
        this.frameIndex = 0;
        this.animSpeed = 80;                        // ms pro Frame → ca. 12 FPS Drehung (passe an!)
        this.lastAnimTime = performance.now();

        // Speech bubble (same system as Ida)
        this.speech = {
            text: "",
            until: 0
        };
        
        this.rideTexts = [
            "Danke, Ida!",
            "Endlich raus aus dem Dreck!",
            "Aua, mein Kopf!",
            "Jetzt eine Dusche!",
            "Ich hab den Drehwurm.",
            "Mann, schon wieder dreckig!",
            "Gut gemacht, Ida!",
            "Super, Ida!",
            "Ich hab Hunger!",
            "Seid gegrüßt, meine Lieben!",
            "Da geht ja der Motor kaputt",
            "Bin hingefallen, au, aua!",
            "Autsch!"
        ];
        
        this.speechBaseY = null; // Referenz-Y für Speechbubble
    }

    collidesWithIda(ida) {
        if (this.state === "fall") {
            return (
                    this.x + this.w > ida.x + ida.w * 0.6 &&
                    this.x < ida.x + ida.w * 0.4 &&
                    this.y + this.h > ida.y + 40 &&
                    this.y < ida.y + ida.h - 40
                    );
        }
        else return false;
    }

    update(cssH, gameCtx) {
        const now = performance.now();

        // === FALL-ZUSTAND ===
        if (this.state === "fall") {
            this.y += this.speed;

            // Dreh-Animation (13 Frames aus odo-fall_sprites.png)
            if (this.fallFrames.length > 1 && now - this.lastAnimTime > this.animSpeed) {
                this.frameIndex = (this.frameIndex + 1) % this.fallFrames.length;
                this.lastAnimTime = now;
            }

            // Kollision mit Ida
            if (this.collidesWithIda(gameCtx.state.ida)) {
                this.state = "ride";
                this.y = gameCtx.state.ida.y;
                this.currentFrames = this.rideFrames;
                this.frameIndex = 0;
                this.lastAnimTime = now;
                gameCtx.playOdoCollect();

                this.speechBaseY = this.y;

                if (typeof this.showSpeech === "function") {
                    const txt = this.rideTexts[Math.floor(Math.random() * this.rideTexts.length)];
                    this.showSpeech(txt, 2000);
                }

                return true;
            }

            // Rausfallen unten
            if (this.y > cssH + this.h) {
                this.dead = true;
                return false;
            }

            return true;
        }

        // === RIDE-ZUSTAND ===
        if (this.state === "ride") {
            // Langsame Ride-Animation
            if (this.rideFrames.length > 1 && now - this.lastAnimTime > 120) { // ca. 8 FPS
                this.frameIndex = (this.frameIndex + 1) % this.rideFrames.length;
                this.lastAnimTime = now;
            }

            // Nach links fahren
            this.x = Math.max(this.x - 2, 0);

            // Linksrand erreicht → Greifmodus
            if (this.x <= 0) {
                this.state = "grab";
                this.currentFrames = this.grabFrames;
                this.frameIndex = 0;
                this.lastAnimTime = now;
            }

            return true;
        }

        // === GRAB-ZUSTAND ===
        if (this.state === "grab") {
            if (this.grabFrames.length === 0) {
                this.dead = true;
                return false;
            }

            /*
            // Frame vorwärts (ca. 10 FPS)
            if (now - this.lastAnimTime > 100) {
                this.frameIndex++;
                this.lastAnimTime = now;
            }
             */
            
            this.frameIndex += 0.6

            // Animation fertig → Odo verschwindet
            if (Math.floor(this.frameIndex) >= this.grabFrames.length) {
                this.dead = true;
                return false;
            }

            // --- Greif-Logik (dein kompletter ursprünglicher Code) ---
            const frame = this.grabFrames[Math.floor(this.frameIndex)];
            if (!frame) return true;

            const scale = 0.5;
            const drawW = frame.width * scale;
            const drawH = frame.height * scale;

            const drawX = this.x;
            const drawY = this.y - frame.height * 0.4;

            const grabStart = { x: drawX + drawW * 0.05, y: drawY + drawH * 0.95 };
            const grabEnd   = { x: drawX + drawW * 0.9,  y: drawY + drawH * 0.25 };

            const vx = grabEnd.x - grabStart.x;
            const vy = grabEnd.y - grabStart.y;
            const len2 = vx * vx + vy * vy || 0.0001;

            const world = gameCtx.lumpsParam;
            const survivors = [];
            let collectedCount = 0;

            const nowFrame = performance.now();
            if (!gameCtx.__odoLastCollectFrame) gameCtx.__odoLastCollectFrame = 0;

            for (let i = 0; i < world.length; i++) {
                const b = world[i];

                if (b && b.collected === true && b.mode !== "fall") continue;

                const bx = (b.x + (b.w || 0) * 0.5);
                const by = (b.y + (b.h || 0) * 0.5);

                let t = ((bx - grabStart.x) * vx + (by - grabStart.y) * vy) / len2;
                t = Math.max(0, Math.min(1, t));
                const cx = grabStart.x + t * vx;
                const cy = grabStart.y + t * vy;

                const dx = bx - cx;
                const dy = by - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const PICK_RADIUS = 38;

                if (dist < PICK_RADIUS) {
                    b.collected = true;
                    b._collectedBy = 'odo';

                    if (gameCtx.__odoLastCollectFrame !== Math.floor(nowFrame)) {
                        gameCtx.state.score++;
                        if (typeof gameCtx.playCollect === "function") gameCtx.playCollect();
                    }
                    collectedCount++;
                } else {
                    survivors.push(b);
                }
            }

            world.length = 0;
            for (let s of survivors) world.push(s);

            if (!gameCtx.__odoHardCleanupInstalled) {
                gameCtx.__odoHardCleanupInstalled = true;
                const originalUpdateLump = gameCtx.updateLump;
                gameCtx.updateLump = function() {
                    if (typeof originalUpdateLump === "function") originalUpdateLump.apply(this, arguments);
                    for (let i = this.lump.length - 1; i >= 0; i--) {
                        if (this.lump[i] && this.lump[i].collected === true) {
                            this.lump.splice(i, 1);
                        }
                    }
                };
            }

            gameCtx.__odoLastCollectFrame = Math.floor(nowFrame);
            return true;
        }

        return true;
    }

    draw(ctx) {
        if (!ctx || !this.currentFrames || this.currentFrames.length === 0) return;

        const frame = this.currentFrames[Math.floor(this.frameIndex)];
        if (!frame) return;

        let drawX = this.x;
        let drawY = this.y;
        let drawW = this.w;
        let drawH = this.h;

        if (this.state === "ride") {
            drawW = this.w * 0.6;
            drawH = this.h * 0.6;
            drawY = this.y - drawH * 0.15;
        } else if (this.state === "grab") {
            const scale = 0.5;
            drawW = frame.width * scale;
            drawH = frame.height * scale;
            drawY = this.y - frame.height * 0.4;
        }

        ctx.drawImage(frame, drawX, drawY, drawW, drawH);

        // === SPEECH BUBBLE ===
        const now = performance.now();
        if (this.speech && this.speech.text && now < this.speech.until) {
            const SCALE = 1.0;
            const text = this.speech.text;

            ctx.save();

            ctx.font = `${16 * SCALE}px sans-serif`;
            ctx.textBaseline = "middle";

            const paddingX = 10 * SCALE;
            const paddingY = 6 * SCALE;
            const metrics = ctx.measureText(text);

            const boxW = Math.ceil(metrics.width) + paddingX * 2;
            const boxH = (24 * SCALE) + paddingY * 2;

            let bx = drawX + drawW / 2 - boxW / 2;

            const baseY = (this.speechBaseY !== null) ? this.speechBaseY : drawY;
            let by = baseY - boxH - 8;

            if (by < 0) {
                by = drawY + drawH + (8 * SCALE);
            }

            const margin = 6;
            const canvasW = ctx.canvas.width;
            if (bx < margin) bx = margin;
            if (bx + boxW > canvasW - margin) {
                bx = canvasW - boxW - margin;
            }

            ctx.globalAlpha = 0.95;
            ctx.fillStyle = "#fff";

            const r = 8 * SCALE;
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
            ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
            ctx.arcTo(bx, by + boxH, bx, by, r);
            ctx.arcTo(bx, by, bx + boxW, by, r);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.5 * SCALE;
            ctx.stroke();

            ctx.fillStyle = "#000";
            ctx.globalAlpha = 1;
            ctx.fillText(text, bx + paddingX, by + boxH / 2);

            ctx.restore();
        }
    }
    
    showSpeech(text, ms = 2000) {
        const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
        this.speech.text = text;
        this.speech.until = now + ms;
    }
}

window.Odo = Odo;
