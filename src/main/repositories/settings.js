'use strict';

function deleteAll(db) {
  db.prepare('DELETE FROM settings').run();
}

function set(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, JSON.stringify(value));
}

function insertRow(db, row) {
  db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)'
  ).run(row);
}

function selectAll(db) {
  return db.prepare('SELECT * FROM settings').all();
}

module.exports = { deleteAll, set, insertRow, selectAll };
