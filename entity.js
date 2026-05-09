/* -----------------------------------------------------------
   entity-base.js
   Gemeinsame, übergeordnete Klasse aller Spiel-Entities
   (Ida, Odo, Obstacles, Bollen, Partikel, etc.)
   Läuft OHNE import/export, alles als Globals.
----------------------------------------------------------- */

class Entity {

    constructor(opts = {}) {
        this.x = opts.x || 0;
        this.y = opts.y || 0;
        this.w = opts.w || 50;
        this.h = opts.h || 50;

        this.frames = opts.frames || [];
        this.frameIndex = 0;

        this.dead = false;
        this.type = opts.type ?? null;
    }

    update() {
        /*
           Basis-Update: Wird von Unterklassen überschrieben.
           Diese Funktion existiert nur, damit "update()" immer
           definiert ist.
        */
        return true;
    }

    updateAnimation(factor = 0.3) {
        if (!this.frames || this.frames.length === 0) return;
        this.frameIndex = (this.frameIndex + factor) % this.frames.length;
    }

    getCurrentFrame() {
        if (!this.frames.length) return null;
        return this.frames[Math.floor(this.frameIndex)];
    }

    draw(ctx) {
        const f = this.getCurrentFrame();
        if (!f) return;
        ctx.drawImage(f, this.x, this.y, this.w, this.h);
    }
}

window.Entity = Entity;
