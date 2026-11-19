// Приложение на телефон (PWA): регистрация, установка на экран, подписка на уведомления. Общий для сайта и кабинета.
(() => {
  const base = new URL('.', document.currentScript.src).href;            // корень сайта (работает и в превью по подпапке)
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferred = null;
  const listeners = new Set(), changed = () => listeners.forEach(f => { try { f(); } catch {} });
  const reg = 'serviceWorker' in navigator ? navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(() => null) : Promise.resolve(null);

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; changed(); });
  addEventListener('appinstalled', () => { deferred = null; changed(); });

  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const pushOk = () => 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator && (!ios || standalone);

  async function post(path, body) {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.message || 'Ошибка'), { status: r.status }); return j;
  }
  async function subscription(create) {
    const r = await reg; if (!r) return null;
    await navigator.serviceWorker.ready;
    let s = await r.pushManager.getSubscription();
    if (!s && create) {
      const k = await fetch(base + 'api/public/push-key').then(x => x.json()).catch(() => ({}));
      if (!k.key) throw new Error('Уведомления заработают, когда сайт будет на сервере');
      s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.key) });
    }
    return s;
  }

  // iPhone: установка только вручную через «Поделиться»; показываем подсказку один раз по кнопке
  function iosHelp() {
    let d = document.getElementById('pwaHelp');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'pwaHelp'; d.className = 'pwahelp';
      d.innerHTML = `<button type="button" class="x" aria-label="Закрыть">×</button><b>Установить на iPhone</b>
        <ol><li>Нажмите <span class="pwi">Поделиться</span> внизу Safari (квадрат со стрелкой).</li><li>Выберите <span class="pwi">На экран «Домой»</span>.</li><li>Нажмите «Добавить». Иконка появится на экране, уведомления включаются уже в приложении.</li></ol>`;
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('.x')) d.close(); });
      document.body.append(d);
    }
    d.showModal();
  }

  window.CHP_PWA = {
    ios, standalone, base,
    onChange: f => { listeners.add(f); return () => listeners.delete(f); },
    canInstall: () => !standalone && (!!deferred || ios),
    async install() {
      if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; changed(); return r?.outcome === 'accepted'; }
      if (ios) iosHelp();
      return false;
    },
    pushSupported: pushOk,
    needsInstallForPush: () => ios && !standalone,
    async pushState() { if (!pushOk()) return 'unsupported'; if (Notification.permission === 'denied') return 'denied'; return (await subscription(false)) ? 'on' : 'off'; },
    // включить: спросить разрешение, подписаться и отдать подписку серверу (path: 'api/admin/push' или 'api/public/requests/<token>/push')
    async enable(path) {
      if (!pushOk()) throw new Error(ios ? 'Сначала установите приложение на экран «Домой»' : 'Этот браузер не умеет уведомления');
      const p = await Notification.requestPermission();
      if (p !== 'granted') throw new Error('Уведомления запрещены в настройках браузера');
      const s = await subscription(true);
      await post(path, { subscription: s.toJSON() });
      return true;
    },
    async disable() { const s = await subscription(false); if (s) { await post('api/public/push/off', { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); } },
  };
})();
