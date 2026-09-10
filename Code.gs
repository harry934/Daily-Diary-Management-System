/**
 * Kenya Shipyards Limited — Internship Daily Diary
 * Web app entry, HtmlService includes, and client action router.
 */

function doGet() {
  migrateBrand_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Daily Diary | Kenya Shipyards Limited')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function migrateBrand_() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('COMPANY', COMPANY_NAME);
  var id = props.getProperty('SPREADSHEET_ID');
  if (!id) {
    return;
  }
  try {
    var ss = SpreadsheetApp.openById(id);
    ss.rename('Kenya Shipyards Limited — Internship Daily Diary');
    ss.setSpreadsheetTimeZone(APP_TIMEZONE);
    ensureDiarySheet_(ss);
    ensureTasksSheets_(ss);
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
    switch (String(action || '')) {
      case 'login':
        return login_(payload.email, payload.password);
      case 'logout':
        return logout_(payload.token);
      case 'session':
        return getSession_(payload.token);
      case 'getWeek':
        requireSession_(payload.token);
        return getWeek_(payload.weekStart);
      case 'saveEntry':
        requireSession_(payload.token);
        return saveEntry_(payload.entry);
      case 'exportExcel':
        requireSession_(payload.token);
        return exportWeekExcel_(payload.weekStart);
      case 'getSummary':
        requireSession_(payload.token);
        return getSummary_();
      case 'listTasks':
        requireSession_(payload.token);
        return listTasks_();
      case 'saveTask':
        requireSession_(payload.token);
        return saveTask_(payload.task);
      case 'saveSubtask':
        requireSession_(payload.token);
        return saveSubtask_(payload.subtask);
      case 'toggleSubtask':
        requireSession_(payload.token);
        return toggleSubtask_(payload.id);
      case 'deleteTask':
        requireSession_(payload.token);
        return deleteTask_(payload.id);
      case 'deleteSubtask':
        requireSession_(payload.token);
        return deleteSubtask_(payload.id);
      default:
        return { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
