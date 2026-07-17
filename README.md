# Ida & Odo 1XL

Ein 2D-Arcade-Spiel im Browser — gebaut mit Vanilla JavaScript, HTML5 Canvas und Web Audio API. Keine Build-Tools, keine Abhängigkeiten.

---

## Spielprinzip

Ida fängt fallende Objekte (Lumps) auf und weicht Hindernissen aus. Mit jedem Level steigt die Fallgeschwindigkeit. Odo taucht als Bonusfigur auf und kann mitgenommen werden. Powerups (Boost & Magnet) helfen in kritischen Momenten.

**Steuerung:**

| Taste / Button | Aktion |
|---|---|
| `←` / Linke Pfeiltaste | Ida nach links bewegen |
| `→` / Rechte Pfeiltaste | Ida nach rechts bewegen |
| `🚀🧲` | Boost / Scoop / Magnet aktivieren |
| `⏸` / `P` | Pause |

---

## Starten

**Ohne Server** — direkt im Browser öffnen:
```
index.html
```

**Mit Python-Server** (empfohlen, besonders für Multiplayer und Joy-Con):
```bash
python server.py
# → http://localhost:8080
```

---

## Einstiegspunkte

| Datei | Beschreibung |
|---|---|
| `index.html` | Singleplayer |
| `multiplay.html` | Lokaler Multiplayer — zwei Spieler nebeneinander (Gelb vs. Rot) |
| `imaginaere-zahlen-drehung.html` | Interaktive 3D-Visualisierung mit komplexen Zahlen (Bonus) |

---

## Projektstruktur

```
ida-odo/
├── index.html                  # Singleplayer-Einstieg
├── multiplay.html              # Multiplayer-Einstieg
├── style.css                   # Layout & UI
├── server.py                   # Python-Server für Joy-Con-Input (optional)
│
├── game-state.js               # Spielkonstanten & GameState-Klasse
├── start-screen.js             # Startbildschirm & Audio-Gate
├── loader.js                   # Level-Backgrounds, Musik, Sprite-Caching
├── sound.js                    # Web Audio API mit analoger Jitter-Simulation
├── entity.js                   # Basisklasse für alle Spielobjekte
├── falling-entity.js           # Fallende Objekte (Physik-Basisklasse)
├── ida.js                      # Spielfigur Ida (walk/idle/frozen/present)
├── odo.js                      # Figur Odo (fall→ride→grab, Dialogblasen)
├── lump.js                     # Sammelbare Objekte
├── obstacle.js                 # Hindernisse
├── overflow.js                 # Platsch-Effekte am Bildschirmrand
├── input-manager.js            # Tastatur, Touch & Button-Input (1- & 2-Spieler)
├── game-loop.js                # requestAnimationFrame-Loop mit Delta-Time
├── highscore.js                # Highscore-Persistenz via localStorage
├── main.js                     # Orchestrierung: Kamera-Shake, Vignette, Effekte
│
├── bg_001.jpg … bg_020.jpg     # Hintergrundbilder (je ein Level)
├── music_001.mp3 … music_005.mp3  # Musik (ein Track pro 4 Level)
└── *_sprites.png               # Sprite-Sheets für alle Figuren & Effekte
```

---

## Technische Details

**Spielkonstanten** (aus `game-state.js`):
- Design-Auflösung: `390 × 844 px` (iPhone-Format)
- Spielwelt-Höhe: `704 px` (abzüglich Controls-Bereich)
- Basis-Fallgeschwindigkeit: `FRAME_FALL_BASE = 2.2`
- Geschwindigkeitssteigerung pro Level: `× 1.1`
- 20 Level, 5 Musiktracks

**Audio:** Prozedurale Klangsynthese mit simuliertem Analog-Jitter (Xorshift32-PRNG) für authentischen 8-Bit-Sound. Abspielgeschwindigkeit steigt mit dem Level.

**Grafik:** Canvas-basiertes Sprite-Rendering mit Frame-Cache-Extraktion. Chroma-Key-System für Spieler-Reinfärbung im Multiplayer (Gelb → Rot).

**Effekte:** Kamera-Shake, Screen-Vignette, Flash bei Level-Up, Score-Popups, Parallax-Schatten, Ida-Glow beim Fangen.

**Highscore:** Wird per `localStorage` im Browser gespeichert.

---

## Joy-Con / Controller (experimentell)

`server.py` stellt einen Event-Relay-Server bereit:

```
POST /input   → schickt ein Controller-Event (JSON)
GET  /events  → holt alle gesammelten Events seit letztem Poll (Liste wird geleert)
```

Ein externes Programm (z. B. auf macOS/iOS) schickt Joy-Con-Events per HTTP an den Server; das Spiel pollt `/events` und übersetzt sie in Spielsteuerung.

---

## Unterstützte Sprachen

Die Sprache wird automatisch aus dem Browser erkannt. Manuell überschreibbar per URL-Parameter: `?lang=XX`

| Kürzel | Sprache | Eigenname |
|--------|---------|-----------|
| `de` | Deutsch | Deutsch |
| `en` | Englisch | English |
| `fr` | Französisch | Français |
| `it` | Italienisch | Italiano |
| `es` | Spanisch | Español |
| `pt` | Portugiesisch | Português |
| `ro` | Rumänisch | Română |
| `nl` | Niederländisch | Nederlands |
| `pl` | Polnisch | Polski |
| `hr` | Kroatisch / Serbisch / Bosnisch | Hrvatski |
| `ru` | Russisch | Русский |
| `tr` | Türkisch | Türkçe |
| `sw` | Swahili | Kiswahili |
| `hi` | Hindi | हिन्दी |
| `bn` | Bengalisch | বাংলা |
| `id` | Indonesisch | Bahasa Indonesia |
| `vi` | Vietnamesisch | Tiếng Việt |
| `zh` | Chinesisch | 中文 |
| `ja` | Japanisch | 日本語 |
| `ko` | Koreanisch | 한국어 |
| `th` | Thailändisch | ภาษาไทย |
| `ar` | Arabisch *(RTL)* | العربية |
| `he` | Hebräisch *(RTL)* | עברית |
| `ur` | Urdu *(RTL)* | اردو |
| `fa` | Persisch / Farsi *(RTL)* | فارسی |
| `ae` | Altägyptisch 𓂀 *(Easter Egg)* | 𓃭𓏏𓀀 |

**26 Sprachen** — RTL-Layouts (Arabisch, Hebräisch, Urdu, Farsi) werden automatisch erkannt und gespiegelt.

---

## Browser-Anforderungen

Moderner Browser mit Unterstützung für:
- HTML5 Canvas 2D
- Web Audio API
- ES6+ (keine Transpilierung)
- `localStorage`
