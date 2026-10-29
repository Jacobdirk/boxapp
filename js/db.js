/*
 * Data layer.
 * Data is stored as normalized "tables" (users, exercises, logs) with
 * numeric ids and foreign keys, so it maps 1:1 onto a future SQL schema:
 *
 *   users     (id PK, name, initials, created_at)
 *   exercises (id PK, name, muscles, icon, color, category)   category: 'main' | 'filler'
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
  const DB_VERSION = 2;

  // Initial feed: base exercises. Used by seedDatabase() (and later as SQL seed script).
  const SEED_EXERCISES = [
      { id: 1, name: 'Weighted Pull Ups', muscles: 'Rug / Biceps', icon: '🏋️', color: 'green', category: 'main' },
      { id: 2, name: 'Cable Row', muscles: 'Rug', icon: '🚣', color: 'blue', category: 'main' },
      { id: 3, name: 'Hex Bar Deadlift', muscles: 'Benen / Billen', icon: '🏋️‍♂️', color: 'yellow', category: 'main' },
      { id: 4, name: 'Bench Press', muscles: 'Borst', icon: '🛏️', color: 'purple', category: 'main' },
      { id: 5, name: 'Shoulder Press', muscles: 'Schouders', icon: '🙌', color: 'orange', category: 'main' },
      { id: 6, name: 'Cable Fly', muscles: 'Borst', icon: '🦅', color: 'teal', category: 'main' },
      { id: 7, name: 'Biceps Curl', muscles: 'Armen', icon: '💪', color: 'slate', category: 'filler' },
      { id: 8, name: 'Triceps Extension', muscles: 'Armen', icon: '💪', color: 'slate', category: 'filler' },
      { id: 9, name: 'Shrugs', muscles: 'Schouders', icon: '🤷', color: 'slate', category: 'filler' },
      { id: 10, name: 'Lat Raises', muscles: 'Schouders', icon: '🙆', color: 'slate', category: 'filler' },
      { id: 11, name: 'Leg Extension', muscles: 'Benen', icon: '🦵', color: 'slate', category: 'filler' },
      { id: 12, name: 'Leg Curl', muscles: 'Benen', icon: '🦵', color: 'slate', category: 'filler' }
  ];
  const SEED_FAVORITE_IDS = [1, 2, 3, 4, 5, 6];

  function seedDatabase() {
    const now = new Date().toISOString();
    return {
      meta: { version: DB_VERSION, seq: { users: 1, exercises: SEED_EXERCISES.length, logs: 0 }, currentUserId: 1 },
      users: [{ id: 1, name: 'JD', initials: 'JD', created_at: now }],
      exercises: structuredClone(SEED_EXERCISES),
      logs: [],
      favorites: SEED_FAVORITE_IDS.map(exercise_id => ({ user_id: 1, exercise_id, created_at: now }))
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

    // Users
    async getUsers() { return [...this.db.users]; }
    async getCurrentUser() { return this.db.users.find(u => u.id === this.db.meta.currentUserId) || this.db.users[0]; }
    async setCurrentUser(id) { this.db.meta.currentUserId = id; this._save(); }
    async addUser(name) {
      const user = {
        id: this._nextId('users'),
        name,
        initials: name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase(),
        created_at: new Date().toISOString()
      };
      this.db.users.push(user);
      this._save();
      return user;
    }

    // Exercises
    async getExercises(category) {
      return this.db.exercises.filter(e => !category || e.category === category);
    }
    async getExercise(id) { return this.db.exercises.find(e => e.id === id); }
    async addExercise({ name, muscles = '', icon = '🏋️', color = 'slate', category = 'filler' }) {
      const ex = { id: this._nextId('exercises'), name, muscles, icon, color, category };
      this.db.exercises.push(ex);
      this._save();
      return ex;
    }
    async updateExercise(id, { name, muscles, icon, color, category }) {
      const ex = this.db.exercises.find(e => e.id === id);
      if (!ex) return null;
      Object.assign(ex, { name, muscles, icon, color, category });
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
