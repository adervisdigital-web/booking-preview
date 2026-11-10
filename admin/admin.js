// Кабинет администратора: сетка залов, заявки, бронь по телефону, перенос, отмена.
(() => {
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = n => Math.round(n).toLocaleString('ru') + ' ₽';
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const asDate = s => new Date(s + 'T12:00:00Z');
  const addDays = (s, k) => new Date(asDate(s).getTime() + k * 864e5).toISOString().slice(0, 10);
  const dayShort = s => { const d = asDate(s); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const hrsWord = n => n % 10 === 1 && n % 100 !== 11 ? 'час' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'часа' : 'часов';

  class Unauth extends Error {}
  async function api(path, data) {
    const r = await fetch(path.startsWith('/api/public') ? path : '/api/admin' + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {});
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.error === 'auth') throw new Unauth();
    if (!r.ok) throw new Error(j.message || 'Нет связи, попробуйте ещё раз');
    return j;
  }

  let C, S = { date: '', day: null, last: '', pop: null, seen: null };
  const hh = i => String((C.from + i) % 24).padStart(2, '0');
  const span = (a, n) => `${hh(a)}:00–${hh(a + n)}:00`;
  const hall = id => C.halls.find(h => h.id === id);
  const isFree = (h, i) => !S.day.bookings.some(b => b.hall_id === h && i >= b.start && i < b.start + b.hours);
  const cls = b => b.status === 'confirmed' ? (b.source === 'phone' ? 'phone' : 'confirmed') : b.status;

  function draw() {
    const d = S.day, cols = `repeat(${C.hours}, 1fr)`, wait = d.pending.filter(q => q.status === 'request');
    const conf = d.bookings.filter(b => b.status === 'confirmed');
    $('kReq').textContent = wait.length; $('sReq').textContent = d.pending.length; $('kB').textContent = conf.length;
    document.title = wait.length ? `(${wait.length}) Брони: кабинет` : 'Брони: кабинет';
    const eve = Math.max(0, 18 - C.from), cells = C.halls.length * (C.hours - eve);
    let busy = 0; conf.forEach(b => { for (let k = b.start; k < b.start + b.hours; k++) if (k >= eve) busy++; });
    $('kL').textContent = Math.round(busy / Math.max(cells, 1) * 100) + '%';
    $('grid').innerHTML = `<div class="hrs"><span></span><div class="hh" style="grid-template-columns:${cols}">${Array.from({ length: C.hours }, (_, i) => `<span>${hh(i)}</span>`).join('')}</div></div>` +
      C.halls.map(x => `<div class="gr"><div class="n">${E(x.name)}<i>${rub(x.price)}/ч</i></div><div class="cells" style="grid-template-columns:${cols}">
        ${Array.from({ length: C.hours }, (_, i) => `<div class="cell${i < d.past - 1 ? ' past' : ''}" data-h="${x.id}" data-i="${i}"></div>`).join('')}
        ${d.bookings.filter(b => b.hall_id === x.id).map(b => `<button type="button" class="bk ${cls(b)}" data-b="${b.id}" style="left:${b.start / C.hours * 100}%;width:${b.hours / C.hours * 100}%">${E(b.name || 'По телефону')}<small>${b.status === 'request' ? 'заявка' : b.status === 'offered' ? 'ждём гостя' : `${b.hours} ${hrsWord(b.hours)}`}${b.guests ? ` · ${b.guests} чел.` : ''}</small></button>`).join('')}
      </div></div>`).join('');
    const fresh = S.seen ? d.pending.filter(q => !S.seen.has(q.id)).map(q => q.id) : [];
    S.seen = new Set([...(S.seen || []), ...d.pending.map(q => q.id)]);
    $('reqs').innerHTML = d.pending.length ? d.pending.map(q => `<div class="req ${q.status}${fresh.includes(q.id) ? ' in' : ''}">
      <div class="t">${q.status === 'offered' ? 'предложили другое время, ждём гостя' : 'с сайта'}</div><b>${E(q.name)} · ${E(hall(q.hall_id).name)}</b>
      <p>${E(dayShort(q.date))}, ${span(q.start, q.hours)} · гостей: ${q.guests} · ${rub(q.total)}<br><a href="tel:${E(q.phone)}">${E(q.phone)}</a>${q.comment ? `<br>«${E(q.comment)}»` : ''}</p>
      <div class="a"><button type="button" class="yes" data-do="confirm" data-id="${q.id}">Подтвердить</button><button type="button" class="no" data-form="offer" data-id="${q.id}">Другое время</button><button type="button" class="no" data-do="reject" data-id="${q.id}">Отклонить</button><button type="button" class="no" data-goto="${E(q.date)}">Показать в сетке</button></div></div>`).join('')
      : '<p class="empty">Новых заявок нет.</p>';
  }

  function drawCb(list) {
    const open = list.filter(c => !c.done_at);
    $('sCb').textContent = open.length;
    $('cbs').innerHTML = list.length ? list.map(c => `<div class="req${c.done_at ? ' ok' : ''}"><div class="t">${new Date(c.created_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      <b>${E(c.name)}</b><p><a href="tel:${E(c.phone)}">${E(c.phone)}</a>${c.comment ? `<br>«${E(c.comment)}»` : ''}</p>
      ${c.done_at ? `<div class="st">Перезвонили · ${E(c.done_by)}</div>` : `<div class="a"><button type="button" class="yes" data-cb="${c.id}">Перезвонили</button></div>`}</div>`).join('')
      : '<p class="empty">Просьб перезвонить нет.</p>';
  }
  async function load(force) {
    api('/callbacks').then(drawCb).catch(() => {});
    const d = await api(`/day?date=${S.date}`), key = JSON.stringify(d);
    S.day = d;
    if (force || key !== S.last) { S.last = key; if (!S.pop || force) draw(); }
  }
  const go = date => { S.date = date; $('pick').value = date; closePop(); load(true).catch(onErr); };
  function onErr(e) { if (e instanceof Unauth) return showLogin(); toast('Не получилось', e.message, 'alt'); }
  let tt;
  function toast(t, s, kind) {
    $('tT').textContent = t; $('tS').textContent = s || ''; $('tIc').textContent = kind === 'alt' ? '!' : '✓';
    const el = $('toast'); el.className = 'toast show ' + (kind || 'ok'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3800);
  }

  function openPop(cell) {
    const h = +cell.dataset.h, i = +cell.dataset.i;
    if (cell.classList.contains('past') || !isFree(h, i)) return;
    S.pop = { h, i }; $('popT').textContent = `Бронь по телефону · ${hall(h).name}, ${hh(i)}:00`;
    $('pName').value = ''; $('pTel').value = '';
    const r = cell.getBoundingClientRect(), pop = $('pop');
    pop.style.left = Math.max(8, Math.min(r.left + scrollX, scrollX + innerWidth - 272)) + 'px';
    pop.style.top = r.bottom + scrollY + 6 + 'px';
    pop.classList.add('show');
  }
  function closePop() { $('pop').classList.remove('show'); S.pop = null; }
  async function addPhone(n) {
    const p = S.pop; if (!p) return;
    let k = 0; while (k < n && p.i + k < C.hours && isFree(p.h, p.i + k)) k++;
    if (k < n) toast('Записали на меньшее время', `Дальше зал занят: ${k} ${hrsWord(k)}`, 'alt');
    try { await api('/bookings', { hall_id: p.h, date: S.date, start: p.i, hours: k, name: $('pName').value, phone: $('pTel').value }); closePop(); await load(true); }
    catch (e) { onErr(e); }
  }

  const find = id => [...S.day.bookings, ...S.day.pending].find(b => b.id === id);
  function details(b) {
    const link = new URL(`../?b=${b.token}`, location.href).href;
    $('dlgBody').innerHTML = `<h3>${E(hall(b.hall_id).name)}</h3>
      <p>${E(dayShort(b.date))}, ${span(b.start, b.hours)} · ${rub(b.total)}<br>${E(b.name || 'Без имени')}${b.guests ? ` · гостей: ${b.guests}` : ''}<br>${b.phone ? `<a href="tel:${E(b.phone)}">${E(b.phone)}</a>` : 'Телефон не указан'}${b.comment ? `<br>«${E(b.comment)}»` : ''}</p>
      ${b.source === 'site' ? `<p>Ссылка для гостя со статусом брони:</p><input class="copy" readonly value="${E(link)}">` : ''}
      <div class="row">${b.status === 'confirmed' ? `<button type="button" class="btn g" data-form="move" data-id="${b.id}">Перенести</button><button type="button" class="btn g" data-do="cancel" data-id="${b.id}">Отменить бронь</button>` : `<button type="button" class="btn" data-do="confirm" data-id="${b.id}">Подтвердить</button><button type="button" class="btn g" data-form="offer" data-id="${b.id}">Другое время</button>`}</div>
      <button type="button" class="btn g wide" data-close>Закрыть</button>`;
    if (!$('dlg').open) $('dlg').showModal();
  }
  function moveForm(b, action) {
    const opt = (v, t, on) => `<option value="${E(v)}"${on ? ' selected' : ''}>${E(t)}</option>`;
    $('dlgBody').innerHTML = `<h3>${action === 'offer' ? 'Предложить другое время' : 'Перенести бронь'}</h3><p>${E(b.name || 'Без имени')}, сейчас: ${E(hall(b.hall_id).name)}, ${E(dayShort(b.date))}, ${span(b.start, b.hours)}</p>
      <label class="fld"><i>Зал</i><select id="mH">${C.halls.map(x => opt(x.id, x.name, x.id === b.hall_id)).join('')}</select></label>
      <label class="fld"><i>Дата</i><input id="mD" type="date" value="${E(b.date)}"></label>
      <div class="two"><label class="fld"><i>Начало</i><select id="mS">${Array.from({ length: C.hours }, (_, i) => opt(i, `${hh(i)}:00`, i === b.start)).join('')}</select></label>
      <label class="fld"><i>Часов</i><select id="mN">${Array.from({ length: 8 }, (_, i) => opt(i + 1, i + 1, i + 1 === b.hours)).join('')}</select></label></div>
      <p class="err" id="mErr" role="alert"></p>
      <div class="row"><button type="button" class="btn" data-save="${action}" data-id="${b.id}">${action === 'offer' ? 'Предложить гостю' : 'Перенести'}</button><button type="button" class="btn g" data-close>Отмена</button></div>`;
    if (!$('dlg').open) $('dlg').showModal();
  }
  async function act(id, action, body = {}) { await api(`/bookings/${id}/${action}`, body); if ($('dlg').open) $('dlg').close(); await load(true); }

  document.addEventListener('click', async ev => {
    const t = ev.target;
    if (S.pop && !t.closest('#pop') && !t.closest('.cell')) closePop();
    const n = t.closest('#pop [data-n]'); if (n) return addPhone(+n.dataset.n);
    if (t.closest('#popX')) return closePop();
    const cell = t.closest('.cell'); if (cell) return openPop(cell);
    const bk = t.closest('.bk'); if (bk) return details(find(+bk.dataset.b));
    const go2 = t.closest('[data-goto]'); if (go2) return go(go2.dataset.goto);
    if (t.closest('[data-close]')) return $('dlg').close();
    const f = t.closest('[data-form]'); if (f) return moveForm(find(+f.dataset.id), f.dataset.form);
    const d = t.closest('[data-do]');
    if (d) {
      if ((d.dataset.do === 'cancel' || d.dataset.do === 'reject') && !confirm(d.dataset.do === 'cancel' ? 'Отменить бронь?' : 'Отклонить заявку?')) return;
      try { await act(+d.dataset.id, d.dataset.do); toast({ confirm: 'Подтверждено', reject: 'Заявка отклонена', cancel: 'Бронь отменена' }[d.dataset.do]); } catch (e) { onErr(e); }
      return;
    }
    const sv = t.closest('[data-save]');
    if (sv) {
      const body = { hall_id: +$('mH').value, date: $('mD').value, start: +$('mS').value, hours: +$('mN').value };
      try { await act(+sv.dataset.id, sv.dataset.save, body); toast(sv.dataset.save === 'offer' ? 'Предложили гостю' : 'Перенесли', sv.dataset.save === 'offer' ? 'Позвоните гостю или отправьте ссылку' : ''); }
      catch (e) { if (e instanceof Unauth) return showLogin(); $('mErr').textContent = e.message; }
      return;
    }
    const cb = t.closest('[data-cb]'); if (cb) { try { await api(`/callbacks/${cb.dataset.cb}/done`, {}); drawCb(await api('/callbacks')); toast('Отмечено'); } catch (e) { onErr(e); } return; }
    if (t.closest('#statsBtn')) {
      try { const s = await api('/stats?days=30'), T = s.totals, n = k => T[k] || 0;
        const halls = C.halls.map(h => [h.name, n('hall:' + h.slug)]).sort((a, b) => b[1] - a[1]);
        const row = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
        const max = Math.max(1, ...s.views.map(v => v.n));
        $('dlgBody').innerHTML = `<h3>Статистика сайта за 30 дней</h3>
          <div class="spark">${s.views.map(v => `<i style="height:${Math.max(4, v.n / max * 100)}%" title="${E(v.day)}: ${v.n}"></i>`).join('') || '<p class="empty">Данных пока нет</p>'}</div>
          <dl class="srows">${row('Просмотры сайта', n('view'))}${row('Начали бронь', n('book:open'))}${row('Отправили заявку', n('book:sent'))}${row('Заказали звонок', n('callback'))}
          ${row('Нажали «Позвонить»', n('click:tel'))}${row('Перешли во ВКонтакте', n('click:vk'))}${row('Перешли в MAX', n('click:max'))}${row('Перешли в Instagram', n('click:ig'))}${row('Открыли Яндекс Карты', n('click:map'))}</dl>
          <h3 class="sh3">Какие залы смотрят</h3><dl class="srows">${halls.map(h => row(E(h[0]), h[1])).join('')}</dl>
          <button type="button" class="btn g wide" data-close>Закрыть</button>`;
        $('dlg').showModal(); } catch (e) { onErr(e); }
      return;
    }
    if (t.closest('#prev')) return go(addDays(S.date, -1));
    if (t.closest('#next')) return go(addDays(S.date, 1));
    if (t.closest('#today')) return go(C.today);
    if (t.closest('#csv')) { location.href = `/api/admin/export.csv?from=${S.date.slice(0, 8)}01&to=${addDays(S.date.slice(0, 8) + '28', 4).slice(0, 8)}01`; return; }
    if (t.closest('#out')) { await api('/logout', {}).catch(() => {}); showLogin(); }
  });
  $('pick').addEventListener('change', () => { if ($('pick').value) go($('pick').value); });

  let timer;
  function showLogin() { clearInterval(timer); $('app').hidden = true; $('login').hidden = false; }
  function showApp(name) {
    $('login').hidden = true; $('app').hidden = false; $('who').textContent = name;
    S.date = S.date || C.today; $('pick').value = S.date; S.seen = null;
    load(true).catch(onErr);
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden && !$('dlg').open) load().catch(onErr); }, 7000);
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
