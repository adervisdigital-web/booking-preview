// Страница гостя: свободные часы, заявка, статус своих заявок.
(() => {
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru') + ' ₽';
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const asDate = s => new Date(s + 'T12:00:00Z');
  const addDays = (s, k) => new Date(asDate(s).getTime() + k * 864e5).toISOString().slice(0, 10);
  const dayName = s => { const d = asDate(s); return `${WDF[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const hrsWord = n => n % 10 === 1 && n % 100 !== 11 ? 'час' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'часа' : 'часов';
  const LS = 'chp_my_requests';
  const store = { get() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v.slice(-8))); } catch {} } };

  async function api(path, data) {
    const r = await fetch('/api/public' + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || 'Нет связи, попробуйте ещё раз'), { code: j.error, status: r.status });
    return j;
  }

  let C, day = { busy: {}, past: 0 };
  const st = { date: '', sel: null, mine: [] };
  const hh = i => String((C.from + i) % 24).padStart(2, '0');
  const span = (a, n) => `${hh(a)}:00–${hh(a + n)}:00`;
  const taken = (id, i) => i < day.past || (day.busy[id] || []).some(([a, n]) => i >= a && i < a + n);

  function drawDays() {
    $('days').innerHTML = Array.from({ length: 14 }, (_, k) => { const s = addDays(C.today, k), d = asDate(s);
      return `<button type="button" class="day${s === st.date ? ' on' : ''}" data-day="${s}"><b>${d.getUTCDate()}</b><i>${k === 0 ? 'сегодня' : WD[d.getUTCDay()]}</i></button>`; }).join('');
  }
  function drawHalls() {
    $('halls').innerHTML = C.halls.map(x => `<article class="hall"><div class="ph" data-ph="${x.id}"><h3>${E(x.name)}</h3><span class="price">${rub(x.price)}/час</span></div>
      <div class="slots">${Array.from({ length: C.hours }, (_, i) => { const b = taken(x.id, i), sel = !b && st.sel && st.sel.id === x.id && i >= st.sel.a && i <= st.sel.b;
        return `<button type="button" class="sl${b ? ' b' : sel ? ' s' : ''}" data-id="${x.id}" data-i="${i}"${b ? ' disabled' : ''} aria-label="${E(x.name)}, ${hh(i)}:00, ${b ? 'занято' : 'свободно'}">${hh(i)}</button>`; }).join('')}</div></article>`).join('');
    document.querySelectorAll('.ph').forEach(el => { const x = C.halls.find(h => h.id === +el.dataset.ph);
      if (x.photo) el.style.backgroundImage = `url("${x.photo}")`;
      else { el.style.backgroundImage = `radial-gradient(80% 120% at 20% 0%, ${x.c1} 0%, transparent 55%), radial-gradient(70% 90% at 100% 100%, ${x.c2} 0%, transparent 60%)`; el.style.backgroundColor = '#14141c'; } });
  }
  function drawBar() {
    const s = st.sel;
    $('bar').classList.toggle('show', !!s);
    if (!s) return;
    const n = s.b - s.a + 1, x = C.halls.find(h => h.id === s.id);
    $('barT').textContent = `${x.name} · ${dayName(st.date)}`;
    $('barS').textContent = `${span(s.a, n)} · ${n} ${hrsWord(n)} · ${rub(x.price * n)}`;
  }
  const LABEL = { request: 'ждёт ответа', offered: 'предлагаем другое время', confirmed: 'подтверждено', rejected: 'отклонено', cancelled: 'отменено' };
  function drawMine() {
    $('mine').innerHTML = st.mine.slice().reverse().map(q => { const x = C.halls.find(h => h.id === q.hall_id);
      return `<div class="m ${q.status}"><div class="mh"><b>${E(x ? x.name : 'Зал')}, ${E(dayName(q.date))}, ${span(q.start, q.hours)}</b><span>${LABEL[q.status]}</span></div>
      ${q.status === 'offered' ? `<div class="row"><button type="button" class="btn" data-acc="${E(q.token)}">Согласиться</button><button type="button" class="btn g" data-dec="${E(q.token)}">Отказаться</button></div>` : ''}
      ${q.status === 'request' ? `<button type="button" class="lnk" data-dec="${E(q.token)}">Отменить заявку</button>` : ''}</div>`; }).join('');
  }
  async function loadDay() {
    day = await api(`/day?date=${st.date}`);
    if (st.sel) for (let i = st.sel.a; i <= st.sel.b; i++) if (taken(st.sel.id, i)) { st.sel = null; toast('Это время только что заняли', 'Выберите другое', 'alt'); break; }
    drawHalls(); drawBar();
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
      if (q.status === 'offered') toast('Предлагаем другое время', 'Посмотрите вверху страницы', 'alt');
      if (q.status === 'rejected') toast('Заявка отклонена', 'Позвоните нам, подберём время', 'alt');
    }
  }
  function tap(id, i) {
    const s = st.sel;
    if (!s || s.id !== id) st.sel = { id, a: i, b: i };
    else if (s.a === i && s.b === i) st.sel = null;
    else if (i >= s.a && i <= s.b) st.sel = i === s.a ? { id, a: i + 1, b: s.b } : { id, a: s.a, b: i - 1 };
    else { const a = Math.min(s.a, i), b = Math.max(s.b, i); let free = true; for (let k = a; k <= b; k++) if (taken(id, k)) free = false; st.sel = free ? { id, a, b } : { id, a: i, b: i }; }
    drawHalls(); drawBar();
  }
  const form = on => { document.body.classList.toggle('form', on); if (!on) $('err').textContent = ''; };
  function openForm() {
    const s = st.sel; if (!s) return; const n = s.b - s.a + 1, x = C.halls.find(h => h.id === s.id);
    $('sum').innerHTML = `<b>${E(x.name)}</b>, ${E(dayName(st.date))}, <b>${span(s.a, n)}</b><br>${n} ${hrsWord(n)} · ${rub(x.price * n)}`;
    form(true); setTimeout(() => $('fName').focus({ preventScroll: true }), 300);
  }
  async function send(ev) {
    ev.preventDefault();
    const s = st.sel; if (!s) return;
    const guests = parseInt($('fGu').value, 10);
    if (!$('fOk').checked) { $('err').textContent = 'Отметьте согласие на обработку персональных данных'; return; }
    const x = C.halls.find(h => h.id === s.id);
    $('send').disabled = true; $('err').textContent = '';
    try {
      const r = await api('/requests', { hall: x.slug, date: st.date, start: s.a, hours: s.b - s.a + 1, name: $('fName').value, phone: $('fTel').value, guests, comment: $('fCom').value, consent: true, website: $('fWeb').value });
      store.set([...store.get(), r.token]);
      st.mine.push(r); st.sel = null; form(false); drawMine();
      toast('Заявка отправлена', 'Администратор подтвердит бронь', '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await loadDay();
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
    if (t.closest('#openForm')) { openForm(); return; }
    if (t.closest('#closeForm') || t.closest('#dim')) { form(false); return; }
    const acc = t.closest('[data-acc]'), dec = t.closest('[data-dec]');
    if (acc || dec) {
      const token = (acc || dec).dataset[acc ? 'acc' : 'dec'];
      try { await api(`/requests/${encodeURIComponent(token)}/${acc ? 'accept' : 'decline'}`, {}); toast(acc ? 'Бронь подтверждена' : 'Заявка отменена', acc ? 'Ждём вас!' : '', acc ? 'ok' : 'alt'); }
      catch (e) { toast('Не получилось', e.message, 'alt'); }
      await loadMine().catch(() => {}); await loadDay().catch(() => {});
    }
  });
  $('sheet').addEventListener('submit', send);

  (async () => {
    try { C = await api('/config'); }
    catch { $('halls').innerHTML = '<p class="empty">Не удалось загрузить расписание. Обновите страницу или позвоните нам.</p>'; return; }
    const link = new URLSearchParams(location.search).get('b');
    if (link && /^[\w-]{10,40}$/.test(link) && !store.get().includes(link)) store.set([...store.get(), link]);
    st.date = C.today;
    $('name').textContent = C.name; $('sub').textContent = C.sub;
    $('tags').innerHTML = C.tags.map(t => `<span>${E(t)}</span>`).join('');
    $('call').href = `tel:${C.phoneHref}`; $('vk').href = C.vk;
    $('call').hidden = !C.phone; $('vk').hidden = !C.vk;
    if (C.programs?.length) { $('programsBox').hidden = false; $('programs').innerHTML = C.programs.map(p => `<div class="pr"><div><b>${E(p.name)}</b>${p.note ? `<i>${E(p.note)}</i>` : ''}</div><span>${E(p.price)}</span></div>`).join(''); }
    drawDays();
    await Promise.all([loadDay(), loadMine()]).catch(e => toast('Нет связи', e.message, 'alt'));
    setInterval(() => { if (document.hidden || document.body.classList.contains('form')) return; loadDay().catch(() => {}); loadMine().catch(() => {}); }, 20000);
  })();
})();
