// Предпросмотр на GitHub Pages: тот же интерфейс, но вместо сервера данные в браузере посетителя.
// Подключается только в сборке предпросмотра. Брони вымышленные, настоящих данных здесь нет.
(() => {
  const FROM = 12, HOURS = 18, TZ = 5, H = 3600000;
  const STORE = 'booking_preview_v3', KEY_D = 'booking_preview_d';
  const BASE = 'https://mlsmybtspqqpsvbukbcj.supabase.co/storage/v1/object/public/kp-media/';
  const realFetch = window.fetch.bind(window);
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const param = (new URLSearchParams(location.search).get('d') || '').replace(/[^a-z0-9-]/g, '');
  if (param) lsSet(KEY_D, param);
  const folder = param || lsGet(KEY_D) || '';

  const nowH = () => Math.floor(Date.now() / H);
  const dayNoAt = h => Math.floor((h + TZ - FROM) / 24);
  const stamp = (d, i) => d * 24 + FROM + i - TZ;
  const dateOf = d => new Date(d * 864e5).toISOString().slice(0, 10);
  const dayNoOf = s => Date.parse(s + 'T00:00:00Z') / 864e5;
  const curDay = () => { const d = dayNoAt(nowH()); return nowH() >= stamp(d, HOURS) ? d + 1 : d; };
  const place = h => { const d = dayNoAt(h); return { date: dateOf(d), start: h - stamp(d, 0) }; };
  const ACTIVE = ['request', 'offered', 'confirmed'];
  class E extends Error { constructor(s, c, m) { super(m); this.s = s; this.c = c; } }

  let cfg;
  async function loadCfg() {
    if (cfg) return cfg;
    let c = {};
    if (folder) c = await realFetch(`${BASE}${folder}/site-demo4.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const halls = (c.halls || [{ n: 'Зал 1', p: 1000 }, { n: 'Зал 2', p: 800 }, { n: 'Зал 3', p: 1200 }])
      .map((x, i) => ({ id: i + 1, slug: `h${i + 1}`, name: x.n, price: x.p, c1: (x.c || ['#ff2d3a'])[0], c2: (x.c || [0, '#2f4dff'])[1], photo: x.photo || '', gallery: x.gallery || [], video: x.video || '', desc: x.desc || '', games: x.games || '', cap: x.cap || 10, extra: x.extra || 0, what: x.what || '',
        rates: x.rates || { day: x.p, night: x.p, weekend: x.p } }));
    const s = c.site || {};
    cfg = { name: c.name || 'Бронь залов', sub: c.sub || 'Выберите зал и время', lead: s.lead || '', tags: c.tags || [], hoursText: s.hoursText || '', ownFood: s.ownFood || '', address: s.address || '', mapUrl: s.mapUrl || '',
      phone: s.phone || '', phoneHref: s.phoneHref || '', vk: s.vk || '', from: FROM, hours: HOURS, closeLabel: s.closeLabel || 'до закрытия', holidays: s.holidays || [], horizonDays: 90, programs: s.programs || [], operator: {}, halls, facts: s.facts || [], faq: s.faq || [], occasions: s.occasions || [], tzOffset: s.tzOffset ?? 5, logo: s.logo || '', logoBig: s.logoBig || '' };
    return cfg;
  }

  function db() {
    let d; try { d = JSON.parse(lsGet(STORE)); } catch {}
    if (d) return d;
    d = { seq: 0, rows: [] };
    const names = ['Мария', 'Денис', 'Корпоратив', 'Анна', 'Кирилл', 'Вечеринка', 'Игорь', 'Елена'];
    let x = curDay() % 9973 + 17; const r = () => (x = x * 16807 % 2147483647) / 2147483647;
    for (let day = 0; day < 7; day++) cfg.halls.forEach(h => {
      let i = Math.floor(r() * 4);
      while (i < HOURS - 2) {
        if (r() < (FROM + i >= 18 ? .4 : .14)) {
          const n = 2 + Math.floor(r() * 3);
          if (i + n <= HOURS) d.rows.push({ id: ++d.seq, token: 'demo' + d.seq + 'xxxxxxxx', hall_id: h.id, start_h: stamp(curDay() + day, i), end_h: stamp(curDay() + day, i) + n, status: 'confirmed',
            source: r() < .25 ? 'phone' : 'site', ...(k => ({ name: names[k], phone: '+79000000' + String(10 + k * 3 + Math.floor(r() * 3)) }))(Math.floor(r() * names.length)), guests: 2 + Math.floor(r() * 6), comment: '', total: h.price * n, created_at: Date.now() });
          i += n + 1;
        } else i++;
      }
    });
    save(d); return d;
  }
  const save = d => lsSet(STORE, JSON.stringify(d));
  const view = b => { const p = place(b.start_h); return { hall_id: b.hall_id, date: p.date, start: p.start, hours: b.end_h - b.start_h, status: b.status, total: b.total }; };
  const adm = b => ({ id: b.id, token: b.token, source: b.source, name: b.name, phone: b.phone, guests: b.guests, comment: b.comment, created_at: b.created_at, visit: b.visit || '', prepaid: b.prepaid || 0, ...view(b) });
  const hallName = id => (cfg.halls.find(x => x.id === id) || {}).name || '';
  const ev = (b, action, detail = '') => { b.events = b.events || []; b.events.push({ at: Date.now(), who: 'Предпросмотр', action, detail }); };
  const gstat = (phone, except) => { const l = db().rows.filter(r => r.phone && r.phone === phone && r.id !== except && r.status === 'confirmed');
    const past = l.filter(r => r.start_h <= nowH()), ns = past.filter(r => r.visit === 'noshow').length, ok = past.filter(r => r.visit !== 'noshow');
    const last = past.sort((a, b) => b.start_h - a.start_h)[0], nm = db().rows.filter(r => r.phone === phone && r.name).pop();
    return { phone, name: nm ? nm.name : '', visits: ok.length, noshow: ns, sum: ok.reduce((x, r) => x + r.total, 0), last: last ? place(last.start_h).date : null, upcoming: l.filter(r => r.start_h > nowH()).length }; };
  const clash = (d, hall, a, z, self) => d.rows.some(b => b.id !== self && b.hall_id === hall && ACTIVE.includes(b.status) && b.start_h < z && b.end_h > a);
  const pastOf = date => Math.max(0, Math.min(HOURS, nowH() + 1 - stamp(dayNoOf(date), 0)));
  function slot(date, start, n, guest) {
    if (!Number.isInteger(start) || !Number.isInteger(n) || n < 1 || start < 0 || start + n > HOURS) throw new E(400, 'bad_slot', 'Выберите время в часы работы');
    const a = stamp(dayNoOf(date), start), z = a + n;
    if (guest ? a <= nowH() : z <= nowH()) throw new E(409, 'past', 'Это время уже прошло');
    return [a, z];
  }
  const phoneOf = v => { const s = String(v || '').replace(/\D/g, ''), n = s.length === 11 && /^[78]/.test(s) ? s.slice(1) : s; if (n.length !== 10) throw new E(400, 'bad_phone', 'Проверьте номер телефона'); return '+7' + n; };
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => (b % 36).toString(36)).join('');

  async function route(path, q, method, body) {
    await loadCfg(); const d = db(); let m;
    if (path === 'public/config') return { ...cfg, today: dateOf(curDay()) };
    if (path === 'public/day') {
      const date = q.get('date'), a = stamp(dayNoOf(date), 0), z = a + HOURS, busy = Object.fromEntries(cfg.halls.map(h => [h.id, []]));
      d.rows.filter(b => ACTIVE.includes(b.status) && b.start_h < z && b.end_h > a).forEach(b => busy[b.hall_id].push([Math.max(b.start_h, a) - a, Math.min(b.end_h, z) - Math.max(b.start_h, a)]));
      return { date, busy, past: pastOf(date) };
    }
    if (path === 'public/requests' && method === 'POST') {
      if (body.consent !== true) throw new E(400, 'consent', 'Нужно согласие');
      const h = cfg.halls.find(x => x.slug === body.hall), [a, z] = slot(body.date, body.start, body.hours, true);
      if (!String(body.name || '').trim()) throw new E(400, 'bad_name', 'Укажите имя');
      const phone = phoneOf(body.phone);
      if (!(body.guests >= 1 && body.guests <= 60)) throw new E(400, 'bad_guests', 'Укажите число гостей');
      if (clash(d, h.id, a, z)) throw new E(409, 'slot_taken', 'Это время уже занято');
      const b = { id: ++d.seq, token: token(), hall_id: h.id, start_h: a, end_h: z, status: 'request', source: 'site', name: String(body.name).slice(0, 60), phone, guests: body.guests, comment: String(body.comment || '').slice(0, 300), total: Pricing.total(h, body.date, body.start, body.hours, body.guests, cfg), created_at: Date.now() };
      d.rows.push(b); save(d); return { token: b.token, ...view(b) };
    }
    if ((m = /^public\/requests\/([\w-]+)(?:\/(accept|decline))?$/.exec(path))) {
      const b = d.rows.find(r => r.token === m[1]); if (!b) throw new E(404, 'not_found', 'Заявка не найдена');
      if (m[2] === 'accept') { if (b.status !== 'offered') throw new E(409, 'state', 'Предложение неактуально'); b.status = 'confirmed'; save(d); }
      if (m[2] === 'decline') { if (!['request', 'offered'].includes(b.status)) throw new E(409, 'state', 'Подтверждённую бронь отменяет администратор'); b.status = 'cancelled'; save(d); }
      return view(b);
    }
    if (path === 'public/hit') { const k = String(body.k || ''); d.hits = d.hits || {}; d.hits[k] = (d.hits[k] || 0) + 1; save(d); return { ok: true }; }
    if (path === 'public/callback') { phoneOf(body.phone); if (!String(body.name || '').trim()) throw new E(400, 'bad_name', 'Укажите имя');
      d.cbs = d.cbs || []; d.cbs.push({ id: ++d.seq, name: String(body.name).slice(0, 60), phone: phoneOf(body.phone), comment: String(body.comment || ''), created_at: Date.now(), done_at: null, done_by: '' }); save(d); return { ok: true }; }
    if (path === 'admin/callbacks') return (d.cbs || []).slice().reverse();
    if ((m = /^admin\/callbacks\/(\d+)\/done$/.exec(path))) { const c = (d.cbs || []).find(x => x.id === +m[1]); if (c) { c.done_at = Date.now(); c.done_by = 'Предпросмотр'; save(d); } return { ok: true }; }
    if (path === 'admin/stats') { const h = d.hits || {}; return { days: 30, totals: h, views: [{ day: new Date().toISOString().slice(0, 10), n: h.view || 0 }] }; }
    if (path === 'admin/me' || path === 'admin/login') return { name: 'Предпросмотр' };
    if (path === 'admin/logout') return {};
    if (path === 'admin/day') {
      const date = q.get('date'), a = stamp(dayNoOf(date), 0), z = a + HOURS;
      return { date, past: pastOf(date), bookings: d.rows.filter(b => ACTIVE.includes(b.status) && b.start_h < z && b.end_h > a).sort((x, y) => x.start_h - y.start_h).map(adm),
        pending: d.rows.filter(b => ['request', 'offered'].includes(b.status) && b.end_h > nowH()).sort((x, y) => y.created_at - x.created_at).map(adm) };
    }
    if (path === 'admin/bookings' && method === 'POST') {
      const h = cfg.halls.find(x => x.id === body.hall_id), [a, z] = slot(body.date, body.start, body.hours, false);
      if (clash(d, h.id, a, z)) throw new E(409, 'slot_taken', 'Это время уже занято');
      const b = { id: ++d.seq, token: token(), hall_id: h.id, start_h: a, end_h: z, status: 'confirmed', source: 'phone', name: String(body.name || ''), phone: body.phone ? phoneOf(body.phone) : '', guests: +body.guests || 0, comment: String(body.comment || '').slice(0, 300), prepaid: Math.max(0, +body.prepaid || 0), total: Pricing.total(h, body.date, body.start, body.hours, +body.guests || 1, cfg), created_at: Date.now() };
      d.rows.push(b); save(d); return adm(b);
    }
    if ((m = /^admin\/bookings\/(\d+)\/(confirm|reject|cancel|offer|move)$/.exec(path))) {
      const b = d.rows.find(r => r.id === +m[1]), act = m[2]; if (!b) throw new E(404, 'not_found', 'Бронь не найдена');
      const need = (...s) => { if (!s.includes(b.status)) throw new E(409, 'state', 'Бронь уже изменена, обновите экран'); };
      if (act === 'confirm') { need('request', 'offered'); b.status = 'confirmed'; }
      if (act === 'reject') { need('request', 'offered'); b.status = 'rejected'; }
      if (act === 'cancel') { need('confirmed'); b.status = 'cancelled'; }
      if (act === 'offer' || act === 'move') {
        need(...(act === 'offer' ? ['request', 'offered'] : ['confirmed']));
        const h = cfg.halls.find(x => x.id === body.hall_id), [a, z] = slot(body.date, body.start, body.hours, false);
        if (clash(d, h.id, a, z, b.id)) throw new E(409, 'slot_taken', 'Это время уже занято');
        Object.assign(b, { hall_id: h.id, start_h: a, end_h: z, total: h.price * (z - a), status: act === 'offer' ? 'offered' : 'confirmed' });
      }
      save(d); return adm(b);
    }
    if ((m = /^admin\/bookings\/(\d+)$/.exec(path))) { const b = d.rows.find(r => r.id === +m[1]); if (!b) throw new E(404, 'not_found', 'Бронь не найдена');
      return { ...adm(b), hall: hallName(b.hall_id), events: b.events || [{ at: b.created_at, who: b.source === 'site' ? 'гость' : 'Предпросмотр', action: b.source === 'site' ? 'заявка' : 'бронь по телефону', detail: '' }], guest: b.phone ? gstat(b.phone, b.id) : null }; }
    if ((m = /^admin\/bookings\/(\d+)\/(edit|extend|visit)$/.exec(path))) {
      const b = d.rows.find(r => r.id === +m[1]); if (!b) throw new E(404, 'not_found', 'Бронь не найдена');
      const h = cfg.halls.find(x => x.id === b.hall_id), p = place(b.start_h);
      if (m[2] === 'edit') { for (const k of ['name', 'comment']) if (k in body) b[k] = String(body[k] || '').slice(0, k === 'name' ? 60 : 300);
        if ('phone' in body) b.phone = body.phone ? phoneOf(body.phone) : ''; if ('guests' in body) b.guests = +body.guests || 0; if ('prepaid' in body) b.prepaid = Math.max(0, +body.prepaid || 0);
        b.total = Pricing.total(h, p.date, p.start, b.end_h - b.start_h, b.guests || 1, cfg); ev(b, 'изменил'); }
      if (m[2] === 'extend') { if (b.status !== 'confirmed') throw new E(409, 'state', 'Продлить можно только подтверждённую бронь');
        const z = b.end_h + (body.by > 0 ? 1 : -1); if (z <= b.start_h) throw new E(400, 'too_short', 'Короче часа сделать нельзя');
        if (z > stamp(dayNoOf(p.date), HOURS)) throw new E(400, 'closing', 'Дальше закрытие'); if (clash(d, b.hall_id, b.start_h, z, b.id)) throw new E(409, 'slot_taken', 'Следующий час в этом зале уже занят');
        b.end_h = z; b.total = Pricing.total(h, p.date, p.start, z - b.start_h, b.guests || 1, cfg); ev(b, body.by > 0 ? 'продлил на 1 ч' : 'сократил на 1 ч'); }
      if (m[2] === 'visit') { if (body.visit === 'noshow' && b.start_h > nowH()) throw new E(409, 'early', 'Бронь ещё не началась'); b.visit = body.visit || ''; ev(b, { arrived: 'гости пришли', noshow: 'гости не пришли', '': 'снял отметку' }[b.visit]); }
      save(d); return adm(b);
    }
    if (path === 'admin/guest') { const n = String(q.get('phone') || '').replace(/\D/g, '').slice(-10); return n.length === 10 ? gstat('+7' + n) : {}; }
    if (path === 'admin/search') { const t = String(q.get('q') || '').trim().toLowerCase(), dg = t.replace(/\D/g, '');
      const l = d.rows.filter(r => dg.length >= 4 ? r.phone.includes(dg.slice(-10)) : t.length >= 2 && (r.name || '').toLowerCase().includes(t));
      return l.sort((a, b) => a.start_h - b.start_h).slice(0, 40).map(r => ({ ...adm(r), hall: hallName(r.hall_id) })); }
    if (path === 'admin/report') { const a = stamp(dayNoOf(q.get('from')), 0), z = stamp(dayNoOf(q.get('to')), HOURS), rows = d.rows.filter(r => r.start_h >= a && r.start_h < z);
      const conf = rows.filter(r => r.status === 'confirmed'), ok = conf.filter(r => r.visit !== 'noshow'), sum = l => l.reduce((x, r) => x + r.total, 0), hrs = l => l.reduce((x, r) => x + r.end_h - r.start_h, 0);
      const days = Math.round((z - a) / 24);
      return { from: q.get('from'), to: q.get('to'), days, count: ok.length, hours: hrs(ok), sum: sum(ok), prepaid: conf.reduce((x, r) => x + (r.prepaid || 0), 0), noshow: conf.length - ok.length, noshowSum: sum(conf) - sum(ok),
        site: ok.filter(r => r.source === 'site').length, phone: ok.filter(r => r.source === 'phone').length, requests: rows.filter(r => r.source === 'site').length, rejected: rows.filter(r => r.status === 'rejected').length, cancelled: rows.filter(r => r.status === 'cancelled').length,
        halls: cfg.halls.map(h => { const l = ok.filter(r => r.hall_id === h.id); return { name: h.name, count: l.length, hours: hrs(l), sum: sum(l), load: Math.round(hrs(l) / (days * HOURS) * 100) }; }) }; }
    throw new E(404, 'not_found', 'Не найдено');
  }

  window.fetch = async (u, o = {}) => {
    const url = new URL(String(u), location.href), m = /\/api\/(.+)$/.exec(url.pathname);
    if (!m) return realFetch(u, o);
    try {
      const data = await route(m[1], url.searchParams, o.method || 'GET', o.body ? JSON.parse(o.body) : {});
      return new Response(JSON.stringify(data), { status: o.method === 'POST' && /requests$|bookings$/.test(m[1]) ? 201 : 200 });
    } catch (e) {
      if (e instanceof E) return new Response(JSON.stringify({ error: e.c, message: e.m || e.message }), { status: e.s });
      return new Response(JSON.stringify({ error: 'server', message: 'Ошибка предпросмотра' }), { status: 500 });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const inAdmin = /\/admin\//.test(location.pathname), root = inAdmin ? '../' : './';
    const st = document.createElement('style');
    st.textContent = '#previewBar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#1a2340;color:#dbe4ff;font:600 12.5px "Golos Text",system-ui,sans-serif}#previewBar span{flex:1 1 200px}#previewBar a{color:#fff;padding:5px 10px;border-radius:9px;background:rgba(255,255,255,.12);text-decoration:none}#previewBar a.on{background:#e8222e}#previewBar button{color:#dbe4ff;text-decoration:underline;font-size:12.5px}#csv,#out{display:none}';
    document.head.append(st);
    const bar = document.createElement('div'); bar.id = 'previewBar';
    bar.innerHTML = `<span>Предпросмотр. Заявки видны только в этом браузере, брони вымышленные.</span><a class="${inAdmin ? '' : 'on'}" href="${root}">Гость</a><a class="${inAdmin ? 'on' : ''}" href="${root}admin/">Администратор</a><button type="button" id="previewReset">Сбросить</button>`;
    document.body.prepend(bar);
    bar.querySelector('#previewReset').onclick = () => { try { localStorage.removeItem(STORE); localStorage.removeItem('chp_my_requests'); } catch {} location.reload(); };
  });
})();
