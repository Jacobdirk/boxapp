// Muscle map of recently worked muscles (computed locally from logs, nothing stored)
(function () {
  const MAP = {
    'Pull Ups': { lats: 1, biceps: .6, traps: .3 }, 'Chin Ups': { lats: 1, biceps: .8 }, 'Lat Pulley': { lats: 1, biceps: .5 },
    'Cable Row': { lats: .8, traps: .6, rearDelts: .4, biceps: .4 }, 'Seated Row': { lats: .8, traps: .6, biceps: .4 },
    'Chest Supported Row': { lats: .7, traps: .7, rearDelts: .5 }, 'Dumbbell Row': { lats: 1, biceps: .4 }, 'Barbell Row': { lats: .8, traps: .6, lowerBack: .5 },
    'Hex Bar Deadlift': { quads: .8, glutes: 1, hamstrings: .6, lowerBack: .6, traps: .4 }, 'Deadlift': { glutes: 1, hamstrings: .8, lowerBack: 1, traps: .5 },
    'Romanian Deadlift': { hamstrings: 1, glutes: .8, lowerBack: .5 },
    'Bench Press': { chest: 1, frontDelts: .5, triceps: .6 }, 'Incline Bench Press': { chest: .9, frontDelts: .7, triceps: .5 },
    'Dumbbell Bench Press': { chest: 1, frontDelts: .5, triceps: .5 }, 'Incline Dumbbell Bench Press': { chest: .9, frontDelts: .7, triceps: .4 },
    'Push Ups': { chest: .9, frontDelts: .5, triceps: .6, abs: .3 }, 'Dips': { chest: .7, triceps: 1, frontDelts: .4 }, 'Cable Fly': { chest: 1, frontDelts: .3 },
    'Shoulder Press': { frontDelts: 1, sideDelts: .6, triceps: .5 }, 'Dumbbell Shoulder Press': { frontDelts: 1, sideDelts: .6, triceps: .4 },
    'Machine Shoulder Press': { frontDelts: 1, sideDelts: .5, triceps: .4 }, 'Landmine Press': { frontDelts: .9, chest: .5, triceps: .4, abs: .3 },
    'Lat Raises': { sideDelts: 1 }, 'Face Pulls': { rearDelts: 1, traps: .5 }, 'Shrugs': { traps: 1, forearms: .3 },
    'Biceps Curl': { biceps: 1, forearms: .4 }, 'Preacher Curl': { biceps: 1, forearms: .3 },
    'Tricep Pulley': { triceps: 1 }, 'Skull Crushers': { triceps: 1 },
    'Squat': { quads: 1, glutes: .8, hamstrings: .3, lowerBack: .3, abs: .3 }, 'Leg Press': { quads: 1, glutes: .6 },
    'Bulgarian Split Squat': { quads: 1, glutes: .9, hamstrings: .3 }, 'Hamstring Curl': { hamstrings: 1, calves: .2 }, 'Calf Raise': { calves: 1 },
    'Power Clean': { glutes: .8, hamstrings: .6, quads: .6, traps: .9, lowerBack: .5 }, 'Clean & Jerk': { quads: .8, glutes: .8, frontDelts: .7, traps: .7, triceps: .4 },
    'Snatch': { quads: .7, glutes: .8, traps: .8, sideDelts: .5, lowerBack: .5 }, "Farmer's Walk": { forearms: 1, traps: .9, abs: .6 }
  };
  const KEYWORDS = [[/borst|chest/i, 'chest'], [/schouder|shoulder/i, 'frontDelts'], [/rug|back/i, 'lats'], [/biceps/i, 'biceps'], [/triceps/i, 'triceps'],
    [/arm/i, 'biceps'], [/hamstring/i, 'hamstrings'], [/bil|glute/i, 'glutes'], [/been|benen|leg/i, 'quads'], [/kuit|calf/i, 'calves'], [/core|buik|abs/i, 'abs'], [/grip/i, 'forearms'], [/trap/i, 'traps']];
  const DAYS = 7;
  const LABELS = { chest: 'Borst', frontDelts: 'Voorkant schouders', sideDelts: 'Zijkant schouders', rearDelts: 'Achterkant schouders', biceps: 'Biceps', triceps: 'Triceps',
    forearms: 'Onderarmen', abs: 'Core', quads: 'Quadriceps', hamstrings: 'Hamstrings', glutes: 'Billen', calves: 'Kuiten', lats: 'Rug', traps: 'Traps', lowerBack: 'Onderrug' };

  const musclesFor = ex => MAP[ex.name] || Object.fromEntries(KEYWORDS.filter(([re]) => re.test(ex.muscles || '')).map(([, m]) => [m, .8]));

  async function scores(user) {
    const exercises = new Map((await repo.getExercises()).map(e => [e.id, e]));
    const now = Date.now(), score = {};
    for (const l of await repo.getAllLogs(user.id)) {
      const days = (now - new Date(l.logged_at)) / 864e5;
      const ex = exercises.get(l.exercise_id);
      if (days > DAYS || !ex) continue;
      const w = (l.sets || 1) * (1 - days / DAYS);
      for (const [m, f] of Object.entries(musclesFor(ex))) score[m] = (score[m] || 0) + w * f;
    }
    const max = Math.max(1, ...Object.values(score));
    return Object.fromEntries(Object.entries(score).map(([m, v]) => [m, v / max]));
  }

  const P = (m, d, s) => `<path data-m="${m}" d="${d}" style="fill-opacity:${(0.12 + .88 * (s[m] || 0)).toFixed(2)}"><title>${LABELS[m]}</title></path>`;
  const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const agoText = iso => {
    const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
    return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`;
  };

  // Exercises that train a muscle: favorites first, then most recently done, then how much they target the muscle
  async function suggestionsFor(user, muscle) {
    const favs = new Set((await repo.getFavoriteExercises(user.id)).map(e => e.id));
    const last = {};
    for (const l of await repo.getAllLogs(user.id)) if (!last[l.exercise_id] || l.logged_at > last[l.exercise_id]) last[l.exercise_id] = l.logged_at;
    return (await repo.getExercises())
      .map(e => ({ e, f: musclesFor(e)[muscle] || 0, fav: favs.has(e.id), last: last[e.id] || '' }))
      .filter(x => x.f >= .5)
      .sort((a, b) => (b.fav - a.fav) || b.last.localeCompare(a.last) || (b.f - a.f) || a.e.name.localeCompare(b.e.name));
  }

  async function showMuscle(muscle) {
    const box = document.getElementById('mm-suggest');
    if (!box || !currentUser) return;
    document.querySelectorAll('.musclemap path[data-m]').forEach(p => p.classList.toggle('sel', p.dataset.m === muscle));
    const list = await suggestionsFor(currentUser, muscle);
    box.innerHTML = `
      <div class="mm-suggest-head"><b>${LABELS[muscle]}</b><button class="mm-close" aria-label="Sluiten">✕</button></div>
      ${list.length ? `<div class="list">${list.map(({ e, fav, last }) => `
        <a class="row" href="#/exercise/${e.id}">
          <div class="icon c-${e.color}">${renderExerciseIcon(e.icon)}</div>
          <div class="grow"><div class="title">${escHtml(e.name)}${fav ? ' <span class="pb-fav">★</span>' : ''}</div><div class="muted">${last ? agoText(last) : 'Nog niet gedaan'}</div></div>
          <span class="chev">›</span>
        </a>`).join('')}</div>` : '<div class="muted">Geen oefeningen gevonden voor deze spiergroep</div>'}`;
    box.hidden = false;
  }

  let currentUser = null;
  document.addEventListener('click', e => {
    const path = e.target.closest && e.target.closest('.musclemap path[data-m]');
    if (path) return showMuscle(path.dataset.m);
    if (e.target.closest && e.target.closest('.mm-close')) {
      const box = document.getElementById('mm-suggest');
      if (box) box.hidden = true;
      document.querySelectorAll('.musclemap path.sel').forEach(p => p.classList.remove('sel'));
    }
  });
  const mirror = d => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(100 - x).toFixed(1)},${y}`);
  const both = (m, d, s) => P(m, d, s) + P(m, mirror(d), s);

  // Left half of the body silhouette (top centre -> down the left side -> crotch); mirrored for the right half
  const HALF = [[46,22],[46,28],[37,30],[29,32],[25,36],[23.5,42],[22.5,52],[22,62],[20,74],[18.5,84],[17,93],[18.5,98],[21,97],[23,88],[25.5,74],[27.5,63],[28.5,54],[30,47],
    [31.5,52],[33,62],[32.5,72],[31.5,82],[31.5,94],[32.5,110],[33,122],[33.5,136],[35,160],[35,172],[33.5,180],[42.5,180],[42,172],[43,160],[44.5,136],[45.5,122],[47,108],[48.5,98],[50,96]];
  const outline = `<ellipse class="mm-body" cx="50" cy="13" rx="8" ry="9.5"/>
    <path class="mm-body" d="M${HALF.map(p => p.join(',')).join(' L')} L${HALF.slice(0, -1).reverse().map(([x, y]) => `${100 - x},${y}`).join(' L')} Z"/>`;

  function front(s) {
    return `<svg viewBox="0 0 100 185" class="mm-svg">${outline}
      ${both('sideDelts', 'M29,32.5 Q24,35 24,43 L26.5,45 Q26,38 31,34 Z', s)}
      ${both('frontDelts', 'M31,34 Q26,38 26.5,45 L30,46 L34,38 L36.5,31 Z', s)}
      ${both('chest', 'M37.5,31.5 L49,33 L49,46 Q42,49 34.5,44 L34,38 Z', s)}
      ${both('biceps', 'M26.5,46 Q30.5,49 28,61 L23.5,61 Q23.5,51 26.5,46 Z', s)}
      ${both('forearms', 'M23,64 L27,64 Q26,76 23,86 L19.5,85 Q20.5,72 23,64 Z', s)}
      ${P('abs', 'M43,49 L57,49 L56,74 Q50,79 44,74 Z', s)}
      ${both('quads', 'M33,82 L43,87 L47,99 L45.5,118 L38,122 Q33,106 33,82 Z', s)}
      ${both('calves', 'M35,130 L43,130 L42.5,158 L37,159 Q34,145 35,130 Z', s)}
    </svg>`;
  }
  function back(s) {
    return `<svg viewBox="0 0 100 185" class="mm-svg">${outline}
      ${P('traps', 'M46,27 L54,27 L63,30.5 L56,38 L50,50 L44,38 L37,30.5 Z', s)}
      ${both('rearDelts', 'M29,32.5 Q24,35 24,43 L29,45.5 L34,37 L36,31 Z', s)}
      ${both('lats', 'M35,37 L43.5,40 L49,52 L48,63 L36.5,61 Q33,50 35,37 Z', s)}
      ${P('lowerBack', 'M42,64.5 L58,64.5 L58,76 L42,76 Z', s)}
      ${both('triceps', 'M26.5,46 Q30.5,49 28,61 L23.5,61 Q23.5,51 26.5,46 Z', s)}
      ${both('forearms', 'M23,64 L27,64 Q26,76 23,86 L19.5,85 Q20.5,72 23,64 Z', s)}
      ${both('glutes', 'M32,78 L49,79.5 L49,96 Q40,99.5 32,92 Z', s)}
      ${both('hamstrings', 'M33,99 L47,100 L45.5,119 L37.5,122 Q33,110 33,99 Z', s)}
      ${both('calves', 'M34.5,128 L43.5,128 L42.5,157 L37,159 Q33.5,144 34.5,128 Z', s)}
    </svg>`;
  }

  window.muscleMapCard = async function (user) {
    currentUser = user;
    const s = await scores(user);
    const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => LABELS[m]);
    return `
      <h3>Spiergroepen · laatste ${DAYS} dagen</h3>
      <div class="card musclemap">
        <div class="mm-views"><div>${front(s)}<div class="muted">Voor</div></div><div>${back(s)}<div class="muted">Achter</div></div></div>
        <div class="muted">${top.length ? 'Meest getraind: ' + top.join(', ') : 'Nog geen logs in de afgelopen week'} · tik op een spier voor oefeningen</div>
        <div id="mm-suggest" class="mm-suggest" hidden></div>
      </div>`;
  };
})();
