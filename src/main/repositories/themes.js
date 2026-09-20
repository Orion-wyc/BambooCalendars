'use strict';

function deleteAll(db) {
  db.prepare('DELETE FROM themes').run();
}

function insert(db, row) {
  db.prepare(`
    INSERT OR IGNORE INTO themes (id, name, colors, is_builtin)
    VALUES (@id, @name, @colors, @is_builtin)
  `).run(row);
}

function selectAll(db) {
  return db.prepare('SELECT * FROM themes ORDER BY name').all();
}

module.exports = { deleteAll, insert, selectAll };
