/**
 * Daily Diary — web app entry, HtmlService includes, and client action router.
 */

function doGet() {
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
    ensureDiaryAndTaskSheets_(ss);
    ensureAdminUsersSheet_();
    migrateUsersFromDiarySpreadsheet_(ss);
    migrateLegacyIntern_();
    fillMissingUsernamesOnSheet_(getUsersSheet_());
    ensureAdminAccount_();
    PropertiesService.getScriptProperties().setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
  } catch (err) {
    // Spreadsheet may not exist yet; setupInitialize will create it.
  }
}

function migrateSchemaIfNeeded_() {
  if (getScriptProp_('SCHEMA_VERSION', '') === SCHEMA_VERSION) {
    return;
  }
  migrateSchema_();
}

/**
 * Single entry point for google.script.run.
 * Always returns a structured { ok, ... } object.
 */
function api(action, payload) {
  payload = payload || {};
  try {
    migrateSchemaIfNeeded_();
    var profile;
    switch (String(action || '')) {
      case 'login':
        return login_(payload.username || payload.email, payload.password);
      case 'register':
        return register_(payload);
      case 'changePassword':
        profile = requireSession_(payload.token);
        return changePassword_(profile, payload);
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
      case 'getSummary':
        profile = requireSession_(payload.token);
        return getSummary_(profile);
      case 'downloadSummaryPdf':
        profile = requireSession_(payload.token);
        return downloadSummaryPdf_(profile);
      case 'getReportSetup':
        profile = requireSession_(payload.token);
        return getReportSetup_(profile);
      case 'connectReportSheet':
        profile = requireSession_(payload.token);
        return connectReportSheet_(profile, payload.spreadsheet);
      case 'sendWeekReport':
        profile = requireSession_(payload.token);
        return sendWeekReport_(profile);
      case 'listUsers':
        profile = requireSession_(payload.token);
        return listUsers_(profile);
      case 'setUserStatus':
        profile = requireSession_(payload.token);
        return setUserStatus_(profile, payload.userId, payload.status);
      case 'updateUser':
        profile = requireSession_(payload.token);
        return updateUser_(profile, payload.user);
      case 'deleteUser':
        profile = requireSession_(payload.token);
        return deleteUser_(profile, payload.userId, payload.confirmPassword);
      case 'disconnectReportSheet':
        profile = requireSession_(payload.token);
        return disconnectReportSheet_(profile, payload.userId, payload.confirmPassword);
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
