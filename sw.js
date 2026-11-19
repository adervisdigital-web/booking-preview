// Приложение сайта брони (PWA): быстрый запуск и работа без сети, уведомления с кнопками.
// Кэш: оболочка сайта и кабинета; данные гостей и кабинета не кэшируются (кроме расписания для гостей — на случай без сети).
const CACHE = 'chp-v1';
const SHELL = ['./', 'app.css', 'site.css', 'theme.css', 'brand.css', 'guest.js', 'pricing.js', 'pwa.js', 'offline.html', 'icon-192.png', 'icon-512.png',
  'brand/logo-96.png', 'admin/', 'admin/admin.css', 'admin/admin.js'];
const scope = self.registration.scope;
const at = p => new URL(p, scope).href;

self.addEventListener('install', e => {
  // оболочка + файлы, на которые ссылаются страницы (с их ?v=), чтобы приложение открывалось без сети с первого раза
  const refs = async c => { for (const page of ['./', 'admin/']) { try { const t = await (await fetch(at(page), { cache: 'reload' })).text();
    for (const m of t.matchAll(/(?:href|src)="([^"#]+\.(?:css|js|png|svg)(?:\?[^"]*)?)"/g)) await c.add(new URL(m[1], at(page)).href).catch(() => {}); } catch {} } };
  e.waitUntil(caches.open(CACHE).then(async c => { await Promise.all(SHELL.map(p => c.add(new Request(at(p), { cache: 'reload' })).catch(() => {}))); await refs(c); }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('chp-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req, fallback) {
  const c = await caches.open(CACHE);
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch { return (await c.match(req)) || (fallback && (await c.match(at(fallback)))) || (await c.match(at('offline.html'))) || Response.error(); }
}
async function staleWhileRevalidate(req, ev) {
  const c = await caches.open(CACHE), hit = await c.match(req);
  const net = fetch(req).then(r => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => hit);
  if (hit) { ev.waitUntil(net); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const p = url.pathname;
  if (/\.mp4$/.test(p) || req.headers.has('range')) return;            // видео: браузер просит кусками, не трогаем
  if (p.includes('/api/admin/') || p.endsWith('.csv')) return;          // кабинет: только сеть, ничего не храним
  if (p.includes('/api/public/config') || p.includes('/api/public/day')) { e.respondWith(networkFirst(req)); return; }
  if (p.includes('/api/')) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, p.includes('/admin') ? 'admin/' : './')); return; }
  e.respondWith(staleWhileRevalidate(req, e));
});

// ---- уведомления
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Бронь', {
    body: m.body || '', tag: m.tag || undefined, renotify: !!m.tag, icon: at('icon-192.png'), badge: at('icon-192.png'),
    data: { url: m.url || './', actions: m.actions || [] }, actions: (m.actions || []).slice(0, 2).map(a => ({ action: a.action, title: a.title })),
    requireInteraction: !!m.sticky,
  }));
});

const ACTIONS = {
  c: id => [`api/admin/bookings/${id}/confirm`, 'Бронь подтверждена'],
  r: id => [`api/admin/bookings/${id}/reject`, 'Заявка отклонена'],
  ga: t => [`api/public/requests/${t}/accept`, 'Отлично, время подтверждено'],
  gd: t => [`api/public/requests/${t}/decline`, 'Заявка отменена'],
};
async function openUrl(u) {
  const target = at(u), list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) if (c.url.split('#')[0] === target.split('#')[0] && 'focus' in c) { c.navigate && target !== c.url && c.navigate(target).catch(() => {}); return c.focus(); }
  return self.clients.openWindow(target);
}
self.addEventListener('notificationclick', e => {
  const n = e.notification, d = n.data || {};
  n.close();
  const m = /^(c|r|ga|gd):([\w-]+)$/.exec(e.action || '');
  if (!m) { e.waitUntil(openUrl(d.url || './')); return; }
  const [path, ok] = ACTIONS[m[1]](m[2]);
  e.waitUntil(fetch(at(path), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async r => {
      if (r.ok) return self.registration.showNotification(ok, { body: n.body, icon: at('icon-192.png'), tag: n.tag });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return openUrl(d.url || 'admin/');               // кабинет: сессия кончилась — откроем вход
      return self.registration.showNotification('Не получилось', { body: j.message || 'Откройте приложение', icon: at('icon-192.png'), data: d });
    })
    .catch(() => openUrl(d.url || './')));
});
