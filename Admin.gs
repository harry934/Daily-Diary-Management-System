/**
 * Admin user management and Google Sheet report connection.
 */

function requireAdmin_(profile) {
  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin access required.');
  }
  return profile;
}

function requireAdminPassword_(profile, password) {
  requireAdmin_(profile);
  var admin = findUserById_(profile.userId);
  if (!admin || !passwordMatches_(password, admin.passwordSalt, admin.passwordHash)) {
    throw new Error('Confirm with your admin password to continue.');
  }
  return admin;
}

function listUsers_(profile) {
  requireAdmin_(profile);
  var users = readRecords_(getUsersSheet_(), USERS_HEADERS).map(function (row) {
    var user = hydrateUser_(row);
    return {
      id: user.id,
      username: user.username || '',
      email: user.email || '',
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

function systemSpreadsheetIds_() {
  var ids = {};
  var adminId = getAdminSpreadsheetId_();
  if (adminId) {
    ids[adminId] = true;
  }
  var diaryId = getScriptProp_('SPREADSHEET_ID', '');
  if (diaryId) {
    ids[diaryId] = true;
  }
  return ids;
}

function assertReportSheetAllowed_(ss, id, profile) {
  var blocked = systemSpreadsheetIds_();
  if (blocked[id]) {
    throw new Error('That spreadsheet is reserved for the app. Connect your own Google Sheet instead.');
  }
  var owner = '';
  try {
    owner = String(ss.getOwner().getEmail() || '').trim().toLowerCase();
  } catch (err) {
    owner = '';
  }
  var deployer = ownerEmail_();
  if (deployer && owner && owner === deployer) {
    throw new Error('Connect a Google Sheet that you own, not one owned by the app operator. Create a new sheet, share it as Editor with ' + deployer + ', then try again.');
  }
  var username = String(profile.username || '').trim().toLowerCase();
  if (!username) {
    throw new Error('Your account needs a username before connecting a sheet.');
  }
  var expected = REPORT_VERIFY_PREFIX + username;
  var first = ss.getSheets()[0];
  var marker = '';
  try {
    marker = String(first.getRange(1, 1).getDisplayValue() || '').trim();
  } catch (err) {
    marker = '';
  }
  if (marker !== expected) {
    throw new Error(
      'Open your sheet and put exactly ' + expected +
      ' in cell A1 of the first tab, share the sheet as Editor with ' +
      (deployer || 'the app owner') + ', then connect again.'
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
  var username = String((user && user.username) || profile.username || '').trim().toLowerCase();
  return {
    ok: true,
    ownerEmail: ownerEmail_(),
    spreadsheetTitle: title,
    connected: !!connectedId,
    verifyCode: username ? REPORT_VERIFY_PREFIX + username : ''
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
  assertReportSheetAllowed_(ss, id, profileFromUser_(user));
  user.reportSpreadsheetId = id;
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return {
    ok: true,
    ownerEmail: ownerEmail_(),
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

function disconnectReportSheet_(profile, userId, confirmPassword) {
  requireAdminPassword_(profile, confirmPassword);
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

  var username = sanitizeUsername_(payload.username);
  var email = sanitizeEmail_(payload.email);
  var name = sanitizePersonName_(payload.name, 'full name');
  var organisation = sanitizeOrganisation_(payload.organisation);
  var programmeStart = sanitizeProgrammeStart_(payload.programmeStart);
  var role = String(payload.role || user.role || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
  var status = String(payload.status || user.status || 'approved').toLowerCase();
  if (status !== 'pending' && status !== 'disabled' && status !== 'approved') {
    throw new Error('Unknown account status.');
  }

  var promoting = user.role !== 'admin' && role === 'admin';
  if (promoting) {
    requireAdminPassword_(profile, payload.confirmPassword);
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

  if (isUsernameDeleted_(username) && username !== user.username) {
    throw new Error('That username is not available.');
  }
  var existingUsername = findUserByUsername_(username);
  if (existingUsername && existingUsername.id !== user.id) {
    throw new Error('Another account already uses that username.');
  }
  if (email) {
    var existingEmail = findUserByEmail_(email);
    if (existingEmail && existingEmail.id !== user.id) {
      throw new Error('Another account already uses that email.');
    }
  }

  user.username = username;
  user.email = email;
  user.name = name;
  user.organisation = organisation;
  user.programmeStart = programmeStart;
  user.role = role;
  user.status = status;
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  return listUsers_(profile);
}

function deleteUser_(profile, userId, confirmPassword) {
  requireAdminPassword_(profile, confirmPassword);
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

  var email = String(user.email || '').trim().toLowerCase();
  var username = String(user.username || '').trim().toLowerCase();
  var id = String(user.id || '');
  function matchesUser(row) {
    var rowId = cellAsText_(row.id, 'yyyy-MM-dd');
    var rowEmail = cellAsText_(row.email, 'yyyy-MM-dd').toLowerCase();
    var rowUsername = cellAsText_(row.username, 'yyyy-MM-dd').toLowerCase();
    return (id && rowId === id) ||
      (email && rowEmail === email) ||
      (username && rowUsername === username);
  }

  deleteRecordsForUser_(getDiarySheet_(), DIARY_HEADERS, id);
  deleteRecordsForUser_(getTasksSheet_(), TASKS_HEADERS, id);
  deleteRecordsForUser_(getSubtasksSheet_(), SUBTASKS_HEADERS, id);
  deleteMatchingUserRows_(getUsersSheet_(), matchesUser);

  try {
    var legacy = getDiarySpreadsheet_().getSheetByName(USERS_SHEET_NAME);
    deleteMatchingUserRows_(legacy, matchesUser);
  } catch (err) {}

  if (email) {
    markEmailDeleted_(email);
  }
  if (username) {
    markUsernameDeleted_(username);
  }
  SpreadsheetApp.flush();
  return listUsers_(profile);
}
