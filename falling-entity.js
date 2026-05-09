/* -----------------------------------------------------------
   entity-falling.js
   FallingEntity erweitert Entity:
   - vertikale Bewegung (Fallen)
   - Animation
   - Lebenszeitbegrenzung unten am Bildschirm
   - Neuer Zustand: "hit" für Aufwärtsbewegung
----------------------------------------------------------- */
class FallingEntity extends Entity {
    constructor(opts = {}) {
        super({
            ...opts,
            state: "fall",
            speed: opts.speed || 2
        });

        this.mode = opts.state || "fall";
        this.id = opts.id || Math.random().toString(36).slice(2);
        this.seen = false;
        this.decisionMade = false;
        this.prevY = this.y;
        this.blinkTimer = 0;
        this.blinkCount = 0;
        this.visible = true;
        this.platschY = this.y;
        this.megaTriggered = false;

        // Animation
        this.frames = opts.frames || [];
        this.frame = opts.frame || 0;
        this.animSpeed = opts.animSpeed || 0.3;
        this.animOffset = opts.animOffset || 0;
        this.animTimer = 0;
    }

    baseUpdate(cssH) {
        if (this.dead) return false;

        if (this.state === "fall") {
            this.y += this.speed;
            this.updateAnimation(0.3);
            // Unten raus?
            if (this.y > cssH + this.h) {
                this.dead = true;
                return false;
            }
        } else if (this.state === "hit") {
            // Aufwärtsbewegung mit dreifacher Geschwindigkeit
            this.y -= this.speed * this.hitSpeedMultiplier;
            this.updateAnimation(0.3);
            // Oben raus? -> Bereit für Instanzwechsel
            if (this.y < -this.h) {
                this.dead = true; // Markiere als tot, wird in main.js übertragen
                return false;
            }
        }

        return true;
    }

    update(cssH) {
        return this.baseUpdate(cssH);
    }

    updateAnimation(speedMultiplier = 1) {
        if (!this.frames || this.frames.length <= 1) return;
        this.animTimer = (this.animTimer || 0) + speedMultiplier;
        if (this.animTimer >= this.animSpeed) {
            this.animTimer = 0;
            this.frame = (this.frame + 1) % this.frames.length;
        }
    }
    
    // Methode zum Auslösen des Hits
    triggerHit(targetInstanceId) {
        this.state = "hit";
        this.targetInstanceId = targetInstanceId; // Speichere Zielinstanz
        // Optional: Visueller Effekt oder Sound
        if (typeof playHitSound === "function") {
            playHitSound();
        }
    }
}
window.FallingEntity = FallingEntity;
console.log("entity-falling.js geladen — Klasse FallingEntity bereit.");
