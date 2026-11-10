// Сайт заведения: стена свободных залов, описания и тарифы, бронь, статус своих заявок.
(() => {
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(n).toLocaleString('ru');
  const rub = n => num(n) + ' ₽';
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const asDate = s => new Date(s + 'T12:00:00Z');
  const addDays = (s, k) => new Date(asDate(s).getTime() + k * 864e5).toISOString().slice(0, 10);
  const dayName = s => { const d = asDate(s); return `${WDF[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const dayMon = s => { const d = asDate(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const hrsWord = n => n % 10 === 1 && n % 100 !== 11 ? 'час' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'часа' : 'часов';
  const LS = 'chp_my_requests';
  const store = { get() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v.slice(-8))); } catch {} } };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function api(path, data) {
    const r = await fetch('/api/public' + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || 'Нет связи, попробуйте ещё раз'), { code: j.error, status: r.status });
    return j;
  }

  let C, day = { busy: {}, past: 0 }, wall = null;
  const st = { date: '', sel: null, mine: [] };
  const hall = id => C.halls.find(h => h.id === id);
  const hh = i => String((C.from + i) % 24).padStart(2, '0');
  const span = (a, n) => `${hh(a)}:00–${hh(a + n)}:00`;
  const takenIn = (d, id, i) => i < d.past || (d.busy[id] || []).some(([a, n]) => i >= a && i < a + n);
  const taken = (id, i) => takenIn(day, id, i);
  const guests = () => Math.max(1, parseInt($('fGu').value, 10) || 1);
  const costOf = s => Pricing.total(hall(s.id), st.date, s.a, s.b - s.a + 1, guests(), C);

  function freeWindow(d, id) {
    let a = 0; while (a < C.hours && takenIn(d, id, a)) a++;
    if (a >= C.hours) return null;
    let b = a; while (b + 1 < C.hours && !takenIn(d, id, b + 1)) b++;
    return { a, b };
  }
  const windowText = w => `с ${hh(w.a)}:00 ${w.b + 1 >= C.hours ? C.closeLabel : `до ${hh(w.b + 1)}:00`}`;

  // Стена: окно горит, если зал сегодня ещё можно забронировать.
  async function loadWall() {
    for (let k = 0; k < 3; k++) {
      const date = addDays(C.today, k), d = await api(`/day?date=${date}`);
      if (C.halls.some(h => freeWindow(d, h.id)) || k === 2) { wall = { date, d, k }; break; }
    }
    drawWall();
  }
  let lit = false;
  function drawWall() {
    const { date, d, k } = wall;
    $('wallTitle').textContent = k === 0 ? 'Свободно сегодня' : k === 1 ? `Свободно завтра, ${dayMon(date)}` : `Свободно ${dayMon(date)}`;
    $('wall').innerHTML = C.halls.map((x, n) => { const w = freeWindow(d, x.id);
      return `<button type="button" class="win${w ? ' on' : ''}${lit || reduced ? '' : ' boot'}" style="--n:${n}" data-wall="${x.id}" aria-label="${E(x.name)}: ${w ? 'свободен ' + windowText(w) : 'занят'}">
        ${x.photo ? `<img src="${E(x.photo)}" alt="" decoding="async">` : ''}<span class="wn">${E(x.name)}</span><span class="wt">${w ? windowText(w) : 'занят'}</span></button>`; }).join('');
    lit = true;
  }
  function rateLines(x) {
    const value = r => Array.isArray(r) ? `${num(r[0][1])}–${rub(r[r.length - 1][1])}` : rub(r);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), R = x.rates;
    let lines;
    if (same(R.day, R.night) && same(R.day, R.weekend)) lines = [['Любой день', R.day]];
    else if (same(R.day, R.night)) lines = [['Пн–чт', R.day], ['Выходные и праздники', R.weekend]];
    else lines = [['Пн–чт, 12:00–00:00', R.day], ['Пн–чт, 00:00–06:00', R.night], ['Выходные и праздники', R.weekend]];
    return lines.map(([l, r]) => `<div><dt>${l}</dt><dd>${value(r)}</dd></div>`).join('');
  }
  function drawHallList() {
    $('hallList').innerHTML = C.halls.map(x => `<article class="hl" id="info-${x.id}">
      <button type="button" class="hlimg" data-more="${x.id}" aria-label="Подробнее о зале ${E(x.name)}">
        ${x.photo ? `<img class="hlph" src="${E(x.photo)}" alt="" loading="lazy" decoding="async">` : `<span class="hlph" style="background:linear-gradient(120deg,${E(x.c1)},${E(x.c2)})"></span>`}
        ${x.video ? '<span class="badge">видео 360°</span>' : (x.gallery || []).length ? `<span class="badge">${x.gallery.length + 1} фото</span>` : ''}</button>
      <div class="hlb"><div class="hltop"><h3>${E(x.name)}</h3><p class="cap">до ${x.cap} человек</p></div>
      <p class="what">${E(x.what)}</p>
      <dl class="rates">${rateLines(x)}</dl>
      ${x.extra ? `<p class="extra">Сверх ${x.cap} человек: +${x.extra} ₽ в час за гостя</p>` : ''}
      <div class="hlact"><button type="button" class="pick" data-pick="${x.id}">Выбрать время</button><button type="button" class="more" data-more="${x.id}">Подробнее о зале</button></div></div></article>`).join('');
  }
  // Карточка зала, как товар во ВКонтакте: фото, видео, описание, что есть в зале, цены
  function openMore(id) {
    const x = hall(id), media = [x.photo, ...(x.gallery || [])].filter(Boolean);
    $('hdBody').innerHTML = `<div class="hdmedia">${x.video ? `<video src="${E(x.video)}" controls playsinline preload="metadata"${x.photo ? ` poster="${E(x.photo)}"` : ''}></video>` : media.length ? `<img id="hdMain" src="${E(media[0])}" alt="Зал ${E(x.name)}">` : ''}
        ${media.length > 1 ? `<div class="thumbs">${media.map((m, i) => `<button type="button" data-thumb="${E(m)}"${i ? '' : ' class="on"'}><img src="${E(m)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>
      <div class="hdtext"><div class="hltop"><h3 id="hdT">${E(x.name)}</h3><p class="cap">до ${x.cap} человек</p></div>
        ${x.desc ? `<p class="lead2">${E(x.desc)}</p>` : ''}<p class="what">${E(x.what)}</p>${x.games ? `<p class="what">${E(x.games)}</p>` : ''}
        <dl class="rates">${rateLines(x)}</dl>${x.extra ? `<p class="extra">Сверх ${x.cap} человек: +${x.extra} ₽ в час за гостя</p>` : ''}
        <div class="hlact"><button type="button" class="pick" data-pick="${x.id}">Выбрать время</button><button type="button" class="more" data-close-hall>Закрыть</button></div></div>
      <button type="button" class="x hdx" data-close-hall aria-label="Закрыть">×</button>`;
    $('hallDlg').showModal(); hit('hall:' + x.slug);
  }
  const hit = k => { fetch('/api/public/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }), keepalive: true }).catch(() => {}); };
  function drawDays() {
    $('days').innerHTML = Array.from({ length: 14 }, (_, k) => { const s = addDays(C.today, k), d = asDate(s);
      return `<button type="button" class="day${s === st.date ? ' on' : ''}" data-day="${s}"><b>${d.getUTCDate()}</b><i>${k === 0 ? 'сегодня' : WD[d.getUTCDay()]}</i></button>`; }).join('');
  }
  function drawSlots() {
    $('slots').innerHTML = C.halls.map(x => `<article class="row2" id="b-${x.id}"><div class="rn"><b>${E(x.name)}</b><span>до ${x.cap} чел.</span></div>
      <div class="slots" style="--hours:${C.hours}">${Array.from({ length: C.hours }, (_, i) => { const b = taken(x.id, i), sel = !b && st.sel && st.sel.id === x.id && i >= st.sel.a && i <= st.sel.b;
        return `<button type="button" class="sl${b ? ' b' : sel ? ' s' : ''}" data-id="${x.id}" data-i="${i}"${b ? ' disabled' : ''} aria-label="${E(x.name)}, ${hh(i)}:00, ${b ? 'занято' : 'свободно'}">${hh(i)}</button>`; }).join('')}</div></article>`).join('');
  }
  function drawBar() {
    const s = st.sel; $('bar').classList.toggle('show', !!s);
    if (!s) return;
    const n = s.b - s.a + 1;
    $('barT').textContent = `${hall(s.id).name}, ${dayName(st.date)}`;
    $('barS').textContent = `${span(s.a, n)}, ${n} ${hrsWord(n)}, примерно ${rub(costOf(s))}`;
  }
  const LABEL = { request: 'ждёт ответа', offered: 'предлагаем другое время', confirmed: 'подтверждено', rejected: 'отклонено', cancelled: 'отменено' };
  function drawMine() {
    $('mine').innerHTML = st.mine.slice().reverse().map(q => { const x = hall(q.hall_id);
      return `<div class="m ${q.status}"><div class="mh"><b>${E(x ? x.name : 'Зал')}, ${E(dayName(q.date))}, ${span(q.start, q.hours)}</b><span>${LABEL[q.status]}</span></div>
      ${q.status === 'offered' ? `<div class="row"><button type="button" class="btn" data-acc="${E(q.token)}">Согласиться</button><button type="button" class="btn g" data-dec="${E(q.token)}">Отказаться</button></div>` : ''}
      ${q.status === 'request' ? `<button type="button" class="lnk" data-dec="${E(q.token)}">Отменить заявку</button>` : ''}</div>`; }).join('');
  }
  async function loadDay() {
    day = await api(`/day?date=${st.date}`);
    if (st.sel) for (let i = st.sel.a; i <= st.sel.b; i++) if (taken(st.sel.id, i)) { st.sel = null; toast('Это время только что заняли', 'Выберите другое', 'alt'); break; }
    drawSlots(); drawBar();
  }
  async function loadMine() {
    const tokens = store.get(), out = [], keep = [];
    for (const t of tokens) {
      try { const q = await api(`/requests/${encodeURIComponent(t)}`); out.push({ ...q, token: t }); keep.push(t); }
      catch (e) { if (e.status !== 404) { keep.push(t); const old = st.mine.find(m => m.token === t); if (old) out.push(old); } }
    }
    const was = Object.fromEntries(st.mine.map(q => [q.token, q.status]));
    st.mine = out.filter(q => addDays(q.date, 1) >= C.today); store.set(keep); drawMine();
    for (const q of st.mine) if (was[q.token] && was[q.token] !== q.status) {
      if (q.status === 'confirmed') toast('Бронь подтверждена', 'Ждём вас!', 'ok');
      if (q.status === 'offered') toast('Предлагаем другое время', 'Ответьте в разделе брони', 'alt');
      if (q.status === 'rejected') toast('Заявка отклонена', 'Позвоните нам, подберём время', 'alt');
    }
  }
  function tap(id, i) {
    const s = st.sel;
    if (!s || s.id !== id) st.sel = { id, a: i, b: i };
    else if (s.a === i && s.b === i) st.sel = null;
    else if (i >= s.a && i <= s.b) st.sel = i === s.a ? { id, a: i + 1, b: s.b } : { id, a: s.a, b: i - 1 };
    else { const a = Math.min(s.a, i), b = Math.max(s.b, i); let free = true; for (let k = a; k <= b; k++) if (taken(id, k)) free = false; st.sel = free ? { id, a, b } : { id, a: i, b: i }; }
    drawSlots(); drawBar();
  }
  const goTo = id => { const el = $(id); if (!el) return; el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
  async function openHall(id, date, preselect) {
    st.date = date; st.sel = null; drawDays();
    await loadDay();
    if (preselect) { const w = freeWindow(day, id); if (w) { st.sel = { id, a: w.a, b: w.a }; drawSlots(); drawBar(); } }
    goTo(`b-${id}`);
  }
  const form = on => { document.body.classList.toggle('form', on); if (!on) $('err').textContent = ''; };
  function drawSum() {
    const s = st.sel; if (!s) return; const n = s.b - s.a + 1, x = hall(s.id), g = guests();
    const over = x.extra && g > x.cap ? `<br>Сверх ${x.cap} человек: +${x.extra} ₽ в час за каждого гостя` : '';
    $('sum').innerHTML = `<b>${E(x.name)}</b>, ${E(dayName(st.date))}, <b>${span(s.a, n)}</b><br>${n} ${hrsWord(n)}, примерно <b>${rub(costOf(s))}</b>${over}`;
  }
  function openForm() { if (!st.sel) return; drawSum(); form(true); hit('book:open'); setTimeout(() => $('fName').focus({ preventScroll: true }), 300); }
  const cbForm = on => { document.body.classList.toggle('cbform', on); if (!on) $('cbErr').textContent = ''; else setTimeout(() => $('cbName').focus({ preventScroll: true }), 300); };
  async function sendCb(ev) {
    ev.preventDefault();
    if (!$('cbOk').checked) { $('cbErr').textContent = 'Отметьте согласие на обработку персональных данных'; return; }
    $('cbSend').disabled = true; $('cbErr').textContent = '';
    try { await api('/callback', { name: $('cbName').value, phone: $('cbTel').value, comment: $('cbCom').value, consent: true, website: $('cbWeb').value });
      cbForm(false); toast('Заявка на звонок принята', 'Администратор скоро перезвонит', 'ok'); }
    catch (e) { $('cbErr').textContent = e.message; } finally { $('cbSend').disabled = false; }
  }
  async function send(ev) {
    ev.preventDefault();
    const s = st.sel; if (!s) return;
    if (!$('fOk').checked) { $('err').textContent = 'Отметьте согласие на обработку персональных данных'; return; }
    $('send').disabled = true; $('err').textContent = '';
    try {
      const r = await api('/requests', { hall: hall(s.id).slug, date: st.date, start: s.a, hours: s.b - s.a + 1, name: $('fName').value, phone: $('fTel').value, guests: parseInt($('fGu').value, 10), comment: $('fCom').value, consent: true, website: $('fWeb').value });
      store.set([...store.get(), r.token]);
      st.mine.push(r); st.sel = null; form(false); drawMine(); hit('book:sent');
      toast('Заявка отправлена', 'Администратор подтвердит бронь', '');
      $('book').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      await Promise.all([loadDay(), loadWall()]);
    } catch (e) {
      if (e.code === 'slot_taken' || e.code === 'past') { st.sel = null; form(false); toast('Это время только что заняли', 'Выберите другое', 'alt'); await loadDay(); }
      else $('err').textContent = e.message;
    } finally { $('send').disabled = false; }
  }
  let tt;
  function toast(t, s, kind) {
    $('tT').textContent = t; $('tS').textContent = s; $('tIc').textContent = kind === 'alt' ? '↺' : '✓';
    const el = $('toast'); el.className = 'toast show ' + kind; clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 4200);
  }
  document.addEventListener('click', async ev => {
    const t = ev.target;
    const d = t.closest('[data-day]');
    if (d) { st.date = d.dataset.day; st.sel = null; drawDays(); drawBar(); loadDay().catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const sl = t.closest('.sl'); if (sl && !sl.disabled) { tap(+sl.dataset.id, +sl.dataset.i); return; }
    const w = t.closest('[data-wall]'); if (w) { openHall(+w.dataset.wall, wall.date, w.classList.contains('on')).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const p = t.closest('[data-pick]'); if (p) { if ($('hallDlg').open) $('hallDlg').close(); openHall(+p.dataset.pick, st.date, false).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const mo = t.closest('[data-more]'); if (mo) { openMore(+mo.dataset.more); return; }
    const th = t.closest('[data-thumb]'); if (th) { $('hdMain').src = th.dataset.thumb; document.querySelectorAll('[data-thumb]').forEach(b => b.classList.toggle('on', b === th)); return; }
    if (t.closest('[data-close-hall]') || t === $('hallDlg')) { $('hallDlg').close(); return; }
    if (t.closest('#openCb')) { cbForm(true); return; }
    if (t.closest('[data-close-cb]')) { cbForm(false); return; }
    const hk = t.closest('[data-hit]'); if (hk) hit(hk.dataset.hit);
    if (t.closest('#openForm')) { openForm(); return; }
    if (t.closest('#closeForm') || t.closest('#dim')) { form(false); cbForm(false); return; }
    const acc = t.closest('[data-acc]'), dec = t.closest('[data-dec]');
    if (acc || dec) {
      const token = (acc || dec).dataset[acc ? 'acc' : 'dec'];
      try { await api(`/requests/${encodeURIComponent(token)}/${acc ? 'accept' : 'decline'}`, {}); toast(acc ? 'Бронь подтверждена' : 'Заявка отменена', acc ? 'Ждём вас!' : '', acc ? 'ok' : 'alt'); }
      catch (e) { toast('Не получилось', e.message, 'alt'); }
      await loadMine().catch(() => {}); await loadDay().catch(() => {}); await loadWall().catch(() => {});
    }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { form(false); cbForm(false); } });
  $('sheet').addEventListener('submit', send);
  $('cbSheet').addEventListener('submit', sendCb);
  $('fGu').addEventListener('input', () => { drawSum(); drawBar(); });

  function fill() {
    $('name').textContent = C.name; document.querySelector('.logo').textContent = C.name; $('lead').textContent = C.lead || C.sub || '';
    const tel = (el, show) => { if (C.phone) { el.textContent = show; el.href = `tel:${C.phoneHref}`; } else el.hidden = true; };
    tel($('topTel'), C.phone); tel($('tel'), C.phone);
    $('addr').textContent = C.address || ''; $('hoursText').textContent = C.hoursText || '';
    if (C.mapUrl) $('map').href = C.mapUrl; else $('map').hidden = true;
    const L = [[C.vk, 'ВКонтакте', 'vk'], [C.max, 'MAX', 'max'], [C.instagram, 'Instagram*', 'ig']].filter(l => l[0]);
    $('links').innerHTML = L.map(([u, n, k]) => `<a class="chip2" href="${E(u)}" target="_blank" rel="noopener" data-hit="click:${k}">${n}</a>`).join('');
    $('igNote').hidden = !C.instagram;
    if (C.yandexOrgId && /^\d+$/.test(C.yandexOrgId)) {
      $('ymap').hidden = false; $('ymap').innerHTML = `<iframe src="https://yandex.ru/map-widget/v1/?oid=${C.yandexOrgId}&ol=biz&z=16" title="Мы на карте" loading="lazy"></iframe>`;
      $('reviews').hidden = false; $('yrev').innerHTML = `<iframe src="https://yandex.ru/maps-reviews-widget/${C.yandexOrgId}?comments" title="Отзывы на Яндекс Картах" loading="lazy"></iframe>`;
    }
    $('ownFood').textContent = C.ownFood || '';
    $('programs').hidden = !C.programs?.length;
    $('programsList').innerHTML = (C.programs || []).map(p => `<div class="pr"><div><b>${E(p.name)}</b>${p.note ? `<i>${E(p.note)}</i>` : ''}</div><span>${E(p.price)}</span></div>`).join('');
    drawHallList();
    // факты на первом экране
    $('facts').innerHTML = (C.facts || []).map(([a, b]) => `<div><dt>${E(a)}</dt><dd>${E(b)}</dd></div>`).join('');
    // поводы: фото зала и куда ведёт кнопка
    const bySlug = s => C.halls.find(h => h.slug === s) || C.halls[0];
    $('occasions').hidden = !(C.occasions || []).length;
    $('occList').innerHTML = (C.occasions || []).map(o => { const h = bySlug(o.hall);
      return `<a class="oc" href="#${E(o.to || 'halls')}">${h.photo ? `<img src="${E(h.photo)}" alt="" loading="lazy" decoding="async">` : ''}<span class="ocb"><b>${E(o.title)}</b><span>${E(o.text)}</span></span></a>`; }).join('');
    $('faq').hidden = !(C.faq || []).length;
    $('faqList').innerHTML = (C.faq || []).map(([q, a]) => `<details><summary>${E(q)}</summary><p>${E(a)}</p></details>`).join('');
    // подвал
    $('ftName').textContent = C.name; $('ftAddr').textContent = C.address || ''; $('ftHours').textContent = C.hoursText || '';
    if (C.phone) { $('ftTel').textContent = C.phone; $('ftTel').href = `tel:${C.phoneHref}`; } else $('ftTel').hidden = true;
    $('ftLinks').innerHTML = $('links').innerHTML;
    drawStatus(); setInterval(drawStatus, 60000);
  }
  // «Открыто до 06:00» по времени заведения, а не по часам на телефоне гостя
  function drawStatus() {
    const h = new Date(Date.now() + (C.tzOffset ?? 5) * 3600000).getUTCHours(), close = (C.from + C.hours) % 24;
    const open = C.from + C.hours > 24 ? (h >= C.from || h < close) : (h >= C.from && h < close);
    $('status').className = 'status' + (open ? ' on' : '');
    $('status').textContent = open ? `Открыто до ${String(close).padStart(2, '0')}:00` : `Откроемся в ${String(C.from).padStart(2, '0')}:00`;
  }

  (async () => {
    try { C = await api('/config'); }
    catch { $('wall').innerHTML = '<p class="empty">Не удалось загрузить расписание. Обновите страницу или позвоните нам.</p>'; return; }
    const link = new URLSearchParams(location.search).get('b');
    if (link && /^[\w-]{10,40}$/.test(link) && !store.get().includes(link)) store.set([...store.get(), link]);
    fill(); hit('view');
    try {
      await loadWall();
      st.date = wall.date; drawDays();
      await Promise.all([loadDay(), loadMine()]);
    } catch (e) { toast('Нет связи', e.message, 'alt'); }
    if (link) $('book').scrollIntoView();
    setInterval(() => { if (document.hidden || document.body.classList.contains('form')) return; loadDay().catch(() => {}); loadMine().catch(() => {}); loadWall().catch(() => {}); }, 20000);
  })();
})();
