/**
 * Daily diary load/save, Nairobi hours, and week reports to a Google Sheet.
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
  var day = ('0' + (date.getUTCDate())).slice(-2);
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

function weekNumber_(mondayStr, programmeStart) {
  var start = mondayOf_(programmeStart || getProgrammeStart_());
  var diffMs = parseYmd_(mondayStr).getTime() - parseYmd_(start).getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function formatShortRange_(mondayStr) {
  var start = parseYmd_(mondayStr);
  var end = parseYmd_(addDays_(mondayStr, DAYS_IN_WEEK - 1));
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return start.getUTCDate() + '–' + end.getUTCDate() + ' ' + SHORT_MONTHS[end.getUTCMonth()];
  }
  return start.getUTCDate() + ' ' + SHORT_MONTHS[start.getUTCMonth()] + ' – ' +
    end.getUTCDate() + ' ' + SHORT_MONTHS[end.getUTCMonth()];
}

function weekTitle_(mondayStr, programmeStart) {
  return 'Week ' + weekNumber_(mondayStr, programmeStart);
}

function weekLabel_(mondayStr, programmeStart) {
  return weekTitle_(mondayStr, programmeStart);
}

function orgSlug_(name) {
  var slug = String(name || 'Daily-Diary').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'Daily-Diary';
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

function previousDay_(dateStr) {
  return addDays_(dateStr, -1);
}

function nextDay_(dateStr) {
  return addDays_(dateStr, 1);
}

function snapToDiaryDate_(dateStr, programmeStart) {
  var date = String(dateStr || todayNairobi_());
  var start = programmeStart || getProgrammeStart_();
  if (date < start) {
    date = start;
  }
  return date;
}

function resolveWeekStart_(weekStart, programmeStart) {
  var start = programmeStart || getProgrammeStart_();
  var programmeMonday = mondayOf_(start);
  var requested = weekStart ? mondayOf_(String(weekStart)) : mondayOf_(todayNairobi_());
  if (requested < programmeMonday) {
    requested = programmeMonday;
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

function mapDiaryEntry_(rec) {
  var date = cellAsText_(rec.date, 'yyyy-MM-dd');
  return {
    id: rec.id,
    userId: cellAsText_(rec.userId, 'yyyy-MM-dd'),
    date: date,
    weekday: cellAsText_(rec.weekday, 'EEEE') || weekdayName_(date),
    timeIn: cellAsText_(rec.timeIn, 'HH:mm'),
    timeOut: cellAsText_(rec.timeOut, 'HH:mm'),
    assignment: String(rec.assignment == null ? '' : rec.assignment).replace(/\r\n/g, '\n'),
    hoursWorked: cellAsText_(rec.hoursWorked, '0.00'),
    updatedAt: cellAsText_(rec.updatedAt, 'yyyy-MM-dd HH:mm:ss'),
    timeOutReason: cellAsText_(rec.timeOutReason, 'yyyy-MM-dd'),
    rowIndex: rec._rowIndex
  };
}

function readDiaryMap_(userId) {
  var rows = recordsForUser_(readRecords_(getDiarySheet_(), DIARY_HEADERS), userId);
  var map = {};
  rows.forEach(function (rec) {
    var entry = mapDiaryEntry_(rec);
    if (entry.date) {
      map[entry.date] = entry;
    }
  });
  return map;
}

function buildWeekDay_(date, existing) {
  var saved = !!(existing && existing.timeIn && existing.timeOut && existing.assignment);
  return {
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
  };
}

function getWeek_(weekStart, profile) {
  var programmeStart = programmeStartOf_(profile);
  var monday = resolveWeekStart_(weekStart, programmeStart);
  var programmeMonday = mondayOf_(programmeStart);
  var map = readDiaryMap_(profile.userId);
  var days = [];
  var daysLogged = 0;
  var totalHours = 0;

  for (var offset = 0; offset < DAYS_IN_WEEK; offset++) {
    var date = addDays_(monday, offset);
    var day = buildWeekDay_(date, map[date]);
    if (day.saved) {
      daysLogged += 1;
      totalHours += Number(day.hoursWorked) || 0;
    }
    days.push(day);
  }

  return {
    ok: true,
    weekStart: monday,
    weekEnd: addDays_(monday, DAYS_IN_WEEK - 1),
    weekNumber: weekNumber_(monday, programmeStart),
    weekLabel: weekTitle_(monday, programmeStart),
    weekRangeShort: formatShortRange_(monday),
    canPrev: monday > programmeMonday,
    canNext: true,
    today: todayNairobi_(),
    days: days,
    stats: {
      daysLogged: daysLogged,
      totalHours: totalHours.toFixed(2)
    }
  };
}

function getDay_(dateStr, profile) {
  var programmeStart = programmeStartOf_(profile);
  var date = snapToDiaryDate_(dateStr, programmeStart);
  var week = getWeek_(mondayOf_(date), profile);
  var existing = null;
  week.days.forEach(function (day) {
    if (day.date === date) {
      existing = day;
    }
  });
  var prev = previousDay_(date);
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

function getSummary_(profile) {
  var programmeStart = programmeStartOf_(profile);
  var programmeMonday = mondayOf_(programmeStart);
  var currentMonday = mondayOf_(todayNairobi_());
  if (currentMonday < programmeMonday) {
    currentMonday = programmeMonday;
  }
  var map = readDiaryMap_(profile.userId);
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
    var days = [];
    for (var offset = 0; offset < DAYS_IN_WEEK; offset++) {
      var date = addDays_(monday, offset);
      var day = buildWeekDay_(date, map[date]);
      if (day.saved) {
        daysLogged += 1;
        hours += Number(day.hoursWorked) || 0;
      }
      days.push(day);
    }
    grandHours += hours;
    grandDays += daysLogged;
    weeks.push({
      weekNumber: weekNumber_(monday, programmeStart),
      weekStart: monday,
      weekEnd: addDays_(monday, DAYS_IN_WEEK - 1),
      rangeShort: formatShortRange_(monday),
      daysLogged: daysLogged,
      totalHours: hours.toFixed(2),
      days: days
    });
    monday = addDays_(monday, 7);
  }

  var taskStats = taskSummaryStats_(profile);
  return {
    ok: true,
    weeks: weeks,
    totals: {
      daysLogged: grandDays,
      totalHours: grandHours.toFixed(2),
      tasksOpen: taskStats.open,
      tasksUrgent: taskStats.urgent,
      tasksOverdue: taskStats.overdue
    }
  };
}

function saveEntry_(entry, profile) {
  entry = entry || {};
  var date = String(entry.date || '').trim();
  parseYmd_(date);

  var weekday = weekdayName_(date);
  var programmeStart = programmeStartOf_(profile);
  if (date < programmeStart) {
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
  var map = readDiaryMap_(profile.userId);
  var existing = map[date];
  var updatedAt = nowNairobi_();
  var id = existing && existing.id ? existing.id : Utilities.getUuid();
  writeRecord_(sheet, DIARY_HEADERS, existing && existing.rowIndex ? existing.rowIndex : 0, {
    id: id,
    userId: profile.userId,
    date: date,
    weekday: weekday,
    timeIn: timeIn,
    timeOut: timeOut,
    assignment: assignment,
    hoursWorked: hoursWorked,
    updatedAt: updatedAt,
    timeOutReason: timeOutReason
  });

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
    day: getDay_(date, profile)
  };
}

function writeWeekReport_(dest, week, profile) {
  var organisation = organisationOf_(profile);
  var tabName = String(week.weekLabel || 'Week').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 90);
  var sheet = dest.getSheetByName(tabName);
  if (!sheet) {
    sheet = dest.insertSheet(tabName);
  }
  sheet.clear();
  sheet.getRange('A1:G1').merge().setValue(organisation);
  sheet.getRange('A2:G2').merge().setValue('Internship Daily Diary');
  sheet.getRange('A3:G3').merge().setValue('Intern: ' + (profile.name || ''));
  sheet.getRange('A4:G4').merge().setValue(
    profile.username
      ? 'Username: ' + profile.username
      : (profile.email ? 'Email: ' + profile.email : 'Username: —')
  );
  sheet.getRange('A5:G5').merge().setValue(week.weekLabel + ' · ' + week.weekRangeShort);
  sheet.getRange('A6:G6').merge().setValue('Time zone: ' + (profile.timezone || getTimezone_()));

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

  var totalRow = 9 + body.length + 1;
  sheet.getRange(totalRow, 5).setValue('Weekly total hours').setFontWeight('bold');
  sheet.getRange(totalRow, 6).setValue(week.stats.totalHours).setFontWeight('bold').setBackground('#B4F105');

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 420);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 200);
  sheet.setFrozenRows(8);
  SpreadsheetApp.flush();
}
