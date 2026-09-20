'use strict';

const fs = require('fs');
const path = require('path');
const repositories = require('./repositories');
const mapper = require('./mapper');

// 导出为 v1 旧版可读的 JSON 文件（store.json + user-themes.json），用于降级回滚
function exportDbToJson(db, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const store = repositories.readStore(db) || { lists: [], tasks: [], tags: [], settings: {} };
  const storePath = path.join(targetDir, 'store.json');
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');

  const themes = mapper.assembleThemes(repositories.themes.selectAll(db));
  const themesPath = path.join(targetDir, 'user-themes.json');
  fs.writeFileSync(themesPath, JSON.stringify(themes, null, 2), 'utf8');

  return [storePath, themesPath];
}

module.exports = { exportDbToJson };
