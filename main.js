/* -------------------------------------------------------
   main.js — Orchestrierung + visuelle Effekte:
   – Kamera-Shake bei Kollision / Megaplatsch
   – Vignette
   – Screen-Flash bei Level-Up
   – Score-Popup "+1" (Ida + Odo)
   – Schatten für Ida + Odo (parallax-verschoben)
   – Ida-Glow beim Sammeln
------------------------------------------------------- */

// Legacy-Globals für Single-Modus
let state;
let input;
let overflow;
let canvas;
let ctx;
let frameEl;
let overlay;
let startButton;

let paused        = false;
let gameInstances = [];

const res = loader.getCurrentResources();
bgMusic = res.music;

/* =======================================================
   EFFEKT-SYSTEM
======================================================= */

/* ── 1. Kamera-Shake ─────────────────────────────────── */
function triggerShake(instance, intensity = 6, durationMs = 280) {
    instance.shake = { intensity, until: performance.now() + durationMs };
}

// Shake-Offset: gibt direkt x/y zurück um Object-Allokation zu minimieren
const _shakeOut = { x: 0, y: 0 };
function getShakeOffset(instance) {
    if (!instance.shake) { _shakeOut.x = 0; _shakeOut.y = 0; return _shakeOut; }
    if (performance.now() > instance.shake.until) {
        instance.shake = null; _shakeOut.x = 0; _shakeOut.y = 0; return _shakeOut;
    }
    const t = instance.shake.intensity;
    _shakeOut.x = (Math.random() - 0.5) * t * 2;
    _shakeOut.y = (Math.random() - 0.5) * t;
    return _shakeOut;
}

/* ── 2. Screen-Flash (Level-Up) ──────────────────────── */
function triggerFlash(instance, color = "rgba(255,255,255,0.55)", durationMs = 320) {
    instance.flash = { color, start: performance.now(), duration: durationMs };
}

function drawFlash(ctx, instance) {
    if (!instance.flash) return;
    const elapsed = performance.now() - instance.flash.start;
    const alpha   = Math.max(0, 1 - elapsed / instance.flash.duration);
    if (alpha <= 0) { instance.flash = null; return; }
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = instance.flash.color;
    ctx.fillRect(0, 0, DESIGN_W, WORLD_H);
    ctx.globalAlpha = prev;
}

/* ── 3. Score-Popups "+1" ────────────────────────────── */
function spawnScorePopup(instance, x, y, text = "+1") {
    if (!instance.scorePopups) instance.scorePopups = [];
    instance.scorePopups.push({ x, y, text, born: performance.now(), life: 900 });
}

function updateAndDrawPopups(ctx, instance) {
    if (!instance.scorePopups || !instance.scorePopups.length) return;
    const now    = performance.now();
    const popups = instance.scorePopups;
    const prevA  = ctx.globalAlpha;
    const prevTA = ctx.textAlign;
    ctx.fillStyle   = "#FFD700";
    ctx.strokeStyle = "#000";
    ctx.lineWidth   = 3;
    ctx.textAlign   = "center";
    let write = 0;
    for (let i = 0; i < popups.length; i++) {
        const p = popups[i];
        const t = (now - p.born) / p.life;
        if (t >= 1) continue;
        const alpha = 1 - t;
        const dy    = -40 * t;
        ctx.globalAlpha = alpha;
        ctx.font        = `bold ${Math.round(18 + t * 6)}px sans-serif`;
        ctx.strokeText(p.text, p.x, p.y + dy);
        ctx.fillText(p.text,   p.x, p.y + dy);
        popups[write++] = p;
    }
    popups.length    = write;
    ctx.globalAlpha  = prevA;
    ctx.textAlign    = prevTA;
}

/* ── 4. Hintergrund-DrawRect-Cache ───────────────────── */
const _bgDrawCache = new Map();

function _getBgDrawRect(bg) {
    if (_bgDrawCache.has(bg)) return _bgDrawCache.get(bg);
    const imgAspect    = bg.naturalWidth / bg.naturalHeight;
    const canvasAspect = DESIGN_W / WORLD_H;
    let drawW, drawH, drawX0, drawY;
    if (imgAspect > canvasAspect) {
        drawH = WORLD_H; drawW = imgAspect * WORLD_H;
        drawX0 = -(drawW - DESIGN_W) / 2; drawY = 0;
    } else {
        drawH = DESIGN_W / imgAspect; drawW = DESIGN_W;
        drawX0 = 0; drawY = -(drawH - WORLD_H) / 2;
    }
    const rect = { drawW, drawH, drawX0, drawY };
    _bgDrawCache.set(bg, rect);
    return rect;
}

/* ── 5. Vignette ─────────────────────────────────────── */
let _vignetteCache = null;
let _vignetteCacheKey = "";

function drawVignette(ctx) {
    const key = `${DESIGN_W}x${WORLD_H}`;
    if (_vignetteCacheKey !== key || !_vignetteCache) {
        const vc = document.createElement("canvas");
        vc.width = DESIGN_W; vc.height = WORLD_H;
        const vx = vc.getContext("2d");
        const grad = vx.createRadialGradient(
            DESIGN_W / 2, WORLD_H / 2, WORLD_H * 0.25,
            DESIGN_W / 2, WORLD_H / 2, WORLD_H * 0.85
        );
        grad.addColorStop(0,   "rgba(0,0,0,0)");
        grad.addColorStop(1,   "rgba(0,0,0,0.55)");
        vx.fillStyle = grad;
        vx.fillRect(0, 0, DESIGN_W, WORLD_H);
        _vignetteCache    = vc;
        _vignetteCacheKey = key;
    }
    ctx.drawImage(_vignetteCache, 0, 0);
}

/* ── 5. Schatten (Ida + Odo) ─────────────────────────── */
// bgOffsetX: Hintergrund-Parallax-Wert — Schatten verschiebt sich
// leicht in dieselbe Richtung (halbe Stärke) für Tiefenwirkung.
function drawEntityShadow(ctx, entity, bgOffsetX = 0, opts = {}) {
    if (!entity) return;
    const rxFactor       = opts.rxFactor       ?? 0.38;
    const ry             = opts.ry             ?? 7;
    const alpha          = opts.alpha          ?? 0.28;
    const shadowParallax = opts.shadowParallax ?? 0.4;
    const cyBase         = opts.cyBase         ?? (WORLD_H - 18);
    const cx = entity.x + entity.w / 2 + bgOffsetX * shadowParallax;
    const rx = entity.w * rxFactor;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cyBase, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = prevAlpha;
}

/* ── 6. Ida-Glow beim Sammeln (pre-rendered, kein shadowBlur) ── */
function triggerCollectGlow(instance) {
    instance.collectGlow = performance.now() + 180;
}

function getCollectGlowAlpha(instance) {
    if (!instance.collectGlow) return 0;
    const remaining = instance.collectGlow - performance.now();
    if (remaining <= 0) { instance.collectGlow = 0; return 0; }
    return remaining / 180;
}

let _idaGlowCanvas = null;
let _idaGlowForW   = 0;

function _drawIdaGlow(c, ida, alpha) {
    if (!_idaGlowCanvas || _idaGlowForW !== ida.w) {
        const pad = 28;
        const gc  = document.createElement('canvas');
        gc.width  = ida.w + pad * 2;
        gc.height = ida.h + pad * 2;
        const gx  = gc.getContext('2d');
        const cx  = gc.width  / 2;
        const cy  = gc.height / 2;
        const r   = Math.max(ida.w, ida.h) / 2 + pad;
        const grad = gx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0,   'rgba(255,215,0,0.6)');
        grad.addColorStop(0.5, 'rgba(255,200,0,0.2)');
        grad.addColorStop(1,   'rgba(255,215,0,0)');
        gx.fillStyle = grad;
        gx.fillRect(0, 0, gc.width, gc.height);
        _idaGlowCanvas = gc;
        _idaGlowForW   = ida.w;
    }
    const pad = 28;
    c.globalAlpha = alpha * 0.85;
    c.drawImage(_idaGlowCanvas, ida.x - pad, ida.y - pad);
    c.globalAlpha = 1;
}

/* =======================================================
   createInstance
======================================================= */
function createInstance(suffix = '', colorMode = 'yellow') {
    const instance = {
        suffix,
        colorMode,
        frameEl:  document.getElementById(`gameFrame${suffix}`),
        canvas:   document.getElementById(`gameCanvas${suffix}`),
        ctx:      null,
        overflow: new OverflowManager(12),
        state:    new GameState(),
        input:    new InputManager(),
        startAnim:    null,
        gameOverAnim: null,

        odoFallFrames:    null,
        odoRideFrames:    null,
        odoGrabFrames:    null,
        idaWalkFrames:    null,
        idaIceFrames:     null,
        idaPresentFrames: null,
        lumpFrames:       null,
        platschFrames:    null,
        obstaclesFrames:  null,

        bgOffsetX:      0,
        bgOffsetTarget: 0,

        // Effekt-State
        shake:        null,
        flash:        null,
        scorePopups:  [],
        collectGlow:  0,
    };

    if (instance.canvas) {
        instance.ctx = instance.canvas.getContext('2d');
        instance.overflow.setCanvasSize(DESIGN_W, WORLD_H);
    } else {
        console.error(`Canvas gameCanvas${suffix} nicht gefunden!`);
        return null;
    }

    instance.overflow.onOverflow = () => {
        triggerGameOver(instance);
    };

    // Full-frame overlay canvas (390×DESIGN_H) so animation extends behind buttons
    const startCanvas = document.createElement('canvas');
    startCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:4;pointer-events:none;';
    const dpr = window.devicePixelRatio || 1;
    startCanvas.width  = DESIGN_W * dpr;
    startCanvas.height = DESIGN_H * dpr;
    startCanvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    instance.frameEl.appendChild(startCanvas);
    instance._startCanvas = startCanvas;

    instance.startAnim = new StartScreenAnimation(startCanvas, "start_sprites.png", DESIGN_W, DESIGN_H, 'width');
    instance.startAnim.start(14);

    return instance;
}

/* =======================================================
   Draw
======================================================= */
function drawGround(ctx, instance) {
    const bg = instance?.state?.backgroundImage || loader.getCurrentResources().bg;

    if (!bg) {
        ctx.fillStyle = '#4a7c3f';
        ctx.fillRect(0, 0, DESIGN_W, WORLD_H);
        return;
    }

    if (bg.complete && bg.naturalWidth > 0) {
        const { drawW, drawH, drawX0, drawY } = _getBgDrawRect(bg);
        ctx.drawImage(bg, drawX0 + (instance?.bgOffsetX ?? 0), drawY, drawW, drawH);
    }
}

const _SCORE_FONT = "bold 18px sans-serif";

function drawScore(instance) {
    const c = instance.ctx;
    c.fillStyle = '#000';
    c.font      = _SCORE_FONT;
    c.textAlign = "left";
    c.fillText(t("scoreLabel") + " " + instance.state.score, 12, 24);
}

function drawObstacles(instance) {
    for (let o of instance.state.obstacles) o.draw(instance.ctx);
}

function drawAllForInstance(instance) {
    if (instance.state.gameOver) return;

    const c     = instance.ctx;
    const shake = getShakeOffset(instance);

    // Kamera-Shake: Canvas verschieben
    c.save();
    c.translate(shake.x, shake.y);

    drawGround(c, instance);
    instance.overflow.drawPuddles(c);
    updateGlobalLumpAnimation();

    // Platsch-Lumps
    for (const lump of instance.state.lumps) {
        if (lump.mode === "platsch") lump.draw(c, instance);
    }

    c.save();
    c.translate(0, -(instance.overflow.getOffsetY() || 0));

    for (const lump of instance.state.lumps) {
        if (lump.mode !== "platsch") lump.draw(c, instance);
    }

    drawObstacles(instance);

    // Schatten — parallax-verschoben wie der Hintergrund
    drawEntityShadow(c, instance.state.ida, instance.bgOffsetX);
    // Odo: Schatten nur ab ride-Modus. Im grab-Modus bleibt der Schatten
    // an der letzten ride-Position stehen (eingefroren), fährt aber mit
    // Odo links raus wenn x <= 0 annähernd erreicht.
    if (instance.state.odo) {
        const odo      = instance.state.odo;
        const odoState = odo.state;

        if (odoState === "ride") {
            // Schatten-X live merken für grab-Phase
            instance._odoShadowX = odo.x + odo.w / 2;
            // Ride: Schatten 20px höher als Ida-Schatten (WORLD_H - 38)
            drawEntityShadow(c, odo, instance.bgOffsetX,
                { rxFactor: 0.3, ry: 5, alpha: 0.22, cyBase: WORLD_H - 38 });

        } else if (odoState === "grab") {
            // Grab: Schatten an eingefrorener X-Position, 20px höher (WORLD_H-58).
            // In den letzten 30% der Animation (Odo fährt links raus) → kein Schatten.
            const grabFrameCount = odo.grabFrames ? odo.grabFrames.length : 29;
            const grabProgress   = odo.frameIndex / grabFrameCount;  // 0→1

            if (grabProgress < 0.70) {
                const frozenX    = instance._odoShadowX ?? (odo.x + odo.w / 2);
                const fakeEntity = { x: frozenX - odo.w / 2, w: odo.w };
                drawEntityShadow(c, fakeEntity, instance.bgOffsetX,
                    { rxFactor: 0.3, ry: 5, alpha: 0.22, cyBase: WORLD_H - 58 });
            }
        }
        // fall → kein Schatten
    }

    if (instance.state.odo) instance.state.odo.draw(c);

    // Ida mit optionalem Collect-Glow (pre-rendered, kein shadowBlur)
    if (instance.state.ida) {
        const glowAlpha = getCollectGlowAlpha(instance);
        if (glowAlpha > 0) _drawIdaGlow(c, instance.state.ida, glowAlpha);
        instance.state.ida.draw(c, instance.state.magnet.active, instance.state.boost.active);
    }

    // Score-Popups im Weltkoordinatensystem (folgen dem offsetY-Translate)
    updateAndDrawPopups(c, instance);

    c.restore();  // Ende offsetY-translate

    // Vignette über allem
    drawVignette(c);

    // Screen-Flash (Level-Up)
    drawFlash(c, instance);

    c.restore(); // Shake-restore

    drawScore(instance);
}

/* =======================================================
   Update
======================================================= */
function updateAll(instance, dt) {
    if (paused) return;
    if (!instance || !instance.input) return;

    const state = instance.state;
    if (!state.ida || state.gameOver) return;

    spawnFallingThing(instance, state.level);
    state.ida.update();
    state.ida.y = Math.min(state.ida.y, cssHeight(instance) - state.ida.h);

    // Parallax
    const BG_MAX_OFFSET = 30;
    const idaCenter     = state.ida.x + state.ida.w / 2;
    const idaNorm       = idaCenter / DESIGN_W;
    instance.bgOffsetTarget = (idaNorm - 0.5) * 2 * BG_MAX_OFFSET;
    instance.bgOffsetX += (instance.bgOffsetTarget - instance.bgOffsetX) * 0.08;

    const scoreBeforeOdo = state.score;
    if (state.odo) {
        const alive = state.odo.update(cssHeight(instance), dt, {
            state,
            lumpsParam: state.lumps,
            playOdoCollect,
            playCollect
        });
        if (!alive || state.odo.dead) state.odo = null;
    }
    // Odo hat Bollen eingesammelt → Popup über Odo
    if (state.score > scoreBeforeOdo && state.odo) {
        const gained = state.score - scoreBeforeOdo;
        spawnScorePopup(
            instance,
            state.odo.x + state.odo.w / 2,
            state.odo.y - 10,
            "+" + gained
        );
    }

    // Score vor updateLumps merken → Popup wenn gestiegen
    const scoreBefore = state.score;
    updateLumps(instance, dt);
    const scoreAfterLumps = state.score;
    updateObstacles(instance, dt);
    const scoreAfterObstacles = state.score;

    // Obstacle-Treffer → Shake
    if (scoreAfterObstacles < scoreAfterLumps) {
        triggerShake(instance, 7, 300);
    }

    // Lump gesammelt durch updateLumps → Popup
    const scoreAfter = scoreAfterObstacles;
    if (scoreAfter > scoreBefore && state.ida) {
        const gained = scoreAfter - scoreBefore;
        spawnScorePopup(
            instance,
            state.ida.x + state.ida.w / 2,
            state.ida.y - 10,
            "+" + gained
        );
        triggerCollectGlow(instance);
    }

    state.ida.handleIdaCollecting(state);

    // Collect-Glow auch bei Ida-Collecting (direkte Kollision)
    const scoreAfter2 = state.score;
    if (scoreAfter2 > scoreAfter && state.ida) {
        const gained2 = scoreAfter2 - scoreAfter;
        spawnScorePopup(
            instance,
            state.ida.x + state.ida.w / 2,
            state.ida.y - 10,
            "+" + gained2
        );
        triggerCollectGlow(instance);
    }

    checkLevelUp(instance);

    if (!state.gameOver && instance.overflow.overflowReached()) {
        triggerGameOver(instance);
    }
}

function checkLevelUp(instance) {
    const now = performance.now();
    if (now - (instance.lastLevelUpTime || 0) < LEVELUP_DEBOUNCE_MS) return;
    if (instance.state.score < instance.state.nextLevelScore) return;

    instance.lastLevelUpTime = now;
    instance.state.level++;
    instance.state.nextLevelScore  += 100;
    instance.state.fallSpeedMultiplier *= LEVEL_SPEED_FACTOR;
    bpmFactor *= 1.06;

    // Level-Up Flash
    triggerFlash(instance, "rgba(255,255,180,0.6)", 350);

    loader.setLevel(instance.state.level);
    loader.loadResourcesForLevel(instance.state.level).then(res => {
        if (res.bg) instance.state.backgroundImage = res.bg;
        startMusicForLevel(instance.state.level);
    });
}

/* =======================================================
   Game-Loop Callback
======================================================= */
const logic = {
    update(instance, dt) {
        if (!instance || !instance.input) return;

        const state      = instance.state;
        const inputState = instance.input.poll(instance.colorMode === "red" ? 1 : 0);

        if (inputState.pause) togglePause(instance);
        if (paused)           return;
        if (state.gameOver)   return;

        if (inputState.hit) {
            handleIdaHit(instance, instance.suffix === "1" ? "2" : "1");
        }

        const nowMs = Date.now();
        if (inputState.boost)  { state.boost.active  = true; state.boost.until  = nowMs + 1000; }
        if (inputState.magnet) { state.magnet.active = true; state.magnet.until = nowMs + 3000; }
        if (state.boost.active  && nowMs > state.boost.until)  state.boost.active  = false;
        if (state.magnet.active && nowMs > state.magnet.until) state.magnet.active = false;

        if      (inputState.left  && !inputState.right) state.dir = -1;
        else if (inputState.right && !inputState.left)  state.dir =  1;
        else                                             state.dir =  0;

        updateAll(instance, dt);
    }
};

/* =======================================================
   Game Over
======================================================= */
function triggerGameOver(instance) {
    if (instance.state.gameOver) return;
    instance.state.gameOver     = true;
    instance.state.gameOverTime = performance.now();
    triggerShake(instance, 12, 600);
    if (typeof playGameOverJingle === "function") playGameOverJingle();
    startGameOverAnimation(instance);
    // Highscore-Lightbox nach 3,5s — Animation läuft zuerst
    if (typeof showHighscoreOverlay === "function") {
        showHighscoreOverlay(instance.state.score, 3500);
    } else {
        bindGameOverRestart(instance);
    }
}

function startGameOverAnimation(instance) {
    instance.gameOverAnim = new StartScreenAnimation(instance.canvas, "gameover_sprites.png", DESIGN_W, WORLD_H);
    instance.gameOverAnim.start(9);
    instance.gameOverAnim.allowAnimation();
}

function bindGameOverRestart(instance) {
    const restart = () => { window.location.reload(); };
    window.addEventListener("keydown", restart, { once: true });
    instance.canvas.addEventListener("pointerdown", restart, { once: true });
}

/* =======================================================
   Instanz-Initialisierung
======================================================= */
window.addEventListener('load', () => { initGameInstances(); });

function initGameInstances() {
    if (document.querySelector('#multiGameContainer')) {
        const i1 = createInstance('1', 'yellow');
        const i2 = createInstance('2', 'red');
        if (i1 && i2) {
            gameInstances = [i1, i2];
            scaleFrameMulti(i1);
            scaleFrameMulti(i2);
            tryAutoStartForInstance(i1);
            tryAutoStartForInstance(i2);
        }
    } else {
        const instance = createInstance('', 'yellow');
        if (instance) {
            gameInstances = [instance];
            canvas      = instance.canvas;
            ctx         = instance.ctx;
            frameEl     = instance.frameEl;
            overflow    = instance.overflow;
            state       = instance.state;
            input       = instance.input;
            overlay     = document.getElementById('startOverlay');
            startButton = document.getElementById('startButton');
            scaleFrame();
            resizeCanvas();
            tryAutoStartForInstance(instance);
        }
    }
}

async function tryAutoStartForInstance(instance) {
    const overlayEl     = document.getElementById(`startOverlay${instance.suffix}`);
    const startButtonEl = document.getElementById(`startButton${instance.suffix}`);
    if (!overlayEl) return console.error(`startOverlay${instance.suffix} nicht gefunden!`);

    overlayEl.style.display = "flex";

    preloadIdaWalk(instance);
    preloadIdaIce(instance);
    preloadIdaPresent(instance);
    loader.loadResourcesForLevel(1);

    await waitForSprites();
    assignSpritesToInstance(instance);

    instance.startAnim.allowAnimation(500);

    // Only fade the poster once startAnim has drawn frame 0 — prevents black flash
    const poster = document.getElementById('startPoster' + instance.suffix);
    if (poster) {
        const tryFade = () => {
            if (!instance.startAnim._ready) { setTimeout(tryFade, 50); return; }
            requestAnimationFrame(() => {
                poster.style.transition = 'opacity 0.4s';
                poster.style.opacity = '0';
                setTimeout(() => poster.remove(), 400);
            });
        };
        tryFade();
    }

    let started = false;
    const startNow = async () => {
        if (started) return;
        started = true;

        ensureAudioContext();
        audioAllowed = true;
        if (loader.getCurrentResources().music) {
            startMusicForLevel(1);
        } else {
            loader.loadResourcesForLevel(1).then(() => { if (audioAllowed) startMusicForLevel(1); });
        }

        instance.state.level          = 1;
        instance.state.score          = 0;
        instance.state.nextLevelScore = 100;

        instance.state.ida = new Ida({
            x: Math.max(0, (cssWidth(instance) - (idaWalkFrameW / 2 || 100)) / 2),
            y: cssHeight(instance) - 40,
            w: idaWalkFrameW / 2 || 100,
            h: idaWalkFrameH / 2 || 100,
            walkFrames:    instance.idaWalkFrames    || [],
            frozenFrames:  instance.idaIceFrames     || [],
            presentFrames: instance.idaPresentFrames || [],
            speed: 4,
            overflow: instance.overflow
        });
        instance.state.ida.posLimitLeft  = 0;
        instance.state.ida.posLimitRight = cssWidth(instance) - instance.state.ida.w;

        instance.startAnim.stop();
        overlayEl.style.display = "none";
        instance.state.gameStarted = true;
        cacheInstanceSize(instance);
        // Remove start overlay canvas after game loop has drawn its first frame
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (instance._startCanvas) { instance._startCanvas.remove(); instance._startCanvas = null; }
        }));

        // Megaplatsch-Shake: playMegaPlatschSound patchen
        const _origMegaPlatsch = window.playMegaPlatschSound || playMegaPlatschSound;
        window.playMegaPlatschSound = function() {
            _origMegaPlatsch();
            gameInstances.forEach(inst => triggerShake(inst, 11, 550));
        };

        if (!instance.loop) {
            instance.loop = new GameLoop({
                instance,
                logic,
                renderer: { draw() { drawAllForInstance(instance); } }
            });
            instance.loop.start();
        }
    };

    startButtonEl.addEventListener("click",   startNow, { once: true });
    overlayEl.addEventListener("pointerdown", startNow, { once: true });
    window.addEventListener("keydown", function onKey() {
        window.removeEventListener("keydown", onKey);
        startNow();
    });
}

/* =======================================================
   Obstacle-Score-Abfall → Shake
   Wir erweitern updateObstacles aus obstacle.js:
   Score-Änderung nach updateObstacles prüfen.
   (in updateAll bereits score-delta gemessen,
    wir fügen Shake bei negativem Delta hinzu)
======================================================= */

/* =======================================================
   Resize
======================================================= */
window.addEventListener("resize", () => {
    scaleFrame();
    resizeCanvas();
    gameInstances.forEach(cacheInstanceSize);
});

// Pre-scale immediately — frameEl isn't set via initGameInstances yet (that runs on load),
// so set it directly here to avoid the unstyled flash.
frameEl = document.getElementById('gameFrame');
scaleFrame();
