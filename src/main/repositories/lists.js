'use strict';

function deleteAll(db) {
  db.prepare('DELETE FROM lists').run();
}

function insert(db, row) {
  db.prepare(`
    INSERT OR IGNORE INTO lists (id, name, color, order_index, archived, created_at, updated_at)
    VALUES (@id, @name, @color, @order_index, @archived, @created_at, @updated_at)
  `).run(row);
}

function selectAll(db) {
  return db.prepare('SELECT * FROM lists ORDER BY order_index, created_at').all();
}

module.exports = { deleteAll, insert, selectAll };
