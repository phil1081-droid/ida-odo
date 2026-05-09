/* game-state.js
   – Spielkonstanten (DESIGN_W, WORLD_H, …)
   – Lump-Animations-Globals
   – GameState-Konstruktor
*/

// =======================================================
// Konstanten — überall verfügbar, nie aus Canvas lesen!
// =======================================================
const DESIGN_W          = 390;
const DESIGN_H          = 844;
const CONTROLS_H        = 140;
const WORLD_H           = DESIGN_H - CONTROLS_H;  // 704

const ANIM_FPS          = 10;
const FRAME_FALL_BASE   = 2.2;
const LEVEL_SPEED_FACTOR = 1.1;

const ODO_SPAWN_PER_BOLL   = 0.05;
const LEVELUP_DEBOUNCE_MS  = 800;

// Lump-Animations-Globals (werden nach Sprite-Laden überschrieben)
let lumpAnimIndex   = 0;
let lumpLastAnimTS  = performance.now();
const frameDelay    = 80;   // ~12.5 FPS

// =======================================================
// GameState
// =======================================================
function GameState() {
    /* --- lifecycle --- */
    this.gameStarted = false;
    this.paused      = false;
    this.gameover    = false;

    /* --- score & progression --- */
    this.score           = 0;
    this.level           = 1;
    this.nextLevelScore  = 100;
    this.lastLevelUpTime = 0;

    /* --- player & entities --- */
    this.ida       = null;
    this.odo       = null;
    this.lumps     = [];
    this.obstacles = [];

    /* --- movement & physics --- */
    this.dir                 = 0;
    this.fallSpeedMultiplier = 1.0;

    /* --- powerups --- */
    this.boost  = { active: false, until: 0 };
    this.magnet = { active: false, until: 0, range: 120, pull: 2 };

    /* --- lump internals --- */
    this.nextLumpId        = 1;
    this.activeBlinkLumpId = null;

    /* --- music --- */
    this.musicPlaying = false;
}
