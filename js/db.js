/*
 * Data layer.
 * Data is stored as normalized "tables" (users, exercises, logs) with
 * numeric ids and foreign keys, so it maps 1:1 onto a future SQL schema:
 *
 users     (id PK, name, initials, photo TEXT NULL, created_at)
 *   exercises (id PK, name, muscles, icon, color, category, variant_group NULL)
 *              category: 'main' | 'filler'; variant_group: e.g. 'row' (quick swap)
 *   logs      (id PK, user_id FK->users, exercise_id FK->exercises ON DELETE CASCADE,
 *              weight REAL, reps INT, sets INT NULL, logged_at TEXT ISO-8601)
 *   favorites (user_id FK->users, exercise_id FK->exercises ON DELETE CASCADE,
 *              created_at, PRIMARY KEY (user_id, exercise_id))
 *
 * All access goes through the async Repository API below. To move to SQL,
 * replace LocalStorageRepository with an implementation that calls an API.
 */
(function () {
  const STORAGE_KEY = 'boxapp.db.v1';
  const DB_VERSION = 12;
  const SESSION_KEY = 'boxapp.session';
  const CFG = window.BOXAPP_CONFIG || {};
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
  const nowIso = () => new Date().toISOString();

  // Initial feed: base exercises. Used by seedDatabase() (and later as SQL seed script).
  // Ids are stable; removed ids (8, 11, 12) are not reused.
  const SEED_EXERCISES = [
      { id: 1, name: 'Pull Ups', muscles: 'Rug / Biceps', icon: 'svg:pullup', color: 'green', category: 'main' },
      { id: 2, name: 'Cable Row', muscles: 'Rug', icon: 'svg:cablerow', color: 'blue', category: 'main' },
      { id: 3, name: 'Hex Bar Deadlift', muscles: 'Benen / Billen', icon: 'svg:hexdeadlift', color: 'yellow', category: 'main' },
      { id: 4, name: 'Bench Press', muscles: 'Borst', icon: 'svg:bench', color: 'purple', category: 'main' },
      { id: 5, name: 'Shoulder Press', muscles: 'Schouders', icon: 'svg:shoulderpress', color: 'orange', category: 'main' },
      { id: 6, name: 'Cable Fly', muscles: 'Borst', icon: 'svg:cablefly', color: 'slate', category: 'filler' },
      { id: 13, name: 'Squat', muscles: 'Benen / Billen', icon: 'svg:squat', color: 'green', category: 'main' },
      { id: 7, name: 'Biceps Curl', muscles: 'Armen', icon: 'svg:curl', color: 'slate', category: 'filler' },
      { id: 14, name: 'Tricep Pulley', muscles: 'Armen', icon: 'svg:triceppulley', color: 'slate', category: 'filler' },
      { id: 9, name: 'Shrugs', muscles: 'Schouders', icon: 'svg:shrugs', color: 'slate', category: 'filler' },
      { id: 10, name: 'Lat Raises', muscles: 'Schouders', icon: 'svg:latraise', color: 'slate', category: 'filler' },
      { id: 15, name: 'Leg Press', muscles: 'Benen', icon: 'svg:legpress', color: 'slate', category: 'filler' },
      { id: 16, name: 'Hamstring Curl', muscles: 'Benen', icon: 'svg:hamcurl', color: 'slate', category: 'filler' },
      { id: 17, name: 'Calf Raise', muscles: 'Kuiten', icon: 'svg:calfraise', color: 'slate', category: 'filler' },
      { id: 18, name: 'Dumbbell Row', muscles: 'Rug', icon: 'svg:dbrow', color: 'slate', category: 'filler' },
      { id: 19, name: 'Barbell Row', muscles: 'Rug', icon: 'svg:barbellrow', color: 'slate', category: 'filler' },
      { id: 20, name: 'Dumbbell Shoulder Press', muscles: 'Schouders', icon: 'svg:dbshoulderpress', color: 'slate', category: 'filler' },
      { id: 21, name: 'Machine Shoulder Press', muscles: 'Schouders', icon: 'svg:machinepress', color: 'slate', category: 'filler' },
      { id: 22, name: 'Romanian Deadlift', muscles: 'Hamstrings / Billen', icon: 'svg:rdl', color: 'slate', category: 'filler' },
      { id: 23, name: 'Deadlift', muscles: 'Rug / Benen', icon: 'svg:deadlift', color: 'slate', category: 'filler' },
      { id: 24, name: 'Push Ups', muscles: 'Borst / Armen', icon: 'svg:pushup', color: 'slate', category: 'filler' },
      { id: 25, name: 'Lat Pulley', muscles: 'Rug / Biceps', icon: 'svg:latpulley', color: 'slate', category: 'filler' },
      { id: 26, name: 'Dips', muscles: 'Borst / Triceps', icon: 'svg:dips', color: 'slate', category: 'filler' },
      { id: 27, name: 'Chin Ups', muscles: 'Rug / Biceps', icon: 'svg:chinup', color: 'slate', category: 'filler' },
      { id: 28, name: 'Incline Bench Press', muscles: 'Bovenborst', icon: 'svg:inclinebench', color: 'slate', category: 'filler' },
      { id: 29, name: 'Dumbbell Bench Press', muscles: 'Borst', icon: 'svg:dbbench', color: 'slate', category: 'filler' },
      { id: 30, name: 'Incline Dumbbell Bench Press', muscles: 'Bovenborst', icon: 'svg:inclinedbbench', color: 'slate', category: 'filler' },
      { id: 31, name: 'Chest Supported Row', muscles: 'Rug', icon: 'svg:chestrow', color: 'slate', category: 'filler' },
      { id: 32, name: 'Seated Row', muscles: 'Rug', icon: 'svg:seatedrow', color: 'slate', category: 'filler' },
      { id: 33, name: 'Bulgarian Split Squat', muscles: 'Benen / Billen', icon: 'svg:splitsquat', color: 'slate', category: 'filler' },
      { id: 34, name: 'Face Pulls', muscles: 'Achterkant schouders / Bovenrug', icon: 'svg:facepull', color: 'slate', category: 'filler' },
      { id: 35, name: 'Skull Crushers', muscles: 'Triceps', icon: 'svg:skullcrusher', color: 'slate', category: 'filler' },
      { id: 36, name: 'Power Clean', muscles: 'Volledig lichaam', icon: 'svg:powerclean', color: 'slate', category: 'filler' },
      { id: 37, name: "Farmer's Walk", muscles: 'Grip / Core / Traps', icon: 'svg:farmerswalk', color: 'slate', category: 'filler' },
      { id: 38, name: 'Clean & Jerk', muscles: 'Volledig lichaam', icon: 'svg:cleanjerk', color: 'slate', category: 'filler' },
      { id: 39, name: 'Snatch', muscles: 'Volledig lichaam', icon: 'svg:snatch', color: 'slate', category: 'filler' },
      { id: 40, name: 'Landmine Press', muscles: 'Schouders / Borst', icon: 'svg:landminepress', color: 'slate', category: 'filler' },
      { id: 41, name: 'Preacher Curl', muscles: 'Biceps', icon: 'svg:preachercurl', color: 'slate', category: 'filler' }
  ].map(e => ({ ...e, variant_group: null }));
  // Quick swap groups (exercises.variant_group)
  const SEED_VARIANT_GROUPS = {
    row: ['Cable Row', 'Seated Row', 'Chest Supported Row', 'Dumbbell Row', 'Barbell Row'],
    bench: ['Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Bench Press', 'Push Ups'],
    deadlift: ['Hex Bar Deadlift', 'Deadlift', 'Romanian Deadlift'],
    shoulder_press: ['Shoulder Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press', 'Landmine Press'],
    olympic: ['Power Clean', 'Clean & Jerk', 'Snatch'],
    curl: ['Biceps Curl', 'Preacher Curl'],
    squat: ['Squat', 'Leg Press', 'Bulgarian Split Squat'],
    triceps: ['Tricep Pulley', 'Skull Crushers', 'Dips'],
    traps: ['Shrugs', "Farmer's Walk"],
    pull_up: ['Pull Ups', 'Chin Ups', 'Lat Pulley']
  };
  const applyVariantGroups = exercises => {
    for (const [group, names] of Object.entries(SEED_VARIANT_GROUPS)) {
      exercises.filter(e => names.includes(e.name) && !e.variant_group).forEach(e => { e.variant_group = group; });
    }
    return exercises;
  };
  applyVariantGroups(SEED_EXERCISES);
  const REMOVED_SEED_NAMES = ['Triceps Extension', 'Leg Extension', 'Leg Curl'];

  function seedDatabase() {
    return {
      meta: { version: 10, seq: { users: 0, exercises: Math.max(...SEED_EXERCISES.map(e => e.id)), logs: 0 }, currentUserId: null },
      users: [],
      exercises: structuredClone(SEED_EXERCISES),
      logs: [],
      favorites: []
    };
  }

  // Schema migrations (mirror of future SQL migrations)
  function migrate(db) {
    if ((db.meta.version || 1) < 2) {
      const now = new Date().toISOString();
      db.favorites = db.users.flatMap(u => db.exercises
        .filter(e => e.category === 'main')
        .map(e => ({ user_id: u.id, exercise_id: e.id, created_at: now })));
      db.meta.version = 2;
    }
    if (db.meta.version < 3) {
      const now = new Date().toISOString();
      // Remove dropped defaults, but keep them if the user already logged them
      const logged = new Set(db.logs.map(l => l.exercise_id));
      const drop = new Set(db.exercises.filter(e => REMOVED_SEED_NAMES.includes(e.name) && !logged.has(e.id)).map(e => e.id));
      db.exercises = db.exercises.filter(e => !drop.has(e.id));
      db.favorites = db.favorites.filter(f => !drop.has(f.exercise_id));
      // Add new defaults that don't exist yet (matched by name), with fresh ids
      const names = new Set(db.exercises.map(e => (e.name || '').toLowerCase()));
      for (const seed of SEED_EXERCISES) {
        if (names.has(seed.name.toLowerCase()) || ['Push Ups', 'Lat Pulley', 'Pull Ups'].includes(seed.name)) continue;
        const ex = { ...seed, id: ++db.meta.seq.exercises };
        db.exercises.push(ex);
        if (seed.name === 'Squat') {
          db.users.forEach(u => db.favorites.push({ user_id: u.id, exercise_id: ex.id, created_at: now }));
        }
      }
      db.meta.version = 3;
    }
    if (db.meta.version < 4) {
      db.exercises.forEach(e => { if (e.variant_group === undefined) e.variant_group = null; });
      if (!db.exercises.some(e => (e.name || '').toLowerCase() === 'push ups')) {
        const seed = SEED_EXERCISES.find(e => e.name === 'Push Ups');
        db.exercises.push({ ...seed, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 4;
    }
    if (db.meta.version < 5) {
      const has = name => db.exercises.some(e => (e.name || '').toLowerCase() === name.toLowerCase());
      const weighted = db.exercises.find(e => e.name === 'Weighted Pull Ups');
      if (weighted && !has('Pull Ups')) weighted.name = 'Pull Ups';
      if (!has('Lat Pulley')) {
        const seed = SEED_EXERCISES.find(e => e.name === 'Lat Pulley');
        db.exercises.push({ ...seed, variant_group: null, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 5;
    }
    if (db.meta.version < 6) {
      db.exercises.filter(e => e.name === 'Cable Fly').forEach(e => { e.category = 'filler'; e.color = 'slate'; });
      db.exercises.filter(e => e.name === 'Squat').forEach(e => { e.category = 'main'; });
      db.meta.version = 6;
    }
    if (db.meta.version < 7) {
      // Custom SVG icons for default exercises (keep icons the user changed), add Dips and Chin Ups
      const OLD_DEFAULT_ICONS = ['ðŸ‹ï¸', 'ðŸš£', 'ðŸ‹ï¸â€â™‚ï¸', 'ðŸ›ï¸', 'ðŸ™Œ', 'ðŸ¦…', 'ðŸ¦µ', 'ðŸ’ª', 'ðŸ¤·', 'ðŸ™†', 'ðŸ¦¶', 'ðŸ¤¸'];
      for (const seed of SEED_EXERCISES) {
        const ex = db.exercises.find(e => (e.name || '').toLowerCase() === seed.name.toLowerCase());
        if (ex && OLD_DEFAULT_ICONS.includes(ex.icon)) ex.icon = seed.icon;
      }
      for (const name of ['Dips', 'Chin Ups']) {
        if (db.exercises.some(e => (e.name || '').toLowerCase() === name.toLowerCase())) continue;
        const seed = SEED_EXERCISES.find(e => e.name === name);
        db.exercises.push({ ...seed, variant_group: null, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 7;
    }
    if (db.meta.version < 8) {
      for (const name of ['Incline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Bench Press', 'Chest Supported Row', 'Seated Row']) {
        if (db.exercises.some(e => (e.name || '').toLowerCase() === name.toLowerCase())) continue;
        const seed = SEED_EXERCISES.find(e => e.name === name);
        db.exercises.push({ ...seed, variant_group: null, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 8;
    }
    if (db.meta.version < 9) {
      for (const name of ['Bulgarian Split Squat', 'Face Pulls', 'Skull Crushers']) {
        if (db.exercises.some(e => (e.name || '').toLowerCase() === name.toLowerCase())) continue;
        const seed = SEED_EXERCISES.find(e => e.name === name);
        db.exercises.push({ ...seed, variant_group: null, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 9;
    }
    if (db.meta.version < 10) {
      for (const name of ['Power Clean', "Farmer's Walk", 'Clean & Jerk', 'Snatch', 'Landmine Press', 'Preacher Curl']) {
        if (db.exercises.some(e => (e.name || '').toLowerCase() === name.toLowerCase())) continue;
        const seed = SEED_EXERCISES.find(e => e.name === name);
        db.exercises.push({ ...seed, variant_group: null, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 10;
    }
    if (db.meta.version < 11) {
      // Numeric ids -> UUIDs, plus sync fields (client_updated_at, deleted_at, dirty)
      const now = nowIso();
      const mark = r => Object.assign(r, { client_updated_at: r.client_updated_at || now, deleted_at: r.deleted_at || null, dirty: true });
      const users = new Map(), exercises = new Map();
      db.users.forEach(u => { const id = uuid(); users.set(u.id, id); u.id = id; mark(u); });
      db.exercises.forEach(e => { const id = uuid(); exercises.set(e.id, id); e.id = id; mark(e); });
      db.logs = db.logs.filter(l => users.has(l.user_id) && exercises.has(l.exercise_id))
        .map(l => mark({ ...l, id: uuid(), user_id: users.get(l.user_id), exercise_id: exercises.get(l.exercise_id) }));
      db.favorites = db.favorites.filter(f => users.has(f.user_id) && exercises.has(f.exercise_id))
        .map(f => mark({ ...f, user_id: users.get(f.user_id), exercise_id: exercises.get(f.exercise_id) }));
      db.meta = { version: 11, currentUserId: users.get(db.meta.currentUserId) ?? null, linked: false, cursors: {} };
    }
    if (db.meta.version < 12) {
      const before = new Map(db.exercises.map(e => [e.id, e.variant_group]));
      applyVariantGroups(db.exercises);
      db.exercises.filter(e => before.get(e.id) !== e.variant_group)
        .forEach(e => Object.assign(e, { client_updated_at: nowIso(), dirty: true }));
      db.meta.version = 12;
    }
    return db;
  }


  // ---------- Supabase (REST via fetch, no SDK) ----------
  const TABLES = [
    // local table, remote table, key, local->remote, remote->local
    { local: 'users', remote: 'profiles', key: ['id'],
      out: u => ({ id: u.id, name: u.name, initials: u.initials, photo: u.photo || null, created_at: u.created_at, client_updated_at: u.client_updated_at, deleted_at: u.deleted_at }),
      in: r => ({ id: r.id, name: r.name, initials: r.initials, photo: r.photo, created_at: r.created_at, client_updated_at: r.client_updated_at, deleted_at: r.deleted_at }) },
    { local: 'exercises', remote: 'exercises', key: ['id'],
      out: e => ({ id: e.id, name: e.name, muscles: e.muscles, icon: e.icon, color: e.color, category: e.category, variant_group: e.variant_group || null, client_updated_at: e.client_updated_at, deleted_at: e.deleted_at }),
      in: r => ({ id: r.id, name: r.name, muscles: r.muscles, icon: r.icon, color: r.color, category: r.category, variant_group: r.variant_group, client_updated_at: r.client_updated_at, deleted_at: r.deleted_at }) },
    { local: 'logs', remote: 'logs', key: ['id'],
      out: l => ({ id: l.id, profile_id: l.user_id, exercise_id: l.exercise_id, weight: l.weight, reps: l.reps, sets: l.sets, logged_at: l.logged_at, client_updated_at: l.client_updated_at, deleted_at: l.deleted_at }),
      in: r => ({ id: r.id, user_id: r.profile_id, exercise_id: r.exercise_id, weight: r.weight, reps: r.reps, sets: r.sets, logged_at: r.logged_at, client_updated_at: r.client_updated_at, deleted_at: r.deleted_at }) },
    { local: 'favorites', remote: 'favorites', key: ['user_id', 'exercise_id'], onConflict: 'profile_id,exercise_id',
      out: f => ({ profile_id: f.user_id, exercise_id: f.exercise_id, created_at: f.created_at, client_updated_at: f.client_updated_at, deleted_at: f.deleted_at }),
      in: r => ({ user_id: r.profile_id, exercise_id: r.exercise_id, created_at: r.created_at, client_updated_at: r.client_updated_at, deleted_at: r.deleted_at }) }
  ];
  const sameKey = (t, a, b) => t.key.every(k => a[k] === b[k]);

  class Remote {
    constructor() {
      this.url = (CFG.supabaseUrl || '').replace(/\/$/, '');
      this.key = CFG.supabaseKey || '';
      try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { this.session = null; }
    }
    get configured() { return !!(this.url && this.key); }
    get loggedIn() { return !!this.session; }
    _store(s) {
      this.session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) } : null;
      if (this.session) localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      else localStorage.removeItem(SESSION_KEY);
    }
    async _auth(grant, body) {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=${grant}`, {
        method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(data.error_description || data.msg || data.message || `HTTP ${res.status}`); err.status = res.status; throw err; }
      this._store(data);
    }
    async login(secret) {
      // PBKDF2-SHA256 (must match tools/generate-login.ps1): bytes 0-31 = password, 32-39 = email name
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('boxapp:v2'), iterations: 600000 }, key, 320);
      const hex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
      await this._auth('password', { email: `${hex.slice(64, 80)}@boxapp.local`, password: hex.slice(0, 64) });
    }
    logout() { this._store(null); }
    async _token() {
      if (!this.session) throw Object.assign(new Error('Niet ingelogd'), { auth: true });
      if (this.session.expires_at - 60 < Date.now() / 1000) {
        try { await this._auth('refresh_token', { refresh_token: this.session.refresh_token }); }
        catch (e) { if (e.status >= 400 && e.status < 500) { this.logout(); e.auth = true; } throw e; }
      }
      return this.session.access_token;
    }
    async rest(path, { method = 'GET', body, prefer } = {}) {
      const headers = { apikey: this.key, Authorization: `Bearer ${await this._token()}`, 'Content-Type': 'application/json' };
      if (prefer) headers.Prefer = prefer;
      const res = await fetch(`${this.url}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
      if (res.status === 401) { this.logout(); throw Object.assign(new Error('Sessie verlopen'), { auth: true }); }
      if (!res.ok) throw new Error(`${path.split('?')[0]}: ${(await res.text()) || res.status}`);
      return res.status === 204 ? null : res.json().catch(() => null);
    }
  }

  class LocalStorageRepository {
    constructor() {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.db = migrate(raw ? JSON.parse(raw) : seedDatabase());
      this.remote = new Remote();
      this.status = { state: 'idle', error: null, last: this.db.meta.lastSync || null };
      this._save(false);
    }
    _save(sync = true) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
      if (sync) this.scheduleSync();
    }
    _live(table) { return this.db[table].filter(r => !r.deleted_at); }
    _touch(row) { return Object.assign(row, { client_updated_at: nowIso(), dirty: true }); }
    _remove(row) { return this._touch(Object.assign(row, { deleted_at: nowIso() })); }

    // ---------- Sync ----------
    get syncEnabled() { return this.remote.configured && !this.offlineMode; }
    get offlineMode() { return !!this.db.meta.offlineMode; }
    setOfflineMode(on) {
      this.db.meta.offlineMode = !!on;
      this._save(false);
      // Ask the browser not to evict local data, since it is the only copy
      if (on && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }
    // Logs created after the last export (offline mode has no cloud copy)
    unbackedLogs() {
      const since = this.db.meta.lastBackup || '';
      return this._live('logs').filter(l => l.logged_at > since).length;
    }
    get hasSynced() { return !!this.db.meta.lastSync; }
    needsLogin() { return this.remote.configured && !this.offlineMode && !this.remote.loggedIn; }
    async login(secret) { await this.remote.login(secret); this.setOfflineMode(false); await this.sync(); }
    logout() { this.remote.logout(); this._status('offline'); }
    pendingCount() { return TABLES.reduce((n, t) => n + this.db[t.local].filter(r => r.dirty).length, 0); }
    _status(state, error = null) {
      this.status = { state, error, last: this.db.meta.lastSync || null, pending: this.pendingCount() };
      window.dispatchEvent(new CustomEvent('boxapp:sync', { detail: this.status }));
    }
    scheduleSync(delay = 1500) {
      if (!this.syncEnabled) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.sync(), delay);
    }
    async sync() {
      if (!this.syncEnabled || !this.remote.loggedIn) return;
      if (!navigator.onLine) return this._status('offline');
      if (this._syncing) { this._again = true; return; }
      this._syncing = true;
      this._status('syncing');
      let changed = false;
      try {
        changed = await this._pull();
        // Always merge unsynced local exercises into remote ones with the same name (not only on first link)
        if (this._linkByName() || !this.db.meta.linked) changed = true;
        await this._push();
        changed = (await this._pull()) || changed;
        this.db.meta.linked = true;
        this.db.meta.lastSync = nowIso();
        this._save(false);
        this._status('ok');
        if (changed) window.dispatchEvent(new CustomEvent('boxapp:remote-change'));
      } catch (e) {
        this._save(false);
        this._status(e.auth ? 'login' : (navigator.onLine ? 'error' : 'offline'), e.message);
        if (e.auth) window.dispatchEvent(new CustomEvent('boxapp:auth-required'));
      } finally {
        this._syncing = false;
        if (this._again) { this._again = false; this.scheduleSync(0); }
      }
    }
    async _pull() {
      let changed = false;
      const cursors = this.db.meta.cursors || (this.db.meta.cursors = {});
      for (const t of TABLES) {
        for (;;) {
          const since = cursors[t.remote];
          const rows = await this.remote.rest(`${t.remote}?select=*&order=updated_at.asc&limit=1000${since ? `&updated_at=gt.${encodeURIComponent(since)}` : ''}`);
          for (const r of rows) {
            const incoming = t.in(r);
            const list = this.db[t.local];
            const i = list.findIndex(x => sameKey(t, x, incoming));
            if (i < 0) { list.push(incoming); changed = true; continue; }
            const mine = list[i];
            // Last write wins on client_updated_at; deleted logs stay deleted
            if (mine.dirty && mine.client_updated_at > (incoming.client_updated_at || '')) {
              if (t.local === 'logs' && incoming.deleted_at) list[i] = incoming;
              continue;
            }
            list[i] = incoming;
            changed = true;
          }
          if (rows.length) cursors[t.remote] = rows[rows.length - 1].updated_at;
          if (rows.length < 1000) break;
        }
      }
      return changed;
    }
    // First link of a device: reuse remote exercises with the same name instead of uploading duplicates
    _linkByName() {
      const remote = new Map();
      this.db.exercises.filter(e => !e.dirty && !e.deleted_at).forEach(e => { const k = (e.name || '').trim().toLowerCase(); if (!remote.has(k)) remote.set(k, e.id); });
      const map = new Map();
      this.db.exercises = this.db.exercises.filter(e => {
        const target = e.dirty && remote.get((e.name || '').trim().toLowerCase());
        if (target && target !== e.id) { map.set(e.id, target); return false; }
        return true;
      });
      if (!map.size) return false;
      this.db.logs.forEach(l => { if (map.has(l.exercise_id)) this._touch(Object.assign(l, { exercise_id: map.get(l.exercise_id) })); });
      const favs = [];
      for (const f of this.db.favorites) {
        if (map.has(f.exercise_id)) this._touch(Object.assign(f, { exercise_id: map.get(f.exercise_id) }));
        const dup = favs.find(x => x.user_id === f.user_id && x.exercise_id === f.exercise_id);
        if (!dup) favs.push(f);
        else if (!f.deleted_at) dup.deleted_at = null;
      }
      this.db.favorites = favs;
      return true;
    }
    async _push() {
      for (const t of TABLES) {
        const dirty = this.db[t.local].filter(r => r.dirty);
        for (let i = 0; i < dirty.length; i += 200) {
          const batch = dirty.slice(i, i + 200);
          await this.remote.rest(`${t.remote}${t.onConflict ? `?on_conflict=${t.onConflict}` : ''}`, {
            method: 'POST', body: batch.map(t.out), prefer: 'resolution=merge-duplicates,return=minimal'
          });
          batch.forEach(r => { delete r.dirty; });
          this._save(false);
        }
      }
    }

    // Reset local copy (remote data is pulled again on next sync)
    async resetDatabase() { this.db = migrate(seedDatabase()); this._save(); }
    async exportDatabase() {
      const dump = { app: 'boxapp', exported_at: nowIso(), data: JSON.parse(JSON.stringify(this.db)) };
      this.db.meta.lastBackup = dump.exported_at;
      this._save(false);
      return dump;
    }
    async importDatabase(dump) {
      const data = dump && dump.app === 'boxapp' ? dump.data : dump;
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.exercises) || !Array.isArray(data.logs) || !data.meta) {
        throw new Error('Ongeldig back-upbestand');
      }
      const db = migrate(JSON.parse(JSON.stringify(data)));
      TABLES.forEach(t => db[t.local].forEach(r => { r.dirty = true; }));
      db.meta = { version: DB_VERSION, currentUserId: db.meta.currentUserId, linked: false, cursors: {} };
      this.db = db;
      this._save();
    }

    // Users
    async getUsers() { return this._live('users'); }
    async getCurrentUser() {
      const users = this._live('users');
      return users.find(u => u.id === this.db.meta.currentUserId) || null;
    }
    async setCurrentUser(id) { this.db.meta.currentUserId = id; this._save(false); }
    async addUser(name) {
      const user = this._touch({
        id: uuid(), name, photo: null, deleted_at: null,
        initials: name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase(),
        created_at: nowIso()
      });
      this.db.users.push(user);
      // Default favorites: all main exercises
      this._live('exercises').filter(e => e.category === 'main')
        .forEach(e => this.db.favorites.push(this._touch({ user_id: user.id, exercise_id: e.id, created_at: user.created_at, deleted_at: null })));
      this._save();
      return user;
    }
    // Default profiles (fixed ids, so seeding on several devices merges instead of duplicating)
    async seedProfiles() {
      if (this._live('users').length) return;
      const SEED_PROFILES = [
        { id: '00000000-0000-4000-8000-000000000001', name: 'JD', favorites: null },
        { id: '00000000-0000-4000-8000-000000000002', name: 'Bart', favorites: ['Cable Row', 'Hex Bar Deadlift', 'Bench Press', 'Shoulder Press', 'Cable Fly', 'Biceps Curl', 'Tricep Pulley', 'Shrugs'] }
      ];
      const created_at = nowIso();
      for (const p of SEED_PROFILES) {
        if (this.db.users.some(u => u.id === p.id)) continue;
        const initials = p.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
        this.db.users.push(this._touch({ id: p.id, name: p.name, initials, photo: null, created_at, deleted_at: null }));
        this._live('exercises').filter(e => p.favorites ? p.favorites.includes(e.name) : e.category === 'main')
          .forEach(e => this.db.favorites.push(this._touch({ user_id: p.id, exercise_id: e.id, created_at, deleted_at: null })));
      }
      this._save();
    }
    async updateUser(id, { name, photo }) {
      const user = this.db.users.find(u => u.id === id);
      if (!user) return null;
      if (name !== undefined) {
        user.name = name;
        user.initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
      }
      if (photo !== undefined) user.photo = photo || null;
      this._touch(user);
      this._save();
      return user;
    }
    async deleteUser(id) {
      this.db.users.filter(u => u.id === id && !u.deleted_at).forEach(r => this._remove(r));
      this.db.logs.filter(l => l.user_id === id && !l.deleted_at).forEach(r => this._remove(r));
      this.db.favorites.filter(f => f.user_id === id && !f.deleted_at).forEach(r => this._remove(r));
      if (this.db.meta.currentUserId === id) this.db.meta.currentUserId = this._live('users')[0]?.id ?? null;
      this._save();
    }

    // Exercises
    async getExercises(category) {
      return this._live('exercises').filter(e => !category || e.category === category);
    }
    async getExercise(id) { return this._live('exercises').find(e => e.id === id); }
    async getVariants(id) {
      const ex = await this.getExercise(id);
      if (!ex || !ex.variant_group) return [];
      return this._live('exercises').filter(e => e.variant_group === ex.variant_group && e.id !== id);
    }
    async getVariantGroups() {
      return [...new Set(this._live('exercises').map(e => e.variant_group).filter(Boolean))].sort();
    }
    async addExercise({ name, muscles = '', icon = 'ðŸ‹ï¸', color = 'slate', category = 'filler', variant_group = null }) {
      const ex = this._touch({ id: uuid(), name, muscles, icon, color, category, variant_group, deleted_at: null });
      this.db.exercises.push(ex);
      this._save();
      return ex;
    }
    async updateExercise(id, { name, muscles, icon, color, category, variant_group = null }) {
      const ex = this.db.exercises.find(e => e.id === id);
      if (!ex) return null;
      this._touch(Object.assign(ex, { name, muscles, icon, color, category, variant_group }));
      this._save();
      return ex;
    }
    async deleteExercise(id) {
      this.db.exercises.filter(e => e.id === id && !e.deleted_at).forEach(r => this._remove(r));
      this.db.logs.filter(l => l.exercise_id === id && !l.deleted_at).forEach(r => this._remove(r));
      this.db.favorites.filter(f => f.exercise_id === id && !f.deleted_at).forEach(r => this._remove(r));
      this._save();
    }

    // Favorites (per user)
    async getFavoriteExercises(userId) {
      const ids = new Set(this._live('favorites').filter(f => f.user_id === userId).map(f => f.exercise_id));
      return this._live('exercises').filter(e => ids.has(e.id));
    }
    async isFavorite(userId, exerciseId) {
      return this._live('favorites').some(f => f.user_id === userId && f.exercise_id === exerciseId);
    }
    async setFavorite(userId, exerciseId, value) {
      let fav = this.db.favorites.find(f => f.user_id === userId && f.exercise_id === exerciseId);
      if (!fav) {
        if (!value) return;
        fav = { user_id: userId, exercise_id: exerciseId, created_at: nowIso() };
        this.db.favorites.push(fav);
      }
      fav.deleted_at = value ? null : nowIso();
      this._touch(fav);
      this._save();
    }

    // Logs (newest first)
    async getLogs(userId, exerciseId) {
      return this._live('logs')
        .filter(l => l.user_id === userId && l.exercise_id === exerciseId)
        .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    }
    async getLastLog(userId, exerciseId) { return (await this.getLogs(userId, exerciseId))[0] || null; }
    async getAllLogs(userId) {
      return this._live('logs')
        .filter(l => l.user_id === userId)
        .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    }
    async addLog({ user_id, exercise_id, weight, reps, sets = null }) {
      const log = this._touch({ id: uuid(), user_id, exercise_id, weight, reps, sets, logged_at: nowIso(), deleted_at: null });
      this.db.logs.push(log);
      this._save();
      return log;
    }
    async deleteLog(id) {
      this.db.logs.filter(l => l.id === id && !l.deleted_at).forEach(r => this._remove(r));
      this._save();
    }
  }

  window.repo = new LocalStorageRepository();
  window.addEventListener('online', () => repo.sync());
  window.addEventListener('offline', () => repo._status('offline'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) repo.sync(); });
  setInterval(() => repo.sync(), 30000);
})();
