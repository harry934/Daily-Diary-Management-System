/**
 * Spreadsheet setup, sheet schemas, and shared row helpers.
 * Edit the three values below only if you want to seed the first intern
 * account from the Apps Script editor. Everyone else can create an
 * account in the web app.
 */
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';

var COMPANY_NAME = 'Daily Diary';
var PROGRAMME_START_DATE = '2026-09-07';
var APP_TIMEZONE = 'Africa/Nairobi';
var ADMIN_SPREADSHEET_ID = '1uC3kzvoxwTCalatyhLXAt75I1cV2yRCbbb--Kktqfgc';
var ADMIN_EMAIL = '';
var DAYS_IN_WEEK = 7;

var DIARY_SHEET_NAME = 'Diary';
var TASKS_SHEET_NAME = 'Tasks';
var SUBTASKS_SHEET_NAME = 'Subtasks';
var USERS_SHEET_NAME = 'Users';

var DIARY_HEADERS = ['id', 'userId', 'date', 'weekday', 'timeIn', 'timeOut', 'assignment', 'hoursWorked', 'updatedAt', 'timeOutReason'];
var TASKS_HEADERS = ['id', 'userId', 'title', 'notes', 'priority', 'dueDate', 'createdAt', 'updatedAt'];
var SUBTASKS_HEADERS = ['id', 'userId', 'taskId', 'title', 'done', 'sortOrder', 'updatedAt'];
var USERS_HEADERS = ['id', 'email', 'name', 'organisation', 'passwordHash', 'passwordSalt', 'programmeStart', 'createdAt', 'role', 'status', 'reportSpreadsheetId'];

function setupInitialize() {
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
    ss = SpreadsheetApp.create('Daily Diary');
    spreadsheetId = ss.getId();
  }

  ss.setSpreadsheetTimeZone(APP_TIMEZONE);
  ensureDiaryAndTaskSheets_(ss);
  ensureAdminUsersSheet_();

  props.setProperties({
    SPREADSHEET_ID: spreadsheetId,
    TIMEZONE: APP_TIMEZONE,
    ADMIN_SPREADSHEET_ID: ADMIN_SPREADSHEET_ID
  }, false);

  migrateUsersFromDiarySpreadsheet_(ss);
  seedSetupUserIfRequested_();
  migrateLegacyIntern_();
  promoteAdminUsers_();

  Logger.log('Setup complete.');
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('People can create accounts from the web app.');
}

/**
 * Run this later if you need a new password for the seeded intern.
 * Edit SETUP_INTERN_PASSWORD first.
 */
function setupChangePassword() {
  if (!SETUP_INTERN_PASSWORD || SETUP_INTERN_PASSWORD === 'ChangeThisPassword') {
    throw new Error('Set SETUP_INTERN_PASSWORD in Setup.gs before running setupChangePassword.');
  }
  if (!SETUP_INTERN_EMAIL || SETUP_INTERN_EMAIL.indexOf('@') < 1) {
    throw new Error('Set SETUP_INTERN_EMAIL in Setup.gs before running setupChangePassword.');
  }
  var email = String(SETUP_INTERN_EMAIL).trim().toLowerCase();
  var user = findUserByEmail_(email);
  if (!user) {
    throw new Error('No account found for that email. Create it in the web app or run setupInitialize.');
  }
  var salt = generateSalt_();
  user.passwordSalt = salt;
  user.passwordHash = hashPassword_(SETUP_INTERN_PASSWORD, salt);
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  Logger.log('Password updated. Change SETUP_INTERN_PASSWORD back to a placeholder.');
}

function seedSetupUserIfRequested_() {
  if (!SETUP_INTERN_EMAIL || SETUP_INTERN_EMAIL.indexOf('@') < 1) {
    return;
  }
  if (!SETUP_INTERN_PASSWORD || SETUP_INTERN_PASSWORD === 'ChangeThisPassword') {
    return;
  }
  if (!SETUP_INTERN_NAME || SETUP_INTERN_NAME === 'Your Full Name') {
    return;
  }
  var email = String(SETUP_INTERN_EMAIL).trim().toLowerCase();
  if (findUserByEmail_(email)) {
    return;
  }
  var salt = generateSalt_();
  var now = nowNairobi_();
  writeRecord_(getUsersSheet_(), USERS_HEADERS, 0, {
    id: Utilities.getUuid(),
    email: email,
    name: String(SETUP_INTERN_NAME).trim(),
    organisation: COMPANY_NAME,
    passwordHash: hashPassword_(SETUP_INTERN_PASSWORD, salt),
    passwordSalt: salt,
    programmeStart: PROGRAMME_START_DATE,
    createdAt: now,
    role: isAdminEmail_(email) ? 'admin' : 'user',
    status: isAdminEmail_(email) ? 'approved' : 'approved',
    reportSpreadsheetId: ''
  });
  Logger.log('Seeded account: ' + email);
}

function migrateLegacyIntern_() {
  var props = PropertiesService.getScriptProperties();
  var email = String(props.getProperty('INTERN_EMAIL') || '').trim().toLowerCase();
  var hash = props.getProperty('PASSWORD_HASH');
  var salt = props.getProperty('PASSWORD_SALT');
  if (!email || !hash || !salt) {
    return;
  }

  var existing = findUserByEmail_(email);
  var userId;
  if (existing) {
    userId = existing.id;
  } else {
    userId = Utilities.getUuid();
    writeRecord_(getUsersSheet_(), USERS_HEADERS, 0, {
      id: userId,
      email: email,
      name: String(props.getProperty('INTERN_NAME') || '').trim() || 'Intern',
      organisation: props.getProperty('COMPANY') || 'Kenya Shipyards Limited',
      passwordHash: hash,
      passwordSalt: salt,
      programmeStart: props.getProperty('PROGRAMME_START') || PROGRAMME_START_DATE,
      createdAt: nowNairobi_(),
      role: isAdminEmail_(email) ? 'admin' : 'user',
      status: 'approved',
      reportSpreadsheetId: ''
    });
  }

  backfillUserId_(getDiarySheet_(), DIARY_HEADERS, userId);
  backfillUserId_(getTasksSheet_(), TASKS_HEADERS, userId);
  backfillUserId_(getSubtasksSheet_(), SUBTASKS_HEADERS, userId);
}

function backfillUserId_(sheet, headers, userId) {
  var userCol = headers.indexOf('userId') + 1;
  if (userCol < 1) {
    return;
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }
  var range = sheet.getRange(2, userCol, lastRow - 1, 1);
  var values = range.getValues();
  var changed = false;
  for (var i = 0; i < values.length; i++) {
    if (!String(values[i][0] || '').trim()) {
      values[i][0] = userId;
      changed = true;
    }
  }
  if (changed) {
    range.setNumberFormat('@');
    range.setValues(values);
  }
}

function headerList_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (value) {
    return String(value || '').trim();
  });
}

function headersMatch_(current, expected) {
  if (current.length < expected.length) {
    return false;
  }
  for (var i = 0; i < expected.length; i++) {
    if (current[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

function migrateSheetToHeaders_(sheet, expectedHeaders, defaults) {
  defaults = defaults || {};
  var current = headerList_(sheet);
  if (headersMatch_(current, expectedHeaders)) {
    return;
  }
  var lastRow = sheet.getLastRow();
  var records = [];
  if (lastRow >= 2 && current.length) {
    var values = sheet.getRange(2, 1, lastRow - 1, current.length).getValues();
    values.forEach(function (row) {
      var rec = {};
      current.forEach(function (header, index) {
        if (header) {
          rec[header] = row[index];
        }
      });
      if (!cellAsText_(rec.id, 'yyyy-MM-dd')) {
        return;
      }
      expectedHeaders.forEach(function (header) {
        if (rec[header] == null || rec[header] === '') {
          rec[header] = defaults[header] != null ? defaults[header] : '';
        }
      });
      records.push(expectedHeaders.map(function (header) {
        return rec[header];
      }));
    });
  }

  sheet.clear();
  if (sheet.getMaxColumns() < expectedHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), expectedHeaders.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  if (records.length) {
    var body = sheet.getRange(2, 1, records.length, expectedHeaders.length);
    body.setNumberFormat('@');
    body.setValues(records);
  }
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

function styleDiarySheet_(sheet) {
  migrateSheetToHeaders_(sheet, DIARY_HEADERS, {});
  styleHeaderRow_(sheet, DIARY_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 360);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 160);
  sheet.setColumnWidth(10, 220);
  sheet.getRange('A:J').setNumberFormat('@');
}

function styleTasksSheet_(sheet) {
  migrateSheetToHeaders_(sheet, TASKS_HEADERS, { priority: 'medium', dueDate: '' });
  styleHeaderRow_(sheet, TASKS_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 160);
  sheet.setColumnWidth(8, 160);
  sheet.getRange('A:H').setNumberFormat('@');
}

function styleSubtasksSheet_(sheet) {
  migrateSheetToHeaders_(sheet, SUBTASKS_HEADERS, {});
  styleHeaderRow_(sheet, SUBTASKS_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 160);
  sheet.getRange('A:G').setNumberFormat('@');
}

function styleUsersSheet_(sheet) {
  migrateSheetToHeaders_(sheet, USERS_HEADERS, { role: 'user', status: 'approved', reportSpreadsheetId: '' });
  styleHeaderRow_(sheet, USERS_HEADERS);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 200);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 280);
  sheet.setColumnWidth(6, 160);
  sheet.setColumnWidth(7, 130);
  sheet.setColumnWidth(8, 160);
  sheet.setColumnWidth(9, 90);
  sheet.setColumnWidth(10, 110);
  sheet.setColumnWidth(11, 220);
  sheet.getRange('A:K').setNumberFormat('@');
}

function ensureNamedSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function ensureDiarySheet_(ss) {
  var sheet = ensureNamedSheet_(ss, DIARY_SHEET_NAME);
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  if (sheetNeedsMigrate_(sheet, DIARY_HEADERS)) {
    styleDiarySheet_(sheet);
  }
  return sheet;
}

function ensureTasksSheets_(ss) {
  var tasks = ensureNamedSheet_(ss, TASKS_SHEET_NAME);
  var subtasks = ensureNamedSheet_(ss, SUBTASKS_SHEET_NAME);
  if (sheetNeedsMigrate_(tasks, TASKS_HEADERS)) {
    styleTasksSheet_(tasks);
  }
  if (sheetNeedsMigrate_(subtasks, SUBTASKS_HEADERS)) {
    styleSubtasksSheet_(subtasks);
  }
  return { tasks: tasks, subtasks: subtasks };
}

function ensureDiaryAndTaskSheets_(ss) {
  ensureDiarySheet_(ss);
  ensureTasksSheets_(ss);
  return ss;
}

function ensureAdminUsersSheet_() {
  var ss = getAdminSpreadsheet_();
  ss.setSpreadsheetTimeZone(APP_TIMEZONE);
  var sheet = ensureNamedSheet_(ss, USERS_SHEET_NAME);
  if (sheetNeedsMigrate_(sheet, USERS_HEADERS)) {
    styleUsersSheet_(sheet);
  }
  return sheet;
}

function ownerEmail_() {
  try {
    return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (err) {
    return '';
  }
}

function adminEmail_() {
  var configured = String(ADMIN_EMAIL || '').trim().toLowerCase();
  if (configured && configured.indexOf('@') > 0 && configured !== 'your.email@example.com') {
    return configured;
  }
  var setup = String(SETUP_INTERN_EMAIL || '').trim().toLowerCase();
  if (setup.indexOf('@') > 0 && setup !== 'your.email@example.com') {
    return setup;
  }
  return ownerEmail_();
}

function isAdminEmail_(email) {
  var admin = adminEmail_();
  return !!(admin && String(email || '').trim().toLowerCase() === admin);
}

function getAdminSpreadsheet_() {
  var id = ADMIN_SPREADSHEET_ID || getScriptProp_('ADMIN_SPREADSHEET_ID', '');
  if (!id) {
    throw new Error('Admin spreadsheet is not configured.');
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error('Cannot open the admin spreadsheet. Share it with ' + (ownerEmail_() || 'the app owner') + ' as Editor.');
  }
}

function migrateUsersFromDiarySpreadsheet_(ss) {
  if (!ss) {
    return;
  }
  var old = ss.getSheetByName(USERS_SHEET_NAME);
  if (!old || old.getLastRow() < 2) {
    return;
  }
  var dest = getUsersSheet_();
  var existing = readRecords_(dest, USERS_HEADERS);
  var emails = {};
  existing.forEach(function (row) {
    emails[cellAsText_(row.email, 'yyyy-MM-dd').toLowerCase()] = true;
  });
  var oldHeaders = headerList_(old);
  var oldRecords = readRecords_(old, oldHeaders.length ? oldHeaders : USERS_HEADERS);
  oldRecords.forEach(function (rec) {
    var email = cellAsText_(rec.email, 'yyyy-MM-dd').toLowerCase();
    if (!email || emails[email]) {
      return;
    }
    writeRecord_(dest, USERS_HEADERS, 0, {
      id: rec.id,
      email: email,
      name: cellAsText_(rec.name, 'yyyy-MM-dd'),
      organisation: cellAsText_(rec.organisation, 'yyyy-MM-dd'),
      passwordHash: String(rec.passwordHash || ''),
      passwordSalt: String(rec.passwordSalt || ''),
      programmeStart: cellAsText_(rec.programmeStart, 'yyyy-MM-dd') || PROGRAMME_START_DATE,
      createdAt: cellAsText_(rec.createdAt, 'yyyy-MM-dd HH:mm:ss') || nowNairobi_(),
      role: rec.role || (isAdminEmail_(email) ? 'admin' : 'user'),
      status: rec.status || 'approved',
      reportSpreadsheetId: cellAsText_(rec.reportSpreadsheetId, 'yyyy-MM-dd')
    });
    emails[email] = true;
  });
}

function promoteAdminUsers_() {
  var admin = adminEmail_();
  if (!admin) {
    return;
  }
  var sheet = getUsersSheet_();
  readRecords_(sheet, USERS_HEADERS).forEach(function (row) {
    var email = cellAsText_(row.email, 'yyyy-MM-dd').toLowerCase();
    if (email !== admin) {
      return;
    }
    row.email = email;
    row.name = cellAsText_(row.name, 'yyyy-MM-dd');
    row.organisation = cellAsText_(row.organisation, 'yyyy-MM-dd');
    row.passwordHash = String(row.passwordHash || '');
    row.passwordSalt = String(row.passwordSalt || '');
    row.programmeStart = cellAsText_(row.programmeStart, 'yyyy-MM-dd');
    row.createdAt = cellAsText_(row.createdAt, 'yyyy-MM-dd HH:mm:ss');
    row.role = 'admin';
    row.status = 'approved';
    row.reportSpreadsheetId = cellAsText_(row.reportSpreadsheetId, 'yyyy-MM-dd');
    writeRecord_(sheet, USERS_HEADERS, row._rowIndex, row);
  });
}

function ensureAllSheets_(ss) {
  ensureDiaryAndTaskSheets_(ss);
  ensureAdminUsersSheet_();
  return ss;
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

function sheetNeedsMigrate_(sheet, headers) {
  return !headersMatch_(headerList_(sheet), headers);
}

function getDiarySheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(DIARY_SHEET_NAME);
  if (!sheet) {
    sheet = ensureDiarySheet_(ss);
  } else if (sheetNeedsMigrate_(sheet, DIARY_HEADERS)) {
    styleDiarySheet_(sheet);
  }
  return sheet;
}

function getTasksSheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ensureTasksSheets_(ss).tasks;
  } else if (sheetNeedsMigrate_(sheet, TASKS_HEADERS)) {
    styleTasksSheet_(sheet);
  }
  return sheet;
}

function getSubtasksSheet_() {
  var ss = getDiarySpreadsheet_();
  var sheet = ss.getSheetByName(SUBTASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ensureTasksSheets_(ss).subtasks;
  } else if (sheetNeedsMigrate_(sheet, SUBTASKS_HEADERS)) {
    styleSubtasksSheet_(sheet);
  }
  return sheet;
}

function getUsersSheet_() {
  var sheet = ensureAdminUsersSheet_();
  return sheet;
}

function writeRow_(sheet, rowIndex, values) {
  var range;
  if (rowIndex) {
    range = sheet.getRange(rowIndex, 1, 1, values.length);
  } else {
    sheet.appendRow(values);
    range = sheet.getRange(sheet.getLastRow(), 1, 1, values.length);
  }
  range.setNumberFormat('@');
  range.setValues([values]);
}

function writeRecord_(sheet, headers, rowIndex, rec) {
  writeRow_(sheet, rowIndex, headers.map(function (header) {
    return rec[header] == null ? '' : rec[header];
  }));
}

function deleteSheetRow_(sheet, rowIndex) {
  sheet.deleteRow(rowIndex);
}

function readRecords_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  var rows = [];
  if (lastRow < 2) {
    return rows;
  }
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var rec = { _rowIndex: i + 2 };
    headers.forEach(function (header, index) {
      rec[header] = values[i][index];
    });
    rec.id = cellAsText_(rec.id, 'yyyy-MM-dd');
    if (!rec.id) {
      continue;
    }
    rows.push(rec);
  }
  return rows;
}

function recordsForUser_(rows, userId) {
  return rows.filter(function (row) {
    return cellAsText_(row.userId, 'yyyy-MM-dd') === String(userId || '');
  });
}

function deleteRecordsForUser_(sheet, headers, userId) {
  var rows = recordsForUser_(readRecords_(sheet, headers), userId);
  rows.sort(function (a, b) {
    return b._rowIndex - a._rowIndex;
  });
  rows.forEach(function (row) {
    deleteSheetRow_(sheet, row._rowIndex);
  });
}
