/* -----------------------------------------------------------
   overflow.js — Überlauf-Management
 Jeder Megaplatsch erzeugt eine Pfütze. Diese Pfützen werden geschichet.
 Sind zu viele Pfützen aufeinandergestapelt, ist das Spiel aus. Ein
 Geschenk entfernt eine Pfütze.
----------------------------------------------------------- */

(function (global) {

 class OverflowManager {
     constructor(maxLevels = 12) {
         this.maxLevels = maxLevels;

         // Statische Pfützen (fertige Platsche)
         this.puddleStack = [];

         // Aktive Megaplatsch-Animation
         this.activePlatsch = null;

         this.canvasWidth = 0;
         this.canvasHeight = 0;
         this.levelHeightFactor = 1 / this.maxLevels;
     }

     /* Canvas-Größen -> für sauberes Stapeln */
     setCanvasSize(w, h) {
         this.canvasWidth = w;
         this.canvasHeight = h;
     }
     setCanvasHeight(h) { this.setCanvasSize(this.canvasWidth, h); }

     /* ❗Startet den aktiven MegaPlatsch */
     startMegaPlatsch(finalFrameList, config) {
         if (!finalFrameList || !finalFrameList.length) return;

         this.activePlatsch = {
             frames: finalFrameList,
             frameIndex: 0,
             holdFrame: config.holdFrame,
             holdReached: false,
             x: 0,

             y: -config.frameH * config.holdWeight + config.frameH * config.heightWeight,

             speed: config.speed,
             drawW: config.drawW,
             drawH: config.drawH,
             done: false,
             addedToPuddles: false
         };
     }

     /* ❗ Wird immer im drawAll nach drawGround() aufgerufen */
     drawPuddles(ctx) {
         if (!this.puddleStack.length) return;

         const perLayer = this.canvasHeight / this.maxLevels;

         for (let i = 0; i < this.puddleStack.length; i++) {
             const puddle = this.puddleStack[i];
             if (!puddle) continue;

             const fh = puddle.height;
             const y = this.canvasHeight - fh - (i * perLayer);

             ctx.drawImage(puddle, 0, y, puddle.width, puddle.height);
         }
     }

     /* ❗Aktiven MegaPlatsch zeichnen */
     drawActiveMegaPlatsch(ctx) {
         const p = this.activePlatsch;
         if (!p || p.done) return;

         // Fallbewegung
         const targetY = this.canvasHeight * 0.13;
         if (!p.holdReached && p.y < targetY) {
             p.y += p.speed;
             if (p.y >= targetY) {
                 p.holdReached = true;
                 p.y = targetY;
                 if (typeof playMegaPlatschSound === "function") {
                     playMegaPlatschSound();
                 }
             }
         }

         // Frame-Auswahl
         let fIdx = p.frameIndex;
         if (!p.holdReached) fIdx = Math.min(fIdx, p.holdFrame);

         const frame = p.frames[fIdx];
         if (!frame) return;

         ctx.drawImage(frame, 0, p.y, p.drawW, p.drawH);

         // Frame weiterlaufen lassen
         if (!p.holdReached) {
             p.frameIndex++;
             if (p.frameIndex >= p.frames.length) {
                 p.frameIndex = p.frames.length - 1;
             }
         }

         // ❗Wenn fertig – Pfütze erzeugen
         if (p.holdReached && !p.addedToPuddles) {
             const puddleCanvas = document.createElement("canvas");
             puddleCanvas.width = p.drawW;
             puddleCanvas.height = p.drawH;
             const cctx = puddleCanvas.getContext("2d");
             cctx.drawImage(frame, 0, 0, p.drawW, p.drawH);

             this.puddleStack.push(puddleCanvas);

             if (this.puddleStack.length > this.maxLevels) {
                 this.puddleStack.length = this.maxLevels;
             }

             p.addedToPuddles = true;
             p.done = true;
         }
     }

     /* ❗Offset für das Hochrücken */
     getOffsetY() {
         if (!this.canvasHeight) return 0;

         const perLayer = this.canvasHeight / this.maxLevels;
         return this.puddleStack.length * perLayer * 0.4;
     }

     /* ❗Geschenk: oberste Pfütze löschen */
     removeTop() {
         if (this.puddleStack.length) {
             this.puddleStack.pop();
         }
     }

     reset() {
         this.puddleStack = [];
         this.activePlatsch = null;
     }
 }

 global.OverflowManager = OverflowManager;

 })(window);
