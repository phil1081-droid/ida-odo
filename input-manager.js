class InputManager {
    constructor() {
        this._ac = new AbortController();
        this._bind();
        this.reset();
    }

    destroy() { this._ac.abort(); }

    reset() {
        this.left  = [false, false];
        this.right = [false, false];

        this._boostQueued  = [false, false];
        this._magnetQueued = [false, false];

        this._scoopDown    = [false, false];
        this._scoopTimer   = [null,  null];
        this._scoopStartTs = [0, 0];

        this._fireHitEvent = [false, false];
        this._disabled     = [false, false];

        // Pre-allokierte Snapshots — einmal erzeugt, nie neu
        this._snapshot = [
            { left: false, right: false, boost: false, magnet: false, hit: false },
            { left: false, right: false, boost: false, magnet: false, hit: false }
        ];
    }

    /* ───────────────────────────────
       Public API
    ─────────────────────────────── */

    poll(i = 0) {
        const snapshot    = this._snapshot[i];
        snapshot.left     = this.left[i];
        snapshot.right    = this.right[i];
        snapshot.boost    = this._boostQueued[i];
        snapshot.magnet   = this._magnetQueued[i];
        snapshot.hit      = this._fireHitEvent[i];
        this._boostQueued[i]  = false;
        this._magnetQueued[i] = false;
        this._fireHitEvent[i] = false;
        return snapshot;
    }

    disable() {
        this._disabled = [true, true];
        this._cancelScoop();
        this.left  = [false, false];
        this.right = [false, false];
    }

    enable() { this._disabled = [false, false]; }

    /* ───────────────────────────────
       Binding
    ─────────────────────────────── */

    _bind() {
        this._bindButton("leftBtn",  () => this._setLeft(true),  () => this._setLeft(false));
        this._bindButton("rightBtn", () => this._setRight(true), () => this._setRight(false));
        this._bindButton("scoopBtn", () => this._scoopDownHandler(), () => this._scoopUpHandler());

        if (document.querySelector('#multiGameContainer')) {
            this._bindButton("leftBtn1",  () => this._setLeft(true, 0),  () => this._setLeft(false, 0));
            this._bindButton("rightBtn1", () => this._setRight(true, 0), () => this._setRight(false, 0));
            this._bindButton("scoopBtn1", () => this._scoopDownHandler(0), () => this._scoopUpHandler(0));

            this._bindButton("leftBtn2",  () => this._setLeft(true, 1),  () => this._setLeft(false, 1));
            this._bindButton("rightBtn2", () => this._setRight(true, 1), () => this._setRight(false, 1));
            this._bindButton("scoopBtn2", () => this._scoopDownHandler(1), () => this._scoopUpHandler(1));
        }

        const sig = { signal: this._ac.signal };
        const pauseBtns = document.getElementsByClassName("pause-btn");
        for (let pauseBtn of pauseBtns) {
            pauseBtn.addEventListener("click", togglePause, sig);
        }

        window.addEventListener("keydown", e => this._onKeyDown(e), sig);
        window.addEventListener("keyup",   e => this._onKeyUp(e), sig);
        window.addEventListener("blur",    () => this._onBlur(), sig);
        document.addEventListener("visibilitychange", () => { if (document.hidden) this._onBlur(); }, sig);
    }

    _bindButton(id, down, up) {
        const el = document.getElementById(id);
        if (!el) return;
        const sig = this._ac.signal;
        const d = e => { e.preventDefault(); down(); };
        const u = e => { e.preventDefault(); up(); };
        el.addEventListener("pointerdown",   d, { signal: sig });
        el.addEventListener("pointerup",     u, { signal: sig });
        el.addEventListener("pointercancel", u, { signal: sig });
        // mouseleave entfernt: auf Android kann es bei minimaler Fingerbewegung
        // fälschlicherweise feuern und Long-Press (Magnet) in Short-Press (Boost) umwandeln.
        // pointercancel + pointerup mit implizitem Capture decken denselben Fall ab.
        el.addEventListener("touchstart",    d, { signal: sig, passive: false });
        el.addEventListener("touchend",      u, { signal: sig, passive: false });
    }

    /* ───────────────────────────────
       Direction
    ─────────────────────────────── */

    _setLeft(v, i = 0) {
        if (this._disabled[i]) return;
        this.left[i] = v;
        if (v) this.right[i] = false;
    }

    _setRight(v, i = 0) {
        if (this._disabled[i]) return;
        this.right[i] = v;
        if (v) this.left[i] = false;
    }

    /* ───────────────────────────────
       Scoop (short / long press)
    ─────────────────────────────── */

    _scoopDownHandler(i = 0) {
        if (this._disabled[i] || this._scoopDown[i]) return;
        this._scoopDown[i]    = true;
        this._scoopStartTs[i] = performance.now();
        this._scoopTimer[i]   = setTimeout(() => {
            this._scoopTimer[i] = null;
            this._queueMagnet(i);
        }, 1000);
    }

    _scoopUpHandler(i = 0) {
        if (!this._scoopDown[i]) return;
        if (this._scoopTimer[i]) {
            clearTimeout(this._scoopTimer[i]);
            this._scoopTimer[i] = null;
            this._queueBoost(i);
        }
        this._scoopDown[i] = false;
    }

    _cancelScoop(i = 0) {
        if (this._scoopTimer[i]) { clearTimeout(this._scoopTimer[i]); this._scoopTimer[i] = null; }
        this._scoopDown[i] = false;
    }

    _hit(i = 0) {
        if (this._disabled[i] || this._hitCooldown?.[i]) return;
        this._fireHitEvent[i] = true;
        this._hitCooldown = this._hitCooldown || [0, 0];
        this._hitCooldown[i] = true;
        setTimeout(() => { this._hitCooldown[i] = false; }, 500);
    }

    _queueBoost(i = 0)  { this._boostQueued[i]  = true; }
    _queueMagnet(i = 0) { this._magnetQueued[i] = true; }

    /* ───────────────────────────────
       Keyboard
    ─────────────────────────────── */

    _onKeyDown(e) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.repeat || this._disabled[0] || this._disabled[1]) return;
        switch (e.code) {
            case "ArrowLeft":  this._setLeft(true, 0);        e.preventDefault(); break;
            case "ArrowRight": this._setRight(true, 0);       e.preventDefault(); break;
            case "ArrowUp":    this._hit(0);                                       break;
            case "Space":
            case "Numpad0":    this._scoopDownHandler(0);     e.preventDefault(); break;
            case "KeyA":       this._setLeft(true, 1);        e.preventDefault(); break;
            case "KeyD":       this._setRight(true, 1);       e.preventDefault(); break;
            case "KeyW":       this._hit(1);                                       break;
            case "KeyS":       this._scoopDownHandler(1);     e.preventDefault(); break;
            case "Enter":      togglePause();                  e.preventDefault(); break;
        }
    }

    _onKeyUp(e) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        switch (e.code) {
            case "ArrowLeft":  this.left[0]  = false; break;
            case "ArrowRight": this.right[0] = false; break;
            case "Space":
            case "Numpad0":    this._scoopUpHandler(0); break;
            case "KeyA":       this.left[1]  = false; break;
            case "KeyD":       this.right[1] = false; break;
            case "KeyS":       this._scoopUpHandler(1); break;
        }
    }

    _onBlur() { this.disable(); this.enable(); }
}

/* ───────────────────────────────────────────────────────────
   handleIdaHit — Lump nach oben schleudern (Multiplay)
   Ausgelagert aus main.js, gehört zur Input-Reaktion.
─────────────────────────────────────────────────────────── */
function handleIdaHit(instance, targetInstanceId) {
    if (!instance.state.ida) return;
    let hitTriggered = false;

    for (let e of instance.state.lumps) {
        if (e.mode === "hit" || e.decisionMade) continue;

        const collides =
            e.x + e.w > instance.state.ida.x + instance.state.ida.w * 0.15 &&
            e.x       < instance.state.ida.x + instance.state.ida.w * 0.7  &&
            e.y + e.h > instance.state.ida.y + 10 &&
            e.y       < instance.state.ida.y + instance.state.ida.h * 0.8;

        if (collides && !hitTriggered) {
            e.mode = "hit";
            e.targetInstanceId = targetInstanceId;
            if (typeof playHitSound === "function") playHitSound();
            hitTriggered = true;
        }
    }
}

window.handleIdaHit = handleIdaHit;

/* ───────────────────────────────────────────────────────────
   togglePause — gehört zum Input-System
─────────────────────────────────────────────────────────── */
function togglePause() {
    // Kein Pause wenn alle Instanzen Game-Over haben
    if (typeof gameInstances !== 'undefined' && gameInstances.length &&
        gameInstances.every(i => i.state?.gameOver)) return;
    paused = !paused;
    const pauseBtns = document.getElementsByClassName("pause-btn");
    for (let pauseBtn of pauseBtns) {
        pauseBtn.textContent = paused ? "▶️" : "⏸";
    }
    if (paused) {
        // Level-Transition abbrechen bevor Pause-Overlay eingeblendet wird (kein Overlay-Stack)
        if (typeof adManager !== 'undefined') adManager.cancelLevelTransition?.();
        if (bgMusic) { bgMusic.pause(); musicPaused = true; }
        if (typeof adManager !== 'undefined') adManager.showPauseAd();
    } else {
        if (typeof adManager !== 'undefined') adManager.hidePauseAd();
        if (bgMusic && audioAllowed) {
            bgMusic.play().then(() => { musicPaused = false; musicStarted = true; }).catch(() => {});
        }
    }
}

/* ───────────────────────────────────────────────────────────
   Scroll-Schutz
─────────────────────────────────────────────────────────── */
(function () {
    const blockedKeys = new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Spacebar","PageUp","PageDown","Home","End"]);
    window.addEventListener("keydown", e => {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (blockedKeys.has(e.key)) e.preventDefault();
    }, { passive: false });
})();

/* ───────────────────────────────────────────────────────────
   Joy-Con (für Switch 2 — per POST /input aktivieren)
─────────────────────────────────────────────────────────── */
function applyJoyConEvent(data) {
    if (data.type === 'button') {
        if (data.button === '06') activateBoost();
        if (data.button === 'Y')  activateMagnet();
    }
}

