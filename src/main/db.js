'use strict';

const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations');

function openDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);
  return db;
}

function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(db, key, value) {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function dbHasData(db) {
  if (getMeta(db, 'json_migrated_at')) return true;
  const row = db.prepare(
    'SELECT (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM lists) + (SELECT COUNT(*) FROM settings) AS n'
  ).get();
  return row.n > 0;
}

module.exports = { openDatabase, getMeta, setMeta, dbHasData };
