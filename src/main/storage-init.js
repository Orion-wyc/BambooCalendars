'use strict';

const fs = require('fs');
const path = require('path');
const { openDatabase, getMeta, setMeta, dbHasData } = require('./db');
const { decideAction } = require('./migrate-policy');
const mapper = require('./mapper');
const repositories = require('./repositories');

let currentDb = null;
let lastReport = null;

function getDb() {
  return currentDb;
}

function getReport() {
  return lastReport;
}

function readJson(filePath, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

function writeJson(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// 场景判定见 migrate-policy.js（纯函数，便于单元测试）

function archiveLegacy(filePath, legacyDir, prefix = '') {
  if (!filePath || !fs.existsSync(filePath)) return null;
  fs.mkdirSync(legacyDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(legacyDir, `${prefix}${path.basename(filePath)}.${ts}.bak`);
  fs.renameSync(filePath, dest);
  return dest;
}

function pruneLegacy(legacyDir, keep = 3) {
  if (!fs.existsSync(legacyDir)) return;
  const files = fs.readdirSync(legacyDir)
    .filter(f => f.endsWith('.bak'))
    .map(f => ({ f, t: fs.statSync(path.join(legacyDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  files.slice(keep).forEach(({ f }) => {
    try { fs.unlinkSync(path.join(legacyDir, f)); } catch {}
  });
}

function seedAppStateIfMissing(dataDir, rawSettings) {
  const appStatePath = path.join(dataDir, 'app-state.json');
  if (fs.existsSync(appStatePath)) return false;
  const s = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  writeJson(appStatePath, {
    alwaysOnTop: Boolean(s.alwaysOnTop),
    compactMode: Boolean(s.compactMode),
    requestExitConfirmation: s.requestExitConfirmation !== false,
    checkUpdateOnStartup: s.checkUpdateOnStartup !== false,
  });
  return true;
}

function migrateJsonToSqlite(db, jsonPath, themesPath, appVersion) {
  const raw = readJson(jsonPath, null);
  if (!raw) return { migrated: false, reason: 'unreadable-json' };

  const mapped = mapper.mapStoreJson(raw);
  const themeRows = mapper.mapThemesJson(readJson(themesPath, []));

  const tx = db.transaction(() => {
    repositories.insertMapped(db, mapped);
    themeRows.forEach(r => repositories.themes.insert(db, r));
    setMeta(db, 'json_migrated_at', String(Date.now()));
    setMeta(db, 'json_migrated_from', path.basename(jsonPath));
    setMeta(db, 'migrated_app_version', appVersion);
    const skippedTotal = Object.values(mapped.skipped).reduce((a, b) => a + b, 0);
    if (skippedTotal > 0) setMeta(db, 'migration_skipped', JSON.stringify(mapped.skipped));
  });
  tx();

  return { migrated: true, mapped, themeCount: themeRows.length };
}

function initStorage(dataDir, { appVersion = '0.0.0' } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'bamboo.db');
  const jsonPath = path.join(dataDir, 'store.json');
  const themesPath = path.join(dataDir, 'user-themes.json');
  const legacyDir = path.join(dataDir, 'legacy');

  const dbExists = fs.existsSync(dbPath);
  const jsonExists = fs.existsSync(jsonPath);

  const db = openDatabase(dbPath);
  currentDb = db;

  const hasData = dbHasData(db);
  const action = decideAction({ dbExists, dbHasData: hasData, jsonExists });
  const report = { action, dbPath, archived: [], conflicts: [], error: null, seededAppState: false };

  if (action === 'migrate') {
    try {
      const result = migrateJsonToSqlite(db, jsonPath, themesPath, appVersion);
      if (result.migrated) {
        report.seededAppState = seedAppStateIfMissing(dataDir, (readJson(jsonPath, {}) || {}).settings);
        report.archived.push(archiveLegacy(jsonPath, legacyDir));
        report.archived.push(archiveLegacy(themesPath, legacyDir));
        report.counts = {
          lists: result.mapped.lists.length,
          tasks: result.mapped.tasks.length,
          tags: result.mapped.tags.length,
          themes: result.themeCount,
        };
      } else {
        report.archived.push(archiveLegacy(jsonPath, legacyDir, 'unreadable-'));
      }
    } catch (e) {
      // 事务已回滚：保留 json 供下次启动重试，应用以空库继续启动
      report.error = e.message;
    }
  } else if (action === 'conflict') {
    report.conflicts.push(archiveLegacy(jsonPath, legacyDir, 'conflict-'));
    report.conflicts.push(archiveLegacy(themesPath, legacyDir, 'conflict-'));
  }

  pruneLegacy(legacyDir);
  lastReport = report;
  return { db, report };
}

module.exports = { initStorage, decideAction, archiveLegacy, getDb, getReport, readJson };
