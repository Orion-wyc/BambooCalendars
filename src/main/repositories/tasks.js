'use strict';

function deleteAll(db) {
  db.prepare('DELETE FROM task_tags').run();
  db.prepare('DELETE FROM subtasks').run();
  db.prepare('DELETE FROM tasks').run();
}

function insertTask(db, row) {
  db.prepare(`
    INSERT OR IGNORE INTO tasks (
      id, list_id, title, note, completed, completed_at, important, in_my_day,
      priority, due_date, reminder, repeat, order_index, created_at, updated_at
    ) VALUES (
      @id, @list_id, @title, @note, @completed, @completed_at, @important, @in_my_day,
      @priority, @due_date, @reminder, @repeat, @order_index, @created_at, @updated_at
    )
  `).run(row);
}

function insertSubtask(db, row) {
  db.prepare(`
    INSERT OR IGNORE INTO subtasks (id, task_id, title, completed, order_index)
    VALUES (@id, @task_id, @title, @completed, @order_index)
  `).run(row);
}

function insertTaskTag(db, row) {
  db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (@task_id, @tag_id)').run(row);
}

function selectAll(db) {
  return db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all();
}

function selectSubtasks(db) {
  return db.prepare('SELECT * FROM subtasks ORDER BY order_index, rowid').all();
}

function selectTaskTags(db) {
  return db.prepare('SELECT * FROM task_tags').all();
}

module.exports = { deleteAll, insertTask, insertSubtask, insertTaskTag, selectAll, selectSubtasks, selectTaskTags };
