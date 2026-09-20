'use strict';

function deleteAll(db) {
  db.prepare('DELETE FROM task_tags').run();
  db.prepare('DELETE FROM tags').run();
}

function insert(db, row) {
  db.prepare('INSERT OR IGNORE INTO tags (id, name, color) VALUES (@id, @name, @color)').run(row);
}

function selectAll(db) {
  return db.prepare('SELECT * FROM tags ORDER BY name').all();
}

function usageCount(db, tagId) {
  return db.prepare('SELECT COUNT(*) AS n FROM task_tags WHERE tag_id = ?').get(tagId).n;
}

module.exports = { deleteAll, insert, selectAll, usageCount };
