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
  // 17.11 меню кухни: вкладки по разделам, строки «название · состав · цена»
  function drawMenu(k) {
    const M = C.menu || []; $('menu').hidden = !M.length; if (!M.length) return;
    st.mtab = k ?? st.mtab ?? 0; $('menuNote').textContent = C.menuNote || '';
    $('menuTabs').innerHTML = M.map((c, i) => `<button type="button" class="mtab${i === st.mtab ? ' on' : ''}" role="tab" aria-selected="${i === st.mtab}" data-mtab="${i}">${E(c.t)}<i>${c.items.length}</i></button>`).join('');
    const c = M[st.mtab];
    $('menuList').innerHTML = (c.note ? `<p class="mcnote">${E(c.note)}</p>` : '') + c.items.map(([n, p, d]) => `<div class="mi"><div><b>${E(n)}</b>${d ? `<span>${E(d)}</span>` : ''}</div><em>${E(p)} ₽</em></div>`).join('');
  }
  // 17.11 отзывы гостей: свои (после проверки администратором), средняя оценка, форма со звёздами
  const starsHtml = n => `<span class="st5" aria-label="${n} из 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
  const MONR = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  let RV = { count: 0, avg: 0, items: [] }, rvShown = 6;
  async function loadReviews() { try { RV = await api('/reviews'); } catch { RV = { count: 0, avg: 0, items: [] }; } drawReviews();
    if (RV.count >= 10) { $('yRate').hidden = false; $('yRate').href = '#reviews'; $('yRate').innerHTML = `<b>${String(RV.avg).replace('.', ',')}</b><span><i>★★★★★</i>${RV.count} оценок гостей</span>`; } }
  function drawReviews() {
    const word = n => n % 10 === 1 && n % 100 !== 11 ? 'отзыв' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'отзыва' : 'отзывов';
    $('rvSum').innerHTML = RV.count ? `<b class="rvavg">${String(RV.avg).replace('.', ',')}</b><div>${starsHtml(RV.avg)}<span>${RV.count} ${RV.count % 10 === 1 && RV.count % 100 !== 11 ? 'оценка' : [2, 3, 4].includes(RV.count % 10) && ![12, 13, 14].includes(RV.count % 100) ? 'оценки' : 'оценок'} гостей</span></div>`
      : '<div class="rvfirst"><b>Будьте первым</b><span>Расскажите, как прошёл вечер: это помогает другим выбрать зал</span></div>';
    if (C.ratings && C.ratings.length) $('rvSum').innerHTML += `<div class="rvsrcs">${C.ratings.map(g => `<a class="rvsrcb ${E(g.src)}" href="${E(g.url)}" target="_blank" rel="noopener" data-hit="click:reviews"><i>${g.src === 'vk' ? 'VK' : 'Я'}</i><span><b>${E(g.value)} ★</b>${E(g.name)} · ${E(g.count)}</span></a>`).join('')}</div>`;
    if (false) $('rvSum').innerHTML += `<a class="rvya" href="${E(C.yandexRating.url)}" target="_blank" rel="noopener" data-hit="click:reviews"><b>${E(C.yandexRating.value)}</b><span>${starsHtml(4.6)}${E(C.yandexRating.count)} отзывов на Яндекс Картах →</span></a>`;
    $('rvList').innerHTML = RV.items.slice(0, rvShown).map(r => { const d = new Date(r.created_at + C.tzOffset * 36e5), h = r.hall && C.halls.find(x => x.slug === r.hall);
      return `<article class="rv"><div class="rvh"><span class="rva" aria-hidden="true">${E(r.name.trim()[0] || '?')}</span><div><b>${E(r.name)}</b><span>${d.getUTCDate()} ${MONR[d.getUTCMonth()]}${h ? ` · зал «${E(h.name)}»` : ''}${r.source ? ` · <em class="rvtag ${E(r.source)}">${r.source === 'vk' ? 'ВКонтакте' : 'Яндекс Карты'}</em>` : ' · <em class="rvtag site">на сайте</em>'}</span></div>${starsHtml(r.rating)}</div>
        <p>${E(r.text)}</p>${r.reply ? `<div class="rvr"><b>Ответ «${E(C.name)}»</b><p>${E(r.reply)}</p></div>` : ''}</article>`; }).join('');
    $('rvMore').hidden = RV.items.length <= rvShown;
    $('rvSrc').hidden = !RV.items.some(r => r.source);
  }
  let rvRate = 0;
  function drawStars() { $('rvStars').innerHTML = [1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${i === rvRate}" aria-label="${i} из 5" class="${i <= rvRate ? 'on' : ''}" data-rate="${i}">★</button>`).join(''); }
  const rvForm = (on, hallSlug) => { document.body.classList.toggle('rvform', on); if (on) { $('rvErr').textContent = '';
    $('rvHall').innerHTML = '<option value="">Не важно</option>' + C.halls.map(x => `<option value="${E(x.slug)}"${x.slug === hallSlug ? ' selected' : ''}>${E(x.name)}</option>`).join('');
    const p = prefs.get(); if (p.name && !$('rvName').value) $('rvName').value = p.name; drawStars(); setTimeout(() => $('rvStars').querySelector('button').focus(), 50); } };
  async function sendReview(ev) {
    ev.preventDefault(); const err = $('rvErr');
    if (!rvRate) { err.textContent = 'Поставьте оценку'; return; }
    if ($('rvText').value.trim().length < 10) { err.textContent = 'Напишите пару слов о вечере'; return; }
    if (!$('rvOk').checked) { err.textContent = 'Нужно согласие на публикацию'; return; }
    $('rvSend').disabled = true;
    try { await api('/reviews', { name: $('rvName').value, rating: rvRate, text: $('rvText').value, hall: $('rvHall').value, consent: true, website: $('rvWeb').value });
      rvForm(false); $('rvText').value = ''; rvRate = 0; toast('Спасибо за отзыв!', 'Он появится на сайте после проверки', 'ok');
    } catch (e) { err.textContent = e.message || 'Не получилось отправить'; } finally { $('rvSend').disabled = false; }
  }
  // 17.11 как найти: общее фото здания и два входа (у каждого свои залы)
  function drawPlace() {
    const en = C.entrances || []; if (!C.buildingPhoto && !en.length) return;
    const hn = s => (C.halls.find(x => x.slug === s) || {}).name || s;
    $('place').hidden = false;
    const pic = C.schemePhoto || C.buildingPhoto;
    $('place').innerHTML = (pic ? `<figure class="pbld${C.schemePhoto ? ' scheme' : ''}"><img src="${E(pic)}" alt="${E((C.address ? C.address + ", " : "") + "здание, вид сверху")}" loading="lazy">${en.filter(e => e.pin).map((e, i) => `<button type="button" class="ppin" style="left:${+e.pin[0]}%;top:${+e.pin[1]}%" data-pin="${i}" aria-label="${E(e.title)}"><b>${i + 1}</b><span class="ppop"><img src="${E(e.photo)}" alt=""><i>${E(e.title)}</i></span></button>`).join('')}<figcaption>${E(C.address || '')} · ${en.length} ${en.length === 1 ? 'вход' : 'входа'} — нажмите на цифру</figcaption></figure>` : '')
      + `<div class="pents">${en.map((e, i) => `<figure class="pent"><img src="${E(e.photo)}" alt="${E(e.title)}" loading="lazy"><span class="pnum">${i + 1}</span>
        <figcaption><b>${E(e.title)}</b><span>${E(e.note || '')}</span>${(e.halls || []).length ? `<em>Залы: ${e.halls.map(hn).map(E).join(', ')}</em>` : ''}</figcaption></figure>`).join('')}</div>`;
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
  const SVG = {
    mic: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    sport: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10l-5 0M3 10h5M7 20l2.5-5.5M17 20l-2.5-5.5"/>',
    screen: '<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
    pad: '<path d="M7 8h10a4 4 0 0 1 4 4l.6 4.2a2.5 2.5 0 0 1-4.4 2L15 16H9l-2.2 2.2a2.5 2.5 0 0 1-4.4-2L3 12a4 4 0 0 1 4-4z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17.5" cy="13.5" r=".6"/>',
    vr: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4l-1.5-2.2a1.8 1.8 0 0 0-3 0L9 17H5a2 2 0 0 1-2-2z"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="9" cy="15" r=".9"/><circle cx="15" cy="15" r=".9"/>',
    pc: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20M9 16l-1 4M15 16l1 4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    rub: '<path d="M8 21V3h5.5a4.5 4.5 0 0 1 0 9H5M5 16h9"/>',
    v360: '<path d="M21 12c0 2.2-4 4-9 4s-9-1.8-9-4 4-4 9-4c2.3 0 4.4.4 6 1"/><path d="M16 6.5 18.5 9 16 11.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2A5 5 0 0 1 21 19"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG[k] || SVG.users}</svg>`;
  // разбор строки «что есть в зале» и списков игр в темы: Петь · Смотреть · Играть · Для чего
  function hallFeats(x) {
    const toks = String(x.what || '').split(/[,.]\s+/).map(t => t.trim()).filter(Boolean), lists = {};
    String(x.games || '').split(/;\s*/).forEach(s => { const m = /^([^:]+):\s*(.+)$/.exec(s.trim()); if (m) lists[m[1].toLowerCase()] = m[2].replace(/\s*и другие$/, '').trim(); });
    const list = re => { const k = Object.keys(lists).find(k => re.test(k)); return k ? lists[k] : ''; };
    const G = { sing: [], watch: [], play: [], fit: [] }, notes = [], add = (g, ic, t, s) => { if (!G[g].some(i => i.t === t)) G[g].push({ ic, t, s }); };
    for (const t of toks) {
      const ps = /playstation\s*(\d)/i.exec(t), scr = /(\d+(?:,\d+)?)\s*м/.exec(t);
      if (/караоке/i.test(t)) add('sing', 'mic', 'Караоке', /два микрофона/i.test(t) ? '2 микрофона' : '');
      else if (/экран/i.test(t)) add('watch', 'screen', 'Экран', scr ? scr[1] + ' м' : '');
      else if (/кино|фильм/i.test(t)) add('watch', 'film', 'Кино', '');
      else if (/спорт/i.test(t)) add('watch', 'sport', 'Спорт-трансляции', '');
      else if (ps) { add('play', 'pad', 'PlayStation ' + ps[1], ''); const l = list(new RegExp('playstation\\s*' + ps[1], 'i')); if (l) notes.push(['PlayStation ' + ps[1], l]); }
      else if (/(^|\s)vr($|\s)/i.test(t)) { add('play', 'vr', 'VR', ''); const l = list(/^vr/i); if (l) notes.push(['VR', l]); }
      else if (/настольн/i.test(t)) { add('play', 'dice', 'Настольные игры', ''); const l = list(/настольн/i); if (l) notes.push(['Настольные', l]); }
      else if (/^пк$|компьютер/i.test(t)) add('play', 'pc', 'ПК', '');
      else if (/романт/i.test(t)) add('fit', 'heart', 'Свидание', '');
      else if (/закрыт/i.test(t)) {}   // все залы закрытые — не выделяем
      else if (/больш\S* компан/i.test(t)) add('fit', 'users', 'Большая компания', '');
    }
    const T = { sing: 'Петь', watch: 'Смотреть', play: 'Играть', fit: 'Подходит' };
    const rows = Object.keys(T).filter(k => G[k].length).map(k => `<div class="fg"><span class="fgl">${T[k]}</span><div class="fgi">${G[k].map(i => `<span class="fc">${icon(i.ic)}${E(i.t)}${i.s ? `<i>${E(i.s)}</i>` : ''}</span>`).join('')}</div>${k === 'play' && notes.length ? `<div class="fgn">${notes.map(([n, l]) => `<p><b>${E(n)}:</b> ${E(l)}</p>`).join('')}</div>` : ''}</div>`).join('');
    return rows ? `<div class="hdfeats2">${rows}</div>` : '';
  }
  const minRate = x => Math.min(...Object.values(x.rates || {}).flatMap(r => Array.isArray(r) ? r.map(v => v[1]) : [r]).filter(v => +v > 0));
  // Карточка зала, как товар во ВКонтакте: фото, видео, описание, что есть в зале, цены
  function openMore(id) {
    const x = hall(id), media = [x.photo, ...(x.gallery || [])].filter(Boolean);
    // окно зала: сначала видео-обзор 360° (без звука, по кругу), затем фото; миниатюры переключают главное окно
    const items = [...(x.video ? ['@video'] : []), ...media];
    hdStage = v => v === '@video'
      ? `<video src="${E(x.video)}" controls autoplay muted loop playsinline preload="metadata"${x.photo ? ` poster="${E(x.photo)}"` : ''} aria-label="Видео-обзор зала ${E(x.name)}"></video>`
      : `<img class="hdbg" src="${E(v)}" alt="" aria-hidden="true"><img class="hdph" src="${E(v)}" alt="Зал ${E(x.name)}" title="Открыть на весь экран">`;
    st.hd = { items, i: 0 };
    // 19.11 «Что есть в зале»: темы по смыслу (петь · смотреть · играть · для чего), линейные иконки вместо смайликов, списки игр под пунктом
    const feats = hallFeats(x);
    $('hdBody').innerHTML = `<div class="hdmedia"><div class="hdstage" id="hdStage">${items.length ? hdStage(items[0]) : ''}</div>
        ${items.length > 1 ? `<button type="button" class="hdnav prev" data-hnav="-1" aria-label="Предыдущее фото">‹</button><button type="button" class="hdnav next" data-hnav="1" aria-label="Следующее фото">›</button><span class="hdcount" id="hdCount">1 / ${items.length}</span>` : ''}
        ${items.length > 1 ? `<div class="thumbs">${items.map((m, i) => `<button type="button" data-thumb="${E(m)}" data-ti="${i}"${i ? '' : ' class="on"'} aria-label="${m === '@video' ? 'Видео 360°' : 'Фото ' + (i + (x.video ? 0 : 1))}"><img src="${E(m === '@video' ? (x.photo || media[0] || '') : m)}" alt="" loading="lazy">${m === '@video' ? '<span class="tplay">▶ 360°</span>' : ''}</button>`).join('')}</div>` : ''}</div>
      <div class="hdtext">
        <div class="hdhnav">${(() => { const L = C.halls, i = L.findIndex(h => h.id === x.id), pv = L[(i - 1 + L.length) % L.length], nx = L[(i + 1) % L.length];
          return `<button type="button" data-hall-go="${pv.id}" aria-label="Предыдущий зал">‹ ${E(pv.name)}</button><span>${i + 1} из ${L.length}</span><button type="button" data-hall-go="${nx.id}" aria-label="Следующий зал">${E(nx.name)} ›</button>`; })()}</div>
        <h3 id="hdT">${E(x.name)}</h3>
        <ul class="hdmeta"><li>${icon('users')}до ${x.cap} гостей</li><li>${icon('rub')}от ${num(minRate(x))} ₽/ч</li>${x.video ? `<li class="v">${icon('v360')}видео 360°</li>` : ''}</ul>
        ${x.desc ? `<p class="lead2">${E(x.desc)}</p>` : ''}
        <div class="hdmid">
          ${feats}
          <div class="hdprice"><p class="hdl">Цена за час, весь зал</p><dl class="hdpr">${rateLines(x)}</dl>${x.extra ? `<p class="extra">Больше ${x.cap} гостей: +${x.extra} ₽ в час за каждого</p>` : ''}</div>
        </div>
        <div class="hdfoot"><div class="hdfp"><small>за час, весь зал</small><b>от ${num(minRate(x))} ₽</b></div><button type="button" class="pick hdgo" data-pick="${x.id}">Выбрать время →</button></div>
      </div>
      <button type="button" class="x hdx" data-close-hall aria-label="Закрыть">×</button>`;
    $('hdBody').querySelector('.hdmedia').insertAdjacentHTML('beforeend', '<button type="button" class="hdfull" data-full aria-label="На весь экран"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>');
    $('hallDlg').showModal(); hit('hall:' + x.slug);
  }
  function hdGo(i) {
    st.hd.i = i; $('hdStage').innerHTML = hdStage(st.hd.items[i]); const c = $('hdCount'); if (c) c.textContent = `${i + 1} / ${st.hd.items.length}`;
    document.querySelectorAll('[data-thumb]').forEach(b => { const on = +b.dataset.ti === i; b.classList.toggle('on', on); if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  }
  const hit = k => { fetch('/api/public/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }), keepalive: true }).catch(() => {}); };
  // дни: у каждого цифра, сколько залов подходит под гостей и длительность (расписание 14 дней в кеше на минуту)
  const dayCache = {};
  const fitsDay = d => C.halls.filter(x => { if (guests() > x.cap) return false; const w = bestWin(d, x.id, st.dur); return w && (st.dur >= 99 || w.n >= st.dur); }).length;
  // 16.11 выбор даты (Артём: «не нравится решение с выбором даты»): неделя крупными плитками с полоской загрузки,
  // месяц и стрелки сверху, свой календарь вместо браузерного
  const MONN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const offOf = s => Math.round((asDate(s) - asDate(C.today)) / 864e5);
  const horizon = () => C.horizonDays || 90;
  const visDates = () => Array.from({ length: 7 }, (_, k) => addDays(C.today, st.dpage * 7 + k)).filter(s => offOf(s) <= horizon());
  function dayTile(s, cls) {
    const d = asDate(s), k = offOf(s), c = dayCache[s], n = c ? fitsDay(c.d) : null, wd = d.getUTCDay(), we = wd === 0 || wd === 5 || wd === 6;
    const top = k === 0 ? 'сегодня' : k === 1 ? 'завтра' : WD[wd];
    const lab = n === null ? '' : n ? `, подходит залов: ${n}` : ', под ваши условия мест нет';
    const meter = n === null ? '<span class="dm wait"></span>' : `<span class="dm"><s style="--f:${(n / C.halls.length).toFixed(2)}"></s></span>`;
    const note = n === null ? '' : n ? `<em>${n} ${n === 1 ? 'зал' : n < 5 ? 'зала' : 'залов'}</em>` : '<em>мест нет</em>';
    return `<button type="button" class="${cls}${s === st.date ? ' on' : ''}${n === 0 ? ' none' : ''}${we ? ' we' : ''}" data-day="${s}" aria-label="${E(dayName(s))}${lab}"${s === st.date ? ' aria-current="date"' : ''}><i>${top}</i><b>${d.getUTCDate()}</b>${meter}${note}</button>`;
  }
  function drawDays() {
    if (st.dpFor !== st.date) { st.dpage = Math.floor(offOf(st.date) / 7); st.dpFor = st.date; }
    const vis = visDates();
    $('days').innerHTML = vis.map(s => dayTile(s, 'day')).join('');
    const m1 = asDate(vis[0]).getUTCMonth(), m2 = asDate(vis[vis.length - 1]).getUTCMonth();
    $('dpMon').textContent = m1 === m2 ? MONN[m1] : `${MONN[m1]} — ${MONN[m2]}`;
    const k = offOf(st.date); $('dpSel').textContent = (k === 0 ? 'сегодня, ' : k === 1 ? 'завтра, ' : '') + dayName(st.date);
    document.querySelector('[data-dpage="-1"]').disabled = st.dpage <= 0;
    document.querySelector('[data-dpage="1"]').disabled = (st.dpage + 1) * 7 > horizon();
    if (!$('calPop').hidden) drawCal();
  }
  function drawCal() {
    if (st.cm == null) st.cm = asDate(st.date).getUTCFullYear() * 12 + asDate(st.date).getUTCMonth();
    const y = Math.floor(st.cm / 12), m = st.cm % 12, first = new Date(Date.UTC(y, m, 1, 12)), lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate(), last = addDays(C.today, horizon());
    const t0 = asDate(C.today), tm = t0.getUTCFullYear() * 12 + t0.getUTCMonth(), lm = asDate(last).getUTCFullYear() * 12 + asDate(last).getUTCMonth();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (s < C.today || s > last) { cells += `<span class="cx">${d}</span>`; continue; }
      const c = dayCache[s], n = c ? fitsDay(c.d) : null, wd = asDate(s).getUTCDay();
      cells += `<button type="button" class="cd${s === st.date ? ' on' : ''}${s === C.today ? ' td' : ''}${wd === 0 || wd === 5 || wd === 6 ? ' we' : ''}${n === 0 ? ' none' : ''}" data-day="${s}" aria-label="${E(dayName(s))}">${d}${n ? '<i></i>' : ''}</button>`;
    }
    $('calPop').innerHTML = `<div class="cpt"><b>Выберите дату</b><button type="button" class="cpx" data-calx aria-label="Закрыть календарь">×</button></div><div class="cmh"><button type="button" class="dparr" data-cm="-1" aria-label="Предыдущий месяц"${st.cm <= tm ? ' disabled' : ''}>‹</button><b>${MONN[m]} ${y}</b><button type="button" class="dparr" data-cm="1" aria-label="Следующий месяц"${st.cm >= lm ? ' disabled' : ''}>›</button></div>`
      + `<div class="cwd">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w, i) => `<span${i >= 4 ? ' class="we"' : ''}>${w}</span>`).join('')}</div><div class="cgridd">${cells}</div>`
      + `<p class="cnote">Бронь на ${horizon()} дней вперёд. Точка — есть залы под ваши условия.</p>`;
  }
  const calOpen = on => { $('calPop').hidden = !on; $('calBtn').setAttribute('aria-expanded', on); $('calBtn').classList.toggle('on', on); document.body.classList.toggle('calopen', on); if (on) { st.cm = null; drawCal(); } };
  async function loadAvail() {
    const now = Date.now(), dates = [...new Set([...Array.from({ length: 14 }, (_, k) => addDays(C.today, k)), ...(st.dpage != null ? visDates() : [])])].filter(s => !dayCache[s] || now - dayCache[s].t > 60000);
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
    if (!st.pick && rows.length) st.pick = (good[0] || rows[0]).x.id;
    if (st.pick && !st.sel) { const w0 = bestWin(day, st.pick, st.dur); if (w0 && !taken(st.pick, w0.a)) st.sel = { id: st.pick, a: w0.a, b: w0.a + (st.dur >= 99 ? w0.n : Math.min(w0.n, st.dur)) - 1 }; }
    const durTxt = st.dur >= 99 ? 'до утра' : `на ${st.dur} ${hrsWord(st.dur)}`;
    const big = C.halls.reduce((m, x) => x.cap > m.cap ? x : m, C.halls[0]);
    $('fitSum').innerHTML = g > big.cap
      ? `<b>Самый вместительный зал: ${E(big.name)}, до ${big.cap} человек.</b> Для компании больше ${big.cap} человек <a href="#contacts">позвоните нам</a>, подскажем варианты.`
      : good.length
      ?`<b>${good.length} из ${C.halls.length}</b> подходят для ${g} ${g === 1 ? 'гостя' : 'гостей'} ${durTxt} · от ${rub(Math.min(...good.map(o => o.r.price)))}`
      : `<b>На ${dayMon(st.date)} под ${g} ${g === 1 ? 'гостя' : 'гостей'} ${durTxt} мест нет.</b> <span id="nextFree">Ищем ближайшую дату…</span>`;
    if (!good.length && g <= big.cap) findNext(); else scan++;
    // 16.11 пульт брони: лента залов под фото выбранного зала (подходящие ярко, остальные приглушены)
    st.order = rows.map(o => o.x.id);
    $('slots').innerHTML = rows.map(({ x, r }) => { const on = st.pick === x.id;
      const sub = r.f === 'no' ? 'не поместитесь' : r.w ? `${r.full ? '' : 'только '}с ${hh(r.w.a)}:00 · ${rub(r.price)}` : 'занят';
      return `<button type="button" class="hs f-${r.f}${on ? ' on' : ''}${r.rank > 5 ? ' faded' : ''}" id="b-${x.id}" data-hpick="${x.id}" aria-pressed="${on}" aria-label="${E(x.name)}, до ${x.cap} человек, ${E(r.text)}">
        ${x.photo ? `<img src="${E(x.photo)}" alt="" loading="lazy" decoding="async">` : '<span class="ph"></span>'}<span class="hst"><b>${E(x.name)}</b><i>${E(sub)}</i></span></button>`; }).join('');
    drawPicker();
  }
  const PARTS = i => { const h = (C.from + i) % 24; return h >= 6 && h < 18 ? 'День' : h >= 18 ? 'Вечер' : 'Ночь'; };
  function drawPicker() {
    const x = st.pick && hall(st.pick);
    if (!x) { $('cstage').innerHTML = '<div class="cempty"><b>Выберите зал</b><p>Ниже все 10 залов: яркие подходят под вашу компанию и время.</p></div>'; $('picker').innerHTML = '<p class="pkline">Сначала выберите зал.</p>'; return; }
    const i = (st.order || []).indexOf(x.id), r = rowInfo(x);
    $('cstage').innerHTML = `${x.photo ? `<img class="cph" src="${E(x.photo)}" alt="">` : ''}
      <div class="cinfo"><span class="ckick">до ${x.cap} человек</span>
        <h3>${E(x.name)}</h3><p>${E(x.what || '')}</p>
        <div class="cbtns"><button type="button" class="cbtn" data-more="${x.id}">${x.video ? '▶ Видео 360° и фото' : 'Все фото зала'}</button>${r.f !== 'ok' ? `<span class="cwarn">${r.f === 'tight' ? 'тесновато: доплата за гостей сверх ' + x.cap : 'на вашу компанию мал'}</span>` : ''}</div></div>
      <button type="button" class="carr prev" data-hstep="-1" aria-label="Предыдущий зал">‹</button><button type="button" class="carr next" data-hstep="1" aria-label="Следующий зал">›</button>`;
    const mine = st.sel && st.sel.id === x.id, rowsH = [];
    for (let a = 0; a < C.hours; a += 6) rowsH.push([a, Math.min(C.hours, a + 6)]);
    const cell = i => { const past = i < day.past, b = taken(x.id, i), sel = !b && mine && i >= st.sel.a && i <= st.sel.b;
      const free = j => j >= 0 && j < C.hours && !taken(x.id, j), inSel = j => mine && j >= st.sel.a && j <= st.sel.b;
      let cls = past ? ' p b' : b ? ' b' : sel ? ' s' : '';
      if (!b) cls += sel ? (!inSel(i - 1) ? ' rs' : '') + (!inSel(i + 1) ? ' re' : '') : (!free(i - 1) || inSel(i - 1) ? ' rs' : '') + (!free(i + 1) || inSel(i + 1) ? ' re' : '');
      if (night(i)) cls += ' n'; if (st.date === C.today && i === day.past && day.past > 0) cls += ' now';
      return `<button type="button" class="sl${cls}" data-id="${x.id}" data-i="${i}"${b ? ' disabled' : ''} aria-label="${hh(i)}:00, ${past ? 'прошло' : b ? 'занято' : sel ? 'выбрано' : 'свободно'}">${hh(i)}:00</button>`; };
    const n = mine ? st.sel.b - st.sel.a + 1 : 0;
    $('picker').innerHTML = `<div class="pkbody">${rowsH.map(([a, b]) => `<div class="pkrow"><span class="pkl">${PARTS(a)}</span><div class="pkcells">${Array.from({ length: b - a }, (_, k) => cell(a + k)).join('')}</div></div>`).join('')}
      <div class="hint pkhint"><em>свободно</em><em class="n">ночь</em><em class="b">занято</em><em class="s">ваш выбор</em></div></div>
      ${mine ? `<div class="durrow"><span class="pl">Сколько часов</span>
        <div class="stepper"><button type="button" data-adj="-1" aria-label="На час меньше">−</button><output>${n} ч</output><button type="button" data-adj="1" aria-label="На час больше">+</button></div>
        <button type="button" class="chip${st.sel.b === C.hours - 1 ? ' on' : ''}" data-tomorning>до утра</button><span class="durend">${hh(st.sel.a)}:00 → ${hh(st.sel.b + 1)}:00</span></div>` : ''}
      <div class="ctotal">${mine ? `<div class="ctl"><span>${E(x.name)} · ${E(dayName(st.date))}</span><b>${span(st.sel.a, n)}, ${n} ${hrsWord(n)}</b></div><div class="ctp"><small>примерно</small><b class="pkprice">${rub(costOf(st.sel))}</b></div>
        <button type="button" class="pkgo" data-open-form>Оставить заявку →</button>`
        : `<p class="pkline">Нажмите на час, когда придёте: выделим ${st.dur >= 99 ? 'до утра' : `${st.dur} ${hrsWord(st.dur)}`}, потом поменяете длительность.</p>`}</div>`;
  }
  function pickHall(id, scroll) {
    st.pick = id; const w = bestWin(day, id, st.dur);
    st.sel = w ? { id, a: w.a, b: w.a + w.n - 1 } : null; drawSlots(); drawBar();
    if (scroll && matchMedia('(max-width:900px)').matches) $('cstage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  // ничего не подходит на выбранный день → ищем ближайшую дату (до 14 дней вперёд)
  let scan = 0;
  async function findNext() {
    const my = ++scan, g = guests();
    for (let k = 1; k <= 14; k++) {
      const date = addDays(st.date, k); if (date > addDays(C.today, C.horizonDays || 30)) break;
      const d = await api(`/day?date=${date}`).catch(() => null); if (my !== scan) return; if (!d) continue;
      const n = C.halls.filter(x => g <= x.cap && (() => { const w = bestWin(d, x.id, st.dur); return w && (st.dur >= 99 || w.n >= st.dur); })()).length;
      if (n) { const el = $('nextFree'); if (el) el.innerHTML = `<button type="button" class="nextday" data-day="${date}">Ближайшее: ${E(dayName(date))}, ${n} ${n === 1 ? 'зал' : n < 5 ? 'зала' : 'залов'} →</button>`; return; }
    }
    const el = $('nextFree'); if (el && my === scan) el.innerHTML = 'Ближайшие две недели заняты. <a href="#contacts">Позвоните нам</a>, подберём время.';
  }
  function drawPlan() {
    $('pGu').textContent = guests();
    drawOcc();
  }
  // повод спрашиваем в заявке: готовые варианты и «Другое» (тогда пишут сами в пожеланиях)
  function drawOcc() {
    const list = [...(C.occasions || []).map(o => o.title), 'Другое'];
    $('fOcc').innerHTML = list.map(t => `<button type="button" class="chip${st.occ === t ? ' on' : ''}" data-focc="${E(t)}" aria-pressed="${st.occ === t}">${E(t)}</button>`).join('');
    $('fCom').placeholder = st.occ === 'Другое' ? 'Какой повод? Юбилей, свадьба, выпускной…' : 'Торт, караоке, украшение зала…';
  }
  function setGuests(n) { $('fGu').value = Math.max(1, Math.min(60, n)); prefs.set({ g: guests() }); drawPlan(); drawSlots(); drawBar(); drawDays(); }
  // нижняя панель: −1 ч / +1 ч без прицеливания в клетки
  function adjust(k) {
    const s = st.sel; if (!s) return;
    if (k < 0) { if (s.b > s.a) s.b--; else { toast('Меньше часа нельзя', '', 'alt'); return; } }
    else if (s.b + 1 < C.hours && !taken(s.id, s.b + 1)) s.b++;
    else { toast(s.b + 1 >= C.hours ? 'Это уже до закрытия' : `С ${hh(s.b + 1)}:00 зал занят`, 'Можно начать раньше или выбрать другой зал', 'alt'); return; }
    st.dur = s.b === C.hours - 1 && k > 0 ? 99 : s.b - s.a + 1; prefs.set({ dur: st.dur });
    drawSlots(); drawBar(); if (document.body.classList.contains('form')) drawSum();
  }

  let bookSeen = false;
  let pickSeen = false;   // нижняя панель на телефоне: пока блок брони на экране, а итог с кнопкой — нет
  if ('IntersectionObserver' in window) { new IntersectionObserver(es => { bookSeen = es[0].isIntersecting; drawBar(); }, { rootMargin: '-35% 0px -35% 0px' }).observe(document.getElementById('book'));
    new IntersectionObserver(es => { pickSeen = es[0].isIntersecting; drawBar(); }, { threshold: .35 }).observe(document.getElementById('picker')); }
  function drawBar() {
    const s = st.sel; $('bar').classList.toggle('show', !!s && bookSeen && !pickSeen);
    if (!s) return;
    const n = s.b - s.a + 1;
    $('barT').textContent = `${hall(s.id).name}, ${dayName(st.date)}`;
    $('barS').textContent = `${span(s.a, n)}, ${n} ${hrsWord(n)}, примерно ${rub(costOf(s))}`;
  }
  const LABEL = { request: 'ждёт ответа', offered: 'предлагаем другое время', confirmed: 'подтверждено', rejected: 'отклонено', cancelled: 'отменено' };
  function drawMine() {
    $('mine').innerHTML = (st.mine.length ? '<h3 class="mineh">Ваши брони</h3>' : '') + st.mine.slice().reverse().map(q => { const x = hall(q.hall_id);
      return `<div class="m ${q.status}"><div class="mh"><b>${E(x ? x.name : 'Зал')}, ${E(dayName(q.date))}, ${span(q.start, q.hours)}</b><span>${LABEL[q.status]}</span></div>
      ${q.status === 'offered' ? `<div class="row"><button type="button" class="btn" data-acc="${E(q.token)}">Согласиться</button><button type="button" class="btn g" data-dec="${E(q.token)}">Отказаться</button></div>` : ''}
      ${q.status === 'request' ? '<p class="mnote">Администратор ответит здесь, обычно в течение 15 минут. Страницу можно закрыть: заявка сохранится в этом браузере.</p>' : ''}
      ${q.status === 'confirmed' ? `<p class="mnote">Ждём вас! Если планы изменятся, позвоните: <a href="${E(C.phoneHref)}">${E(C.phone)}</a></p>
        <div class="mact">${q.date <= C.today ? `<button type="button" class="mb2 rate" data-review="${E((hall(q.hall_id) || {}).slug || '')}">★ Оценить вечер</button>` : ''}<button type="button" class="mb2" data-ics="${E(q.token)}">В календарь</button>${C.mapUrl ? `<a class="mb2" href="${E(C.mapUrl)}" target="_blank" rel="noopener" data-hit="click:map">Как добраться</a>` : ''}</div>` : ''}
      ${C.tgBot && ['request', 'offered', 'confirmed'].includes(q.status) ? `<a class="tgb" href="https://t.me/${E(C.tgBot)}?start=${E(q.token)}" target="_blank" rel="noopener"><b>${q.status === 'confirmed' ? 'Напомнить в Telegram' : 'Получить ответ в Telegram'}</b><span>${q.status === 'confirmed' ? 'пришлём напоминание за 3 часа до визита' : 'ответ администратора и напоминание придут в чат'}</span></a>` : ''}
      ${q.status === 'request' ? `<button type="button" class="lnk" data-dec="${E(q.token)}">Отменить заявку</button>` : ''}</div>`; }).join('');
  }
  // файл события для календаря телефона: время Перми переводим в UTC
  function icsOf(q) {
    const x = hall(q.hall_id), [y, m, d] = q.date.split('-').map(Number);
    const at = k => new Date(Date.UTC(y, m - 1, d, C.from + q.start + k - C.tzOffset)).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const esc = s => String(s).replace(/[\\,;]/g, c => '\\' + c);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chp-booking//RU', 'BEGIN:VEVENT', `UID:${q.token}@chp`, `DTSTAMP:${at(0)}`, `DTSTART:${at(0)}`, `DTEND:${at(q.hours)}`,
      `SUMMARY:${esc(`${C.name === C.name.toUpperCase() ? C.name.charAt(0) + C.name.slice(1).toLowerCase() : C.name}: зал «${x ? x.name : ''}»`)}`, `LOCATION:${esc(C.address || '')}`, `DESCRIPTION:${esc(`Телефон: ${C.phone}`)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Бронь', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
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
  function tap(id, i) {   // 17.11: час = начало; длительность задаётся только «Сколько часов»
    const want = st.dur >= 99 ? C.hours : st.dur, n = Math.max(1, runFrom(day, id, i, want));
    st.sel = { id, a: i, b: i + n - 1 }; st.pick = id; drawSlots(); drawBar();
    if (n < want && st.dur < 99) toast(`С ${hh(i)}:00 свободно ${n} ${hrsWord(n)}`, `Дальше зал занят`, 'alt');
  }

  const goTo = id => { const el = $(id); if (!el) return; el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
  async function openHall(id, date, preselect) {
    st.date = date; st.sel = null; drawDays();
    await loadDay();
    pickHall(id, false);
    $('book').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
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
      const r = await api('/requests', { hall: hall(s.id).slug, date: st.date, start: s.a, hours: s.b - s.a + 1, name: $('fName').value, phone: $('fTel').value, guests: parseInt($('fGu').value, 10), comment: [st.occ && st.occ !== 'Другое' ? st.occ : '', $('fCom').value.trim()].filter(Boolean).join('. '), consent: true, website: $('fWeb').value });
      store.set([...store.get(), r.token]); prefs.set({ name: $('fName').value.trim(), tel: $('fTel').value });
      st.mine.push(r); st.sel = null; form(false); drawMine(); hit('book:sent');
      toast('Заявка отправлена', C.tgBot ? 'Нажмите «Получить ответ в Telegram», чтобы не пропустить ответ' : 'Ответ появится здесь, в «Ваших бронях»', '');
      $('mine').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      const card = $('mine').querySelector('.m'); if (card) { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
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
  // 17.11 ленты листаются мышью: зажал и потянул (с инерцией); после перетаскивания клик не срабатывает
  const DRAG = '.hstrip,.thumbs,.mtabs,.hlist';
  let dg = null, dragMoved = false;
  document.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse' || ev.button !== 0) return; const el = ev.target.closest(DRAG); if (!el || el.scrollWidth <= el.clientWidth) return;
    dg = { el, x: ev.clientX, s: el.scrollLeft, t: performance.now(), v: 0, lx: ev.clientX }; dragMoved = false; });
  document.addEventListener('pointermove', ev => { if (!dg) return; const dx = ev.clientX - dg.x; if (Math.abs(dx) > 5 && !dragMoved) { dragMoved = true; dg.el.classList.add('dragging'); }
    if (dragMoved) { dg.el.scrollLeft = dg.s - dx; const now = performance.now(); dg.v = (ev.clientX - dg.lx) / Math.max(1, now - dg.t); dg.t = now; dg.lx = ev.clientX; ev.preventDefault(); } });
  document.addEventListener('pointerup', () => { if (!dg) return; const { el } = dg; let v = dg.v * 16; el.classList.remove('dragging'); dg = null;
    if (dragMoved && !reduced) { const step = () => { if (Math.abs(v) < .5) return; el.scrollLeft -= v; v *= .93; requestAnimationFrame(step); }; requestAnimationFrame(step); } });
  document.addEventListener('click', ev => { if (dragMoved) { ev.stopPropagation(); ev.preventDefault(); dragMoved = false; } }, true);
  document.addEventListener('dragstart', ev => { if (ev.target.closest && ev.target.closest(DRAG)) ev.preventDefault(); });
  document.addEventListener('click', async ev => {
    const t = ev.target;
    const d = t.closest('[data-day]');
    if (d) { const far = d.closest('#calPop'); calOpen(false); st.date = d.dataset.day; st.sel = null; drawDays(); drawBar(); loadAvail().catch(() => {}); loadDay().then(() => { if (far) goTo('fitSum'); }).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const dp = t.closest('[data-dpage]'); if (dp) { st.dpage = Math.max(0, st.dpage + +dp.dataset.dpage); drawDays(); loadAvail().catch(() => {}); return; }
    if (t.closest('#calBtn')) { calOpen($('calPop').hidden); return; }
    if (t.closest('[data-calx]') || t.id === 'calDim') { calOpen(false); return; }
    const cm = t.closest('[data-cm]'); if (cm) { st.cm += +cm.dataset.cm; drawCal(); return; }
    if (!$('calPop').hidden && !t.closest('#calPop')) calOpen(false);
    const sl = t.closest('.sl'); if (sl && !sl.disabled) { tap(+sl.dataset.id, +sl.dataset.i); return; }
    const hp = t.closest('[data-hpick]'); if (hp) { pickHall(+hp.dataset.hpick, false); hit('book:take'); return; }
    const hs = t.closest('[data-hstep]'); if (hs && st.order) { const k = st.order.indexOf(st.pick), id = st.order[(k + +hs.dataset.hstep + st.order.length) % st.order.length]; pickHall(id, false); const el = $('b-' + id); if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); return; }
    if (t.closest('[data-open-form]')) { openForm(); return; }
    const tk = t.closest('[data-take]'); if (tk) { const id = +tk.dataset.take, a = +tk.dataset.a; st.sel = { id, a, b: a + +tk.dataset.n - 1 }; drawSlots(); drawBar(); hit('book:take'); return; }
    const gb = t.closest('[data-g]'); if (gb) { setGuests(guests() + +gb.dataset.g); return; }
    const du = t.closest('[data-dur]'); if (du) { st.dur = +du.dataset.dur; prefs.set({ dur: st.dur }); st.sel = null; drawPlan(); drawSlots(); drawDays(); drawBar(); return; }
    const rvb = t.closest('[data-review]'); if (rvb) { rvForm(true, rvb.dataset.review || ''); hit('review'); return; }
    if (t.closest('[data-close-rv]')) { rvForm(false); return; }
    const rt = t.closest('[data-rate]'); if (rt) { rvRate = +rt.dataset.rate; drawStars(); return; }
    if (t.closest('#rvMore')) { rvShown += 6; drawReviews(); return; }
    const pin = t.closest('[data-pin]'); if (pin) { const on = !pin.classList.contains('open'); document.querySelectorAll('.ppin.open').forEach(x => x.classList.remove('open')); pin.classList.toggle('open', on); const c = document.querySelectorAll('.pent')[+pin.dataset.pin]; if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } return; }
    if (!t.closest('.ppin')) document.querySelectorAll('.ppin.open').forEach(x => x.classList.remove('open'));
    const mt = t.closest('[data-mtab]'); if (mt) { drawMenu(+mt.dataset.mtab); hit('menu:' + mt.dataset.mtab); return; }
    const aj = t.closest('[data-adj]'); if (aj) { adjust(+aj.dataset.adj); return; }
    if (t.closest('[data-tomorning]') && st.sel) { const q = st.sel; q.b = q.a + runFrom(day, q.id, q.a, C.hours) - 1; st.dur = q.b === C.hours - 1 ? 99 : q.b - q.a + 1; prefs.set({ dur: st.dur }); drawSlots(); drawBar(); if (q.b < C.hours - 1) toast(`До утра не выйдет: с ${hh(q.b + 1)}:00 занят`, `Выделили до ${hh(q.b + 1)}:00`, 'alt'); return; }
    if (t.closest('#barX')) { st.sel = null; drawSlots(); drawBar(); return; }
    const oc = t.closest('[data-focc]'); if (oc) { st.occ = st.occ === oc.dataset.focc ? null : oc.dataset.focc; drawOcc(); if (st.occ === 'Другое') $('fCom').focus(); return; }
    const w = t.closest('[data-wall]'); if (w) { openHall(+w.dataset.wall, wall.date, w.classList.contains('on')).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const p = t.closest('[data-pick]'); if (p) { if ($('hallDlg').open) $('hallDlg').close(); openHall(+p.dataset.pick, st.date, false).catch(e => toast('Нет связи', e.message, 'alt')); return; }
    const hg = t.closest('[data-hall-go]'); if (hg) { const d = $('hallDlg'); d.close(); openMore(+hg.dataset.hallGo); return; }
    const mo = t.closest('[data-more]'); if (mo) { openMore(+mo.dataset.more); return; }
    const th = t.closest('[data-thumb]'); if (th) { hdGo(+th.dataset.ti); return; }
    const hn = t.closest('[data-hnav]'); if (hn && st.hd) { hdGo((st.hd.i + +hn.dataset.hnav + st.hd.items.length) % st.hd.items.length); return; }
    if (t.closest('[data-close-hall]') || t === $('hallDlg')) { $('hallDlg').close(); return; }
    if (t.closest('#openCb')) { cbForm(true); return; }
    if (t.closest('[data-close-cb]')) { cbForm(false); return; }
    const hk = t.closest('[data-hit]'); if (hk) hit(hk.dataset.hit);
    if (t.closest('#openForm')) { openForm(); return; }
    if (t.closest('#closeForm') || t.closest('#dim')) { form(false); cbForm(false); rvForm(false); return; }
    const ics = t.closest('[data-ics]');
    if (ics) { const q = st.mine.find(m => m.token === ics.dataset.ics); if (!q) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([icsOf(q)], { type: 'text/calendar' })); a.download = 'bron.ics'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return; }
    const acc = t.closest('[data-acc]'), dec = t.closest('[data-dec]');
    if (acc || dec) {
      const token = (acc || dec).dataset[acc ? 'acc' : 'dec'];
      try { await api(`/requests/${encodeURIComponent(token)}/${acc ? 'accept' : 'decline'}`, {}); toast(acc ? 'Бронь подтверждена' : 'Заявка отменена', acc ? 'Ждём вас!' : '', acc ? 'ok' : 'alt'); }
      catch (e) { toast('Не получилось', e.message, 'alt'); }
      await loadMine().catch(() => {}); await loadDay().catch(() => {}); await loadWall().catch(() => {});
    }
  });
  // 19.11 мобильное меню (на ширине ≤1100 px верхнее меню скрыто)
  const mnav = $('mnav'), burger = $('burger');
  const menuOpen = on => { if (!mnav) return; mnav.hidden = !on; burger.setAttribute('aria-expanded', on); document.body.classList.toggle('menuopen', on); if (on) { const tb = document.querySelector('.topbar'); mnav.style.paddingTop = Math.round((tb ? tb.getBoundingClientRect().bottom : 70) + 14) + 'px'; }
    const tel = $('topTel'), mt = $('mTel'); if (on && tel && mt) { mt.href = tel.href; mt.textContent = tel.textContent; mt.hidden = !tel.textContent; } };
  if (burger) { burger.addEventListener('click', () => menuOpen(mnav.hidden)); mnav.addEventListener('click', ev => { if (ev.target.closest('a') || ev.target === mnav) menuOpen(false); }); }
  // 19.11 точки-индикатор под залами на телефоне: где ты в ленте и быстрый переход к залу
  { const list = $('hallList'), dots = $('hlDots'); let n = 0;
    const draw = () => { const cards = list.querySelectorAll('.hl'); if (cards.length !== n) { n = cards.length; dots.innerHTML = [...cards].map((c, i) => `<button type="button" data-i="${i}" aria-label="${E((c.querySelector('h3') || {}).textContent || 'Зал ' + (i + 1))}"></button>`).join(''); }
      const w = cards[0] ? cards[0].getBoundingClientRect().width + 14 : 1, i = Math.round(list.scrollLeft / w); dots.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i)); };
    if (list && dots) { list.addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true }); new MutationObserver(draw).observe(list, { childList: true });
      dots.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; const c = list.querySelectorAll('.hl')[+b.dataset.i]; if (c) list.scrollTo({ left: c.offsetLeft - list.offsetLeft - parseFloat(getComputedStyle(list).paddingLeft || 0), behavior: 'smooth' }); });
      draw(); } }
  // 19.11 фото зала целиком: в окне фото вписано без обрезки (по краям размытая копия), по нажатию — на весь экран
  { const dlg = $('hallDlg'), full = on => { const m = dlg.querySelector('.hdmedia'); if (!m) return; m.classList.toggle('full', on); dlg.classList.toggle('fullon', on); };
    dlg.addEventListener('click', ev => { if (ev.target.closest('[data-full]') || ev.target.classList.contains('hdph')) { full(!dlg.classList.contains('fullon')); } else if (dlg.classList.contains('fullon') && ev.target.closest('.hdstage') && !ev.target.closest('video')) full(false); });
    dlg.addEventListener('cancel', ev => { if (dlg.classList.contains('fullon')) { ev.preventDefault(); full(false); } });
    dlg.addEventListener('close', () => full(false)); }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && mnav && !mnav.hidden) menuOpen(false); });
  document.addEventListener('keydown', ev => { if ($('hallDlg').open && st.hd && st.hd.items.length > 1 && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); hdGo((st.hd.i + (ev.key === 'ArrowRight' ? 1 : -1) + st.hd.items.length) % st.hd.items.length); return; } if (ev.key === 'Escape') { form(false); cbForm(false); rvForm(false); calOpen(false); } });
  $('rvSheet').addEventListener('submit', sendReview);
  $('sheet').addEventListener('submit', send);
  $('cbSheet').addEventListener('submit', sendCb);
  $('fGu').addEventListener('input', () => { drawSum(); drawBar(); $('pGu').textContent = guests(); prefs.set({ g: guests() }); drawSlots(); drawDays(); });
  for (const id of ['fTel', 'cbTel']) { const el = $(id); if (el) { el.addEventListener('input', () => maskTel(el)); el.addEventListener('focus', () => { if (!el.value) el.value = '+7 '; }); } }
  { const p = prefs.get(); if (p.g) $('fGu').value = p.g; if ([2, 3, 4, 6, 99].includes(p.dur)) st.dur = p.dur; if (p.name) $('fName').value = p.name; if (p.tel) { $('fTel').value = p.tel; if ($('cbTel')) $('cbTel').value = p.tel; } if (p.name && $('cbName')) $('cbName').value = p.name; }

  function fill() {
    $('name').textContent = C.name; { const lg = document.querySelector('.logo'); let tn = [...lg.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()) || [...lg.childNodes].find(n => n.nodeType === 3);
      if (!tn) tn = lg.appendChild(document.createTextNode('')); tn.textContent = C.name; }   // знак-картинка остаётся, меняем только текст
    // логотип: на сервере клиента лежит в brand/, в предпросмотре приходит адресом из данных; нет файла — картинку убираем
    const brandImgs = [[document.querySelector('.logo img'), C.logo], [document.querySelector('.flogoimg'), C.logoBig], [document.querySelector('.herologo'), C.logoBig]];
    for (const [img, url] of brandImgs) { if (!img) continue; img.addEventListener('error', () => img.remove(), { once: true }); if (url) img.src = url; else if (img.complete && !img.naturalWidth) img.remove(); } $('lead').textContent = C.lead || C.sub || '';
    { const ht = $('hTags'); if (ht) { ht.innerHTML = (C.tags || []).map(t => `<li>${E(t)}</li>`).join(''); ht.hidden = !(C.tags || []).length; } }   // 19.11 плашки как на обложке ВК
    const tel = (el, show) => { if (C.phone) { el.textContent = show; el.href = `tel:${C.phoneHref}`; } else el.hidden = true; };
    tel($('topTel'), C.phone); tel($('tel'), C.phone);
    $('addr').textContent = C.address || ''; $('hoursText').textContent = C.hoursText || '';
    if (C.mapUrl) $('map').href = C.mapUrl; else $('map').hidden = true;
    const L = [[C.vk, 'ВКонтакте', 'vk'], [C.max, 'MAX', 'max'], [C.instagram, 'Instagram*', 'ig']].filter(l => l[0]);
    $('links').innerHTML = L.map(([u, n, k]) => `<a class="chip2" href="${E(u)}" target="_blank" rel="noopener" data-hit="click:${k}">${n}</a>`).join('');
    $('igNote').hidden = !C.instagram;
    // 17.11 карта внизу: по номеру организации (с отзывами) или по координатам адреса
    if (!(C.yandexOrgId && /^\d+$/.test(C.yandexOrgId)) && Array.isArray(C.geo)) { const [la, lo] = C.geo;
      $('ymap').hidden = false; $('ymap').innerHTML = `<iframe src="https://yandex.ru/map-widget/v1/?ll=${lo}%2C${la}&z=17&pt=${lo},${la},pm2rdl" title="Мы на карте Яндекса" loading="lazy"></iframe><a class="ymapgo" href="${E(C.mapUrl || '')}" target="_blank" rel="noopener" data-hit="click:map">Построить маршрут →</a>`; }
    if (C.yandexOrgId && /^\d+$/.test(C.yandexOrgId)) {
      $('ymap').hidden = false; $('ymap').innerHTML = `<iframe src="https://yandex.ru/map-widget/v1/?oid=${C.yandexOrgId}&ol=biz&z=16" title="Мы на карте" loading="lazy"></iframe>`;
      $('yrev').hidden = false; $('yrev').innerHTML = `<iframe src="https://yandex.ru/maps-reviews-widget/${C.yandexOrgId}?comments" title="Отзывы на Яндекс Картах" loading="lazy"></iframe>`;
    }
    $('ownFood').textContent = C.ownFood || ''; $('ownFood').hidden = !C.ownFood;   // 19.11: про свою еду уже сказано на первом экране и в вопросах
    $('programs').hidden = !C.programs?.length;
    $('programsList').innerHTML = (C.programs || []).map(p => `<div class="pr"><div><b>${E(p.name)}</b>${p.note ? `<i>${E(p.note)}</i>` : ''}</div><span>${E(p.price)}</span></div>`).join('');
    drawHallList(); drawMenu(); loadReviews(); drawPlace();
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
