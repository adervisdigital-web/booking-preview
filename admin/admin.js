// Кабинет администратора. 13.11: «Сейчас» по залам, список дня (удобно с телефона) и сетка, новая бронь полной формой
// с историей гостя по номеру, карточка брони (пришли / не пришли, ±1 час, правка, перенос, отмена, история, написать гостю),
// поиск по телефону и имени, отчёт за месяц, звук и уведомление о новой заявке.
(() => {
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru') + ' ₽';
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const asDate = s => new Date(s + 'T12:00:00Z');
  const addDays = (s, k) => new Date(asDate(s).getTime() + k * 864e5).toISOString().slice(0, 10);
  const dayShort = s => { const d = asDate(s); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const dayLong = s => { const d = asDate(s); return `${WDF[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const hrsWord = n => n % 10 === 1 && n % 100 !== 11 ? 'час' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'часа' : 'часов';
  const timesWord = n => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'раза' : 'раз';
  const store = { get(k, d) { try { const v = localStorage.getItem('chp_a_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('chp_a_' + k, JSON.stringify(v)); } catch {} } };

  class Unauth extends Error {}
  async function api(path, data) {
    const r = await fetch(path.startsWith('/api/public') ? path : '/api/admin' + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {});
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.error === 'auth') throw new Unauth();
    if (!r.ok) throw new Error(j.message || 'Нет связи, попробуйте ещё раз');
    return j;
  }

  let C, S = { date: '', day: null, last: '', seen: null, cur: null, view: store.get('view', innerWidth < 760 ? 'list' : 'grid'), sound: store.get('sound', true) };
  const hh = i => String((C.from + i) % 24).padStart(2, '0');
  const span = (a, n) => `${hh(a)}:00–${hh(a + n)}:00`;
  const hall = id => C.halls.find(h => h.id === id);
  const isFree = (h, i) => !S.day.bookings.some(b => b.hall_id === h && i >= b.start && i < b.start + b.hours);
  const cls = b => b.status === 'confirmed' ? (b.source === 'phone' ? 'phone' : 'confirmed') : b.status;
  const dayLabel = s => s === C.today ? 'Сегодня' : s === addDays(C.today, 1) ? 'Завтра' : dayShort(s);
  const digits = v => { let n = String(v || '').replace(/\D/g, ''); if (n.length === 11 && /^[78]/.test(n)) n = n.slice(1); return n; };
  const fmtTel = v => { const n = digits(v); return n.length === 10 ? `+7 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}` : v; };
  const STL = { request: 'заявка', offered: 'ждём ответа гостя', confirmed: 'подтверждено', rejected: 'отклонено', cancelled: 'отменено' };
  const nowIdx = () => S.date === C.today ? S.day.past - 1 : -1;
  // номер текущего часа рабочего дня по часам Перми (для брони не на открытом дне); 99 — день уже прошёл
  const localIdx = () => { const i = (new Date().getUTCHours() + C.tzOffset - C.from + 48) % 24; return i < C.hours ? i : -1; };
  const idxFor = date => date === C.today ? (S.date === C.today ? nowIdx() : localIdx()) : date < C.today ? 99 : -1;

  // ---------- лента 14 дней ----------
  const counts = {};
  async function loadCounts() {
    try { const c = await api('/api/public/config'); if (c.today !== C.today) { C.today = c.today; } } catch {}   // вкладка открыта всю ночь: «сегодня» сменится утром
    const dates = Array.from({ length: 14 }, (_, k) => addDays(C.today, k));
    await Promise.all(dates.map(s => api(`/day?date=${s}`).then(x => { counts[s] = x.bookings.filter(b => b.status === 'confirmed').length; }).catch(() => {})));
    drawDays();
  }
  function drawDays() {
    if (!S.day) return; const req = {}; S.day.pending.filter(q => q.status === 'request').forEach(q => req[q.date] = (req[q.date] || 0) + 1);
    $('adays').innerHTML = Array.from({ length: 14 }, (_, k) => { const s = addDays(C.today, k), dd = asDate(s);
      return `<button type="button" class="ad${s === S.date ? ' on' : ''}" data-goto="${s}" aria-label="${E(dayLabel(s))}: заявок ${req[s] || 0}, броней ${counts[s] ?? '…'}"><i>${k === 0 ? 'сегодня' : k === 1 ? 'завтра' : WD[dd.getUTCDay()]}</i><b>${dd.getUTCDate()}</b>${req[s] ? `<u>${req[s]}</u>` : ''}<small>${counts[s] ? `брони: ${counts[s]}` : '&nbsp;'}</small></button>`; }).join('');
  }

  // ---------- «Сейчас»: что происходит в каждом зале в эту минуту ----------
  function drawNow() {
    const i = nowIdx(), el = $('now');
    if (i < 0 || i >= C.hours) { el.hidden = true; return; }
    el.hidden = false;
    const freeNow = [];
    const tiles = C.halls.map(x => {
      const l = S.day.bookings.filter(b => b.hall_id === x.id && b.status === 'confirmed');
      const cur = l.find(b => i >= b.start && i < b.start + b.hours), next = l.filter(b => b.start > i).sort((a, b) => a.start - b.start)[0];
      if (cur) {
        const end = cur.start + cur.hours, ending = end - 1 === i;
        const st = cur.visit === 'arrived' ? 'в зале' : cur.visit === 'noshow' ? 'не пришли' : 'ждём гостей';
        return `<button type="button" class="nw busy${ending ? ' ending' : ''}${cur.visit === 'arrived' ? ' in' : cur.visit === 'noshow' ? ' ns' : ''}" data-b="${cur.id}"><b>${E(x.name)}</b><span>${E(cur.name || 'Гости')} · до ${hh(end)}:00</span><em>${ending ? 'заканчивают' : st}</em></button>`;
      }
      const soon = next && next.start === i + 1;
      if (!soon) { freeNow.push(`<button type="button" class="fchip" data-new="${x.id}" data-i="${i}">${E(x.name)}<small>${next ? `до ${hh(next.start)}:00` : 'до закрытия'}</small></button>`); return ''; }
      return `<button type="button" class="nw free soon" data-new="${x.id}" data-i="${i}"><b>${E(x.name)}</b><span>свободен до ${hh(next.start)}:00</span><em>в ${hh(next.start)}:00 ${E(next.name || 'бронь')}</em></button>`;
    }).join('');
    $('nowList').innerHTML = (tiles || '') + (freeNow.length ? `<div class="fnow"><i>Свободны сейчас (нажмите, чтобы записать)</i>${freeNow.join('')}</div>` : '');
  }

  // ---------- список дня ----------
  function drawList() {
    const l = S.day.bookings.slice().sort((a, b) => a.start - b.start || C.halls.indexOf(hall(a.hall_id)) - C.halls.indexOf(hall(b.hall_id)));
    const i = nowIdx();
    $('list').innerHTML = l.length ? l.map(b => {
      const gone = i >= b.start + b.hours, on = i >= b.start && !gone;
      const tag = b.status !== 'confirmed' ? `<em class="tg ${b.status}">${STL[b.status]}</em>` : b.visit === 'arrived' ? '<em class="tg in">в зале</em>' : b.visit === 'noshow' ? '<em class="tg ns">не пришли</em>' : on ? '<em class="tg wait">ждём</em>' : '';
      return `<button type="button" class="li ${cls(b)}${gone ? ' gone' : ''}${on ? ' on' : ''}" data-b="${b.id}">
        <span class="tm">${hh(b.start)}:00<i>до ${hh(b.start + b.hours)}:00</i></span>
        <span class="bd"><b>${E(hall(b.hall_id).name)} · ${E(b.name || 'По телефону')}</b><small>${b.guests ? `${b.guests} чел. · ` : ''}${rub(b.total)}${b.prepaid ? ` · предоплата ${rub(b.prepaid)}` : ''}${b.comment ? ` · «${E(b.comment)}»` : ''}</small></span>${tag}</button>`;
    }).join('') : `<p class="empty">На ${E(dayLabel(S.date).toLowerCase())} броней нет. Нажмите «+ Бронь», чтобы записать гостя.</p>`;
  }

  function draw() {
    const d = S.day, cols = `repeat(${C.hours}, 1fr)`, wait = d.pending.filter(q => q.status === 'request');
    const conf = d.bookings.filter(b => b.status === 'confirmed');
    $('kReq').textContent = wait.length; $('sReq').textContent = d.pending.length; $('kB').textContent = conf.length;
    $('kSum').textContent = rub(conf.filter(b => b.visit !== 'noshow').reduce((s, b) => s + b.total, 0));
    document.title = wait.length ? `(${wait.length}) Брони: кабинет` : 'Брони: кабинет';
    $('dTitle').textContent = `${dayLabel(S.date)}${S.date === C.today || S.date === addDays(C.today, 1) ? `, ${dayShort(S.date).split(', ')[1]}` : ''}`;
    drawNow();
    $('vList').classList.toggle('on', S.view === 'list'); $('vGrid').classList.toggle('on', S.view === 'grid');
    $('list').hidden = S.view !== 'list'; $('gridBox').hidden = S.view !== 'grid';
    if (S.view === 'list') drawList();
    else $('grid').innerHTML = `<div class="hrs"><span></span><div class="hh" style="grid-template-columns:${cols}">${Array.from({ length: C.hours }, (_, i) => `<span>${hh(i)}</span>`).join('')}</div></div>` +
      C.halls.map(x => `<div class="gr"><div class="n">${E(x.name)}<i>${rub(x.price)}/ч</i></div><div class="cells" style="grid-template-columns:${cols}">
        ${Array.from({ length: C.hours }, (_, i) => `<div class="cell${i < d.past - 1 ? ' past' : ''}" data-h="${x.id}" data-i="${i}"></div>`).join('')}
        ${d.bookings.filter(b => b.hall_id === x.id).map(b => `<button type="button" class="bk ${cls(b)}${b.visit === 'arrived' ? ' in' : b.visit === 'noshow' ? ' ns' : ''}" data-b="${b.id}" style="left:${b.start / C.hours * 100}%;width:${b.hours / C.hours * 100}%">${b.visit === 'arrived' ? '✓ ' : ''}${E(b.name || 'По телефону')}<small>${b.status === 'request' ? 'заявка' : b.status === 'offered' ? 'ждём гостя' : b.visit === 'noshow' ? 'не пришли' : `${b.hours} ${hrsWord(b.hours)}`}${b.guests ? ` · ${b.guests} чел.` : ''}${b.prepaid ? ' · ₽' : ''}</small></button>`).join('')}
      </div></div>`).join('');
    // новые заявки: звук, уведомление, подсветка
    const fresh = S.seen ? d.pending.filter(q => !S.seen.has(q.id) && q.status === 'request').map(q => q.id) : [];
    S.seen = new Set([...(S.seen || []), ...d.pending.map(q => q.id)]);
    if (fresh.length) alertNew(d.pending.filter(q => fresh.includes(q.id)));
    const byDay = {}; d.pending.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).forEach(q => (byDay[q.date] = byDay[q.date] || []).push(q));
    $('reqs').innerHTML = d.pending.length ? Object.entries(byDay).map(([date, list]) => `<h3 class="rday">${E(dayLabel(date))}<span>${list.length}</span></h3>` + list.map(q => `<div class="req ${q.status}${fresh.includes(q.id) ? ' in' : ''}">
      <div class="t">${q.status === 'offered' ? 'предложили другое время, ждём гостя' : 'заявка с сайта'} · ${new Date(q.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</div><b>${E(hall(q.hall_id).name)} · ${span(q.start, q.hours)}</b>
      <p>${E(q.name)} · гостей: ${q.guests} · ${rub(q.total)}<br><a class="tel" href="tel:${E(q.phone)}">${E(fmtTel(q.phone))}</a>${q.comment ? `<br><span class="cm">«${E(q.comment)}»</span>` : ''}</p>
      <div class="a2">${q.status === 'request' ? `<button type="button" class="yes" data-do="confirm" data-id="${q.id}">Подтвердить</button>` : ''}<div class="lk"><button type="button" data-b="${q.id}">Подробнее</button><button type="button" data-form="offer" data-id="${q.id}">Другое время</button><button type="button" class="dang" data-do="reject" data-id="${q.id}">Отклонить</button></div></div></div>`).join('')).join('')
      : '<p class="empty">Новых заявок нет.</p>';
    drawDays();
  }

  // ---------- звук и уведомление о новой заявке ----------
  let actx;
  function beep() {
    try { actx = actx || new AudioContext(); if (actx.state === 'suspended') actx.resume();
      [0, 0.18].forEach((t, k) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = k ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.3);
        o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.32); }); } catch {}
  }
  function alertNew(list) {
    const q = list[0], text = `${hall(q.hall_id).name}, ${dayShort(q.date)}, ${span(q.start, q.hours)} · ${q.name}, гостей: ${q.guests}`;
    toast(list.length > 1 ? `Новых заявок: ${list.length}` : 'Новая заявка', text);
    if (S.sound) beep();
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Новая заявка на бронь', { body: text, icon: '../icon-192.png', tag: 'req' + q.id }); } catch {}
  }
  function drawSound() { $('snd').textContent = S.sound ? '🔔 Звук заявок: вкл' : '🔕 Звук заявок: выкл'; }

  function drawCb(list) {
    const open = list.filter(c => !c.done_at);
    $('sCb').textContent = open.length;
    $('cbs').innerHTML = list.length ? list.map(c => `<div class="req${c.done_at ? ' ok' : ''}"><div class="t">${new Date(c.created_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      <b>${E(c.name)}</b><p><a class="tel" href="tel:${E(c.phone)}">${E(fmtTel(c.phone))}</a>${c.comment ? `<br>«${E(c.comment)}»` : ''}</p>
      ${c.done_at ? `<div class="st">Перезвонили · ${E(c.done_by)}</div>` : `<div class="a"><button type="button" class="yes" data-cb="${c.id}">Перезвонили</button></div>`}</div>`).join('')
      : '<p class="empty">Просьб перезвонить нет.</p>';
  }
  async function load(force) {
    api('/callbacks').then(drawCb).catch(() => {});
    const d = await api(`/day?date=${S.date}`), key = JSON.stringify(d);
    S.day = d;
    if (force || key !== S.last) { S.last = key; draw(); }
  }
  const go = date => { S.date = date; $('pick').value = date; return load(true).catch(onErr); };
  function onErr(e) { if (e instanceof Unauth) return showLogin(); toast('Не получилось', e.message, 'alt'); }
  let tt;
  function toast(t, s, kind) {
    $('tT').textContent = t; $('tS').textContent = s || ''; $('tIc').textContent = kind === 'alt' ? '!' : '✓';
    const el = $('toast'); el.className = 'toast show ' + (kind || 'ok'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3800);
  }
  const openDlg = html => { $('dlgBody').innerHTML = html; if (!$('dlg').open) $('dlg').showModal(); $('dlgBody').scrollTop = 0; };
  const closeDlg = () => { if ($('dlg').open) $('dlg').close(); S.cur = null; };

  // ---------- новая бронь: полная форма ----------
  const opt = (v, t, on) => `<option value="${E(v)}"${on ? ' selected' : ''}>${E(t)}</option>`;
  function bookForm(pre = {}) {
    const st = pre.start ?? (nowIdx() >= 0 ? Math.max(nowIdx(), 18 - C.from) : 18 - C.from);
    const h = pre.hall_id || ((!pre.date || pre.date === S.date) && C.halls.find(x => isFree(x.id, st)) || C.halls[0]).id;   // первый свободный зал на это время
    openDlg(`<h3>Новая бронь</h3>
      <div class="two"><label class="fld"><i>Зал</i><select id="fH">${C.halls.map(x => opt(x.id, `${x.name} · до ${x.cap} чел.`, x.id === h)).join('')}</select></label>
      <label class="fld sm2"><i>Дата</i><input id="fD" type="date" value="${E(pre.date || S.date)}"></label></div>
      <div class="two"><label class="fld"><i>Начало</i><select id="fS">${Array.from({ length: C.hours }, (_, i) => opt(i, `${hh(i)}:00`, i === st)).join('')}</select></label>
      <label class="fld"><i>Часов</i><select id="fN"></select></label></div>
      <label class="fld"><i>Телефон</i><input id="fT" type="tel" inputmode="tel" autocomplete="off" placeholder="+7"></label>
      <p class="ghint" id="fG" hidden></p>
      <div class="two"><label class="fld"><i>Имя</i><input id="fNm" maxlength="60" autocomplete="off"></label><label class="fld sm"><i>Гостей</i><input id="fGs" type="number" min="0" max="60" inputmode="numeric"></label></div>
      <label class="fld"><i>Пожелания (повод, торт, украшения)</i><input id="fC" maxlength="300"></label>
      <label class="fld"><i>Предоплата, ₽</i><input id="fP" type="number" min="0" inputmode="numeric" placeholder="0"></label>
      <p class="fsum" id="fSum"></p><p class="err" id="fErr" role="alert"></p>
      <div class="row"><button type="button" class="btn" data-book>Записать</button><button type="button" class="btn g" data-close>Отмена</button></div>`);
    fillHours(pre.hours || 2); calc();
    setTimeout(() => $('fT').focus(), 50);
  }
  function fillHours(want) {
    const st = +$('fS').value, max = C.hours - st, same = $('fD').value === S.date, h = +$('fH').value;
    let free = max; if (same) { free = 0; while (free < max && isFree(h, st + free)) free++; }
    $('fN').innerHTML = Array.from({ length: max }, (_, i) => opt(i + 1, `${i + 1} ${hrsWord(i + 1)}${same && i + 1 > free ? ' (занято)' : ''}`, i + 1 === Math.min(want, max))).join('');
  }
  function calc() {
    const x = hall(+$('fH').value), n = +$('fN').value, st = +$('fS').value, g = +$('fGs').value || 0;
    try { const sum = globalThis.Pricing.total(x, $('fD').value, st, n, g || 1, C);
      $('fSum').innerHTML = `${E(span(st, n))} · <b>${rub(sum)}</b>${g > x.cap ? ` <span class="warn">больше ${x.cap} чел.: +${rub(x.extra || 0)} за гостя в час</span>` : ''}`; } catch { $('fSum').textContent = ''; }
  }
  let gTimer;
  function guestHint(input, out, nameInput) {
    const n = digits(input.value); clearTimeout(gTimer);
    if (n.length !== 10) { out.hidden = true; return; }
    gTimer = setTimeout(async () => {
      try { const g = await api(`/guest?phone=${encodeURIComponent(n)}`);
        if (!g.phone || (!g.visits && !g.noshow && !g.upcoming)) { out.hidden = false; out.className = 'ghint'; out.textContent = 'Новый гость: раньше не бронировал'; return; }
        if (nameInput && !nameInput.value && g.name) nameInput.value = g.name;
        out.hidden = false; out.className = 'ghint' + (g.noshow ? ' bad' : ' good');
        out.innerHTML = `${E(g.name || 'Гость')}: был${g.visits ? ` ${g.visits} ${timesWord(g.visits)} на ${rub(g.sum)}` : ' 0 раз'}${g.last ? `, последний раз ${E(dayShort(g.last))}` : ''}${g.noshow ? `<br><b>Не пришёл ${g.noshow} ${timesWord(g.noshow)}</b>: можно попросить предоплату` : ''}${g.upcoming ? `<br>Есть ещё брони впереди: ${g.upcoming}` : ''}`;
      } catch { out.hidden = true; }
    }, 250);
  }
  async function saveBook() {
    $('fErr').textContent = '';
    const body = { hall_id: +$('fH').value, date: $('fD').value, start: +$('fS').value, hours: +$('fN').value, name: $('fNm').value, phone: $('fT').value,
      guests: $('fGs').value === '' ? '' : +$('fGs').value, comment: $('fC').value, prepaid: $('fP').value === '' ? 0 : +$('fP').value };
    try { const b = await api('/bookings', body); closeDlg(); if (body.date !== S.date) await go(body.date); else await load(true); loadCounts().catch(() => {});
      toast('Записали', `${hall(b.hall_id).name}, ${dayShort(b.date)}, ${span(b.start, b.hours)}`); }
    catch (e) { if (e instanceof Unauth) return showLogin(); $('fErr').textContent = e.message; }
  }

  // ---------- карточка брони ----------
  function guestLine(g) {
    if (!g) return '';
    const up = g.upcoming ? `${g.visits || g.noshow ? '<br>' : ''}Ещё броней впереди: ${g.upcoming}` : '';
    if (!g.visits && !g.noshow) return `<p class="ghint">${g.upcoming ? up : 'Новый гость: раньше не бронировал'}</p>`;
    return `<p class="ghint ${g.noshow ? 'bad' : 'good'}">Был ${g.visits} ${timesWord(g.visits)} на ${rub(g.sum)}${g.last ? `, последний раз ${E(dayShort(g.last))}` : ''}${g.noshow ? `<br><b>Не пришёл ${g.noshow} ${timesWord(g.noshow)}</b>` : ''}${up}</p>`;
  }
  // «БРОНЬ ЗАЛОВ» в шапке написан капслоком; в сообщении гостю — обычными буквами
  const venueName = () => C.name === C.name.toUpperCase() ? C.name.charAt(0) + C.name.slice(1).toLowerCase() : C.name;
  function msgText(b) {
    const hi = b.name ? `Здравствуйте, ${b.name}!` : 'Здравствуйте!', when = `${dayLong(b.date)}, ${span(b.start, b.hours)}`;
    const link = new URL(`../?b=${b.token}`, location.href).href;
    if (b.status === 'confirmed') return `${hi} Ваша бронь в «${venueName()}» подтверждена: зал «${b.hall}», ${when}${b.guests ? `, гостей: ${b.guests}` : ''}. Адрес: ${C.address}. Ждём вас! Если планы изменятся, позвоните: ${C.phone}`;
    if (b.status === 'offered') return `${hi} Это «${venueName()}». На выбранное время зал занят, можем предложить: зал «${b.hall}», ${when}. Подтвердите по ссылке ${link} или ответьте на это сообщение.`;
    return `${hi} Это «${venueName()}», по вашей заявке: зал «${b.hall}», ${when}. `;
  }
  async function details(id) {
    let b; try { b = await api(`/bookings/${id}`); } catch (e) { return onErr(e); }
    S.cur = b; const i = idxFor(b.date), started = i >= b.start, conf = b.status === 'confirmed', active = ['request', 'offered', 'confirmed'].includes(b.status);
    const tel = digits(b.phone);
    openDlg(`<div class="dh"><h3>${E(b.hall)}</h3><span class="tg ${conf && b.visit ? (b.visit === 'arrived' ? 'in' : 'ns') : b.status}">${conf && b.visit === 'arrived' ? 'в зале' : conf && b.visit === 'noshow' ? 'не пришли' : STL[b.status]}</span></div>
      <p class="big">${E(dayShort(b.date))}, ${span(b.start, b.hours)}<br><small>${b.hours} ${hrsWord(b.hours)} · ${rub(b.total)}${b.prepaid ? ` · предоплата ${rub(b.prepaid)}, к оплате ${rub(Math.max(0, b.total - b.prepaid))}` : ''}</small></p>
      <p>${E(b.name || 'Без имени')}${b.guests ? ` · гостей: ${b.guests}` : ''} · ${b.source === 'site' ? 'с сайта' : 'по телефону'}<br>${tel.length === 10 ? `<a class="tel" href="tel:+7${tel}">${E(fmtTel(b.phone))}</a>` : 'Телефон не указан'}${b.comment ? `<br>«${E(b.comment)}»` : ''}</p>
      ${guestLine(b.guest)}
      ${conf ? `<div class="seg"><button type="button" class="${b.visit === 'arrived' ? 'on ok' : ''}" data-visit="${b.visit === 'arrived' ? '' : 'arrived'}" ${b.start > i + 1 && i !== 99 ? 'disabled' : ''}>Пришли</button><button type="button" class="${b.visit === 'noshow' ? 'on bad' : ''}" data-visit="${b.visit === 'noshow' ? '' : 'noshow'}" ${!started ? 'disabled' : ''}>Не пришли</button></div>
        <div class="seg"><button type="button" data-ext="-1">−1 час</button><button type="button" data-ext="1">Продлить на час</button></div>` : ''}
      <div class="row wrap">${b.status === 'request' || b.status === 'offered' ? `<button type="button" class="btn" data-do="confirm" data-id="${b.id}">Подтвердить</button><button type="button" class="btn g" data-form="offer" data-id="${b.id}">Другое время</button>` : ''}
        ${conf ? `<button type="button" class="btn g" data-form="move" data-id="${b.id}">Перенести</button>` : ''}${active ? `<button type="button" class="btn g" data-edit>Изменить данные</button>` : ''}</div>
      ${tel.length === 10 && active ? `<div class="msg"><i>Написать гостю</i><textarea id="mText" rows="4">${E(msgText(b))}</textarea>
        <div class="mb"><button type="button" data-send="wa">WhatsApp</button><button type="button" data-send="tg">Telegram</button><button type="button" data-send="sms">SMS</button><button type="button" data-send="copy">Копировать</button></div></div>` : ''}
      ${b.source === 'site' ? `<details class="hist"><summary>Ссылка для гостя со статусом брони</summary><input class="copy" readonly value="${E(new URL(`../?b=${b.token}`, location.href).href)}"></details>` : ''}
      <details class="hist"><summary>История (${b.events.length})</summary>${b.events.map(ev => `<div><span>${new Date(ev.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> ${E(ev.who)}: ${E(ev.action)}${ev.detail ? ` <small>(${E(ev.detail)})</small>` : ''}</div>`).join('')}</details>
      <div class="row">${b.status === 'request' || b.status === 'offered' ? `<button type="button" class="btn g dang" data-do="reject" data-id="${b.id}">Отклонить</button>` : conf ? `<button type="button" class="btn g dang" data-do="cancel" data-id="${b.id}">Отменить бронь</button>` : ''}<button type="button" class="btn g" data-close>Закрыть</button></div>`);
  }
  function editForm(b) {
    openDlg(`<h3>Изменить данные</h3><p>${E(b.hall)}, ${E(dayShort(b.date))}, ${span(b.start, b.hours)}</p>
      <label class="fld"><i>Телефон</i><input id="eT" type="tel" inputmode="tel" value="${E(fmtTel(b.phone))}"></label><p class="ghint" id="eG" hidden></p>
      <div class="two"><label class="fld"><i>Имя</i><input id="eN" maxlength="60" value="${E(b.name)}"></label><label class="fld sm"><i>Гостей</i><input id="eGs" type="number" min="0" max="60" inputmode="numeric" value="${b.guests || ''}"></label></div>
      <label class="fld"><i>Пожелания</i><input id="eC" maxlength="300" value="${E(b.comment)}"></label>
      <label class="fld"><i>Предоплата, ₽</i><input id="eP" type="number" min="0" inputmode="numeric" value="${b.prepaid || ''}" placeholder="0"></label>
      <p class="err" id="eErr" role="alert"></p>
      <div class="row"><button type="button" class="btn" data-esave="${b.id}">Сохранить</button><button type="button" class="btn g" data-back="${b.id}">Назад</button></div>`);
  }
  function moveForm(b, action) {
    openDlg(`<h3>${action === 'offer' ? 'Предложить другое время' : 'Перенести бронь'}</h3><p>${E(b.name || 'Без имени')}, сейчас: ${E(hall(b.hall_id).name)}, ${E(dayShort(b.date))}, ${span(b.start, b.hours)}</p>
      <label class="fld"><i>Зал</i><select id="mH">${C.halls.map(x => opt(x.id, x.name, x.id === b.hall_id)).join('')}</select></label>
      <label class="fld"><i>Дата</i><input id="mD" type="date" value="${E(b.date)}"></label>
      <div class="two"><label class="fld"><i>Начало</i><select id="mS">${Array.from({ length: C.hours }, (_, i) => opt(i, `${hh(i)}:00`, i === b.start)).join('')}</select></label>
      <label class="fld"><i>Часов</i><select id="mN">${Array.from({ length: 10 }, (_, i) => opt(i + 1, i + 1, i + 1 === b.hours)).join('')}</select></label></div>
      <p class="err" id="mErr" role="alert"></p>
      <div class="row"><button type="button" class="btn" data-save="${action}" data-id="${b.id}">${action === 'offer' ? 'Предложить гостю' : 'Перенести'}</button><button type="button" class="btn g" data-back="${b.id}">Назад</button></div>`);
  }
  async function act(id, action, body = {}) { await api(`/bookings/${id}/${action}`, body); await load(true); loadCounts().catch(() => {}); }
  async function quick(path, body, msg) {
    try { await api(path, body); await load(true); if (S.cur) await details(S.cur.id); if (msg) toast(msg); }
    catch (e) { onErr(e); }
  }

  // ---------- поиск ----------
  let qTimer;
  function searchInput() {
    const q = $('q').value.trim(); clearTimeout(qTimer);
    if (q.length < 2) { $('qres').hidden = true; return; }
    qTimer = setTimeout(async () => {
      try { const l = await api(`/search?q=${encodeURIComponent(q)}`);
        $('qres').hidden = false;
        $('qres').innerHTML = l.length ? l.map(b => `<button type="button" data-found="${b.id}" data-date="${b.date}"><b>${E(b.name || 'Без имени')} · ${E(fmtTel(b.phone))}</b><span>${E(dayShort(b.date))}, ${span(b.start, b.hours)} · ${E(b.hall)} · ${b.visit === 'noshow' ? 'не пришли' : STL[b.status]}</span></button>`).join('') : '<p class="empty">Ничего не нашли</p>';
      } catch (e) { onErr(e); }
    }, 300);
  }

  // ---------- отчёт за месяц ----------
  async function reportDlg(month) {
    const a = month + '-01', next = addDays(month + '-28', 5).slice(0, 7) + '-01', z = addDays(next, -1);
    try { const r = await api(`/report?from=${a}&to=${z}`), m = asDate(a);
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      openDlg(`<div class="dh"><button type="button" class="nav" data-rep="${addDays(a, -1).slice(0, 7)}">‹</button><h3>${MONN[m.getUTCMonth()]} ${m.getUTCFullYear()}</h3><button type="button" class="nav" data-rep="${next.slice(0, 7)}">›</button></div>
        <div class="kpi rep"><div><i>Сумма броней</i><b>${rub(r.sum)}</b></div><div><i>Броней</i><b>${r.count}</b></div><div><i>Часов</i><b>${r.hours}</b></div></div>
        <dl class="srows">${row('Предоплаты получено', rub(r.prepaid))}${row('С сайта / по телефону', `${r.site} / ${r.phone}`)}${row('Заявок с сайта всего', r.requests)}${row('Отклонено заявок', r.rejected)}${row('Отменено', r.cancelled)}${row('Не пришли', `${r.noshow}${r.noshowSum ? ` (на ${rub(r.noshowSum)})` : ''}`)}</dl>
        <h3 class="sh3">По залам</h3><div class="rh">${r.halls.map(x => `<div><span>${E(x.name)}</span><b>${rub(x.sum)}</b><i style="--w:${Math.min(100, x.load)}%"></i><small>${x.count} бр. · ${x.hours} ч · ${x.load}%</small></div>`).join('')}</div>
        <p class="note">Сумма по тарифу залов, без бара и кухни. Неявки не считаются. Загрузка — доля занятых часов от всех часов работы.</p>
        <button type="button" class="btn g wide" data-close>Закрыть</button>`);
    } catch (e) { onErr(e); }
  }

  // ---------- клики ----------
  document.addEventListener('click', async ev => {
    const t = ev.target;
    if (!t.closest('#qres') && !t.closest('#q')) $('qres').hidden = true;
    let el;
    if ((el = t.closest('[data-found]'))) { $('qres').hidden = true; $('q').value = ''; await go(el.dataset.date); return details(+el.dataset.found); }
    if ((el = t.closest('.cell'))) { if (el.classList.contains('past') || !isFree(+el.dataset.h, +el.dataset.i)) return; return bookForm({ hall_id: +el.dataset.h, start: +el.dataset.i }); }
    if ((el = t.closest('[data-new]'))) return bookForm({ hall_id: +el.dataset.new, start: +el.dataset.i });
    if (t.closest('#addBtn') || t.closest('#fab')) return bookForm({});
    if (t.closest('[data-book]')) return saveBook();
    if ((el = t.closest('[data-b]'))) return details(+el.dataset.b);
    if ((el = t.closest('[data-goto]'))) return go(el.dataset.goto);
    if (t.closest('[data-close]')) return closeDlg();
    if ((el = t.closest('[data-back]'))) return details(+el.dataset.back);
    if ((el = t.closest('[data-form]'))) { const b = S.cur && S.cur.id === +el.dataset.id ? S.cur : [...S.day.bookings, ...S.day.pending].find(x => x.id === +el.dataset.id); if (!S.cur || S.cur.id !== b.id) S.cur = { ...b, hall: hall(b.hall_id).name }; return moveForm(b, el.dataset.form); }
    if (t.closest('[data-edit]')) return editForm(S.cur);
    if ((el = t.closest('[data-visit]'))) return quick(`/bookings/${S.cur.id}/visit`, { visit: el.dataset.visit }, { arrived: 'Отметили: гости пришли', noshow: 'Отметили: не пришли', '': 'Отметку сняли' }[el.dataset.visit]);
    if ((el = t.closest('[data-ext]'))) return quick(`/bookings/${S.cur.id}/extend`, { by: +el.dataset.ext }, +el.dataset.ext > 0 ? 'Продлили на час' : 'Сократили на час');
    if ((el = t.closest('[data-send]'))) {
      const text = $('mText').value, n = digits(S.cur.phone), k = el.dataset.send;
      try { await navigator.clipboard.writeText(text); } catch {}
      if (k === 'wa') window.open(`https://wa.me/7${n}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      else if (k === 'tg') { window.open(`https://t.me/+7${n}`, '_blank', 'noopener'); toast('Текст скопирован', 'Вставьте его в чат с гостем'); }
      else if (k === 'sms') location.href = `sms:+7${n}?&body=${encodeURIComponent(text)}`;
      else toast('Текст скопирован');
      return;
    }
    if ((el = t.closest('[data-esave]'))) {
      const id = +el.dataset.esave;
      try { await api(`/bookings/${id}/edit`, { name: $('eN').value, phone: $('eT').value, guests: $('eGs').value === '' ? '' : +$('eGs').value, comment: $('eC').value, prepaid: $('eP').value === '' ? 0 : +$('eP').value });
        await load(true); await details(id); toast('Сохранили'); }
      catch (e) { if (e instanceof Unauth) return showLogin(); $('eErr').textContent = e.message; }
      return;
    }
    if ((el = t.closest('[data-do]'))) {
      const d = el.dataset.do, id = +el.dataset.id;
      if ((d === 'cancel' || d === 'reject') && !confirm(d === 'cancel' ? 'Отменить бронь? Время освободится на сайте.' : 'Отклонить заявку?')) return;
      try { await act(id, d); toast({ confirm: 'Подтверждено', reject: 'Заявка отклонена', cancel: 'Бронь отменена' }[d], d === 'confirm' ? 'Напишите гостю: текст уже готов' : '');
        if (d === 'confirm') await details(id); else closeDlg(); }
      catch (e) { onErr(e); }
      return;
    }
    if ((el = t.closest('[data-save]'))) {
      const body = { hall_id: +$('mH').value, date: $('mD').value, start: +$('mS').value, hours: +$('mN').value }, id = +el.dataset.id;
      try { await act(id, el.dataset.save, body); toast(el.dataset.save === 'offer' ? 'Предложили гостю' : 'Перенесли', el.dataset.save === 'offer' ? 'Напишите гостю: текст уже готов' : ''); await details(id); }
      catch (e) { if (e instanceof Unauth) return showLogin(); $('mErr').textContent = e.message; }
      return;
    }
    if ((el = t.closest('[data-cb]'))) { try { await api(`/callbacks/${el.dataset.cb}/done`, {}); drawCb(await api('/callbacks')); toast('Отмечено'); } catch (e) { onErr(e); } return; }
    if ((el = t.closest('[data-rep]'))) return reportDlg(el.dataset.rep);
    if (t.closest('#repBtn')) return reportDlg(S.date.slice(0, 7));
    if (t.closest('#vList')) { S.view = 'list'; store.set('view', 'list'); return draw(); }
    if (t.closest('#vGrid')) { S.view = 'grid'; store.set('view', 'grid'); return draw(); }
    if (t.closest('#snd')) {
      S.sound = !S.sound; store.set('sound', S.sound); drawSound(); if (S.sound) { beep(); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {} }
      return;
    }
    if (t.closest('#statsBtn')) {
      try { const s = await api('/stats?days=30'), T = s.totals, n = k => T[k] || 0;
        const halls = C.halls.map(h => [h.name, n('hall:' + h.slug)]).sort((a, b) => b[1] - a[1]);
        const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
        const max = Math.max(1, ...s.views.map(v => v.n));
        openDlg(`<h3>Статистика сайта за 30 дней</h3>
          <div class="spark">${s.views.map(v => `<i style="height:${Math.max(4, v.n / max * 100)}%" title="${E(v.day)}: ${v.n}"></i>`).join('') || '<p class="empty">Данных пока нет</p>'}</div>
          <dl class="srows">${row('Просмотры сайта', n('view'))}${row('Начали бронь', n('book:open'))}${row('Отправили заявку', n('book:sent'))}${row('Заказали звонок', n('callback'))}
          ${row('Нажали «Позвонить»', n('click:tel'))}${row('Перешли во ВКонтакте', n('click:vk'))}${row('Перешли в MAX', n('click:max'))}${row('Перешли в Instagram', n('click:ig'))}${row('Открыли Яндекс Карты', n('click:map'))}</dl>
          <h3 class="sh3">Какие залы смотрят</h3><dl class="srows">${halls.map(h => row(E(h[0]), h[1])).join('')}</dl>
          <button type="button" class="btn g wide" data-close>Закрыть</button>`); } catch (e) { onErr(e); }
      return;
    }
    if (t.closest('#prev')) return go(addDays(S.date, -1));
    if (t.closest('#next')) return go(addDays(S.date, 1));
    if (t.closest('#today')) return go(C.today);
    if (t.closest('#csv')) { location.href = `/api/admin/export.csv?from=${S.date.slice(0, 8)}01&to=${addDays(S.date.slice(0, 8) + '28', 4).slice(0, 8)}01`; return; }
    if (t.closest('#out')) { await api('/logout', {}).catch(() => {}); showLogin(); }
  });
  // поля формы брони: часы, сумма, история гостя по номеру
  document.addEventListener('change', ev => {
    const id = ev.target.id;
    if (id === 'fS' || id === 'fH' || id === 'fD') { fillHours(+$('fN').value || 2); calc(); }
    if (id === 'fN') calc();
  });
  document.addEventListener('input', ev => {
    const id = ev.target.id;
    if (id === 'fGs') calc();
    if (id === 'fT') guestHint($('fT'), $('fG'), $('fNm'));
    if (id === 'eT') guestHint($('eT'), $('eG'), null);
    if (id === 'q') searchInput();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $('qres').hidden = true; if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('#dlg') && $('fErr') && ev.target.tagName === 'INPUT') saveBook(); });
  $('pick').addEventListener('change', () => { if ($('pick').value) go($('pick').value); });
  $('dlg').addEventListener('close', () => { S.cur = null; });

  let timer;
  function showLogin() { clearInterval(timer); $('app').hidden = true; $('login').hidden = false; }
  function showApp(name) {
    $('login').hidden = true; $('app').hidden = false; $('who').textContent = name;
    S.date = S.date || C.today; $('pick').value = S.date; S.seen = null; drawSound();
    load(true).catch(onErr); loadCounts().catch(() => {});
    let tick = 0; clearInterval(timer); timer = setInterval(() => { if (!$('dlg').open) { load().catch(onErr); if (++tick % 8 === 0) loadCounts().catch(() => {}); } else if (!document.hidden) api(`/day?date=${S.date}`).then(d => { const f = d.pending.filter(q => q.status === 'request' && S.seen && !S.seen.has(q.id)); if (f.length) { f.forEach(q => S.seen.add(q.id)); alertNew(f); } }).catch(() => {}); }, 7000);
  }
  $('login').addEventListener('submit', async ev => {
    ev.preventDefault(); $('lErr').textContent = '';
    try { const r = await api('/login', { login: $('lLogin').value.trim(), password: $('lPass').value }); $('lPass').value = ''; showApp(r.name); }
    catch (e) { $('lErr').textContent = e instanceof Unauth ? 'Неверный логин или пароль' : e.message; }
  });

  (async () => {
    try { C = await api('/api/public/config'); }
    catch { document.body.innerHTML = '<p class="empty">Нет связи с сервером. Обновите страницу.</p>'; return; }
    $('aName').textContent = C.name;
    try { showApp((await api('/me')).name); } catch { showLogin(); }
  })();
})();
