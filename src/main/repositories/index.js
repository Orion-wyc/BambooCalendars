'use strict';

const mapper = require('../mapper');
const { dbHasData } = require('../db');
const lists = require('./lists');
const tasks = require('./tasks');
const tags = require('./tags');
const themes = require('./themes');
const settings = require('./settings');

function insertMapped(db, mapped) {
  mapped.lists.forEach(r => lists.insert(db, r));
  mapped.tags.forEach(r => tags.insert(db, r));
  mapped.tasks.forEach(r => tasks.insertTask(db, r));
  mapped.subtasks.forEach(r => tasks.insertSubtask(db, r));
  mapped.taskTags.forEach(r => tasks.insertTaskTag(db, r));
  mapped.settings.forEach(r => settings.insertRow(db, r));
}

function wipeStore(db) {
  tasks.deleteAll(db);
  tags.deleteAll(db);
  lists.deleteAll(db);
  settings.deleteAll(db);
}

// Phase 1 兼容接口：组装为与旧 store.json 完全一致的结构；空库返回 null
function readStore(db) {
  if (!dbHasData(db)) return null;
  return mapper.assembleStore({
    lists: lists.selectAll(db),
    tasks: tasks.selectAll(db),
    subtasks: tasks.selectSubtasks(db),
    taskTags: tasks.selectTaskTags(db),
    tags: tags.selectAll(db),
    settings: settings.selectAll(db),
  });
}

// Phase 1 兼容接口：单事务全量替换
function writeStore(db, data) {
  const mapped = mapper.mapStoreJson(data);
  const tx = db.transaction(() => {
    wipeStore(db);
    insertMapped(db, mapped);
  });
  tx();
  return { ok: true, skipped: mapped.skipped };
}

module.exports = {
  readStore,
  writeStore,
  insertMapped,
  wipeStore,
  lists,
  tasks,
  tags,
  themes,
  settings,
};
