/**
 * Daily Diary — web app entry, HtmlService includes, and client action router.
 */

function doGet() {
  migrateSchema_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Daily Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function migrateSchema_() {
  try {
    var ss = getDiarySpreadsheet_();
    ss.setSpreadsheetTimeZone(APP_TIMEZONE);
    ensureAllSheets_(ss);
    migrateLegacyIntern_();
  } catch (err) {
    // Spreadsheet may not exist yet; setupInitialize will create it.
  }
}

/**
 * Single entry point for google.script.run.
 * Always returns a structured { ok, ... } object.
 */
function api(action, payload) {
  payload = payload || {};
  try {
    var profile;
    switch (String(action || '')) {
      case 'login':
        return login_(payload.email, payload.password);
      case 'register':
        return register_(payload);
      case 'logout':
        return logout_(payload.token);
      case 'session':
        return getSession_(payload.token);
      case 'getWeek':
        profile = requireSession_(payload.token);
        return getWeek_(payload.weekStart, profile);
      case 'getDay':
        profile = requireSession_(payload.token);
        return getDay_(payload.date, profile);
      case 'saveEntry':
        profile = requireSession_(payload.token);
        return saveEntry_(payload.entry, profile);
      case 'exportExcel':
        profile = requireSession_(payload.token);
        return exportWeekExcel_(payload.weekStart, profile);
      case 'getSummary':
        profile = requireSession_(payload.token);
        return getSummary_(profile);
      case 'listTasks':
        profile = requireSession_(payload.token);
        return listTasks_(profile);
      case 'saveTask':
        profile = requireSession_(payload.token);
        return saveTask_(profile, payload.task);
      case 'saveSubtask':
        profile = requireSession_(payload.token);
        return saveSubtask_(profile, payload.subtask);
      case 'toggleSubtask':
        profile = requireSession_(payload.token);
        return toggleSubtask_(profile, payload.id);
      case 'deleteTask':
        profile = requireSession_(payload.token);
        return deleteTask_(profile, payload.id);
      case 'deleteSubtask':
        profile = requireSession_(payload.token);
        return deleteSubtask_(profile, payload.id);
      case 'getTaskAlerts':
        profile = requireSession_(payload.token);
        return getTaskAlerts_(profile);
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
