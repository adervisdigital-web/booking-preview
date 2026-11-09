// Расчёт стоимости брони. Один и тот же код на сервере и в браузере, чтобы гость видел ту же сумму, что и администратор.
// Тариф зала: { day, night, weekend }, каждое значение это цена за час или ступени [[до_гостей, цена], ...].
globalThis.Pricing = (() => {
  const rateFor = (r, guests) => Array.isArray(r) ? (r.find(([max]) => guests <= max) || r[r.length - 1])[1] : r;
  function periodOf(date, i, { from, holidays = [] }) {
    const wd = new Date(date + 'T12:00:00Z').getUTCDay();
    if (wd === 5 || wd === 6 || wd === 0 || holidays.includes(date)) return 'weekend';
    return from + i >= 24 ? 'night' : 'day';
  }
  function total(hall, date, start, hours, guests, venue) {
    const n = Math.max(1, Number(guests) || 1), over = Math.max(0, n - hall.cap) * (hall.extra || 0);
    let sum = 0;
    for (let i = start; i < start + hours; i++) sum += rateFor(hall.rates[periodOf(date, i, venue)], n) + over;
    return sum;
  }
  return { rateFor, periodOf, total };
})();
