/*
==============================================================
=  obstacle.js
=  – OBSTACLE_TYPES
=  – Obstacle-Klasse
=  – spawnObstacle, spawnFallingThing, getObstacleChancesForLevel
=  – updateObstacles
=  – triggerIdaFrozen, startIdaPresentAnimation   (Ida-Effekte)
==============================================================
*/

const OBSTACLE_TYPES = [
    {
        name: "Brigate",
        nr: 0,
        spin:  0.02,
        scoreMalus: 1,
        sound: (ctx) => ctx.playObstacleSound(0),
        levelAppearance: 1,
        initialChance: 0.01,
        chanceIncrease: 0.001
    },
    {
        name: "Pylon",
        nr: 1,
        spin: -0.08,
        scoreMalus: 2,
        sound: (ctx) => ctx.playObstacleSound(1),
        levelAppearance: 2,
        initialChance: 0.005,
        chanceIncrease: 0.01
    },
    {
        name: "Ice",
        nr: 2,
        spin:  0.04,
        scoreMalus: 0,
        sound: (ctx) => ctx.playObstacleSound(2),
        levelAppearance: 2,
        initialChance: 0.005,
        chanceIncrease: 0.01
    },
    {
        name: "Bomb",
        nr: 3,
        spin: -0.012,
        scoreMalus: 5,
        sound: (ctx) => ctx.playObstacleSound(3),
        levelAppearance: 4,
        initialChance: 0.005,
        chanceIncrease: 0.01
    },
    {
        name: "Box",
        nr: 4,
        spin:  -0.04,
        scoreMalus: 7,
        sound: (ctx) => ctx.playObstacleSound(4),
        levelAppearance: 5,
        initialChance: 0.005,
        chanceIncrease: 0.02
    },
    {
        name: "Nail",
        nr: 5,
        spin: -0.003,
        scoreMalus: 10,
        sound: (ctx) => ctx.playObstacleSound(5),
        levelAppearance: 7,
        initialChance: 0.01,
        chanceIncrease: 0.03
    },
    {
        name: "Skull",
        nr: 6,
        spin: -0.01,
        scoreMalus: 20,
        sound: (ctx) => ctx.playObstacleSound(6),
        levelAppearance: 10,
        initialChance: 0.01,
        chanceIncrease: 0.03
    },
    {
        name: "Present",
        nr: 7,
        spin:  0.06,
        scoreMalus: 0,
        sound: (ctx) => ctx.playObstacleSound(7),
        levelAppearance: 3,
        initialChance: 0.02,
        chanceIncrease: 0.02
    }
];

window.OBSTACLE_TYPES = OBSTACLE_TYPES;

// ==============================================================
// Obstacle-Klasse
// ==============================================================
class Obstacle extends FallingEntity {
    constructor(opts = {}) {
        super(opts);

        if (!Number.isFinite(this.x)) this.x = Math.random() * (DESIGN_W - 64);
        if (!Number.isFinite(this.y)) this.y = -Math.random() * 200 - 50;
        if (!Number.isFinite(this.w)) this.w = 48;
        if (!Number.isFinite(this.h)) this.h = 48;
        if (!Number.isFinite(this.speed)) this.speed = 2.2;

        const def   = OBSTACLE_TYPES[this.type];
        const angle = Math.random() * Math.PI * 2;
        this.rot  = { re: Math.cos(angle), im: Math.sin(angle) };
        const spin = def.spin || 0.02;
        this.spin = { re: Math.cos(spin),  im: Math.sin(spin)  };
    }

    updateRotation() {
        const r = this.rot.re * this.spin.re - this.rot.im * this.spin.im;
        const i = this.rot.re * this.spin.im + this.rot.im * this.spin.re;
        this.rot.re = r;
        this.rot.im = i;
    }

    checkCollision(ida) {
        // ~3.5mm Kulanz-Inset pro Seite am Obstacle (rotierte Sprites sind kleiner als BBox)
        const oi = 21;
        return (
            this.x + this.w - oi > ida.x + 12 &&
            this.x + oi         < ida.x + ida.w - 12 &&
            this.y + this.h - oi > ida.y + 15 &&
            this.y + oi         < ida.y + ida.h - 15
        );
    }

    onCollide(gameCtx) {
        const def = OBSTACLE_TYPES[this.type];

        if (this.type === 7) {
            gameCtx.startIdaPresentAnimation(gameCtx.state);
            def.sound(gameCtx);
            if (gameCtx.state.ida) gameCtx.state.ida.pendingPuddleCleanup = true;
            this.dead = true;
            return;
        }

        if (this.type === 2) {
            gameCtx.triggerIdaFrozen(gameCtx.state);
            def.sound(gameCtx);
            this.dead = true;
            return;
        }

        const malus = def?.scoreMalus ?? 0;
        gameCtx.state.score = Math.max(0, gameCtx.state.score - malus);
        def.sound(gameCtx);
        this.dead = true;
    }

    draw(ctx) {
        const frame = this.frames && this.frames[0];
        if (!frame) return;

        const x = Number.isFinite(this.x) ? this.x : 0;
        const y = Number.isFinite(this.y) ? this.y : 0;
        const w = Number.isFinite(this.w) ? this.w : frame.width;
        const h = Number.isFinite(this.h) ? this.h : frame.height;

        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(Math.atan2(this.rot.im, this.rot.re));
        ctx.drawImage(frame, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    update(cssH, gameCtx) {
        if (this.dead) return false;

        if (!Number.isFinite(this.y))     this.y     = -50;
        if (!Number.isFinite(this.speed)) this.speed  = 2.5;

        this.y += this.speed;
        this.updateRotation();

        if (this.y > WORLD_H + this.h + 20) { this.dead = true; return false; }

        if (gameCtx?.state?.ida && this.checkCollision(gameCtx.state.ida)) {
            this.onCollide(gameCtx);
            return false;
        }

        return true;
    }
}

window.Obstacle = Obstacle;

// ==============================================================
// Ida-Effekte (werden von onCollide über gameCtx aufgerufen)
// ==============================================================
function startIdaPresentAnimation(state) {
    if (state.ida) state.ida.triggerPresent(45);
}

function triggerIdaFrozen(state) {
    if (!state.ida) return;
    if (typeof state.ida.showSpeech === "function") state.ida.showSpeech("brrr.", 2000);
    state.ida.triggerFrozen(60);
}

window.startIdaPresentAnimation = startIdaPresentAnimation;
window.triggerIdaFrozen         = triggerIdaFrozen;

// ==============================================================
// Spawn- und Update-Funktionen
// ==============================================================
const _chanceCache = new Map();

function getObstacleChancesForLevel(level) {
    if (_chanceCache.has(level)) return _chanceCache.get(level);
    const result = OBSTACLE_TYPES
        .filter(o => level >= o.levelAppearance)
        .map(o => ({
            type:   o.nr,
            chance: o.initialChance + (level - o.levelAppearance) * o.chanceIncrease
        }));
    _chanceCache.set(level, result);
    return result;
}

function spawnObstacle(instance, type) {
    if (type === undefined || !instance.obstaclesFrames || !instance.obstaclesFrames[type]) {
        console.warn("spawnObstacle: invalid type oder Frames fehlen", type, "für Instanz", instance.suffix);
        return;
    }
    const frame = instance.obstaclesFrames[type];
    const cssW  = cssWidth(instance);
    const w     = frame.width  * 0.5;
    const h     = frame.height * 0.5;

    instance.state.obstacles.push(new Obstacle({
        type,
        x: Math.random() * (cssW - w),
        y: -h,
        w, h,
        speed: 3 + Math.random() * 2.8,
        frames: [frame]
    }));
}

function spawnFallingThing(instance, level) {
    const effectiveLevel = level >= 1 ? level : 1;
    const chances = getObstacleChancesForLevel(effectiveLevel);

    if (!chances.length || Math.random() > 0.92) {
        if (chances.length > 0 && Math.random() < 0.04) {
            const def = chances[Math.floor(Math.random() * chances.length)];
            spawnObstacle(instance, def.type);
            return;
        }
    }

    const totalChance = chances.reduce((s, o) => s + o.chance, 0);
    if (totalChance <= 0 || Math.random() * 100 >= totalChance) {
        spawnLump(instance);
        return;
    }

    let r = Math.random() * totalChance;
    for (const o of chances) {
        r -= o.chance;
        if (r <= 0) { spawnObstacle(instance, o.type); return; }
    }
    spawnLump(instance);
}

function updateObstacles(instance, dt) {
    const cssH     = cssHeight(instance);
    const obstacles = instance.state.obstacles;
    let write = 0;
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const alive = o.update(cssH, {
            state:                   instance.state,
            overflow:                instance.overflow,
            triggerIdaFrozen,
            startIdaPresentAnimation,
            playObstacleSound,
            playBulldozerSweep
        });
        if (alive && !o.dead) obstacles[write++] = o;
    }
    obstacles.length = write;
}

window.getObstacleChancesForLevel = getObstacleChancesForLevel;
window.spawnObstacle              = spawnObstacle;
window.spawnFallingThing          = spawnFallingThing;
window.updateObstacles            = updateObstacles;

