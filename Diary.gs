/**
 * Monday–Friday diary load/save, Nairobi hours, and Excel export.
 */

var WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var ASSIGNMENT_MAX_LENGTH = 4000;
var REASON_MAX_LENGTH = 300;

function todayNairobi_() {
  return Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd');
}

function nowNairobi_() {
  return Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd HH:mm:ss');
}

function parseYmd_(dateStr) {
  var match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Invalid date.');
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatYmd_(date) {
  var year = date.getUTCFullYear();
  var month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + date.getUTCDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

function addDays_(dateStr, days) {
  var date = parseYmd_(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatYmd_(date);
}

function weekdayName_(dateStr) {
  return WEEKDAY_NAMES[parseYmd_(dateStr).getUTCDay()];
}

function mondayOf_(dateStr) {
  var date = parseYmd_(dateStr);
  var day = date.getUTCDay();
  var offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return formatYmd_(date);
}

function formatLongDate_(dateStr) {
  return Utilities.formatDate(parseYmd_(dateStr), 'UTC', 'd MMMM yyyy');
}

var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekNumber_(mondayStr) {
  var start = mondayOf_(getProgrammeStart_());
  var diffMs = parseYmd_(mondayStr).getTime() - parseYmd_(start).getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function formatShortRange_(mondayStr) {
  var start = parseYmd_(mondayStr);
  var end = parseYmd_(addDays_(mondayStr, 4));
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return start.getUTCDate() + '–' + end.getUTCDate() + ' ' + SHORT_MONTHS[end.getUTCMonth()];
  }
  return start.getUTCDate() + ' ' + SHORT_MONTHS[start.getUTCMonth()] + ' – ' +
    end.getUTCDate() + ' ' + SHORT_MONTHS[end.getUTCMonth()];
}

function weekTitle_(mondayStr) {
  return 'Week ' + weekNumber_(mondayStr);
}

function weekLabel_(mondayStr) {
  return weekTitle_(mondayStr);
}

function normalizeTime_(value) {
  var match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    throw new Error('Enter a valid time.');
  }
  var hours = Number(match[1]);
  var minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error('Enter a valid time.');
  }
  return ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);
}

function calculateHours_(timeIn, timeOut) {
  var startParts = normalizeTime_(timeIn).split(':');
  var endParts = normalizeTime_(timeOut).split(':');
  var start = Number(startParts[0]) * 60 + Number(startParts[1]);
  var end = Number(endParts[0]) * 60 + Number(endParts[1]);
  if (end <= start) {
    throw new Error('Time out must be after time in.');
  }
  return ((end - start) / 60).toFixed(2);
}

function sanitizeAssignment_(value) {
  var text = String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!text) {
    throw new Error('Enter the intern job assignment.');
  }
  if (text.length > ASSIGNMENT_MAX_LENGTH) {
    throw new Error('Job assignment must be ' + ASSIGNMENT_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function sanitizeReason_(value) {
  var text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > REASON_MAX_LENGTH) {
    throw new Error('Reason must be ' + REASON_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function isMorningTime_(hhmm) {
  return Number(String(hhmm).split(':')[0]) < 12;
}

function previousWeekday_(dateStr) {
  var prev = addDays_(dateStr, -1);
  var name = weekdayName_(prev);
  if (name === 'Sunday') {
    return addDays_(prev, -2);
  }
  if (name === 'Saturday') {
    return addDays_(prev, -1);
  }
  return prev;
}

function nextWeekday_(dateStr) {
  var next = addDays_(dateStr, 1);
  var name = weekdayName_(next);
  if (name === 'Saturday') {
    return addDays_(next, 2);
  }
  if (name === 'Sunday') {
    return addDays_(next, 1);
  }
  return next;
}

function snapToWeekday_(dateStr) {
  var date = String(dateStr || todayNairobi_());
  var start = getProgrammeStart_();
  if (date < start) {
    date = start;
  }
  var name = weekdayName_(date);
  if (name === 'Saturday') {
    date = addDays_(date, -1);
  } else if (name === 'Sunday') {
    date = addDays_(date, 1);
  }
  if (date < start) {
    date = start;
  }
  return date;
}

function resolveWeekStart_(weekStart) {
  var programmeStart = mondayOf_(getProgrammeStart_());
  var requested = weekStart ? mondayOf_(String(weekStart)) : mondayOf_(todayNairobi_());
  if (requested < programmeStart) {
    requested = programmeStart;
  }
  if (parseYmd_(requested).getUTCDay() !== 1) {
    throw new Error('Week must start on a Monday.');
  }
  return requested;
}

function cellAsText_(value, dateFormat) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getTimezone_(), dateFormat);
  }
  return String(value == null ? '' : value).trim();
}

function readDiaryMap_() {
  var sheet = getDiarySheet_();
  var lastRow = sheet.getLastRow();
  var map = {};
  if (lastRow < 2) {
    return map;
  }
  var values = sheet.getRange(2, 1, lastRow - 1, DIARY_HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var date = cellAsText_(row[1], 'yyyy-MM-dd');
    if (!date) {
      continue;
    }
    map[date] = {
      id: cellAsText_(row[0], 'yyyy-MM-dd'),
      date: date,
      weekday: cellAsText_(row[2], 'EEEE'),
      timeIn: cellAsText_(row[3], 'HH:mm'),
      timeOut: cellAsText_(row[4], 'HH:mm'),
      assignment: String(row[5] == null ? '' : row[5]).replace(/\r\n/g, '\n'),
      hoursWorked: cellAsText_(row[6], '0.00'),
      updatedAt: cellAsText_(row[7], 'yyyy-MM-dd HH:mm:ss'),
      timeOutReason: cellAsText_(row[8], 'yyyy-MM-dd'),
      rowIndex: i + 2
    };
  }
  return map;
}

function getWeek_(weekStart) {
  var monday = resolveWeekStart_(weekStart);
  var programmeStart = mondayOf_(getProgrammeStart_());
  var map = readDiaryMap_();
  var days = [];
  var daysLogged = 0;
  var totalHours = 0;

  for (var offset = 0; offset < 5; offset++) {
    var date = addDays_(monday, offset);
    var existing = map[date];
    var saved = !!(existing && existing.timeIn && existing.timeOut && existing.assignment);
    if (saved) {
      daysLogged += 1;
      totalHours += Number(existing.hoursWorked) || 0;
    }
    days.push({
      date: date,
      weekday: weekdayName_(date),
      short: weekdayName_(date).slice(0, 3),
      timeIn: existing ? existing.timeIn : '',
      timeOut: existing ? existing.timeOut : '',
      assignment: existing ? existing.assignment : '',
      hoursWorked: existing ? existing.hoursWorked : '',
      timeOutReason: existing ? existing.timeOutReason : '',
      updatedAt: existing ? existing.updatedAt : '',
      saved: saved
    });
  }

  return {
    ok: true,
    weekStart: monday,
    weekEnd: addDays_(monday, 4),
    weekNumber: weekNumber_(monday),
    weekLabel: weekTitle_(monday),
    weekRangeShort: formatShortRange_(monday),
    canPrev: monday > programmeStart,
    canNext: true,
    today: todayNairobi_(),
    days: days,
    stats: {
      daysLogged: daysLogged,
      totalHours: totalHours.toFixed(2)
    }
  };
}

function getDay_(dateStr) {
  var date = snapToWeekday_(dateStr);
  var week = getWeek_(mondayOf_(date));
  var existing = null;
  week.days.forEach(function (day) {
    if (day.date === date) {
      existing = day;
    }
  });
  var programmeStart = getProgrammeStart_();
  var prev = previousWeekday_(date);
  return {
    ok: true,
    date: date,
    weekday: weekdayName_(date),
    timeIn: existing ? existing.timeIn : '',
    timeOut: existing ? existing.timeOut : '',
    assignment: existing ? existing.assignment : '',
    hoursWorked: existing ? existing.hoursWorked : '',
    timeOutReason: existing ? existing.timeOutReason : '',
    updatedAt: existing ? existing.updatedAt : '',
    saved: !!(existing && existing.saved),
    weekNumber: week.weekNumber,
    weekLabel: week.weekLabel,
    weekRangeShort: week.weekRangeShort,
    weekStart: week.weekStart,
    canPrev: prev >= programmeStart,
    canNext: true,
    today: week.today,
    weekDays: week.days.map(function (day) {
      return {
        date: day.date,
        weekday: day.weekday,
        short: day.short,
        saved: day.saved
      };
    }),
    stats: week.stats
  };
}

function getSummary_() {
  var programmeMonday = mondayOf_(getProgrammeStart_());
  var currentMonday = mondayOf_(todayNairobi_());
  if (currentMonday < programmeMonday) {
    currentMonday = programmeMonday;
  }
  var map = readDiaryMap_();
  var lastMonday = currentMonday;
  Object.keys(map).forEach(function (date) {
    var monday = mondayOf_(date);
    if (monday > lastMonday) {
      lastMonday = monday;
    }
  });

  var weeks = [];
  var grandHours = 0;
  var grandDays = 0;
  var monday = programmeMonday;
  while (monday <= lastMonday) {
    var daysLogged = 0;
    var hours = 0;
    for (var offset = 0; offset < 5; offset++) {
      var existing = map[addDays_(monday, offset)];
      if (existing && existing.timeIn && existing.timeOut && existing.assignment) {
        daysLogged += 1;
        hours += Number(existing.hoursWorked) || 0;
      }
    }
    grandHours += hours;
    grandDays += daysLogged;
    weeks.push({
      weekNumber: weekNumber_(monday),
      weekStart: monday,
      weekEnd: addDays_(monday, 4),
      rangeShort: formatShortRange_(monday),
      daysLogged: daysLogged,
      totalHours: hours.toFixed(2)
    });
    monday = addDays_(monday, 7);
  }

  return {
    ok: true,
    weeks: weeks,
    totals: {
      daysLogged: grandDays,
      totalHours: grandHours.toFixed(2)
    }
  };
}

function saveEntry_(entry) {
  entry = entry || {};
  var date = String(entry.date || '').trim();
  parseYmd_(date);

  var weekday = weekdayName_(date);
  if (weekday === 'Saturday' || weekday === 'Sunday') {
    throw new Error('Diary entries are Monday to Friday only.');
  }
  if (date < getProgrammeStart_()) {
    throw new Error('Cannot save a day before the programme start date.');
  }

  var timeIn = normalizeTime_(entry.timeIn);
  var timeOut = normalizeTime_(entry.timeOut);
  var hoursWorked = calculateHours_(timeIn, timeOut);
  var assignment = sanitizeAssignment_(entry.assignment);
  var timeOutReason = '';
  if (isMorningTime_(timeOut)) {
    timeOutReason = sanitizeReason_(entry.timeOutReason);
    if (!timeOutReason) {
      throw new Error('Time out is AM. Enter a reason for leaving before noon.');
    }
  }
  var sheet = getDiarySheet_();
  var map = readDiaryMap_();
  var existing = map[date];
  var updatedAt = nowNairobi_();
  var id = existing && existing.id ? existing.id : Utilities.getUuid();
  var row = [id, date, weekday, timeIn, timeOut, assignment, hoursWorked, updatedAt, timeOutReason];

  if (existing && existing.rowIndex) {
    var target = sheet.getRange(existing.rowIndex, 1, 1, DIARY_HEADERS.length);
    target.setNumberFormat('@');
    target.setValues([row]);
  } else {
    sheet.appendRow(row);
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1, 1, DIARY_HEADERS.length).setNumberFormat('@');
  }

  return {
    ok: true,
    entry: {
      id: id,
      date: date,
      weekday: weekday,
      timeIn: timeIn,
      timeOut: timeOut,
      assignment: assignment,
      hoursWorked: hoursWorked,
      timeOutReason: timeOutReason,
      updatedAt: updatedAt,
      saved: true
    },
    day: getDay_(date)
  };
}

function exportSpreadsheetXlsx_(spreadsheetId) {
  var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Excel export failed. Re-authorize the script and try again.');
  }
  return response.getBlob();
}

function exportWeekExcel_(weekStart) {
  var week = getWeek_(weekStart);
  var profile = buildProfile_();
  var temp = SpreadsheetApp.create('Daily Diary Export ' + week.weekStart);
  temp.setSpreadsheetTimeZone(getTimezone_());
  var sheet = temp.getSheets()[0];
  sheet.setName(week.weekLabel);

  sheet.getRange('A1:G1').merge().setValue(profile.company);
  sheet.getRange('A2:G2').merge().setValue('Internship Daily Diary');
  sheet.getRange('A3:G3').merge().setValue('Intern: ' + profile.name);
  sheet.getRange('A4:G4').merge().setValue('Email: ' + profile.email);
  sheet.getRange('A5:G5').merge().setValue(week.weekLabel + ' · ' + week.weekRangeShort);
  sheet.getRange('A6:G6').merge().setValue('Time zone: ' + profile.timezone);

  sheet.getRange('A1').setFontSize(18).setFontWeight('bold').setFontColor('#051C12');
  sheet.getRange('A2').setFontSize(13).setFontWeight('bold').setFontColor('#072F1F');
  sheet.getRange('A3:A6').setFontColor('#6C7E75');

  var headers = ['Day', 'Date', 'Time In', 'Time Out', 'Intern Job Assignment', 'Hours Worked', 'Time out reason'];
  sheet.getRange(8, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(8, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#072F1F')
    .setFontColor('#FFFFFF');

  var body = week.days.map(function (day) {
    return [
      day.weekday,
      day.date,
      day.timeIn || '',
      day.timeOut || '',
      day.assignment || '',
      day.hoursWorked || '',
      day.timeOutReason || ''
    ];
  });
  sheet.getRange(9, 1, body.length, headers.length).setValues(body);
  sheet.getRange(9, 5, body.length, 1).setWrap(true);

  sheet.getRange(15, 5).setValue('Weekly total hours').setFontWeight('bold');
  sheet.getRange(15, 6).setValue(week.stats.totalHours).setFontWeight('bold').setBackground('#B4F105');

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 420);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 200);
  sheet.setFrozenRows(8);

  SpreadsheetApp.flush();
  var blob;
  try {
    blob = exportSpreadsheetXlsx_(temp.getId());
  } finally {
    DriveApp.getFileById(temp.getId()).setTrashed(true);
  }

  return {
    ok: true,
    filename: 'Kenya-Shipyards-Daily-Diary-Week-' + week.weekNumber + '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: Utilities.base64Encode(blob.getBytes())
  };
}
