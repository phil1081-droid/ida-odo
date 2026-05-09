/* ==========================================================
   highscore.js
   – Tages-Highscore (localStorage, automatischer Tages-Reset)
   – Top 10 Einträge mit Name + Score
   – Lightbox-UI: erscheint nach Game-Over-Animation
   – Caching: letzter Name wird gespeichert
========================================================== */

const HS_KEY      = "ida_highscores_v1";
const HS_NAME_KEY = "ida_hs_lastname";
const HS_MAX      = 10;

/* ----------------------------------------------------------
   Datenzugriff
---------------------------------------------------------- */

function _getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function hsLoad() {
    try {
        const raw = localStorage.getItem(HS_KEY);
        if (!raw) return { day: _getTodayKey(), entries: [] };
        const data = JSON.parse(raw);
        // Tages-Reset
        if (data.day !== _getTodayKey()) return { day: _getTodayKey(), entries: [] };
        return data;
    } catch {
        return { day: _getTodayKey(), entries: [] };
    }
}

function hsSave(data) {
    try { localStorage.setItem(HS_KEY, JSON.stringify(data)); } catch {}
}

function hsAddEntry(name, score) {
    const data = hsLoad();
    data.entries.push({ name: name.trim().substring(0, 20) || "???", score });
    data.entries.sort((a, b) => b.score - a.score);
    data.entries = data.entries.slice(0, HS_MAX);
    hsSave(data);
    // Namen cachen für nächstes Mal
    try { localStorage.setItem(HS_NAME_KEY, name.trim().substring(0, 20)); } catch {}
    return data.entries;
}

function hsGetEntries() {
    return hsLoad().entries;
}

function hsCachedName() {
    try { return localStorage.getItem(HS_NAME_KEY) || ""; } catch { return ""; }
}

function hsRank(score) {
    const entries = hsGetEntries();
    if (entries.length < HS_MAX) return entries.length + 1;
    for (let i = 0; i < entries.length; i++) {
        if (score >= entries[i].score) return i + 1;
    }
    return null; // kein Platz in Top 10
}

/* ----------------------------------------------------------
   Lightbox HTML + CSS (wird einmalig ins DOM injiziert)
---------------------------------------------------------- */

function _injectStyles() {
    if (document.getElementById("hs-styles")) return;
    const style = document.createElement("style");
    style.id = "hs-styles";
    style.textContent = `
        #hs-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.4s ease;
            font-family: Arial, sans-serif;
        }
        #hs-overlay.hs-visible {
            opacity: 1;
            pointer-events: auto;
        }

        #hs-box {
            background: #1a1a2e;
            border: 2px solid #ffcc00;
            border-radius: 16px;
            padding: 24px 28px 20px;
            width: min(340px, 90vw);
            color: #fff;
            box-shadow: 0 8px 40px rgba(0,0,0,0.7);
            text-align: center;
        }

        #hs-box h2 {
            margin: 0 0 4px;
            font-size: 22px;
            color: #ffcc00;
            letter-spacing: 1px;
        }

        #hs-day-label {
            font-size: 12px;
            color: #aaa;
            margin-bottom: 16px;
        }

        #hs-score-line {
            font-size: 28px;
            font-weight: bold;
            color: #ffcc00;
            margin-bottom: 4px;
        }

        #hs-rank-line {
            font-size: 13px;
            color: #ccc;
            margin-bottom: 16px;
            min-height: 18px;
        }

        /* Namenseingabe */
        #hs-name-row {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
        }

        #hs-name-input {
            flex: 1;
            padding: 9px 12px;
            border-radius: 8px;
            border: 1.5px solid #ffcc00;
            background: #111;
            color: #fff;
            font-size: 16px;
            outline: none;
        }

        #hs-submit-btn {
            padding: 9px 14px;
            border-radius: 8px;
            border: none;
            background: #ffcc00;
            color: #000;
            font-weight: bold;
            font-size: 15px;
            cursor: pointer;
            white-space: nowrap;
        }
        #hs-submit-btn:active { opacity: 0.75; }

        /* Tabelle */
        #hs-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            margin-bottom: 18px;
        }
        #hs-table thead tr {
            color: #aaa;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        #hs-table th {
            padding: 3px 4px;
            text-align: left;
        }
        #hs-table th:last-child { text-align: right; }
        #hs-table td {
            padding: 5px 4px;
            border-top: 1px solid #333;
        }
        #hs-table td:last-child { text-align: right; }
        #hs-table tr.hs-highlight td { color: #ffcc00; font-weight: bold; }
        .hs-rank-num { color: #888; font-size: 12px; width: 22px; }

        #hs-restart-btn {
            display: block;
            width: 100%;
            padding: 11px;
            border-radius: 10px;
            border: none;
            background: #ffcc00;
            color: #000;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            margin-top: 4px;
        }
        #hs-restart-btn:active { opacity: 0.75; }

        #hs-saved-note {
            font-size: 12px;
            color: #8f8;
            min-height: 16px;
            margin-bottom: 8px;
        }
    `;
    document.head.appendChild(style);
}

function _buildOverlayDOM() {
    if (document.getElementById("hs-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "hs-overlay";

    overlay.innerHTML = `
        <div id="hs-box">
            <h2>🏆 Tageshighscore</h2>
            <div id="hs-day-label"></div>
            <div id="hs-score-line"></div>
            <div id="hs-rank-line"></div>
            <div id="hs-name-row">
                <input id="hs-name-input" type="text" maxlength="20"
                       placeholder="Dein Name" autocomplete="off"
                       autocorrect="off" autocapitalize="words" />
                <button id="hs-submit-btn">Eintragen</button>
            </div>
            <div id="hs-saved-note"></div>
            <table id="hs-table">
                <thead><tr>
                    <th>#</th><th>Name</th><th>Punkte</th>
                </tr></thead>
                <tbody id="hs-tbody"></tbody>
            </table>
            <button id="hs-restart-btn">Nochmal spielen</button>
        </div>
    `;

    document.body.appendChild(overlay);
}

/* ----------------------------------------------------------
   Tabelle rendern
---------------------------------------------------------- */

function _renderTable(entries, highlightName, highlightScore) {
    const tbody = document.getElementById("hs-tbody");
    if (!tbody) return;

    if (!entries.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#666;padding:12px">
            Noch keine Einträge heute</td></tr>`;
        return;
    }

    tbody.innerHTML = entries.map((e, i) => {
        const isMe = e.name === highlightName && e.score === highlightScore;
        return `<tr class="${isMe ? "hs-highlight" : ""}">
            <td class="hs-rank-num">${i + 1}</td>
            <td>${_esc(e.name)}</td>
            <td>${e.score}</td>
        </tr>`;
    }).join("");
}

function _esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* ----------------------------------------------------------
   Datumsanzeige
---------------------------------------------------------- */

function _todayLabel() {
    return new Date().toLocaleDateString("de-DE", {
        weekday: "long", day: "numeric", month: "long"
    });
}

/* ----------------------------------------------------------
   Haupt-API: showHighscoreOverlay(score, delayMs)
   – delayMs: wie lange die Game-Over-Animation laufen soll
     bevor die Lightbox erscheint (Standard: 3500ms)
---------------------------------------------------------- */

function showHighscoreOverlay(score, delayMs = 3500) {
    _injectStyles();
    _buildOverlayDOM();

    const overlay    = document.getElementById("hs-overlay");
    const scoreEl    = document.getElementById("hs-score-line");
    const rankEl     = document.getElementById("hs-rank-line");
    const dayEl      = document.getElementById("hs-day-label");
    const nameInput  = document.getElementById("hs-name-input");
    const submitBtn  = document.getElementById("hs-submit-btn");
    const savedNote  = document.getElementById("hs-saved-note");
    const restartBtn = document.getElementById("hs-restart-btn");

    // Inhalte befüllen
    dayEl.textContent   = _todayLabel();
    scoreEl.textContent = score + " Punkte";

    const rank = hsRank(score);
    rankEl.textContent = rank
        ? `Platz ${rank} in der Tagesliste!`
        : "Nicht unter den Top " + HS_MAX + " heute";

    // Gecachten Namen vorbelegen
    nameInput.value = hsCachedName();

    // Tabelle initial (ohne neuen Eintrag)
    _renderTable(hsGetEntries(), null, null);

    // Eintragen-Button
    let submitted = false;
    const doSubmit = () => {
        if (submitted) return;
        const name = nameInput.value.trim() || "???";
        submitted = true;
        submitBtn.disabled = true;
        nameInput.disabled = true;

        const entries = hsAddEntry(name, score);
        savedNote.textContent = "✓ Gespeichert!";
        _renderTable(entries, name, score);

        // Rank aktualisieren
        const newRank = entries.findIndex(e => e.name === name && e.score === score);
        rankEl.textContent = newRank >= 0
            ? `Platz ${newRank + 1} in der Tagesliste!`
            : rankEl.textContent;
    };

    submitBtn.addEventListener("click", doSubmit);
    nameInput.addEventListener("keydown", e => { if (e.key === "Enter") doSubmit(); });

    // Neustart
    restartBtn.addEventListener("click", () => { window.location.reload(); });

    // Verzögert einblenden (opacity-Fade, kein display-Toggle)
    setTimeout(() => {
        overlay.classList.add("hs-visible");
        // Fokus auf Namensfeld wenn Rang vorhanden
        if (rank) {
            setTimeout(() => nameInput.focus(), 400);
        }
    }, delayMs);
}

/* ----------------------------------------------------------
   Kleiner Highscore-Banner während des Spiels
   (optional — zeigt aktuellen Tages-Leader an)
---------------------------------------------------------- */

function hsGetTodayLeader() {
    const entries = hsGetEntries();
    return entries.length ? entries[0] : null;
}

/* Exports */
window.showHighscoreOverlay = showHighscoreOverlay;
window.hsGetEntries         = hsGetEntries;
window.hsGetTodayLeader     = hsGetTodayLeader;

console.log("highscore.js geladen — Tages-Highscore bereit.");
