/* ==============================================================
   ad-manager.js  –  Werbung & werbefreie Version

   Native (Capacitor + @capacitor-community/admob
           + @revenuecat/purchases-capacitor):
     • Banner, Interstitial, Rewarded Video via AdMob
     • IAP (kein Abo, einmalig) via RevenueCat

   Web / PWA-Fallback:
     • HTML-Container für AdSense (manuell befüllen)
     • Kein nativer Rewarded Video / IAP

   SETUP-CHECKLISTE (Capacitor):
     1. npm install @capacitor-community/admob
        npm install @revenuecat/purchases-capacitor
     2. npx cap sync
     3. AdMob App-IDs in AndroidManifest.xml & Info.plist eintragen
     4. RevenueCat API-Keys in _init() eintragen
     5. AD_UNIT_IDS + IAP_PRODUCT_ID unten befüllen
     6. Testmodus deaktivieren (isTesting: false)
============================================================== */

// ── Konfiguration ─────────────────────────────────────────────
const AD_UNIT_IDS = {
    ios: {
        banner:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← iOS Banner
        interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← iOS Interstitial
        rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← iOS Rewarded
    },
    android: {
        banner:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← Android Banner
        interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← Android Interstitial
        rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',   // ← Android Rewarded
    }
};

// App Store / Play Store Produkt-ID (non-consumable)
const IAP_PRODUCT_ID    = 'ida_odo_no_ads';  // ← mit Store-Eintrag abgleichen
const REVENUECAT_IOS_KEY     = 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // ← eintragen
const REVENUECAT_ANDROID_KEY = 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // ← eintragen

const AD_FREE_KEY = 'idaOdoAdFree_v1';

// ── Klasse ────────────────────────────────────────────────────
class AdManager {
    constructor() {
        this._adFree  = localStorage.getItem(AD_FREE_KEY) === 'true';
        this._admob   = window.Capacitor?.Plugins?.AdMob     ?? null;
        this._buys    = window.Capacitor?.Plugins?.Purchases  ?? null;
        this._plat    = window.Capacitor?.getPlatform?.()    ?? 'web';
        this._interstitialReady  = false;
        this._rewardedReady      = false;
        this._consentGranted     = null; // null = noch unbekannt
        this._ltTimer            = null;
        this._ltOnContinue       = null;

        if (this._adFree) {
            // Sofort alle Werbeflächen ausblenden (Banner bereits im DOM sichtbar)
            document.querySelectorAll('.ad-banner-slot').forEach(el => el.hidden = true);
            document.querySelectorAll('.ad-free-btn, .restore-btn').forEach(b => b.hidden = true);
        }
        // _init() wird erst nach GDPR-Consent aufgerufen (via onConsent)
    }

    /* ── Öffentliche API ──────────────────────────────────── */

    isAdFree() { return this._adFree; }

    // Wird nach GDPR-Consent aufgerufen. granted=true: Werbung voll initialisieren.
    onConsent(granted) {
        this._consentGranted = granted;
        if (this._adFree) return;
        if (granted) {
            this._init();
            if (this._admob) this._nativeBanner('MEDIUM_RECTANGLE');
        } else {
            // Abgelehnt: alle Werbeflächen ausblenden
            document.querySelectorAll('.ad-banner-slot').forEach(el => el.hidden = true);
        }
    }

    // Banner in HTML-Container ein-/ausblenden
    // adSize: AdMob-Größe für native, z.B. 'BANNER', 'MEDIUM_RECTANGLE'
    showBanner(containerId, adSize = 'BANNER') {
        if (this._adFree || this._consentGranted === false) return;
        if (this._admob) {
            this._nativeBanner(adSize);
        } else {
            const el = document.getElementById(containerId);
            if (el) el.hidden = false;
        }
    }

    hideBanner(containerId) {
        if (this._admob) {
            this._admob.hideBanner?.().catch(() => {});
        } else {
            const el = document.getElementById(containerId);
            if (el) el.hidden = true;
        }
    }

    // Pause-Overlay anzeigen
    showPauseAd() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.hidden = false;
        if (!this._adFree) this.showBanner('pause-ad-banner');
        this._bindAdFreeBtn('pause-noad-btn');
        this._bindRestoreBtn('pause-restore-btn');
    }

    hidePauseAd() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.hidden = true;
        this.hideBanner('pause-ad-banner');
    }

    // Start-Screen Banner
    // Web: Banner ist bereits im DOM sichtbar (kein hidden-Attribut)
    // Native: nativen Banner einblenden
    showStartBanner() {
        if (!this._adFree && this._admob) this._nativeBanner('MEDIUM_RECTANGLE');
    }

    // Level-Transition-Screen (Level >= 5)
    showLevelTransition(level, onContinue = () => {}) {
        const overlay = document.getElementById('level-transition');
        if (!overlay) { onContinue(); return; }

        // Vorherige Transition abbrechen (Race-Condition: zwei schnelle Level-Ups)
        if (this._ltTimer) { clearInterval(this._ltTimer); this._ltTimer = null; }
        this._ltOnContinue = onContinue;

        const lvlEl = document.getElementById('lt-level');
        const txtEl = document.getElementById('lt-text');
        const ctdEl = document.getElementById('lt-countdown');

        if (lvlEl) lvlEl.textContent = (typeof t === 'function') ? t('ltLevel', { n: level }) : `Level ${level}`;

        if (txtEl) {
            const texts = (typeof tArr === 'function') ? tArr('ltMotivateTexts') : [];
            txtEl.textContent = texts.length ? texts[Math.floor(Math.random() * texts.length)] : '';
        }

        overlay.hidden = false;
        if (!this._adFree) this.showBanner('lt-ad-banner', 'MEDIUM_RECTANGLE');
        this._bindAdFreeBtn('lt-noad-btn');

        // 5-Sekunden-Countdown
        let secs = 5;
        const _updateCtd = () => {
            if (ctdEl) ctdEl.textContent = (typeof t === 'function')
                ? t('ltCountdown', { n: secs }) : `${secs}…`;
        };
        _updateCtd();
        this._ltTimer = setInterval(() => {
            secs--;
            _updateCtd();
            if (secs <= 0) {
                clearInterval(this._ltTimer);
                this._ltTimer = null;
                this._closeLevelTransition(onContinue);
            }
        }, 1000);

        const btn = document.getElementById('lt-continue-btn');
        if (btn) {
            btn.onclick = () => {
                if (this._ltTimer) { clearInterval(this._ltTimer); this._ltTimer = null; }
                this._closeLevelTransition(onContinue);
            };
        }
    }

    cancelLevelTransition() {
        if (this._ltTimer) { clearInterval(this._ltTimer); this._ltTimer = null; }
        const overlay = document.getElementById('level-transition');
        if (overlay && !overlay.hidden) {
            const cb = this._ltOnContinue || (() => {});
            this._ltOnContinue = null;
            this._closeLevelTransition(cb);
        }
    }

    _closeLevelTransition(onContinue) {
        this._ltOnContinue = null;
        const overlay = document.getElementById('level-transition');
        if (overlay) overlay.hidden = true;
        this.hideBanner('lt-ad-banner');
        onContinue();
    }

    // Vollbild-Interstitial (native; Web-Fallback: sofort weiter)
    showInterstitial(onClose = () => {}) {
        if (this._adFree || this._consentGranted === false) { onClose(); return; }
        if (this._admob) this._nativeInterstitial(onClose);
        else onClose();
    }

    // Rewarded Video (vor Replay)
    showRewarded(onReward = () => {}, onClose = () => {}) {
        if (this._adFree || this._consentGranted === false) { onReward(); onClose(); return; }
        if (this._admob) {
            this._nativeRewarded(onReward, onClose);
        } else {
            // Web-Fallback: Fullscreen-Overlay mit Countdown
            this._webRewardedFallback(() => { onReward(); onClose(); });
        }
    }

    _webRewardedFallback(onDone) {
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'background:#000', 'z-index:99999',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'font-family:Arial,sans-serif', 'color:#fff', 'touch-action:none'
        ].join(';');

        const _t = typeof t === 'function' ? t : k => k;
        overlay.innerHTML = `
            <div style="position:absolute;top:14px;left:16px;font-size:12px;color:#666;">${_t('adLabel')}</div>
            <div style="font-size:64px;margin-bottom:16px;opacity:0.15;">▶</div>
            <div id="_adTimerMsg" style="font-size:14px;color:#888;"></div>
            <button id="_adSkipBtn" style="
                display:none;position:absolute;bottom:36px;right:20px;
                padding:10px 20px;background:rgba(255,255,255,0.12);
                border:1px solid #444;border-radius:6px;
                color:#fff;font-size:14px;cursor:pointer;">
                ›
            </button>`;

        document.body.appendChild(overlay);

        const msg     = overlay.querySelector('#_adTimerMsg');
        const skipBtn = overlay.querySelector('#_adSkipBtn');
        let secs = 5;

        const tick = () => {
            if (secs > 0) {
                msg.textContent = typeof t === 'function' ? t('adCountdown', { n: secs }) : `${secs}…`;
                secs--;
                setTimeout(tick, 1000);
            } else {
                msg.textContent = '';
                skipBtn.style.display = 'block';
            }
        };
        tick();

        skipBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            onDone();
        });
    }

    // Highscore: Banner + "Werbefrei"-Button einrichten
    initHighscoreAds() {
        if (!this._adFree) this.showBanner('hs-ad-banner');
        this._bindAdFreeBtn('hs-noad-btn');
    }

    /* ── Werbefreie Version ──────────────────────────────── */

    purchaseAdFree() {
        if (this._adFree) { this._toast(t('adFreeAlready')); return; }
        if (this._buys)   { this._nativePurchase(); }
        else              { this._toast(t('adFreeWebHint')); }
    }

    restorePurchases() {
        if (this._buys) { this._nativeRestore(); }
        else            { this._toast(t('adFreeWebHint')); }
    }

    _unlockAdFree() {
        this._adFree = true;
        localStorage.setItem(AD_FREE_KEY, 'true');
        ['start-ad-banner','pause-ad-banner','lt-ad-banner','hs-ad-banner'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        document.querySelectorAll('.ad-free-btn, .restore-btn').forEach(b => b.hidden = true);
        this._toast(t('adFreeSuccess'));
    }

    _toast(msg) {
        let el = document.getElementById('ad-mgr-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ad-mgr-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('ad-mgr-toast-show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('ad-mgr-toast-show'), 3500);
    }

    _bindAdFreeBtn(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (this._adFree) { btn.hidden = true; return; }
        btn.hidden = false;
        btn.onclick = () => this.purchaseAdFree();
    }

    _bindRestoreBtn(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (this._adFree) { btn.hidden = true; return; }
        btn.hidden = false;
        btn.onclick = () => this.restorePurchases();
    }

    /* ── AdMob Native ──────────────────────────────────── */

    async _init() {
        if (!this._admob) return;
        const _allIds = Object.values(AD_UNIT_IDS).flatMap(p => Object.values(p));
        if (_allIds.some(id => id.includes('XXXXXXXX'))) {
            console.warn('⚠️  AdManager: Placeholder Ad Unit IDs — fill in AD_UNIT_IDS before release!');
        }
        if (REVENUECAT_IOS_KEY.includes('XXXXXXXX') || REVENUECAT_ANDROID_KEY.includes('XXXXXXXX')) {
            console.warn('⚠️  AdManager: Placeholder RevenueCat API keys — fill in before release!');
        }
        try {
            await this._admob.initialize({ requestTrackingAuthorization: true, isTesting: false });

            // RevenueCat initialisieren
            if (this._buys) {
                const apiKey = this._plat === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
                await this._buys.configure({ apiKey });
                // Auf Geräten prüfen ob bereits gekauft (Restore beim App-Start)
                this._silentRestore();
            }

            this._preloadInterstitial();
            this._preloadRewarded();
        } catch (e) { console.warn('AdManager init:', e); }
    }

    async _silentRestore() {
        try {
            const info = await this._buys.getCustomerInfo();
            if (Object.keys(info?.entitlements?.active ?? {}).length > 0) {
                this._adFree = true;
                localStorage.setItem(AD_FREE_KEY, 'true');
            }
        } catch {}
    }

    _adId(type) {
        return (AD_UNIT_IDS[this._plat] ?? AD_UNIT_IDS.android)[type] ?? '';
    }

    async _nativeBanner(adSize = 'BANNER') {
        try {
            await this._admob.showBanner({
                adId: this._adId('banner'), adSize,
                position: 'BOTTOM_CENTER', margin: 0, isTesting: false,
            });
        } catch (e) { console.warn('Banner:', e); }
    }

    async _preloadInterstitial() {
        try {
            await this._admob.prepareInterstitial({ adId: this._adId('interstitial'), isTesting: false });
            this._interstitialReady = true;
        } catch (e) { console.warn('Interstitial preload:', e); }
    }

    async _nativeInterstitial(onClose) {
        try {
            if (!this._interstitialReady) await this._preloadInterstitial();
            await this._admob.showInterstitial();
            this._interstitialReady = false;
            this._preloadInterstitial();
        } catch (e) { console.warn('Interstitial:', e); }
        onClose();
    }

    async _preloadRewarded() {
        try {
            await this._admob.prepareRewardVideoAd({ adId: this._adId('rewarded'), isTesting: false });
            this._rewardedReady = true;
        } catch (e) { console.warn('Rewarded preload:', e); }
    }

    async _nativeRewarded(onReward, onClose) {
        try {
            if (!this._rewardedReady) await this._preloadRewarded();
            const result = await this._admob.showRewardVideoAd();
            this._rewardedReady = false;
            this._preloadRewarded();
            if (result?.value) onReward();
        } catch (e) { console.warn('Rewarded:', e); }
        onClose();
    }

    /* ── IAP Native (RevenueCat) ───────────────────────── */

    async _nativePurchase() {
        try {
            const offerings = await this._buys.getOfferings();
            const pkg = offerings?.current?.availablePackages?.find(
                p => p.product.identifier === IAP_PRODUCT_ID
            ) ?? offerings?.current?.availablePackages?.[0];
            if (!pkg) { this._toast(t('adFreeError')); return; }
            await this._buys.purchasePackage({ aPackage: pkg });
            this._unlockAdFree();
        } catch (e) {
            if (e?.code !== 'USER_CANCELLED') {
                this._toast(t('adFreeError'));
                console.warn('IAP purchase:', e);
            }
        }
    }

    async _nativeRestore() {
        try {
            const info = await this._buys.restorePurchases();
            if (Object.keys(info?.entitlements?.active ?? {}).length > 0) {
                this._unlockAdFree();
            } else {
                this._toast(t('adFreeNotFound'));
            }
        } catch (e) {
            this._toast(t('adFreeError'));
            console.warn('IAP restore:', e);
        }
    }
}

window.adManager = new AdManager();
