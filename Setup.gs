/**
 * One-time setup. Edit the three values below, then in the Apps Script
 * editor choose setupInitialize and click Run. Authorize Sheets + Drive.
 *
 * The password is hashed immediately and never stored in HTML.
 */
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';

var COMPANY_NAME = 'Kenya Shipyards Limited';
var PROGRAMME_START_DATE = '2026-09-07';
var APP_TIMEZONE = 'Africa/Nairobi';
var DIARY_SHEET_NAME = 'Diary';
var DIARY_HEADERS = ['id', 'date', 'weekday', 'timeIn', 'timeOut', 'assignment', 'hoursWorked', 'updatedAt', 'timeOutReason'];
var TASKS_SHEET_NAME = 'Tasks';
var SUBTASKS_SHEET_NAME = 'Subtasks';
var TASKS_HEADERS = ['id', 'title', 'notes', 'createdAt', 'updatedAt'];
var SUBTASKS_HEADERS = ['id', 'taskId', 'title', 'done', 'sortOrder', 'updatedAt'];

function setupInitialize() {
  if (!SETUP_INTERN_EMAIL || SETUP_INTERN_EMAIL.indexOf('@') < 1) {
    throw new Error('Set SETUP_INTERN_EMAIL in Setup.gs before running setupInitialize.');
  }
  if (!SETUP_INTERN_PASSWORD || SETUP_INTERN_PASSWORD === 'ChangeThisPassword') {
    throw new Error('Set a real SETUP_INTERN_PASSWORD in Setup.gs before running setupInitialize.');
  }
  if (!SETUP_INTERN_NAME || SETUP_INTERN_NAME === 'Your Full Name') {
    throw new Error('Set SETUP_INTERN_NAME in Setup.gs before running setupInitialize.');
  }

  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  var ss;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (err) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('Kenya Shipyards Limited — Internship Daily Diary');
    spreadsheetId = ss.getId();
  }

  ss.setSpreadsheetTimeZone(APP_TIMEZONE);
  ss.rename('Kenya Shipyards Limited — Internship Daily Diary');
  ensureDiarySheet_(ss);
  ensureTasksSheets_(ss);

  var salt = generateSalt_();
  var hash = hashPassword_(SETUP_INTERN_PASSWORD, salt);

  props.setProperties({
    SPREADSHEET_ID: spreadsheetId,
    INTERN_EMAIL: String(SETUP_INTERN_EMAIL).trim().toLowerCase(),
    INTERN_NAME: String(SETUP_INTERN_NAME).trim(),
    PASSWORD_HASH: hash,
    PASSWORD_SALT: salt,
    COMPANY: COMPANY_NAME,
    TIMEZONE: APP_TIMEZONE,
    PROGRAMME_START: PROGRAMME_START_DATE
  }, false);

  Logger.log('Setup complete.');
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('Sign in with: ' + String(SETUP_INTERN_EMAIL).trim().toLowerCase());
  Logger.log('Change SETUP_INTERN_PASSWORD back to a placeholder after this run.');
}

/**
 * Run this later if you need a new password. Edit SETUP_INTERN_PASSWORD first.
 */
function setupChangePassword() {
  if (!SETUP_INTERN_PASSWORD || SETUP_INTERN_PASSWORD === 'ChangeThisPassword') {
    throw new Error('Set SETUP_INTERN_PASSWORD in Setup.gs before running setupChangePassword.');
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PASSWORD_HASH')) {
    throw new Error('Run setupInitialize first.');
  }
  var salt = generateSalt_();
  props.setProperty('PASSWORD_SALT', salt);
  props.setProperty('PASSWORD_HASH', hashPassword_(SETUP_INTERN_PASSWORD, salt));
  Logger.log('Password updated. Change SETUP_INTERN_PASSWORD back to a placeholder.');
}

function ensureDiarySheet_(ss) {
  var sheet = ss.getSheetByName(DIARY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DIARY_SHEET_NAME);
  }
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  sheet.getRange(1, 1, 1, DIARY_HEADERS.length).setValues([DIARY_HEADERS]);
  sheet.getRange(1, 1, 1, DIARY_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#072F1F')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 360);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 160);
  sheet.setColumnWidth(9, 220);
  sheet.getRange('A:I').setNumberFormat('@');
  sheet.getRange(1, 1, 1, DIARY_HEADERS.length).setNumberFormat('@');
  return sheet;
}

function getScriptProp_(key, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value || fallback || '';
}

function getTimezone_() {
  return getScriptProp_('TIMEZONE', APP_TIMEZONE);
}

function getProgrammeStart_() {
  return getScriptProp_('PROGRAMME_START', PROGRAMME_START_DATE);
}

function getCompany_() {
  return getScriptProp_('COMPANY', COMPANY_NAME);
}

function getDiarySpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('System is not set up. Run setupInitialize in the Apps Script editor.');
  }
  return SpreadsheetApp.openById(id);
}

function getDiarySheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(DIARY_SHEET_NAME);
  if (!sheet) {
    sheet = ensureDiarySheet_(ss);
  }
  return sheet;
}

function styleHeaderRow_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#072F1F')
    .setFontColor('#FFFFFF')
    .setNumberFormat('@');
  sheet.setFrozenRows(1);
}

function styleTasksSheet_(sheet) {
  styleHeaderRow_(sheet, TASKS_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 280);
  sheet.setColumnWidth(3, 360);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 160);
  sheet.getRange('A:E').setNumberFormat('@');
}

function styleSubtasksSheet_(sheet) {
  styleHeaderRow_(sheet, SUBTASKS_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 320);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 160);
  sheet.getRange('A:F').setNumberFormat('@');
}

function ensureTasksSheets_(ss) {
  var tasks = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!tasks) {
    tasks = ss.insertSheet(TASKS_SHEET_NAME);
    styleTasksSheet_(tasks);
  }
  var subtasks = ss.getSheetByName(SUBTASKS_SHEET_NAME);
  if (!subtasks) {
    subtasks = ss.insertSheet(SUBTASKS_SHEET_NAME);
    styleSubtasksSheet_(subtasks);
  }
  return { tasks: tasks, subtasks: subtasks };
}

function getTasksSheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ensureTasksSheets_(ss).tasks;
  }
  return sheet;
}

function getSubtasksSheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(SUBTASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ensureTasksSheets_(ss).subtasks;
  }
  return sheet;
}
