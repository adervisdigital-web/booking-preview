// Подставляет реквизиты оператора в страницы согласия и политики из настроек заведения.
fetch('/api/public/config').then(r => r.json()).then(c => {
  const o = c.operator || {}, miss = 'заполняется';
  document.querySelectorAll('[data-op]').forEach(el => { el.textContent = o[el.dataset.op] || miss; });
}).catch(() => {});
