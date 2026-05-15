/* -----------------------------
 Sound and music
 ----------------------------- */

/* ---------- Audio helpers ---------- */
let bpmFactor = 1.0;

// Gemeinsame WaveShaper-Kurven — einmalig berechnet, nie neu allokiert
const WAVESHAPER_TANH_SOFT = (() => {
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) c[i] = Math.tanh((i - 128) / 32);
    return c;
})();
const WAVESHAPER_TANH_MED = (() => {
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) c[i] = Math.tanh((i - 128) / 20);
    return c;
})();
const WAVESHAPER_TANH_HARD = (() => {
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) c[i] = Math.tanh((i - 128) / 10);
    return c;
})();

// ===== Music =====
let musicStarted = false;
let musicPaused = true;
let audioAllowed = false;

// ===== sound =====
const SFX_VOLUME = 1.8;
const MUSIC_BASE_RATE = 1.0;
const MUSIC_RATE_STEP = 0.05;
const MUSIC_MAX_RATE  = 2;

/* ================================================================
   ANALOG SIMULATOR
   ================================================================
   Xorshift32 PRNG — 3 Bit-Operationen, sehr schnell, kein Float-
   Division. nextAnalog() gibt den aktuellen Jitter-Wert zurück und
   zieht sofort den nächsten Rohwert nach. Dadurch bekommt jeder
   Soundparameter (Frequenz, Dauer, Gain, LFO …) einen unabhängigen
   Wert — wie Bauteiltoleranzen in echter analoger Hardware.

   Hilfsfunktionen:
     af(freq)  → Frequenz   ±0.6 %
     at(time)  → Zeitdauer  ±1.0 %
     ag(gain)  → Lautstärke ±1.2 %
================================================================ */

let _analogSeed = 0xDEADBEEF;

function _analogRand() {
    // Xorshift32
    _analogSeed ^= _analogSeed << 13;
    _analogSeed ^= _analogSeed >>> 17;
    _analogSeed ^= _analogSeed << 5;
    return (_analogSeed >>> 0) / 0xFFFFFFFF; // 0 … 1
}

// Rohwert −1 … 1, wird nach jeder Verwendung neu gezogen
let _analogRaw = (_analogRand() - 0.5) * 2;

function nextAnalog(scale) {
    const val  = _analogRaw * scale;
    _analogRaw = (_analogRand() - 0.5) * 2; // sofort neuer Wert
    return val;
}

function af(freq) { return freq * (1 + nextAnalog(0.014)); }  // ±1.4 % Tonhöhe
function at(time) { return time * (1 + nextAnalog(0.022)); }  // ±2.2 % Länge
function ag(gain) { return gain * (1 + nextAnalog(0.025)); }  // ±2.5 % Lautstärke

/* ================================================================ */

/* ---------------- SOUND REGISTRY ---------------- */
const obstacleSoundMap = {
    0: playObstacleAbsperrung,
    1: playObstaclePylon,
    2: playObstacleIce,
    3: playObstacleBomb,
    4: playObstacleElectric,
    5: playObstacleNail,
    6: playObstacleSkull,
    7: playObstaclePresent
};

function applyMusicTempoForLevel(level) {
    if (!bgMusic) return;
    const steps = Math.floor((level - 1) / 5);
    bgMusic.playbackRate = Math.min(
        MUSIC_BASE_RATE + steps * MUSIC_RATE_STEP,
        MUSIC_MAX_RATE
    );
}

function startMusicForLevel(level) {
    const res = loader.getCurrentResources();
    if (!res || !res.music) { console.warn("startMusicForLevel: no music"); return; }

    if (bgMusic && bgMusic !== res.music) {
        try { bgMusic.pause(); bgMusic.currentTime = 0; } catch {}
    }

    bgMusic = res.music;
    musicStarted = false;

    if (!audioAllowed) return;

    try {
        bgMusic.loop   = true;
        bgMusic.volume = 0.7;
        bgMusic.play()
            .then(() => { musicStarted = true; })
            .catch(err => { console.warn("Music play blocked:", err); });
    } catch (err) {
        console.warn("Music start exception:", err);
    }
}

window.audioCtx = null;
function ensureAudioContext() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { console.error("AudioContext nicht unterstützt!"); return null; }

        if (window.audioCtx instanceof Ctx) {
            if (window.audioCtx.state === "suspended") window.audioCtx.resume().catch(() => {});
            return window.audioCtx;
        }

        window.audioCtx = new Ctx();
        if (window.audioCtx.state === "suspended") window.audioCtx.resume().catch(() => {});
        return window.audioCtx;

    } catch (err) {
        console.warn("AudioContext create FAILED:", err);
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            window.audioCtx = new Ctx();
            return window.audioCtx;
        } catch (fatal) {
            console.error("FATAL: Kein AudioContext möglich!", fatal);
            return null;
        }
    }
}

window.addEventListener("click",      () => { ensureAudioContext(); });
window.addEventListener("touchstart", () => { ensureAudioContext(); });
window.addEventListener("keydown",    () => { ensureAudioContext(); }, { once: true });

/* ================================================================
   GAME SOUNDS
   Alle Parameter laufen durch af() / at() / ag().
   Da nextAnalog() nach jedem Aufruf automatisch einen neuen Wert
   zieht, klingen zwei aufeinanderfolgende Auslösungen desselben
   Sounds nie exakt gleich.
================================================================ */

function playObstacleSound(type) {
    const fn = obstacleSoundMap[type];
    if (!fn) { console.warn("No sound mapped for obstacle type:", type); return; }
    try { fn(); } catch (e) { console.warn("Obstacle sound error:", e); }
}

/* ── Collect ── */
function playCollect() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.16);

    const osc = ctxA.createOscillator();
    osc.type  = "square";
    osc.frequency.setValueAtTime(af(1000), now);
    osc.frequency.exponentialRampToValueAtTime(af(1600), now + at(0.12));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.22), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const sh = ctxA.createWaveShaper();
    sh.curve = WAVESHAPER_TANH_SOFT;

    osc.connect(sh).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Odo Collect ── */
function playOdoCollect() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.36);

    const osc = ctxA.createOscillator();
    osc.type  = "square";
    osc.frequency.setValueAtTime(af(400), now);
    osc.frequency.exponentialRampToValueAtTime(af(1000), now + at(0.32));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.22), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const sh = ctxA.createWaveShaper();
    sh.curve = WAVESHAPER_TANH_SOFT;

    osc.connect(sh).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Drop ── */
function playDropSound() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.14);

    const osc = ctxA.createOscillator();
    osc.type  = "sawtooth";
    osc.frequency.setValueAtTime(af(300), now);
    osc.frequency.exponentialRampToValueAtTime(af(120), now + at(0.10));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.14), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const lp = ctxA.createBiquadFilter();
    lp.type  = "lowpass";
    lp.frequency.setValueAtTime(af(1800), now);

    osc.connect(lp).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Boost ── */
function playBoostSound() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.22);

    const osc = ctxA.createOscillator();
    osc.type  = "sawtooth";
    osc.frequency.setValueAtTime(af(160), now);
    osc.frequency.exponentialRampToValueAtTime(af(480), now + at(0.18));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.14), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const lp = ctxA.createBiquadFilter();
    lp.type  = "lowpass";
    lp.frequency.setValueAtTime(af(1800), now);

    osc.connect(lp).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Magnet ── */
function playMagnetSound() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.45);

    const oscA = ctxA.createOscillator();
    oscA.type  = "triangle";
    oscA.frequency.setValueAtTime(af(600), now);
    oscA.frequency.exponentialRampToValueAtTime(af(420), now + at(0.4));

    const gainA = ctxA.createGain();
    gainA.gain.setValueAtTime(ag(0.08), now);
    gainA.gain.exponentialRampToValueAtTime(0.001, now + dur);

    oscA.connect(gainA).connect(ctxA.destination);
    oscA.start(now); oscA.stop(now + dur);
}

/* ── Absperrung ── */
function playObstacleAbsperrung() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.42);

    const osc = ctxA.createOscillator();
    osc.type  = "sine";
    osc.frequency.setValueAtTime(af(420), now);
    osc.frequency.exponentialRampToValueAtTime(af(180), now + at(0.28));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.25 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const sh = ctxA.createWaveShaper();
    sh.curve = WAVESHAPER_TANH_MED;

    osc.connect(sh).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Pylon ── */
function playObstaclePylon() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.32);

    const osc = ctxA.createOscillator();
    osc.type  = "square";
    osc.frequency.setValueAtTime(af(900), now);
    osc.frequency.exponentialRampToValueAtTime(af(1500), now + at(0.22));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.22 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Ice ── */
function playObstacleIce() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(1.88);

    const osc = ctxA.createOscillator();
    osc.type  = "triangle";
    osc.frequency.setValueAtTime(af(1400), now);
    osc.frequency.exponentialRampToValueAtTime(af(700), now + at(0.32));

    // LFO für eisigen Charakter — Jitter auch auf LFO-Frequenz und -Tiefe
    const lfo  = ctxA.createOscillator();
    lfo.type   = "sine";
    lfo.frequency.value = af(5.5);
    const lfoG = ctxA.createGain();
    lfoG.gain.value     = ag(8);
    lfo.connect(lfoG).connect(osc.frequency);

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.18 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctxA.destination);
    osc.start(now); lfo.start(now);
    osc.stop(now + dur); lfo.stop(now + dur);
}

/* ── Bomb ── */
function playObstacleBomb() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.55);

    const osc = ctxA.createOscillator();
    osc.type  = "sawtooth";
    osc.frequency.setValueAtTime(af(160), now);
    osc.frequency.exponentialRampToValueAtTime(af(50), now + at(0.40));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.35 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const sh = ctxA.createWaveShaper();
    sh.curve = WAVESHAPER_TANH_HARD;

    osc.connect(sh).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Electric ── */
function playObstacleElectric() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.28);

    // Zwei leicht verstimmte Oszillatoren — jeder af()-Aufruf
    // zieht einen eigenen Zufallswert → organisches Knistern
    const osc1 = ctxA.createOscillator();
    osc1.type  = "sawtooth";
    osc1.frequency.setValueAtTime(af(1700), now);
    osc1.frequency.exponentialRampToValueAtTime(af(600), now + at(0.22));

    const osc2 = ctxA.createOscillator();
    osc2.type  = "square";
    osc2.frequency.setValueAtTime(af(1715), now);
    osc2.frequency.exponentialRampToValueAtTime(af(612), now + at(0.22));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.13 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(gain); osc2.connect(gain);
    gain.connect(ctxA.destination);
    osc1.start(now); osc2.start(now);
    osc1.stop(now + dur); osc2.stop(now + dur);
}

/* ── Nail ── */
function playObstacleNail() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.28);

    const osc = ctxA.createOscillator();
    osc.type  = "triangle";
    osc.frequency.setValueAtTime(af(2000), now);
    osc.frequency.exponentialRampToValueAtTime(af(600), now + at(0.22));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.16 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Skull ── */
function playObstacleSkull() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.55);

    const osc = ctxA.createOscillator();
    osc.type  = "sine";
    osc.frequency.setValueAtTime(af(260), now);
    osc.frequency.exponentialRampToValueAtTime(af(80), now + at(0.40));

    // Langsames Vibrato mit eigenem Jitter auf Rate und Tiefe
    const vib  = ctxA.createOscillator();
    vib.type   = "sine";
    vib.frequency.value = af(4.2);
    const vibG = ctxA.createGain();
    vibG.gain.value     = ag(6);
    vib.connect(vibG).connect(osc.frequency);

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.30 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctxA.destination);
    osc.start(now); vib.start(now);
    osc.stop(now + dur); vib.stop(now + dur);
}

/* ── Present ── */
function playObstaclePresent() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.33);

    const osc1 = ctxA.createOscillator();
    osc1.type  = "square";
    osc1.frequency.setValueAtTime(af(800), now);

    const osc2 = ctxA.createOscillator();
    osc2.type  = "square";
    osc2.frequency.setValueAtTime(af(1200), now);

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.22 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(gain); osc2.connect(gain);
    gain.connect(ctxA.destination);

    osc1.start(now); osc2.start(now + at(0.03));
    osc1.stop(now + dur); osc2.stop(now + dur);
}

/* ── Mega-Platsch ── */
function playMegaPlatsch() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now      = ctxA.currentTime;
    const totalDur = at(1.4);

    const bass = ctxA.createOscillator();
    bass.type  = "sawtooth";
    bass.frequency.setValueAtTime(af(140), now);
    bass.frequency.exponentialRampToValueAtTime(af(25), now + at(1.2));

    const sub = ctxA.createOscillator();
    sub.type  = "sine";
    sub.frequency.setValueAtTime(af(55), now);
    sub.frequency.exponentialRampToValueAtTime(af(20), now + at(1.2));

    const trem = ctxA.createOscillator();
    trem.type  = "sine";
    trem.frequency.setValueAtTime(af(11), now);

    const tremGain      = ctxA.createGain();
    tremGain.gain.value = ag(0.55);

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.55 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

    trem.connect(tremGain).connect(gain.gain);
    bass.connect(gain); sub.connect(gain);
    gain.connect(ctxA.destination);

    bass.start(now); sub.start(now); trem.start(now);
    bass.stop(now + totalDur); sub.stop(now + totalDur); trem.stop(now + totalDur);
}

function playMegaPlatschSound() { playMegaPlatsch(); }

/* ── Game Over Jingle ── */
function playGameOverJingle() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    stopMusic();
    const now = ctx.currentTime;

    const notes = [
        { freq: 523.25, start: 0.0,  dur: 0.22 },
        { freq: 440.00, start: 0.26, dur: 0.22 },
        { freq: 349.23, start: 0.52, dur: 0.22 },
        { freq: 329.63, start: 0.78, dur: 0.28 },
        { freq: 293.66, start: 1.10, dur: 1.20 },
        { freq: 220.00, start: 2.40, dur: 2.00 },
    ];

    notes.forEach(n => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type   = "sawtooth";

        const noteFreq = af(n.freq);
        const noteDur  = at(n.dur);

        if (n.dur >= 1.0) {
            const vib     = ctx.createOscillator();
            const vibGain = ctx.createGain();
            vib.type = "sine";
            vib.frequency.value = af(n.freq > 250 ? 5.5 : 4.0);
            vibGain.gain.value  = ag(n.freq > 250 ? 10  : 7);
            vib.connect(vibGain).connect(osc.frequency);
            vib.start(now + n.start + at(0.15));
            vib.stop( now + n.start + noteDur + 0.1);
        }

        osc.frequency.setValueAtTime(noteFreq, now + n.start);
        if (n.start > 2.0) {
            osc.frequency.exponentialRampToValueAtTime(noteFreq * 0.6, now + n.start + noteDur);
        }

        gain.gain.setValueAtTime(ag(0.30), now + n.start);
        gain.gain.setValueAtTime(ag(0.30), now + n.start + noteDur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + noteDur + 0.1);

        const lp = ctx.createBiquadFilter();
        lp.type  = "lowpass";
        lp.frequency.value = af(1600);

        osc.connect(lp).connect(gain).connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop( now + n.start + noteDur + 0.15);
    });

    const bass = ctx.createOscillator();
    bass.type  = "sine";
    bass.frequency.setValueAtTime(af(80), now + 2.5);
    bass.frequency.exponentialRampToValueAtTime(af(28), now + 4.8);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(ag(0.28), now + 2.5);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);

    bass.connect(bassGain).connect(ctx.destination);
    bass.start(now + 2.5); bass.stop(now + 5.1);
}

/* ── Bulldozer Sweep ── */
function playBulldozerSweep() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = at(1.1);

    const osc = ctx.createOscillator();
    osc.type  = "square";
    osc.frequency.setValueAtTime(af(120), now);
    osc.frequency.exponentialRampToValueAtTime(af(60),  now + at(0.6));
    osc.frequency.exponentialRampToValueAtTime(af(40),  now + at(1.0));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(ag(0.28), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Hit Sound ── */
function playHitSound() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    const now = ctxA.currentTime;
    const dur = at(0.55);

    const osc = ctxA.createOscillator();
    osc.type  = "sawtooth";
    osc.frequency.setValueAtTime(af(260), now);
    osc.frequency.exponentialRampToValueAtTime(af(50), now + at(0.40));

    const gain = ctxA.createGain();
    gain.gain.setValueAtTime(ag(0.35 * SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const sh = ctxA.createWaveShaper();
    sh.curve = WAVESHAPER_TANH_HARD;

    osc.connect(sh).connect(gain).connect(ctxA.destination);
    osc.start(now); osc.stop(now + dur);
}

/* ── Stop Music ── */
function stopMusic() {
    try {
        if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; }
    } catch (e) {
        console.warn("Fehler beim Stoppen der Musik:", e);
    }
    musicPaused  = true;
    musicStarted = false;
}

/* ── Self-Test ── */
window._audioSelftest = function() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = af(440);
    gain.gain.value     = ag(0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + at(0.2));
    console.log("SFX Test ausgeführt");
};

/* ── Analog-Diagnose (Konsole) ── */
window._analogTest = function(n = 12) {
    console.log("=== Analog-Simulator Jitter-Test ===");
    for (let i = 0; i < n; i++) {
        console.log(
            `af(440)=${af(440).toFixed(2)} Hz  ` +
            `at(0.5)=${at(0.5).toFixed(4)} s  ` +
            `ag(0.5)=${ag(0.5).toFixed(4)}`
        );
    }
};
