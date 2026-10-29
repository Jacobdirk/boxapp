(function () {
  const view = document.getElementById('view');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  const fmtSet = l => `${l.weight} kg × ${l.reps}${l.sets ? ` (${l.sets} sets)` : ''}`;
  const fmtLast = l => `${l.weight} kg × ${l.reps}`;
  const delta = n => n > 0 ? `<span class="up">+${n}</span>` : n < 0 ? `<span class="down">${n}</span>` : `<span class="same">±0</span>`;

  const exerciseRow = e => `
    <a class="row" href="#/exercise/${e.id}">
      <div class="icon c-${e.color}">${e.icon}</div>
      <div class="grow"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}</div></div>
      <span class="chev">›</span>
    </a>`;

  const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const daysAgo = iso => {
    const a = new Date(iso), b = new Date();
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 864e5);
  };
  const agoLabel = iso => {
    if (!iso) return 'Nog nooit gedaan';
    const n = daysAgo(iso);
    return n === 0 ? 'Vandaag' : n === 1 ? 'Gisteren' : `${n} dagen geleden`;
  };

  // Suggest favorites that were skipped in the last session (or not done yet today)
  async function trainingSuggestion(user, favorites) {
    const logs = await repo.getAllLogs(user.id);
    const lastDone = {};
    logs.forEach(l => { if (!lastDone[l.exercise_id]) lastDone[l.exercise_id] = l.logged_at; });
    if (!logs.length) return { lastDone, html: '' };

    const today = dayKey(new Date().toISOString());
    const lastDay = dayKey(logs[0].logged_at);
    const trainedToday = lastDay === today;
    const doneIds = new Set(logs.filter(l => dayKey(l.logged_at) === lastDay).map(l => l.exercise_id));
    const todo = favorites
      .filter(e => !doneIds.has(e.id))
      .sort((a, b) => (lastDone[a.id] || '').localeCompare(lastDone[b.id] || ''));
    const done = favorites.filter(e => doneIds.has(e.id));

    const title = () => `Suggestie voor vandaag${todo.length ? ` · ${todo.length}` : ''}`;
    const sub = trainedToday
      ? `Nog ${todo.length} favoriet${todo.length === 1 ? '' : 'en'} te doen`
      : `Laatste training: ${agoLabel(logs[0].logged_at).toLowerCase()} (${fmtShort(logs[0].logged_at)})`;

    const html = `
      <details class="card suggest">
        <summary class="suggest-head"><span class="suggest-icon">💡</span><div class="grow"><div class="title">${title()}</div><div class="muted">${sub}</div></div><span class="chev suggest-chev">›</span></summary>
        ${todo.length ? `<div class="chips" style="margin-top:10px">${todo.map(e => `
          <a class="chip" href="#/exercise/${e.id}/log"><span class="chip-icon c-${e.color}">${e.icon}</span>${esc(e.name)}<span class="chip-sub">${lastDone[e.id] ? `${daysAgo(lastDone[e.id])}d` : 'nieuw'}</span></a>`).join('')}</div>`
        : `<div class="muted" style="margin-top:8px">Alle favorieten gedaan 💪</div>`}
      </details>`;
    return { lastDone, doneIds, html };
  }

  // ---------- Views ----------
  async function homeView() {
    const user = await repo.getCurrentUser();
    const main = await repo.getFavoriteExercises(user.id);
    const { lastDone, doneIds, html: suggestion } = await trainingSuggestion(user, main);
    const favRow = e => {
      const skipped = doneIds && !doneIds.has(e.id);
      return `
      <a class="row ${skipped ? 'due' : ''}" href="#/exercise/${e.id}">
        <div class="icon c-${e.color}">${e.icon}</div>
        <div class="grow"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}</div></div>
        <span class="last-done ${skipped ? 'due' : ''}">${agoLabel(lastDone[e.id])}</span>
        <span class="chev">›</span>
      </a>`;
    };
    view.innerHTML = `
      <div class="header">
        <div class="icon c-green">💪</div>
        <div class="grow"><h1>Box App</h1><div class="muted accent">Log. Compare. Get stronger.</div></div>
        <a class="avatar" href="#/profile">${avatarInner(user)}</a>
      </div>
      <h2>Mijn oefeningen</h2>
      <div class="muted">Jouw favoriete oefeningen · ${main.length}</div>
      <div class="list">${main.length ? main.map(favRow).join('') : `<div class="card empty">Nog geen favorieten. Markeer oefeningen met ☆.</div>`}</div>
      <div class="list">
        <a class="row" href="#/exercises">
          <div class="icon c-slate">🤸</div>
          <div class="grow"><div class="title">Alle oefeningen</div><div class="muted">Hoofd- en filler oefeningen, favorieten beheren</div></div>
          <span class="chev">›</span>
        </a>
      </div>
      ${main.length ? suggestion : ''}`;
  }

  async function exercisesView() {
    const user = await repo.getCurrentUser();
    const all = await repo.getExercises();
    const favs = new Set((await repo.getFavoriteExercises(user.id)).map(e => e.id));
    const lastUsed = {};
    (await repo.getAllLogs(user.id)).forEach(l => { if (!lastUsed[l.exercise_id] || l.logged_at > lastUsed[l.exercise_id]) lastUsed[l.exercise_id] = l.logged_at; });
    const row = e => `
      <div class="row" data-search="${esc((e.name + ' ' + e.muscles).toLowerCase())}">
        <a class="icon c-${e.color}" href="#/exercise/${e.id}" style="text-decoration:none">${e.icon}</a>
        <a class="grow" href="#/exercise/${e.id}" style="color:inherit;text-decoration:none"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}${e.category !== 'main' && lastUsed[e.id] ? ` · ${agoLabel(lastUsed[e.id]).toLowerCase()}` : ''}</div></a>
        <button class="star ${favs.has(e.id) ? 'on' : ''}" data-fav="${e.id}" title="Favoriet">${favs.has(e.id) ? '★' : '☆'}</button>
      </div>`;
    const group = (title, cat) => {
      const list = all.filter(e => e.category === cat);
      if (cat !== 'main') list.sort((a, b) => (lastUsed[b.id] || '').localeCompare(lastUsed[a.id] || '') || a.name.localeCompare(b.name));
      return list.length ? `<section class="ex-group"><h3>${title}</h3><div class="list">${list.map(row).join('')}</div></section>` : '';
    };
    view.innerHTML = `
      <button class="back" onclick="location.hash='#/'">←</button>
      <div class="header"><div class="grow"><h1>Alle oefeningen</h1><div class="muted">Tik op ☆ om een favoriet te maken</div></div></div>
      <div class="search-box"><span>🔍</span><input id="ex-search" type="search" placeholder="Zoek oefening of spiergroep…" autocomplete="off" /></div>
      ${group('Hoofdoefeningen', 'main')}
      ${group('Overig / Filler', 'filler')}
      <div class="card empty" id="ex-none" hidden>Geen oefeningen gevonden.</div>
      <a class="btn primary" href="#/exercise/new">＋ Nieuwe oefening</a>`;
    const search = document.getElementById('ex-search');
    const applyFilter = () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      view.querySelectorAll('.ex-group').forEach(g => {
        let shown = 0;
        g.querySelectorAll('.row').forEach(r => { const ok = !q || r.dataset.search.includes(q); r.hidden = !ok; if (ok) shown++; });
        g.hidden = !shown;
        any = any || shown > 0;
      });
      document.getElementById('ex-none').hidden = any;
    };
    search.addEventListener('input', applyFilter);
    if (exercisesView.query) { search.value = exercisesView.query; applyFilter(); }
    search.addEventListener('input', () => { exercisesView.query = search.value; });
    view.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', async () => {
      const id = +b.dataset.fav;
      await repo.setFavorite(user.id, id, !favs.has(id));
      exercisesView();
    }));
  }

  async function openSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    const all = await repo.getExercises();
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const list = q ? all.filter(e => (e.name + ' ' + e.muscles).toLowerCase().includes(q)) : all;
      results.innerHTML = list.length ? list.slice(0, 30).map(e => `
        <a class="row" href="#/exercise/${e.id}">
          <div class="icon c-${e.color}">${e.icon}</div>
          <div class="grow"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}</div></div>
          <span class="chev">›</span>
        </a>`).join('') : `<div class="card empty">Geen oefeningen gevonden.</div>`;
    };
    input.value = '';
    input.oninput = render;
    render();
    overlay.hidden = false;
    input.focus();
  }

  function closeSearch() { document.getElementById('search-overlay').hidden = true; }
  document.querySelector('[data-search-open]').addEventListener('click', ev => { ev.preventDefault(); openSearch(); });
  document.getElementById('search-overlay').addEventListener('click', ev => { if (ev.target.id === 'search-overlay' || ev.target.closest('a,[data-search-close]')) closeSearch(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeSearch(); });

  const COLORS = ['green', 'blue', 'yellow', 'purple', 'orange', 'teal', 'slate'];

  async function exerciseFormView(id) {
    const ex = id ? await repo.getExercise(id) : { name: '', muscles: '', icon: '🏋️', color: 'green', category: 'filler', variant_group: null };
    if (!ex) return location.hash = '#/exercises';
    const groups = await repo.getVariantGroups();
    view.innerHTML = `
      <button class="back" onclick="history.back()">←</button>
      <h1>${id ? 'Oefening bewerken' : 'Nieuwe oefening'}</h1>
      <div class="field"><label>Naam</label><div class="stepper"><input id="e-name" value="${esc(ex.name)}" /></div></div>
      <div class="field"><label>Spiergroepen</label><div class="stepper"><input id="e-muscles" value="${esc(ex.muscles)}" placeholder="bijv. Rug / Biceps" /></div></div>
      <div class="field"><label>Icoon (emoji)</label><div class="stepper"><input id="e-icon" value="${esc(ex.icon)}" maxlength="8" /></div></div>
      <div class="field"><label>Categorie</label><div class="stepper"><select id="e-category">
        <option value="main" ${ex.category === 'main' ? 'selected' : ''}>Hoofdoefening</option>
        <option value="filler" ${ex.category === 'filler' ? 'selected' : ''}>Overig / Filler</option>
      </select></div></div>
      <div class="field"><label>Snel wisselen-groep (optioneel)</label><div class="stepper"><input id="e-group" list="e-groups" value="${esc(ex.variant_group || '')}" placeholder="bijv. row, deadlift" /></div>
        <datalist id="e-groups">${groups.map(g => `<option value="${esc(g)}"></option>`).join('')}</datalist></div>
      <div class="field"><label>Kleur</label><div class="colors">
        ${COLORS.map(c => `<button class="swatch c-${c} ${c === ex.color ? 'on' : ''}" data-color="${c}"></button>`).join('')}
      </div></div>
      <button class="btn primary" id="save">Opslaan</button>
      ${id ? `<button class="btn danger" id="del">Verwijderen</button>` : ''}
      <button class="btn" onclick="history.back()">Annuleren</button>`;

    let color = ex.color;
    view.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
      color = b.dataset.color;
      view.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
    }));
    document.getElementById('save').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('e-name').value.trim(),
        muscles: document.getElementById('e-muscles').value.trim(),
        icon: document.getElementById('e-icon').value.trim() || '🏋️',
        category: document.getElementById('e-category').value,
        variant_group: document.getElementById('e-group').value.trim().toLowerCase().replace(/\s+/g, '_') || null,
        color
      };
      if (!data.name) return alert('Vul een naam in.');
      if (id) { await repo.updateExercise(id, data); location.hash = `#/exercise/${id}`; }
      else { const created = await repo.addExercise(data); location.hash = `#/exercise/${created.id}`; }
    });
    if (id) document.getElementById('del').addEventListener('click', async () => {
      if (!confirm(`"${ex.name}" en alle bijbehorende logs verwijderen?`)) return;
      await repo.deleteExercise(id);
      location.hash = '#/exercises';
    });
  }

  const REP_RANGES = [1, 3, 5, 8, 12];
  const repRange = reps => REP_RANGES.find(r => reps <= r) || 12;

  // Logs for a rep range (chronological). Sets with more reps also count for a lower range
  // when their weight beats the best weight in that range so far.
  const rangeLogs = (logs, range) => {
    let best = -Infinity;
    const out = [];
    for (const l of [...logs].reverse()) {
      const r = repRange(l.reps);
      if (r < range) continue;
      const carried = r > range;
      if (carried && l.weight <= best) continue;
      best = Math.max(best, l.weight);
      out.push({ ...l, carried });
    }
    return out;
  };

  async function exerciseView(id, range) {
    const user = await repo.getCurrentUser();
    const ex = await repo.getExercise(id);
    if (!ex) return location.hash = '#/';
    const logs = await repo.getLogs(user.id, id);
    const last = logs[0];
    const fav = await repo.isFavorite(user.id, id);
    const variants = await repo.getVariants(id);
    range = range || (last ? repRange(last.reps) : 8);
    const counts = Object.fromEntries(REP_RANGES.map(r => [r, rangeLogs(logs, r).length]));
    const recent = rangeLogs(logs, range).slice(-6);
    const max = Math.max(1, ...recent.map(l => l.weight));

    view.innerHTML = `
      <button class="back" onclick="location.hash='#/'">←</button>
      <div class="header">
        <div class="icon lg c-${ex.color}">${ex.icon}</div>
        <div class="grow"><h1>${esc(ex.name)}</h1><div class="muted">${esc(ex.muscles)}</div></div>
        <button class="star ${fav ? 'on' : ''}" id="fav" title="Favoriet">${fav ? '★' : '☆'}</button>
        <a class="star" href="#/exercise/${id}/edit" title="Bewerken">✎</a>
      </div>
      <div class="last-row">
        <div class="card last">
          <div class="muted">Laatste keer</div>
          ${last ? `<div class="big">${fmtLast(last)}</div><div class="muted">${fmtDate(last.logged_at)}</div>` : `<div class="muted">Nog niet gelogd</div>`}
        </div>
        <a class="btn primary log-btn" href="#/exercise/${id}/log">＋ Log deze oefening</a>
      </div>
      ${variants.length ? `<h3>Snel wisselen</h3><div class="chips">${variants.map(v => `
        <a class="chip" href="#/exercise/${v.id}"><span class="chip-icon c-${v.color}">${v.icon}</span>${esc(v.name)}</a>`).join('')}</div>` : ''}
      <h3>Jouw progressie</h3>
      <div class="seg" role="tablist" aria-label="Rep range">${REP_RANGES.map(r => `<button data-range="${r}" class="${r === range ? 'on' : ''}" ${counts[r] ? '' : 'disabled'}>${r === 12 ? '12+' : r}</button>`).join('')}</div>
      ${recent.length ? `<div class="chart">${recent.map(l => `
        <div class="bar-wrap">
          <div class="bar-val">${l.weight} kg</div>
          <div class="bar ${l.carried ? 'carried' : ''}" style="height:${(l.weight / max) * 85}%" title="${fmtSet(l)}${l.carried ? ' (meer reps)' : ''}"></div>
          <div class="bar-label">${fmtShort(l.logged_at)}</div>
        </div>`).join('')}</div><div class="muted">Werkgewicht (kg) bij ${range === 12 ? '9+' : range === 1 ? '1' : `${REP_RANGES[REP_RANGES.indexOf(range) - 1] + 1}–${range}`} reps</div>` : `<div class="card empty">${logs.length ? 'Geen sessies in deze rep range' : 'Log je eerste set om progressie te zien'}</div>`}
      <h3>Geschiedenis</h3>
      <div class="card table">${logs.length ? logs.slice(0, 10).map(l => `
        <div class="tr"><span>${fmtDate(l.logged_at)}</span><span>${fmtSet(l)}</span></div>`).join('') : `<div class="empty">Nog geen sessies</div>`}
      </div>`;
    document.getElementById('fav').addEventListener('click', async () => {
      await repo.setFavorite(user.id, id, !fav);
      exerciseView(id, range);
    });
    view.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => exerciseView(id, +b.dataset.range)));
  }

  async function logView(id) {
    const user = await repo.getCurrentUser();
    const ex = await repo.getExercise(id);
    if (!ex) return location.hash = '#/';
    const last = await repo.getLastLog(user.id, id);
    const state = { weight: last ? last.weight : 0, reps: last ? last.reps : 8, sets: last && last.sets ? last.sets : 3 };

    const stepper = (key, label, step) => `
      <div class="field"><label>${label}</label>
        <div class="stepper">
          <input id="f-${key}" type="number" inputmode="decimal" min="0" step="${step}" value="${state[key]}" />
          <button data-k="${key}" data-d="-${step}">−</button><button data-k="${key}" data-d="${step}">+</button>
        </div></div>`;

    view.innerHTML = `
      <button class="back" onclick="history.back()">←</button>
      <div class="header">
        <div class="icon lg c-${ex.color}">${ex.icon}</div>
        <div class="grow"><h1>${esc(ex.name)}</h1><div class="muted">${esc(ex.muscles)}</div></div>
      </div>
      <div class="last-row">
        ${last ? `<div class="card last"><div class="muted">Laatste keer</div><div class="big">${fmtLast(last)}</div><div class="muted">${fmtDate(last.logged_at)}</div></div>` : ''}
        <div class="actions">
          <button class="btn primary" id="save">Opslaan</button>
          <button class="btn" onclick="history.back()">Annuleren</button>
        </div>
      </div>
      <h3>Voer je gewicht en reps in</h3>
      ${stepper('weight', 'Gewicht (kg)', 2.5)}
      ${stepper('reps', 'Reps', 1)}
      <h3>Optioneel</h3>
      ${stepper('sets', 'Sets', 1)}
      <div id="cmp"></div>`;

    const read = k => parseFloat(document.getElementById('f-' + k).value) || 0;
    const renderCompare = () => {
      const el = document.getElementById('cmp');
      if (!last) { el.innerHTML = ''; return; }
      const dw = +(read('weight') - last.weight).toFixed(2), dr = read('reps') - last.reps;
      el.innerHTML = `<h3>Vergelijking met vorige keer</h3>
        <div class="compare"><span>${delta(dw)} kg</span><span>${delta(dr)} reps</span></div>
        <div class="muted">(${fmtDate(last.logged_at)})</div>`;
    };

    view.querySelectorAll('.stepper button').forEach(b => b.addEventListener('click', () => {
      const input = document.getElementById('f-' + b.dataset.k);
      input.value = Math.max(0, +(read(b.dataset.k) + parseFloat(b.dataset.d)).toFixed(2));
      renderCompare();
    }));
    view.querySelectorAll('input').forEach(i => i.addEventListener('input', renderCompare));
    renderCompare();

    document.getElementById('save').addEventListener('click', async () => {
      const weight = read('weight'), reps = Math.round(read('reps')), sets = Math.round(read('sets')) || null;
      if (reps <= 0) return alert('Vul een geldig aantal reps in.');
      await repo.addLog({ user_id: user.id, exercise_id: id, weight, reps, sets });
      location.hash = `#/exercise/${id}`;
    });
  }

  const avatarInner = u => u.photo ? `<img src="${u.photo}" alt="" />` : esc(u.initials);

  // Downscale a picked/captured image to a small square JPEG data URL (keeps localStorage small)
  const imageToDataUrl = (file, size = 192) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const isPhone = () => window.matchMedia('(pointer: coarse)').matches && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  async function profileView() {
    const user = await repo.getCurrentUser();
    const users = await repo.getUsers();
    const captcha = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    view.innerHTML = `
      <div class="header">
        <label class="avatar lg active avatar-edit" title="Profielfoto wijzigen">${avatarInner(user)}<span class="avatar-cam">📷</span>
          <input id="photo" type="file" accept="image/*" ${isPhone() ? 'capture="user"' : ''} hidden /></label>
        <div class="grow"><h1>${esc(user.name)}</h1>${user.photo ? `<button class="link-btn" id="photo-remove">Foto verwijderen</button>` : ''}</div>
      </div>
      <h3>Profiel</h3>
      <form class="field" id="rename"><label for="r-name">Naam</label>
        <div class="stepper"><input id="r-name" maxlength="40" value="${esc(user.name)}" required /></div>
        <button class="btn" type="submit">Naam opslaan</button></form>
      <h3>Wissel van gebruiker</h3>
      <div class="users">
        ${users.map(u => `<div class="u"><button class="avatar lg ${u.id === user.id ? 'active' : ''}" data-id="${u.id}">${avatarInner(u)}</button>${esc(u.name)}</div>`).join('')}
        <div class="u"><button class="avatar lg" id="add">＋</button>Nieuw</div>
      </div>
      <h3>Beheer</h3>
      <a class="btn" href="#/exercises">Oefeningen beheren</a>
      <details class="card danger-zone">
        <summary>🗑️ Profiel "${esc(user.name)}" verwijderen</summary>
        <p class="muted">Dit verwijdert het profiel, alle logs en favorieten. Typ <b class="captcha">${captcha}</b> om te bevestigen.</p>
        <form id="del-user"><div class="stepper"><input id="del-code" autocomplete="off" autocapitalize="characters" placeholder="${captcha}" /></div>
          <button class="btn danger" id="del-btn" type="submit" disabled>Profiel definitief verwijderen</button></form>
      </details>
      <button class="btn danger" id="reset">Alles resetten naar standaard</button>`;
    document.getElementById('photo').addEventListener('change', async ev => {
      const file = ev.target.files[0];
      if (!file) return;
      try { await repo.updateUser(user.id, { photo: await imageToDataUrl(file) }); }
      catch { alert('Kon de afbeelding niet laden.'); }
      router();
    });
    document.getElementById('photo-remove')?.addEventListener('click', async () => { await repo.updateUser(user.id, { photo: null }); router(); });
    document.getElementById('rename').addEventListener('submit', async ev => {
      ev.preventDefault();
      const name = document.getElementById('r-name').value.trim();
      if (!name) return;
      await repo.updateUser(user.id, { name });
      router();
    });
    const code = document.getElementById('del-code'), delBtn = document.getElementById('del-btn');
    code.addEventListener('input', () => { delBtn.disabled = code.value.trim().toUpperCase() !== captcha; });
    document.getElementById('del-user').addEventListener('submit', async ev => {
      ev.preventDefault();
      if (code.value.trim().toUpperCase() !== captcha) return;
      await repo.deleteUser(user.id);
      location.hash = '#/';
      router();
    });
    document.getElementById('reset').addEventListener('click', async () => {
      if (!confirm('Alle gebruikers, oefeningen en logs wissen en standaard oefeningen terugzetten?')) return;
      await repo.resetDatabase();
      location.hash = '#/';
      router();
    });
    view.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', async () => {
      await repo.setCurrentUser(+b.dataset.id); router();
    }));
    document.getElementById('add').addEventListener('click', async () => {
      const name = (prompt('Naam van nieuwe gebruiker:') || '').trim();
      if (!name) return;
      const u = await repo.addUser(name);
      await repo.setCurrentUser(u.id); router();
    });
  }

  // ---------- Router ----------
  const startOfWeek = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString();
  };

  async function historyView(filter = 'all', showOlder = false) {
    const user = await repo.getCurrentUser();
    const exercises = await repo.getExercises();
    const byId = Object.fromEntries(exercises.map(e => [e.id, e]));
    const logs = (await repo.getAllLogs(user.id)).filter(l => byId[l.exercise_id]);
    const weekStart = startOfWeek();

    const logRow = l => {
      const e = byId[l.exercise_id];
      return `
      <div class="row">
        <a class="icon c-${e.color}" href="#/exercise/${e.id}" style="text-decoration:none">${e.icon}</a>
        <a class="grow" href="#/exercise/${e.id}" style="color:inherit;text-decoration:none"><div class="title">${esc(e.name)}</div><div class="muted accent">${fmtSet(l)}</div></a>
        <span class="muted">${fmtShort(l.logged_at)}</span>
        <button class="star" data-del="${l.id}" title="Verwijderen">✕</button>
      </div>`;
    };

    let body;
    if (filter === 'exercise') {
      const groups = exercises
        .map(e => ({ e, items: logs.filter(l => l.exercise_id === e.id) }))
        .filter(g => g.items.length)
        .sort((a, b) => b.items[0].logged_at.localeCompare(a.items[0].logged_at));
      body = groups.length ? `<div class="list">${groups.map(({ e, items }) => `
        <a class="row" href="#/exercise/${e.id}">
          <div class="icon c-${e.color}">${e.icon}</div>
          <div class="grow"><div class="title">${esc(e.name)}</div><div class="muted">${items.length} ${items.length === 1 ? 'sessie' : 'sessies'} · laatst ${fmtSet(items[0])}</div></div>
          <span class="muted">${fmtShort(items[0].logged_at)}</span>
        </a>`).join('')}</div>` : '';
    } else {
      const list = filter === 'filler' ? logs.filter(l => byId[l.exercise_id].category === 'filler') : logs;
      const thisWeek = list.filter(l => l.logged_at >= weekStart);
      const older = list.filter(l => l.logged_at < weekStart);
      body = list.length ? `
        <h3>Deze week</h3>
        ${thisWeek.length ? `<div class="list">${thisWeek.map(logRow).join('')}</div>` : `<div class="card empty">Nog niets gelogd deze week</div>`}
        ${older.length ? `
        <button class="row collapse" id="older"><span class="grow title">Vorige weken (${older.length})</span><span class="chev">${showOlder ? '▴' : '▾'}</span></button>
        ${showOlder ? `<div class="list">${older.map(logRow).join('')}</div>` : ''}` : ''}` : '';
    }

    view.innerHTML = `
      <div class="header"><div class="grow"><h1>History</h1></div></div>
      <div class="seg" style="margin-top:16px">
        <button data-filter="all" class="${filter === 'all' ? 'on' : ''}">Alle</button>
        <button data-filter="exercise" class="${filter === 'exercise' ? 'on' : ''}">Per oefening</button>
        <button data-filter="filler" class="${filter === 'filler' ? 'on' : ''}">Filler / Overig</button>
      </div>
      ${body || `<div class="card empty">Nog geen sessies gelogd</div>`}`;

    view.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => historyView(b.dataset.filter, showOlder)));
    const olderBtn = document.getElementById('older');
    if (olderBtn) olderBtn.addEventListener('click', () => historyView(filter, !showOlder));
    view.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Deze sessie verwijderen?')) return;
      await repo.deleteLog(+b.dataset.del);
      historyView(filter, showOlder);
    }));
  }

  const cmpState = { tab: 'pb', exerciseId: null, mode: 'chart', range: null, otherId: null };
  const cmpRangeLabel = r => r === 12 ? '9+' : r === 1 ? '1' : `${REP_RANGES[REP_RANGES.indexOf(r) - 1] + 1}–${r}`;

  const lineChart = (series, range) => {
    const all = series.flatMap(s => s.pts);
    if (!all.length) return `<div class="card empty">Geen sessies in deze rep range</div>`;
    const W = 320, H = 170, L = 34, R = 12, T = 12, B = 26;
    const ts = all.map(p => Date.parse(p.logged_at)), ws = all.map(p => p.weight);
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const wMin = Math.floor(Math.min(...ws) * 0.9);
    let wMax = Math.ceil(Math.max(...ws) * 1.05);
    if (wMax <= wMin) wMax = wMin + 1;
    const x = t => L + (tMax === tMin ? (W - L - R) / 2 : (t - tMin) / (tMax - tMin) * (W - L - R));
    const y = w => T + (1 - (w - wMin) / (wMax - wMin)) * (H - T - B);
    const grid = [0, 0.5, 1].map(f => {
      const w = wMin + (wMax - wMin) * f;
      return `<line x1="${L}" x2="${W - R}" y1="${y(w).toFixed(1)}" y2="${y(w).toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(y(w) + 4).toFixed(1)}" text-anchor="end" class="axis">${Math.round(w)}</text>`;
    }).join('');
    const lines = series.map(s => {
      const pts = s.pts.map(p => [x(Date.parse(p.logged_at)).toFixed(1), y(p.weight).toFixed(1), p]);
      return `<polyline class="ln ${s.cls}" points="${pts.map(([a, b]) => `${a},${b}`).join(' ')}"/>` +
        pts.map(([a, b, p]) => `<circle class="pt ${s.cls}" cx="${a}" cy="${b}" r="4"><title>${esc(s.name)}: ${fmtSet(p)} (${fmtDate(p.logged_at)})</title></circle>`).join('');
    }).join('');
    const xLabels = `<text x="${L}" y="${H - 6}" class="axis">${fmtShort(new Date(tMin).toISOString())}</text>` +
      (tMax !== tMin ? `<text x="${W - R}" y="${H - 6}" text-anchor="end" class="axis">${fmtShort(new Date(tMax).toISOString())}</text>` : '');
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="card line-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Werkgewicht over tijd">${grid}${lines}${xLabels}</svg>
      ${legend}<div class="muted">Werkgewicht (kg) bij ${cmpRangeLabel(range)} reps</div></div>`;
  };

  const sessionTable = s => {
    const rows = s.all.map((p, i) => ({ p, d: i ? +(p.weight - s.all[i - 1].weight).toFixed(2) : null })).slice(-4).reverse();
    return `<h3>${esc(s.name)} · laatste ${rows.length || ''} sessies</h3>
      <div class="card table">${rows.length ? rows.map(r => `
        <div class="tr"><span>${fmtDate(r.p.logged_at)}</span><span>${fmtSet(r.p)}</span><span>${r.d === null ? '<span class="same">–</span>' : `${delta(r.d)} kg`}</span></div>`).join('') : `<div class="empty">Geen sessies in deze rep range</div>`}
      </div>`;
  };

  const PALETTE = ['me', 'other', 'p2', 'p3', 'p4', 'p5'];
  const MEDALS = [{ cls: 'gold', icon: '🥇' }, { cls: 'silver', icon: '🥈' }, { cls: 'bronze', icon: '🥉' }];

  async function leaderboard(users) {
    const range = 1;
    const mains = await repo.getExercises('main');
    const boards = [];
    for (const e of mains) {
      const ranked = [];
      for (const u of users) {
        const pts = rangeLogs(await repo.getLogs(u.id, e.id), range);
        if (!pts.length) continue;
        const top = pts.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
        ranked.push({ u, top });
      }
      ranked.sort((a, b) => b.top.weight - a.top.weight || b.top.reps - a.top.reps || a.top.logged_at.localeCompare(b.top.logged_at));
      boards.push({ e, top3: ranked.slice(0, 3) });
    }
    const withData = boards.filter(b => b.top3.length);
    return `
      <h3>Top 3 · 1 rep max</h3>
      ${withData.length ? `<div class="list">${withData.map(({ e, top3 }) => `
        <div class="card podium">
          <a class="podium-head" href="#/exercise/${e.id}"><span class="icon c-${e.color}">${e.icon}</span><span class="title">${esc(e.name)}</span></a>
          ${top3.map(({ u, top }, i) => `
          <div class="podium-row ${MEDALS[i].cls}">
            <span class="medal">${MEDALS[i].icon}</span>
            <span class="grow">${esc(u.name)}</span>
            <span class="podium-val">${top.weight} kg</span>
          </div>`).join('')}
        </div>`).join('')}</div>` : `<div class="card empty">Nog geen 1 rep max gelogd</div>`}
      <div class="muted" style="margin-top:6px">Zwaarste gewicht voor 1 rep (zwaardere sets met meer reps tellen mee)</div>`;
  }

  async function personalBests(user) {
    const exercises = await repo.getExercises();
    const favIds = new Set((await repo.getFavoriteExercises(user.id)).map(e => e.id));
    const rows = [];
    for (const e of exercises) {
      const logs = await repo.getLogs(user.id, e.id);
      const top = logs.length ? logs.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a)) : null;
      const perRange = REP_RANGES.map(r => {
        const pts = rangeLogs(logs, r);
        return { r, w: pts.length ? Math.max(...pts.map(p => p.weight)) : null };
      });
      rows.push({ e, fav: favIds.has(e.id), top, perRange });
    }
    rows.sort((a, b) => (b.fav - a.fav) || (!!b.top - !!a.top) || a.e.name.localeCompare(b.e.name));
    const row = ({ e, fav, top, perRange }) => `
      <a class="card pb" href="#/exercise/${e.id}">
        <div class="pb-head">
          <span class="icon c-${e.color}">${e.icon}</span>
          <span class="grow"><span class="title">${esc(e.name)}</span>${fav ? ' <span class="pb-fav">★</span>' : ''}<br><span class="muted">${top ? fmtDate(top.logged_at) : 'Nog niet gelogd'}</span></span>
          <span class="pb-val">${top ? `${top.weight} kg <span class="muted">× ${top.reps}</span>` : '–'}</span>
        </div>
        ${top ? `<div class="pb-ranges">${perRange.map(p => `<span class="${p.w === null ? 'none' : ''}"><b>${p.r === 12 ? '12+' : p.r}</b>${p.w === null ? '–' : `${p.w}`}</span>`).join('')}</div>` : ''}
      </a>`;
    return `
      <h3>Personal bests · ${esc(user.name)}</h3>
      <div class="list">${rows.map(row).join('')}</div>
      <div class="muted" style="margin-top:6px">Per rep range: beste werkgewicht (kg)</div>`;
  }

  async function comparisonsView() {
    const user = await repo.getCurrentUser();
    const users = await repo.getUsers();
    const others = users.filter(u => u.id !== user.id);
    const exercises = await repo.getExercises();
    const header = `<div class="header"><div class="grow"><h1>Ranking</h1></div></div>`;
    const tabs = `<div class="seg" style="margin-top:16px">
      <button data-ctab="pb" class="${cmpState.tab === 'pb' ? 'on' : ''}">Personal Best</button>
      <button data-ctab="top3" class="${cmpState.tab === 'top3' ? 'on' : ''}">Top 3</button>
      <button data-ctab="chart" class="${cmpState.tab === 'chart' ? 'on' : ''}">Vergelijking</button>
    </div>`;
    const bindTabs = () => view.querySelectorAll('[data-ctab]').forEach(b => b.addEventListener('click', () => { cmpState.tab = b.dataset.ctab; comparisonsView(); }));

    if (cmpState.tab === 'pb') {
      view.innerHTML = `${header}${tabs}${await personalBests(user)}`;
      bindTabs();
      return;
    }
    if (cmpState.tab === 'top3') {
      view.innerHTML = `${header}${tabs}${await leaderboard(users)}`;
      bindTabs();
      return;
    }

    const allLogs = [];
    for (const u of users) allLogs.push(...(await repo.getAllLogs(u.id)));
    const exIds = new Set(allLogs.map(l => l.exercise_id));
    const logged = exercises.filter(e => exIds.has(e.id));
    if (!logged.length) {
      view.innerHTML = `${header}${tabs}<div class="card empty" style="margin-top:16px">Log eerst een oefening om te vergelijken</div>`;
      bindTabs();
      return;
    }

    const mine = await repo.getAllLogs(user.id);
    if (!logged.some(e => e.id === cmpState.exerciseId)) {
      cmpState.exerciseId = (mine.find(l => exIds.has(l.exercise_id)) || allLogs[0]).exercise_id;
      cmpState.range = null;
    }
    if (cmpState.otherId !== 'all' && cmpState.otherId && !others.some(u => u.id === cmpState.otherId)) cmpState.otherId = null;
    const exId = cmpState.exerciseId;
    const compared = cmpState.otherId === 'all' ? others : others.filter(u => u.id === cmpState.otherId);

    const people = [user, ...compared];
    const logsBy = [];
    for (const u of people) logsBy.push(await repo.getLogs(u.id, exId));
    const counts = Object.fromEntries(REP_RANGES.map(r => [r, logsBy.reduce((n, ls) => n + rangeLogs(ls, r).length, 0)]));
    if (!cmpState.range || !counts[cmpState.range]) {
      const first = logsBy.find(ls => ls.length);
      cmpState.range = first ? repRange(first[0].reps) : 8;
    }
    const range = cmpState.range;

    const series = people.map((u, i) => ({ name: u.name, cls: PALETTE[i % PALETTE.length], all: rangeLogs(logsBy[i], range) }));
    series.forEach(s => { s.pts = s.all.slice(-8); });
    const visible = series.filter((s, i) => i === 0 || s.all.length);

    const best = s => s.all.length ? Math.max(...s.all.map(p => p.weight)) : null;
    const versus = compared.length ? `
      <div class="compare-cards">${visible.map(s => `
        <div class="card"><div class="muted">${esc(s.name)} · beste</div><div class="big ${s.cls}">${best(s) === null ? '–' : `${best(s)} kg`}</div></div>`).join('')}
      </div>
      ${visible.length === 2 && best(visible[0]) !== null && best(visible[1]) !== null ? `<div class="muted" style="margin-top:6px">Verschil: ${delta(+(best(visible[0]) - best(visible[1])).toFixed(2))} kg</div>` : ''}` : '';

    view.innerHTML = `
      ${header}${tabs}
      <div class="field"><div class="stepper"><select id="c-ex" aria-label="Oefening">
        ${logged.map(e => `<option value="${e.id}" ${e.id === exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
      </select></div></div>
      <div class="seg" style="margin-top:12px">
        <button data-mode="chart" class="${cmpState.mode === 'chart' ? 'on' : ''}">Grafiek</button>
        <button data-mode="table" class="${cmpState.mode === 'table' ? 'on' : ''}">Tabel</button>
      </div>
      <div class="seg" aria-label="Rep range">${REP_RANGES.map(r => `<button data-range="${r}" class="${r === range ? 'on' : ''}" ${counts[r] ? '' : 'disabled'}>${r === 12 ? '12+' : r}</button>`).join('')}</div>
      ${cmpState.mode === 'chart' ? lineChart(visible, range) : visible.map(sessionTable).join('')}
      ${versus}
      <h3>Vergelijk met</h3>
      ${others.length ? `<div class="stepper"><select id="c-other" aria-label="Vergelijk met">
        <option value="">Niemand</option>
        <option value="all" ${cmpState.otherId === 'all' ? 'selected' : ''}>Iedereen</option>
        ${others.map(u => `<option value="${u.id}" ${cmpState.otherId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
      </select></div>` : `<a class="row" href="#/profile"><div class="grow"><div class="title">Andere persoon</div><div class="muted">Voeg een profiel toe om te vergelijken</div></div><span class="chev">›</span></a>`}
      `;

    document.getElementById('c-ex').addEventListener('change', ev => { cmpState.exerciseId = +ev.target.value; cmpState.range = null; comparisonsView(); });
    view.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { cmpState.mode = b.dataset.mode; comparisonsView(); }));
    view.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { cmpState.range = +b.dataset.range; comparisonsView(); }));
    bindTabs();
    const otherSel = document.getElementById('c-other');
    if (otherSel) otherSel.addEventListener('change', ev => {
      const v = ev.target.value;
      cmpState.otherId = v === 'all' ? 'all' : v ? +v : null;
      comparisonsView();
    });
  }

  const routes = [
    [/^#?\/?$/, homeView, 'home'],
    [/^#\/exercises$/, exercisesView, 'home'],
    [/^#\/exercise\/new$/, () => exerciseFormView(null), 'home'],
    [/^#\/exercise\/(\d+)\/edit$/, m => exerciseFormView(+m[1]), 'home'],
    [/^#\/exercise\/(\d+)$/, m => exerciseView(+m[1]), 'home'],
    [/^#\/exercise\/(\d+)\/log$/, m => logView(+m[1]), 'home'],
    [/^#\/history$/, () => historyView(), 'history'],
    [/^#\/comparisons$/, () => comparisonsView(), 'comparisons'],
    [/^#\/profile$/, profileView, 'profile']
  ];

  function onboardingView() {
    document.querySelector('.tabbar').hidden = true;
    view.innerHTML = `
      <div class="onboarding">
        <h1>Welkom bij Box App</h1>
        <div class="muted accent">Log. Compare. Get stronger.</div>
        <form id="onboard">
          <div class="field"><label for="o-name">Hoe heet je?</label>
            <div class="stepper"><input id="o-name" autocomplete="given-name" maxlength="40" placeholder="Je naam" required /></div></div>
          <button class="btn primary" type="submit">Profiel aanmaken</button>
        </form>
      </div>`;
    const input = document.getElementById('o-name');
    input.focus();
    document.getElementById('onboard').addEventListener('submit', async ev => {
      ev.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      const user = await repo.addUser(name);
      await repo.setCurrentUser(user.id);
      document.querySelector('.tabbar').hidden = false;
      location.hash = '#/';
      router();
    });
  }

  async function renderSidebar() {
    const side = document.getElementById('sidebar');
    if (!side) return;
    const [users, current] = [await repo.getUsers(), await repo.getCurrentUser()];
    side.innerHTML = `
      <div class="side-title">Sporters</div>
      ${users.map(u => `
        <button class="side-user ${current && u.id === current.id ? 'active' : ''}" data-id="${u.id}">
          <span class="avatar">${avatarInner(u)}</span><span class="grow">${esc(u.name)}</span>
        </button>`).join('')}
      <a class="side-user add" href="#/profile"><span class="avatar">+</span><span class="grow">Profiel toevoegen</span></a>`;
    side.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', async () => {
      await repo.setCurrentUser(+b.dataset.id);
      router();
    }));
  }

  async function router() {
    if (!(await repo.getCurrentUser())) { document.getElementById('sidebar').hidden = true; return onboardingView(); }
    document.getElementById('sidebar').hidden = false;
    renderSidebar();
    const hash = location.hash || '#/';
    for (const [re, fn, tab] of routes) {
      const m = hash.match(re);
      if (m) {
        document.querySelectorAll('.tabbar a[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
        window.scrollTo(0, 0);
        return fn(m);
      }
    }
    location.hash = '#/';
  }

  // Keep the user inside the app. Browsers skip history entries pushed without a user gesture,
  // so the back-button trap is (re)armed on every tap while the current entry isn't a trap.
  const armTrap = () => { if (!(history.state && history.state.trap)) history.pushState({ trap: true }, '', location.href); };
  document.addEventListener('pointerdown', armTrap, true);
  document.addEventListener('keydown', armTrap, true);
  document.addEventListener('click', ev => {
    const a = ev.target.closest('a[href]');
    if (a && (a.origin !== location.origin || a.target === '_blank')) ev.preventDefault();
  }, true);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.addEventListener('hashchange', router);
  router();
})();
