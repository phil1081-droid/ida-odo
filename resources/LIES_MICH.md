# App-Icon & Splash-Screen

Lege hier deine Quelldateien ab, dann einmal `npm run icons` ausführen.
Das Tool generiert automatisch alle iOS- und Android-Größen.

## Benötigte Dateien

| Datei                    | Größe       | Hinweis                              |
|--------------------------|-------------|--------------------------------------|
| `icon.png`               | 1024 × 1024 | Kein Transparenz-Alpha, volles Bild  |
| `icon-foreground.png`    | 1024 × 1024 | Vordergrund (Android Adaptive Icon)  |
| `icon-background.png`    | 1024 × 1024 | Hintergrund (einfarbig oder Muster)  |
| `splash.png`             | 2732 × 2732 | Zentriertes Logo auf einfarbigem BG  |
| `splash-dark.png`        | 2732 × 2732 | Optionaler Dark-Mode-Splash          |

## Kommando

```bash
npm run icons
```

## Was passiert dann?

- iOS:     `ios/App/App/Assets.xcassets/` wird befüllt
- Android: `android/app/src/main/res/` wird befüllt (alle dpi-Ordner)

## Tipp

Du kannst `icon.png` zunächst auch als `icon-foreground.png` kopieren
und `icon-background.png` einfach als 1024×1024 Volltonfarbe anlegen (#000 o.ä.).
