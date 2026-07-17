/* ==============================================================
   gdpr.js  –  GDPR-Consent-Dialog
   Zeigt beim ersten Start eine Einwilligungsabfrage.
   Ergebnis wird in localStorage gespeichert.
   Consent-Status wird von adManager über onConsent() abgefragt.
============================================================== */

(function () {
    const KEY = 'idaOdoGdprConsent_v1'; // 'granted' | 'denied'

    class GdprManager {
        constructor() {
            this._consent = localStorage.getItem(KEY); // null = noch nicht entschieden
        }

        hasDecided() { return this._consent !== null; }
        isGranted()  { return this._consent === 'granted'; }

        // Zeigt Dialog wenn nötig; ruft onDone(consent) auf sobald entschieden.
        showIfNeeded(onDone) {
            if (this.hasDecided()) { onDone(this._consent); return; }
            this._render(onDone);
        }

        // Consent zurücksetzen (z.B. für Einstellungen)
        reset() {
            this._consent = null;
            localStorage.removeItem(KEY);
        }

        _decide(value, onDone) {
            this._consent = value;
            localStorage.setItem(KEY, value);
            const el = document.getElementById('_gdpr-overlay');
            if (el) el.remove();
            onDone(value);
        }

        _render(onDone) {
            const title  = (typeof t === 'function') ? t('gdprTitle')  : 'Privacy Settings';
            const text   = (typeof t === 'function') ? t('gdprText')   : 'This version shows no ads and sends no data to a server.';
            const accept = (typeof t === 'function') ? t('gdprAccept') : 'Accept & Play';
            const deny   = (typeof t === 'function') ? t('gdprDeny')   : 'Decline';
            const policy = (typeof t === 'function') ? t('gdprPolicy') : 'Privacy Policy';

            const el = document.createElement('div');
            el.id = '_gdpr-overlay';
            el.style.cssText = [
                'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.92)',
                'z-index:99998', 'display:flex', 'align-items:center',
                'justify-content:center', 'padding:20px', 'box-sizing:border-box',
                'font-family:Arial,sans-serif'
            ].join(';');

            el.innerHTML = `
                <div style="
                    background:#1a1a2e;border:2px solid #ffcc00;border-radius:16px;
                    padding:28px 22px 22px;max-width:360px;width:100%;
                    color:#fff;text-align:center;box-sizing:border-box;">
                    <div style="font-size:20px;font-weight:bold;color:#ffcc00;margin-bottom:14px;">
                        🔒 ${title}
                    </div>
                    <p style="font-size:13px;color:#ccc;line-height:1.65;margin:0 0 22px;">
                        ${text}
                    </p>
                    <button id="_gdpr-accept" style="
                        display:block;width:100%;padding:14px;margin-bottom:10px;
                        background:#ffcc00;border:none;border-radius:10px;
                        font-weight:bold;font-size:16px;color:#000;cursor:pointer;">
                        ${accept}
                    </button>
                    <button id="_gdpr-deny" style="
                        display:block;width:100%;padding:11px;margin-bottom:18px;
                        background:transparent;border:1px solid #444;border-radius:10px;
                        font-size:14px;color:#888;cursor:pointer;">
                        ${deny}
                    </button>
                    <a href="privacy.html" target="_blank" style="
                        font-size:12px;color:#555;text-decoration:underline;">
                        ${policy}
                    </a>
                </div>`;

            document.body.appendChild(el);

            document.getElementById('_gdpr-accept').addEventListener('click',
                () => this._decide('granted', onDone));
            document.getElementById('_gdpr-deny').addEventListener('click',
                () => this._decide('denied', onDone));
        }
    }

    window.gdprManager = new GdprManager();
})();
