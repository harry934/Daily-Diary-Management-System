/**
 * Admin user management and Google Sheet report connection.
 */

function requireAdmin_(profile) {
  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin access required.');
  }
  return profile;
}

function listUsers_(profile) {
  requireAdmin_(profile);
  var users = readRecords_(getUsersSheet_(), USERS_HEADERS).map(function (row) {
    var user = hydrateUser_(row);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organisation: user.organisation,
      programmeStart: user.programmeStart,
      createdAt: user.createdAt,
      role: user.role,
      status: user.status,
      hasReportSheet: !!user.reportSpreadsheetId
    };
  });
  var rank = { pending: 0, approved: 1, disabled: 2 };
  users.sort(function (a, b) {
    var aRank = rank[a.status] != null ? rank[a.status] : 9;
    var bRank = rank[b.status] != null ? rank[b.status] : 9;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  return { ok: true, users: users };
}

function setUserStatus_(profile, userId, status) {
  requireAdmin_(profile);
  status = String(status || '').toLowerCase();
  if (status !== 'approved' && status !== 'disabled' && status !== 'pending') {
    throw new Error('Unknown account status.');
  }
  var user = findUserById_(userId);
  if (!user) {
    throw new Error('User not found.');
  }
  if (user.id === profile.userId && status !== 'approved') {
    throw new Error('You cannot disable your own admin account.');
  }
  user.status = status;
  if (user.role === 'admin') {
    user.status = 'approved';
  }
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return listUsers_(profile);
}

function parseSpreadsheetId_(value) {
  var text = String(value || '').trim();
  if (!text) {
    throw new Error('Paste your Google Sheet URL or spreadsheet ID.');
  }
  var fromUrl = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) {
    return fromUrl[1];
  }
  if (/^[a-zA-Z0-9-_]{30,}$/.test(text)) {
    return text;
  }
  throw new Error('Paste the full Google Sheet URL (it contains /spreadsheets/d/...) or the spreadsheet ID.');
}

function openSharedSpreadsheet_(id) {
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error(
      'Cannot open that sheet. Share it with ' + (ownerEmail_() || 'the app owner') +
      ' as Editor, then paste the URL again.'
    );
  }
}

function getReportSetup_(profile) {
  var user = findUserById_(profile.userId);
  var connectedId = user && user.reportSpreadsheetId ? user.reportSpreadsheetId : '';
  var title = '';
  if (connectedId) {
    try {
      title = openSharedSpreadsheet_(connectedId).getName();
    } catch (err) {
      title = '';
    }
  }
  return {
    ok: true,
    ownerEmail: ownerEmail_(),
    spreadsheetId: connectedId,
    spreadsheetTitle: title,
    connected: !!connectedId
  };
}

function connectReportSheet_(profile, raw) {
  var user = findUserById_(profile.userId);
  if (!user) {
    throw new Error('Account not found.');
  }
  if (user.reportSpreadsheetId) {
    throw new Error('Your Google Sheet is already connected. Ask an admin to disconnect it if you need a different sheet.');
  }
  var id = parseSpreadsheetId_(raw);
  var ss = openSharedSpreadsheet_(id);
  user.reportSpreadsheetId = id;
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return {
    ok: true,
    ownerEmail: ownerEmail_(),
    spreadsheetId: id,
    spreadsheetTitle: ss.getName(),
    connected: true
  };
}

function sendWeekReport_(profile) {
  var user = findUserById_(profile.userId);
  if (!user || !user.reportSpreadsheetId) {
    throw new Error('Connect your Google Sheet first, then send your records.');
  }
  var dest = openSharedSpreadsheet_(user.reportSpreadsheetId);
  var summary = getSummary_(profile);
  var weeks = summary.weeks || [];
  weeks.forEach(function (week) {
    writeWeekReport_(dest, {
      weekLabel: 'Week ' + week.weekNumber,
      weekRangeShort: week.rangeShort,
      days: week.days,
      stats: {
        daysLogged: week.daysLogged,
        totalHours: week.totalHours
      }
    }, profile);
  });
  return {
    ok: true,
    spreadsheetId: user.reportSpreadsheetId,
    spreadsheetTitle: dest.getName(),
    weekCount: weeks.length,
    url: dest.getUrl()
  };
}

function countApprovedAdmins_() {
  var count = 0;
  readRecords_(getUsersSheet_(), USERS_HEADERS).forEach(function (row) {
    var user = hydrateUser_(row);
    if (user.role === 'admin' && user.status === 'approved') {
      count += 1;
    }
  });
  return count;
}

function disconnectReportSheet_(profile, userId) {
  requireAdmin_(profile);
  var user = findUserById_(userId);
  if (!user) {
    throw new Error('User not found.');
  }
  user.reportSpreadsheetId = '';
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return listUsers_(profile);
}

function updateUser_(profile, payload) {
  requireAdmin_(profile);
  payload = payload || {};
  var user = findUserById_(payload.userId);
  if (!user) {
    throw new Error('User not found.');
  }

  var email = sanitizeEmail_(payload.email);
  var name = sanitizePersonName_(payload.name, 'full name');
  var organisation = sanitizeOrganisation_(payload.organisation);
  var programmeStart = sanitizeProgrammeStart_(payload.programmeStart);
  var role = String(payload.role || user.role || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
  var status = String(payload.status || user.status || 'approved').toLowerCase();
  if (status !== 'pending' && status !== 'disabled' && status !== 'approved') {
    throw new Error('Unknown account status.');
  }

  var editingSelf = user.id === profile.userId;
  if (editingSelf && (role !== 'admin' || status !== 'approved')) {
    throw new Error('You cannot demote or disable your own admin account.');
  }
  if (isAdminEmail_(user.email) && role !== 'admin') {
    throw new Error('This account is the configured admin and cannot be demoted.');
  }
  if (user.role === 'admin' && role !== 'admin' && countApprovedAdmins_() <= 1) {
    throw new Error('Keep at least one approved admin account.');
  }
  if (role === 'admin') {
    status = 'approved';
  }

  var existing = findUserByEmail_(email);
  if (existing && existing.id !== user.id) {
    throw new Error('Another account already uses that email.');
  }

  user.email = email;
  user.name = name;
  user.organisation = organisation;
  user.programmeStart = programmeStart;
  user.role = role;
  user.status = status;
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return listUsers_(profile);
}

function deleteUser_(profile, userId) {
  requireAdmin_(profile);
  var user = findUserById_(userId);
  if (!user) {
    throw new Error('User not found.');
  }
  if (user.id === profile.userId) {
    throw new Error('You cannot delete your own admin account.');
  }
  if (isAdminEmail_(user.email)) {
    throw new Error('This account is the configured admin and cannot be deleted.');
  }
  if (user.role === 'admin' && countApprovedAdmins_() <= 1) {
    throw new Error('Keep at least one approved admin account.');
  }
  deleteRecordsForUser_(getDiarySheet_(), DIARY_HEADERS, user.id);
  deleteRecordsForUser_(getTasksSheet_(), TASKS_HEADERS, user.id);
  deleteRecordsForUser_(getSubtasksSheet_(), SUBTASKS_HEADERS, user.id);
  deleteSheetRow_(getUsersSheet_(), user._rowIndex);
  return listUsers_(profile);
}
