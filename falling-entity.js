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

    update(cssH) {
        return true;
    }

    updateAnimation(speedMultiplier = 1) {
        if (!this.frames || this.frames.length <= 1) return;
        this.animTimer = (this.animTimer || 0) + speedMultiplier;
        if (this.animTimer >= this.animSpeed) {
            this.animTimer = 0;
            this.frame = (this.frame + 1) % this.frames.length;
        }
    }
    
}
window.FallingEntity = FallingEntity;
