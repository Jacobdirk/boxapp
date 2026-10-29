(function () {
  const view = document.getElementById('view');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = iso => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  const fmtSet = l => `${l.weight} kg × ${l.reps}${l.sets ? ` (${l.sets} sets)` : ''}`;
  const delta = n => n > 0 ? `<span class="up">+${n}</span>` : n < 0 ? `<span class="down">${n}</span>` : `<span class="same">±0</span>`;

  const exerciseRow = e => `
    <a class="row" href="#/exercise/${e.id}">
      <div class="icon c-${e.color}">${e.icon}</div>
      <div class="grow"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}</div></div>
      <span class="chev">›</span>
    </a>`;

  // ---------- Views ----------
  async function homeView() {
    const user = await repo.getCurrentUser();
    const main = await repo.getFavoriteExercises(user.id);
    view.innerHTML = `
      <div class="header">
        <div class="icon c-green">💪</div>
        <div class="grow"><h1>Box App</h1><div class="muted accent">Log. Compare. Get stronger.</div></div>
        <a class="avatar" href="#/profile">${esc(user.initials)}</a>
      </div>
      <h2>Mijn oefeningen</h2>
      <div class="muted">Jouw favoriete oefeningen · ${main.length}</div>
      <div class="list">${main.length ? main.map(exerciseRow).join('') : `<div class="card empty">Nog geen favorieten. Markeer oefeningen met ☆.</div>`}</div>
      <div class="list">
        <a class="row" href="#/exercises">
          <div class="icon c-slate">🤸</div>
          <div class="grow"><div class="title">Alle oefeningen</div><div class="muted">Hoofd- en filler oefeningen, favorieten beheren</div></div>
          <span class="chev">›</span>
        </a>
      </div>`;
  }

  async function exercisesView() {
    const user = await repo.getCurrentUser();
    const all = await repo.getExercises();
    const favs = new Set((await repo.getFavoriteExercises(user.id)).map(e => e.id));
    const row = e => `
      <div class="row">
        <a class="icon c-${e.color}" href="#/exercise/${e.id}" style="text-decoration:none">${e.icon}</a>
        <a class="grow" href="#/exercise/${e.id}" style="color:inherit;text-decoration:none"><div class="title">${esc(e.name)}</div><div class="muted">${esc(e.muscles)}</div></a>
        <button class="star ${favs.has(e.id) ? 'on' : ''}" data-fav="${e.id}" title="Favoriet">${favs.has(e.id) ? '★' : '☆'}</button>
      </div>`;
    const group = (title, cat) => {
      const list = all.filter(e => e.category === cat);
      return list.length ? `<h3>${title}</h3><div class="list">${list.map(row).join('')}</div>` : '';
    };
    view.innerHTML = `
      <button class="back" onclick="location.hash='#/'">←</button>
      <div class="header"><div class="grow"><h1>Alle oefeningen</h1><div class="muted">Tik op ☆ om een favoriet te maken</div></div></div>
      ${group('Hoofdoefeningen', 'main')}
      ${group('Overig / Filler', 'filler')}
      <a class="btn primary" href="#/exercise/new">＋ Nieuwe oefening</a>`;
    view.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', async () => {
      const id = +b.dataset.fav;
      await repo.setFavorite(user.id, id, !favs.has(id));
      exercisesView();
    }));
  }

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
      <button class="back" onclick="history.back()">←</button>
      <div class="header">
        <div class="icon lg c-${ex.color}">${ex.icon}</div>
        <div class="grow"><h1>${esc(ex.name)}</h1><div class="muted">${esc(ex.muscles)}</div></div>
        <button class="star ${fav ? 'on' : ''}" id="fav" title="Favoriet">${fav ? '★' : '☆'}</button>
        <a class="star" href="#/exercise/${id}/edit" title="Bewerken">✎</a>
      </div>
      <div class="last-row">
        <div class="card last">
          <div class="muted">Laatste keer</div>
          ${last ? `<div class="big">${fmtSet(last)}</div><div class="muted">${fmtDate(last.logged_at)}</div>` : `<div class="muted">Nog niet gelogd</div>`}
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
      ${last ? `<div class="card last"><div class="muted">Laatste keer</div><div class="big">${fmtSet(last)}</div><div class="muted">${fmtDate(last.logged_at)}</div></div>` : ''}
      <h3>Voer je gewicht en reps in</h3>
      ${stepper('weight', 'Gewicht (kg)', 2.5)}
      ${stepper('reps', 'Reps', 1)}
      <h3>Optioneel</h3>
      ${stepper('sets', 'Sets', 1)}
      <div id="cmp"></div>
      <button class="btn primary" id="save">Opslaan</button>
      <button class="btn" onclick="history.back()">Annuleren</button>`;

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

  async function profileView() {
    const user = await repo.getCurrentUser();
    const users = await repo.getUsers();
    view.innerHTML = `
      <div class="header"><div class="avatar lg active">${esc(user.initials)}</div><div class="grow"><h1>${esc(user.name)}</h1></div></div>
      <h3>Wissel van gebruiker</h3>
      <div class="users">
        ${users.map(u => `<div class="u"><button class="avatar lg ${u.id === user.id ? 'active' : ''}" data-id="${u.id}">${esc(u.initials)}</button>${esc(u.name)}</div>`).join('')}
        <div class="u"><button class="avatar lg" id="add">＋</button>Nieuw</div>
      </div>
      <h3>Beheer</h3>
      <a class="btn" href="#/exercises">Oefeningen beheren</a>
      <button class="btn danger" id="reset">Alles resetten naar standaard</button>`;
    document.getElementById('reset').addEventListener('click', async () => {
      if (!confirm('Alle gebruikers, oefeningen en logs wissen en standaard oefeningen terugzetten?')) return;
      await repo.resetDatabase();
      location.hash = '#/';
      router();
    });
    view.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', async () => {
      await repo.setCurrentUser(+b.dataset.id); profileView();
    }));
    document.getElementById('add').addEventListener('click', async () => {
      const name = (prompt('Naam van nieuwe gebruiker:') || '').trim();
      if (!name) return;
      const u = await repo.addUser(name);
      await repo.setCurrentUser(u.id); profileView();
    });
  }

  // ---------- Router ----------
  const routes = [
    [/^#?\/?$/, homeView, 'home'],
    [/^#\/exercises$/, exercisesView, 'home'],
    [/^#\/exercise\/new$/, () => exerciseFormView(null), 'home'],
    [/^#\/exercise\/(\d+)\/edit$/, m => exerciseFormView(+m[1]), 'home'],
    [/^#\/exercise\/(\d+)$/, m => exerciseView(+m[1]), 'home'],
    [/^#\/exercise\/(\d+)\/log$/, m => logView(+m[1]), 'home'],
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

  async function router() {
    if (!(await repo.getCurrentUser())) return onboardingView();
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

  window.addEventListener('hashchange', router);
  router();
})();
