'use strict';
// 纯函数模块：覆盖安装场景判定，不依赖 electron / better-sqlite3。

function decideAction({ dbExists, dbHasData, jsonExists }) {
  if (jsonExists && !dbExists) return 'migrate';
  if (jsonExists && dbExists && !dbHasData) return 'migrate';
  if (jsonExists && dbExists && dbHasData) return 'conflict';
  if (!jsonExists && dbExists) return 'normal';
  return 'fresh';
}

module.exports = { decideAction };
