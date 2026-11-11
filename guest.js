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

  let C, day = { busy: {}, past: 0 }, wall = null, hdStage = () => '';
  const st = { date: '', sel: null, mine: [], dur: 3, occ: null, pick: null };
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
    // окно зала: сначала видео-обзор 360° (без звука, по кругу), затем фото; миниатюры переключают главное окно
    const items = [...(x.video ? ['@video'] : []), ...media];
    hdStage = v => v === '@video'
      ? `<video src="${E(x.video)}" controls autoplay muted loop playsinline preload="metadata"${x.photo ? ` poster="${E(x.photo)}"` : ''} aria-label="Видео-обзор зала ${E(x.name)}"></video>`
      : `<img src="${E(v)}" alt="Зал ${E(x.name)}">`;
    $('hdBody').innerHTML = `<div class="hdmedia"><div class="hdstage" id="hdStage">${items.length ? hdStage(items[0]) : ''}</div>
        ${items.length > 1 ? `<div class="thumbs">${items.map((m, i) => `<button type="button" data-thumb="${E(m)}"${i ? '' : ' class="on"'} aria-label="${m === '@video' ? 'Видео 360°' : 'Фото ' + (i + (x.video ? 0 : 1))}"><img src="${E(m === '@video' ? (x.photo || media[0] || '') : m)}" alt="" loading="lazy">${m === '@video' ? '<span class="tplay">▶ 360°</span>' : ''}</button>`).join('')}</div>` : ''}</div>
      <div class="hdtext"><div class="hltop"><h3 id="hdT">${E(x.name)}</h3><p class="cap">до ${x.cap} человек</p></div>
        ${x.desc ? `<p class="lead2">${E(x.desc)}</p>` : ''}<p class="what">${E(x.what)}</p>${x.games ? `<p class="what">${E(x.games)}</p>` : ''}
        <dl class="rates">${rateLines(x)}</dl>${x.extra ? `<p class="extra">Сверх ${x.cap} человек: +${x.extra} ₽ в час за гостя</p>` : ''}
        <div class="hlact"><button type="button" class="pick" data-pick="${x.id}">Выбрать время</button><button type="button" class="more" data-close-hall>Закрыть</button></div></div>
      <button type="button" class="x hdx" data-close-hall aria-label="Закрыть">×</button>`;
    $('hallDlg').showModal(); hit('hall:' + x.slug);
  }
  const hit = k => { fetch('/api/public/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }), keepalive: true }).catch(() => {}); };
  // дни: у каждого цифра, сколько залов подходит под гостей и длительность (расписание 14 дней в кеше на минуту)
  const dayCache = {};
  const fitsDay = d => C.halls.filter(x => { if (guests() > x.cap) return false; const w = bestWin(d, x.id, st.dur); return w && (st.dur >= 99 || w.n >= st.dur); }).length;
  function drawDays() {
    $('days').innerHTML = Array.from({ length: 14 }, (_, k) => { const s = addDays(C.today, k), d = asDate(s), c = dayCache[s], n = c ? fitsDay(c.d) : null;
      const lab = n === null ? '' : n ? `, подходит залов: ${n}` : ', под ваши условия мест нет';
      return `<button type="button" class="day${s === st.date ? ' on' : ''}${n === 0 ? ' none' : ''}" data-day="${s}" aria-label="${E(dayName(s))}${lab}"><b>${d.getUTCDate()}</b><i>${k === 0 ? 'сегодня' : WD[d.getUTCDay()]}</i>${n ? `<u class="av">${n}</u>` : ''}</button>`; }).join('');
  }
  async function loadAvail() {
    const now = Date.now(), dates = Array.from({ length: 14 }, (_, k) => addDays(C.today, k)).filter(s => !dayCache[s] || now - dayCache[s].t > 60000);
    await Promise.all(dates.map(s => api(`/day?date=${s}`).then(d => { dayCache[s] = { d, t: Date.now() }; }).catch(() => {})));
    drawDays();
  }
  // запоминаем гостя: число гостей, длительность, имя, телефон
  const PREF = 'chp_prefs';
  const prefs = { get() { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch { return {}; } }, set(p) { try { localStorage.setItem(PREF, JSON.stringify({ ...prefs.get(), ...p })); } catch {} } };
  // телефон в виде +7 (XXX) XXX-XX-XX; сервер всё равно берёт только цифры
  function maskTel(el) {
    let n = el.value.replace(/\D/g, ''); if (!n) { el.value = ''; return; }
    if (n[0] === '7' && el.value.trim().startsWith('+7')) n = n.slice(1);            // наш префикс +7
    else if (n.length === 11 && (n[0] === '8' || n[0] === '7')) n = n.slice(1);     // вставили 8XXXXXXXXXX целиком
    if (n.length === 11 && n[0] === '8') n = n.slice(1);                             // набрали 8 после +7: это не код города
    n = n.slice(0, 10);
    const p = [n.slice(0, 3), n.slice(3, 6), n.slice(6, 8), n.slice(8, 10)];
    el.value = '+7' + (p[0] ? ` (${p[0]}` : '') + (p[0].length === 3 ? ')' : '') + (p[1] ? ` ${p[1]}` : '') + (p[2] ? `-${p[2]}` : '') + (p[3] ? `-${p[3]}` : '');
  }
  // ---- подбор вечера: гости, длительность, повод → залы сортируются, у каждого готовое окно и цена
  const DUR = [[2, '2 ч'], [3, '3 ч'], [4, '4 ч'], [6, '6 ч'], [99, 'до утра']];
  const night = i => C.from + i >= 24;
  const runFrom = (d, id, i, want) => { let n = 0; while (n < want && i + n < C.hours && !takenIn(d, id, i + n)) n++; return n; };
  // лучшее окно на день: первое начало, где помещается нужная длительность; иначе самое длинное свободное
  function bestWin(d, id, want) {
    let best = null;
    for (let i = 0; i < C.hours; i++) { if (takenIn(d, id, i)) continue; const n = runFrom(d, id, i, want);
      if (n >= Math.min(want, C.hours - i) && (want < 99 ? n >= want : true)) return { a: i, n };
      if (!best || n > best.n) best = { a: i, n }; i += n - 1; }
    return best;
  }
  const fitOf = x => { const g = guests(); return g <= x.cap ? 'ok' : x.extra && g <= Math.ceil(x.cap * 1.5) ? 'tight' : 'no'; };
  const occHall = () => { const o = (C.occasions || []).find(q => q.title === st.occ); return o ? o.hall : ''; };
  function rowInfo(x) {
    const w = bestWin(day, x.id, st.dur), f = fitOf(x), g = guests();
    if (!w) return { w, f, rank: 9, text: 'на этот день занят', price: 0 };
    const full = st.dur >= 99 || w.n >= st.dur, price = Pricing.total(x, st.date, w.a, w.n, g, C);
    const text = `${full ? '' : 'только '}с ${hh(w.a)}:00 · ${w.n} ${hrsWord(w.n)} ≈ ${rub(price)}`;
    return { w, f, full, price, text, rank: (f === 'ok' ? 0 : f === 'tight' ? 2 : 6) + (full ? 0 : 1) };
  }
  function drawSlots() {
    const rec = occHall(), rows = C.halls.map(x => ({ x, r: rowInfo(x) }))
      .sort((p, q) => p.r.rank - q.r.rank || (p.r.price || 1e9) - (q.r.price || 1e9));
    const good = rows.filter(o => o.r.rank === 0), g = guests();
    const durTxt = st.dur >= 99 ? 'до утра' : `на ${st.dur} ${hrsWord(st.dur)}`;
    const big = C.halls.reduce((m, x) => x.cap > m.cap ? x : m, C.halls[0]);
    $('fitSum').innerHTML = g > big.cap
      ? `<b>Самый вместительный зал: ${E(big.name)}, до ${big.cap} человек.</b> Для компании больше ${big.cap} человек <a href="#contacts">позвоните нам</a>, подскажем варианты.`
      : good.length
      ?`<b>${good.length} ${good.length === 1 ? 'зал подходит' : good.length < 5 ? 'зала подходят' : 'залов подходят'}</b> для ${g} ${g === 1 ? 'гостя' : 'гостей'} ${durTxt} · от ${rub(Math.min(...good.map(o => o.r.price)))}`
      : `<b>На ${dayMon(st.date)} под ${g} ${g === 1 ? 'гостя' : 'гостей'} ${durTxt} мест нет.</b> <span id="nextFree">Ищем ближайшую дату…</span>`;
    if (!good.length && g <= big.cap) findNext(); else scan++;
    // карточки залов: крупное фото, полоска дня, окно и цена; справа (на телефоне ниже) панель выбранного зала
    $('slots').innerHTML = rows.map(({ x, r }) => { const on = st.pick === x.id;
      const fitTxt = r.f === 'tight' ? `тесновато: +${x.extra} ₽/ч за гостя сверх ${x.cap}` : r.f === 'no' ? 'не поместитесь' : '';
      const mini = Array.from({ length: C.hours }, (_, i) => { const b = taken(x.id, i), s = !b && st.sel && st.sel.id === x.id && i >= st.sel.a && i <= st.sel.b;
        return `<i class="${b ? 'b' : s ? 's' : night(i) ? 'n' : ''}"></i>`; }).join('');
      return `<article class="hc f-${r.f}${on ? ' on' : ''}${r.rank > 5 ? ' faded' : ''}" id="b-${x.id}">
        <button type="button" class="hcb" data-hpick="${x.id}" aria-label="${E(x.name)}, до ${x.cap} человек, ${E(r.text)}">
        <span class="hcph">${x.photo ? `<img src="${E(x.photo)}" alt="" loading="lazy" decoding="async">` : ''}<span class="hccap">до ${x.cap} чел.</span>${x.slug === rec ? '<em class="rec">советуем</em>' : ''}</span>
        <span class="hcn">${E(x.name)}</span><span class="mini" style="--hours:${C.hours}" aria-hidden="true">${mini}</span>
        <span class="hcw${r.w && r.full ? '' : ' part'}">${r.text}</span>${fitTxt ? `<span class="hcfit">${fitTxt}</span>` : ''}</button></article>`; }).join('');
    drawPicker();
  }
  const PARTS = i => { const h = (C.from + i) % 24; return h >= 6 && h < 18 ? 'День' : h >= 18 ? 'Вечер' : 'Ночь'; };
  function drawPicker() {
    const x = st.pick && hall(st.pick);
    if (!x) { $('picker').innerHTML = `<div class="pkempty"><span class="pkic" aria-hidden="true">←</span><b>Выберите зал</b><p>Нажмите на карточку: покажем свободные часы этого зала, цену и лучшее время под вашу компанию.</p></div>`; return; }
    const mine = st.sel && st.sel.id === x.id, rowsH = [];
    for (let a = 0; a < C.hours; a += 6) rowsH.push([a, Math.min(C.hours, a + 6)]);
    const cell = i => { const past = i < day.past, b = taken(x.id, i), sel = !b && mine && i >= st.sel.a && i <= st.sel.b;
      const free = j => j >= 0 && j < C.hours && !taken(x.id, j), inSel = j => mine && j >= st.sel.a && j <= st.sel.b;
      let cls = past ? ' p b' : b ? ' b' : sel ? ' s' : '';
      if (!b) cls += sel ? (!inSel(i - 1) ? ' rs' : '') + (!inSel(i + 1) ? ' re' : '') : (!free(i - 1) || inSel(i - 1) ? ' rs' : '') + (!free(i + 1) || inSel(i + 1) ? ' re' : '');
      if (night(i)) cls += ' n'; if (st.date === C.today && i === day.past && day.past > 0) cls += ' now';
      return `<button type="button" class="sl${cls}" data-id="${x.id}" data-i="${i}"${b ? ' disabled' : ''} aria-label="${hh(i)}:00, ${past ? 'прошло' : b ? 'занято' : sel ? 'выбрано' : 'свободно'}">${hh(i)}:00</button>`; };
    const n = mine ? st.sel.b - st.sel.a + 1 : 0;
    $('picker').innerHTML = `<div class="pkhead">${x.photo ? `<img src="${E(x.photo)}" alt="">` : ''}<div class="pkt"><span>${E(dayName(st.date))}</span><h3>${E(x.name)}</h3><span>до ${x.cap} человек</span></div></div>
      <div class="pkbody">${rowsH.map(([a, b]) => `<div class="pkrow"><span class="pkl">${PARTS(a)}</span><div class="pkcells">${Array.from({ length: b - a }, (_, k) => cell(a + k)).join('')}</div></div>`).join('')}
      <div class="pksum">${mine ? `<div class="pkline">${span(st.sel.a, n)}, ${n} ${hrsWord(n)}</div><div class="pkprice">≈ ${rub(costOf(st.sel))}</div>
        <div class="pkact"><div class="adj"><button type="button" data-adj="-1" aria-label="На час меньше">−1 ч</button><button type="button" data-adj="1" aria-label="На час больше">+1 ч</button></div><button type="button" class="pkgo" data-open-form>Оставить заявку</button></div>`
        : `<div class="pkline">Нажмите на час, с которого начнёте: выделим сразу ${st.dur >= 99 ? 'до утра' : `${st.dur} ${hrsWord(st.dur)}`}.</div>`}
      <button type="button" class="pkmore" data-more="${x.id}">Фото и видео зала</button></div></div>`;
  }
  function pickHall(id, scroll) {
    st.pick = id; const w = bestWin(day, id, st.dur);
    st.sel = w ? { id, a: w.a, b: w.a + w.n - 1 } : null; drawSlots(); drawBar();
    if (scroll && matchMedia('(max-width:900px)').matches) goTo('picker');
  }
  // ничего не подходит на выбранный день → ищем ближайшую дату (до 14 дней вперёд)
  let scan = 0;
  async function findNext() {
    const my = ++scan, g = guests();
    for (let k = 1; k <= 14; k++) {
      const date = addDays(st.date, k); if (date > addDays(C.today, 13)) break;
      const d = await api(`/day?date=${date}`).catch(() => null); if (my !== scan) return; if (!d) continue;
      const n = C.halls.filter(x => g <= x.cap && (() => { const w = bestWin(d, x.id, st.dur); return w && (st.dur >= 99 || w.n >= st.dur); })()).length;
      if (n) { const el = $('nextFree'); if (el) el.innerHTML = `<button type="button" class="nextday" data-day="${date}">Ближайшее: ${E(dayName(date))}, ${n} ${n === 1 ? 'зал' : n < 5 ? 'зала' : 'залов'} →</button>`; return; }
    }
    const el = $('nextFree'); if (el && my === scan) el.innerHTML = 'Ближайшие две недели заняты. <a href="#contacts">Позвоните нам</a>, подберём время.';
  }
  function drawPlan() {
    $('pGu').textContent = guests();
    $('pDur').innerHTML = DUR.map(([v, l]) => `<button type="button" class="chip${st.dur === v ? ' on' : ''}" data-dur="${v}" aria-pressed="${st.dur === v}">${l}</button>`).join('');
    const occ = C.occasions || [];
    $('plan').querySelector('.pocc').hidden = !occ.length;
    $('pOcc').innerHTML = occ.map(o => `<button type="button" class="chip${st.occ === o.title ? ' on' : ''}" data-occ="${E(o.title)}" aria-pressed="${st.occ === o.title}">${E(o.title)}</button>`).join('');
    const o = occ.find(q => q.title === st.occ); $('planHint').hidden = !o; $('planHint').textContent = o ? o.text : '';
  }
  function setGuests(n) { $('fGu').value = Math.max(1, Math.min(60, n)); prefs.set({ g: guests() }); drawPlan(); drawSlots(); drawBar(); drawDays(); }
  // нижняя панель: −1 ч / +1 ч без прицеливания в клетки
  function adjust(k) {
    const s = st.sel; if (!s) return;
    if (k < 0) { if (s.b > s.a) s.b--; else { toast('Меньше часа нельзя', 'Нажмите × чтобы снять выбор', 'alt'); return; } }
    else if (s.b + 1 < C.hours && !taken(s.id, s.b + 1)) s.b++;
    else if (s.a > 0 && !taken(s.id, s.a - 1)) s.a--;
    else { toast('Дальше зал занят', 'Можно выбрать другой зал или день', 'alt'); return; }
    drawSlots(); drawBar(); if (document.body.classList.contains('form')) drawSum();
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
    day = await api(`/day?date=${st.date}`); dayCache[st.date] = { d: day, t: Date.now() };
    if (st.sel) for (let i = st.sel.a; i <= st.sel.b; i++) if (taken(st.sel.id, i)) { st.sel = null; toast('Это время только что заняли', 'Выберите другое', 'alt'); break; }
    drawSlots(); drawBar(); drawDays();
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
    if (!s || s.id !== id) { const n = Math.max(1, runFrom(day, id, i, st.dur)); st.sel = { id, a: i, b: i + n - 1 }; }   // одно нажатие = вся выбранная длительность
    else if (s.a === i && s.b === i) st.sel = null;
    else if (i >= s.a && i <= s.b) st.sel = i === s.a ? { id, a: i + 1, b: s.b } : { id, a: s.a, b: i - 1 };
    else if (i === s.b + 1 || i === s.a - 1) st.sel = { id, a: Math.min(s.a, i), b: Math.max(s.b, i) };   // соседний час: добавить
    else { const n = Math.max(1, runFrom(day, id, i, st.dur)); st.sel = { id, a: i, b: i + n - 1 }; }       // дальний час: новое начало
    st.pick = id; drawSlots(); drawBar();
  }
  const goTo = id => { const el = $(id); if (!el) return; el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
  async function openHall(id, date, preselect) {
    st.date = date; st.sel = null; drawDays();
    await loadDay();
    pickHall(id, false);
    if (matchMedia('(max-width:900px)').matches) goTo('picker'); else $('book').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
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
      store.set([...store.get(), r.token]); prefs.set({ name: $('fName').value.trim(), tel: $('fTel').value });
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
    const hp = t.closest('[data-hpick]'); if (hp) { pickHall(+hp.dataset.hpick, true); hit('book:take'); return; }
    if (t.closest('[data-open-form]')) { openForm(); return; }
    const tk = t.closest('[data-take]'); if (tk) { const id = +tk.dataset.take, a = +tk.dataset.a; st.sel = { id, a, b: a + +tk.dataset.n - 1 }; drawSlots(); drawBar(); hit('book:take'); return; }
    const gb = t.closest('[data-g]'); if (gb) { setGuests(guests() + +gb.dataset.g); return; }
    const du = t.closest('[data-dur]'); if (du) { st.dur = +du.dataset.dur; prefs.set({ dur: st.dur }); drawPlan(); drawSlots(); drawDays(); return; }
    const aj = t.closest('[data-adj]'); if (aj) { adjust(+aj.dataset.adj); return; }
    if (t.closest('#barX')) { st.sel = null; drawSlots(); drawBar(); return; }
    const oc = t.closest('[data-occ]'); if (oc) { st.occ = st.occ === oc.dataset.occ ? null : oc.dataset.occ;
      const o = (C.occasions || []).find(q => q.title === st.occ), h = o && C.halls.find(x => x.slug === o.hall);
      if (h && guests() > h.cap) setGuests(h.cap);
      if (st.occ && !$('fCom').value) $('fCom').value = st.occ; drawPlan(); drawSlots(); return; }
    const w = t.closest('[data-wall]'); if (w) { openHall(+w.dataset.wall, wall.date, w.classList.contains('on')).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const p = t.closest('[data-pick]'); if (p) { if ($('hallDlg').open) $('hallDlg').close(); openHall(+p.dataset.pick, st.date, false).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const mo = t.closest('[data-more]'); if (mo) { openMore(+mo.dataset.more); return; }
    const th = t.closest('[data-thumb]'); if (th) { $('hdStage').innerHTML = hdStage(th.dataset.thumb); document.querySelectorAll('[data-thumb]').forEach(b => b.classList.toggle('on', b === th)); return; }
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
  $('fGu').addEventListener('input', () => { drawSum(); drawBar(); $('pGu').textContent = guests(); prefs.set({ g: guests() }); drawSlots(); drawDays(); });
  for (const id of ['fTel', 'cbTel']) { const el = $(id); if (el) { el.addEventListener('input', () => maskTel(el)); el.addEventListener('focus', () => { if (!el.value) el.value = '+7 '; }); } }
  { const p = prefs.get(); if (p.g) $('fGu').value = p.g; if ([2, 3, 4, 6, 99].includes(p.dur)) st.dur = p.dur; if (p.name) $('fName').value = p.name; if (p.tel) { $('fTel').value = p.tel; if ($('cbTel')) $('cbTel').value = p.tel; } if (p.name && $('cbName')) $('cbName').value = p.name; }

  function fill() {
    $('name').textContent = C.name; { const lg = document.querySelector('.logo'); let tn = [...lg.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()) || [...lg.childNodes].find(n => n.nodeType === 3);
      if (!tn) tn = lg.appendChild(document.createTextNode('')); tn.textContent = C.name; }   // знак-картинка остаётся, меняем только текст
    // логотип: на сервере клиента лежит в brand/, в предпросмотре приходит адресом из данных; нет файла — картинку убираем
    const brandImgs = [[document.querySelector('.logo img'), C.logo], [document.querySelector('.flogoimg'), C.logoBig]];
    for (const [img, url] of brandImgs) { if (!img) continue; img.addEventListener('error', () => img.remove(), { once: true }); if (url) img.src = url; else if (img.complete && !img.naturalWidth) img.remove(); } $('lead').textContent = C.lead || C.sub || '';
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
    // первый экран: фото самых ярких залов фоном, сменяются с медленным наездом (CSS)
    const pick = ['lounge', 'vip', 'impuls', 'games'].map(s => C.halls.find(h => h.slug === s && h.photo)).filter(Boolean);
    const bg = (pick.length >= 2 ? pick : C.halls.filter(h => h.photo)).slice(0, 4);
    $('heroBg').style.setProperty('--n', bg.length);
    $('heroBg').innerHTML = bg.map((h, i) => `<img src="${E(h.photo)}" alt="" decoding="async" style="--i:${i}">`).join('');
    // факты на первом экране
    $('facts').innerHTML = (C.facts || []).map(([a, b]) => `<div><dt>${E(a)}</dt><dd>${E(b)}</dd></div>`).join('');
    // поводы: фото зала и куда ведёт кнопка
    const bySlug = s => C.halls.find(h => h.slug === s) || C.halls[0];
    $('occasions').hidden = $('occasions').hasAttribute('data-off') || !(C.occasions || []).length;
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
      st.date = wall.date; drawDays(); drawPlan();
      await Promise.all([loadDay(), loadMine()]);
      loadAvail().catch(() => {});
    } catch (e) { toast('Нет связи', e.message, 'alt'); }
    if (link) $('book').scrollIntoView();
    setInterval(() => { if (document.hidden || document.body.classList.contains('form')) return; loadDay().catch(() => {}); loadMine().catch(() => {}); loadWall().catch(() => {}); loadAvail().catch(() => {}); }, 20000);
  })();
})();
