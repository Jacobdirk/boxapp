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
  const DB_VERSION = 6;

  // Initial feed: base exercises. Used by seedDatabase() (and later as SQL seed script).
  // Ids are stable; removed ids (8, 11, 12) are not reused.
  const SEED_EXERCISES = [
      { id: 1, name: 'Pull Ups', muscles: 'Rug / Biceps', icon: '🏋️', color: 'green', category: 'main' },
      { id: 2, name: 'Cable Row', muscles: 'Rug', icon: '🚣', color: 'blue', category: 'main' },
      { id: 3, name: 'Hex Bar Deadlift', muscles: 'Benen / Billen', icon: '🏋️‍♂️', color: 'yellow', category: 'main' },
      { id: 4, name: 'Bench Press', muscles: 'Borst', icon: '🛏️', color: 'purple', category: 'main' },
      { id: 5, name: 'Shoulder Press', muscles: 'Schouders', icon: '🙌', color: 'orange', category: 'main' },
      { id: 6, name: 'Cable Fly', muscles: 'Borst', icon: '🦅', color: 'slate', category: 'filler' },
      { id: 13, name: 'Squat', muscles: 'Benen / Billen', icon: '🦵', color: 'green', category: 'main' },
      { id: 7, name: 'Biceps Curl', muscles: 'Armen', icon: '💪', color: 'slate', category: 'filler' },
      { id: 14, name: 'Tricep Pulley', muscles: 'Armen', icon: '💪', color: 'slate', category: 'filler' },
      { id: 9, name: 'Shrugs', muscles: 'Schouders', icon: '🤷', color: 'slate', category: 'filler' },
      { id: 10, name: 'Lat Raises', muscles: 'Schouders', icon: '🙆', color: 'slate', category: 'filler' },
      { id: 15, name: 'Leg Press', muscles: 'Benen', icon: '🦵', color: 'slate', category: 'filler' },
      { id: 16, name: 'Hamstring Curl', muscles: 'Benen', icon: '🦵', color: 'slate', category: 'filler' },
      { id: 17, name: 'Calf Raise', muscles: 'Kuiten', icon: '🦶', color: 'slate', category: 'filler' },
      { id: 18, name: 'Dumbbell Row', muscles: 'Rug', icon: '🚣', color: 'slate', category: 'filler' },
      { id: 19, name: 'Barbell Row', muscles: 'Rug', icon: '🚣', color: 'slate', category: 'filler' },
      { id: 20, name: 'Dumbbell Shoulder Press', muscles: 'Schouders', icon: '🙌', color: 'slate', category: 'filler' },
      { id: 21, name: 'Machine Shoulder Press', muscles: 'Schouders', icon: '🙌', color: 'slate', category: 'filler' },
      { id: 22, name: 'Romanian Deadlift', muscles: 'Hamstrings / Billen', icon: '🏋️', color: 'slate', category: 'filler' },
      { id: 23, name: 'Deadlift', muscles: 'Rug / Benen', icon: '🏋️', color: 'slate', category: 'filler' },
      { id: 24, name: 'Push Ups', muscles: 'Borst / Armen', icon: '🤸', color: 'slate', category: 'filler' },
      { id: 25, name: 'Lat Pulley', muscles: 'Rug / Biceps', icon: '🏋️', color: 'slate', category: 'filler' }
  ].map(e => ({ ...e, variant_group: null }));
  // Quick swap groups (exercises.variant_group)
  const SEED_VARIANT_GROUPS = {
    row: ['Cable Row', 'Dumbbell Row', 'Barbell Row'],
    deadlift: ['Hex Bar Deadlift', 'Deadlift', 'Romanian Deadlift'],
    shoulder_press: ['Shoulder Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press'],
    squat: ['Squat', 'Leg Press'],
    pull_up: ['Pull Ups', 'Lat Pulley']
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
      meta: { version: DB_VERSION, seq: { users: 0, exercises: Math.max(...SEED_EXERCISES.map(e => e.id)), logs: 0 }, currentUserId: null },
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
      const names = new Set(db.exercises.map(e => e.name.toLowerCase()));
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
      if (!db.exercises.some(e => e.name.toLowerCase() === 'push ups')) {
        const seed = SEED_EXERCISES.find(e => e.name === 'Push Ups');
        db.exercises.push({ ...seed, id: ++db.meta.seq.exercises });
      }
      applyVariantGroups(db.exercises);
      db.meta.version = 4;
    }
    if (db.meta.version < 5) {
      const has = name => db.exercises.some(e => e.name.toLowerCase() === name.toLowerCase());
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
    return db;
  }

  class LocalStorageRepository {
    constructor() {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.db = raw ? migrate(JSON.parse(raw)) : seedDatabase();
      this._save();
    }
    _save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db)); }
    _nextId(table) { return ++this.db.meta.seq[table]; }

    // Reset to initial feed (wipes all data)
    async resetDatabase() { this.db = seedDatabase(); this._save(); }
    async exportDatabase() {
      return { app: 'boxapp', exported_at: new Date().toISOString(), data: JSON.parse(JSON.stringify(this.db)) };
    }
    async importDatabase(dump) {
      const data = dump && dump.app === 'boxapp' ? dump.data : dump;
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.exercises) || !Array.isArray(data.logs) || !data.meta) {
        throw new Error('Ongeldig back-upbestand');
      }
      this.db = migrate(data);
      this._save();
    }

    // Users
    async getUsers() { return [...this.db.users]; }
    async getCurrentUser() { return this.db.users.find(u => u.id === this.db.meta.currentUserId) || this.db.users[0] || null; }
    async setCurrentUser(id) { this.db.meta.currentUserId = id; this._save(); }
    async addUser(name) {
      const user = {
        id: this._nextId('users'),
        name,
        initials: name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase(),
        created_at: new Date().toISOString()
      };
      this.db.users.push(user);
      // Default favorites: all main exercises
      this.db.exercises.filter(e => e.category === 'main')
        .forEach(e => this.db.favorites.push({ user_id: user.id, exercise_id: e.id, created_at: user.created_at }));
      this._save();
      return user;
    }
    async updateUser(id, { name, photo }) {
      const user = this.db.users.find(u => u.id === id);
      if (!user) return null;
      if (name !== undefined) {
        user.name = name;
        user.initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
      }
      if (photo !== undefined) user.photo = photo || null;
      this._save();
      return user;
    }
    async deleteUser(id) {
      this.db.users = this.db.users.filter(u => u.id !== id);
      this.db.logs = this.db.logs.filter(l => l.user_id !== id);
      this.db.favorites = this.db.favorites.filter(f => f.user_id !== id);
      if (this.db.meta.currentUserId === id) this.db.meta.currentUserId = this.db.users[0]?.id ?? null;
      this._save();
    }

    // Exercises
    async getExercises(category) {
      return this.db.exercises.filter(e => !category || e.category === category);
    }
    async getExercise(id) { return this.db.exercises.find(e => e.id === id); }
    async getVariants(id) {
      const ex = this.db.exercises.find(e => e.id === id);
      if (!ex || !ex.variant_group) return [];
      return this.db.exercises.filter(e => e.variant_group === ex.variant_group && e.id !== id);
    }
    async getVariantGroups() {
      return [...new Set(this.db.exercises.map(e => e.variant_group).filter(Boolean))].sort();
    }
    async addExercise({ name, muscles = '', icon = '🏋️', color = 'slate', category = 'filler', variant_group = null }) {
      const ex = { id: this._nextId('exercises'), name, muscles, icon, color, category, variant_group };
      this.db.exercises.push(ex);
      this._save();
      return ex;
    }
    async updateExercise(id, { name, muscles, icon, color, category, variant_group = null }) {
      const ex = this.db.exercises.find(e => e.id === id);
      if (!ex) return null;
      Object.assign(ex, { name, muscles, icon, color, category, variant_group });
      this._save();
      return ex;
    }
    async deleteExercise(id) {
      this.db.exercises = this.db.exercises.filter(e => e.id !== id);
      this.db.logs = this.db.logs.filter(l => l.exercise_id !== id);
      this.db.favorites = this.db.favorites.filter(f => f.exercise_id !== id);
      this._save();
    }

    // Favorites (per user)
    async getFavoriteExercises(userId) {
      const ids = new Set(this.db.favorites.filter(f => f.user_id === userId).map(f => f.exercise_id));
      return this.db.exercises.filter(e => ids.has(e.id));
    }
    async isFavorite(userId, exerciseId) {
      return this.db.favorites.some(f => f.user_id === userId && f.exercise_id === exerciseId);
    }
    async setFavorite(userId, exerciseId, value) {
      this.db.favorites = this.db.favorites.filter(f => !(f.user_id === userId && f.exercise_id === exerciseId));
      if (value) this.db.favorites.push({ user_id: userId, exercise_id: exerciseId, created_at: new Date().toISOString() });
      this._save();
    }

    // Logs (newest first)
    async getLogs(userId, exerciseId) {
      return this.db.logs
        .filter(l => l.user_id === userId && l.exercise_id === exerciseId)
        .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    }
    async getLastLog(userId, exerciseId) { return (await this.getLogs(userId, exerciseId))[0] || null; }
    async getAllLogs(userId) {
      return this.db.logs
        .filter(l => l.user_id === userId)
        .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    }
    async addLog({ user_id, exercise_id, weight, reps, sets = null }) {
      const log = { id: this._nextId('logs'), user_id, exercise_id, weight, reps, sets, logged_at: new Date().toISOString() };
      this.db.logs.push(log);
      this._save();
      return log;
    }
    async deleteLog(id) {
      this.db.logs = this.db.logs.filter(l => l.id !== id);
      this._save();
    }
  }

  window.repo = new LocalStorageRepository();
})();
