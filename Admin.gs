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
      reportSpreadsheetId: user.reportSpreadsheetId
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
  var id = parseSpreadsheetId_(raw);
  var ss = openSharedSpreadsheet_(id);
  var user = findUserById_(profile.userId);
  if (!user) {
    throw new Error('Account not found.');
  }
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

function sendWeekReport_(profile, weekStart) {
  var user = findUserById_(profile.userId);
  if (!user || !user.reportSpreadsheetId) {
    throw new Error('Connect your Google Sheet first, then send the week.');
  }
  var dest = openSharedSpreadsheet_(user.reportSpreadsheetId);
  var week = getWeek_(weekStart, profile);
  writeWeekReport_(dest, week, profile);
  return {
    ok: true,
    spreadsheetId: user.reportSpreadsheetId,
    spreadsheetTitle: dest.getName(),
    weekLabel: week.weekLabel,
    url: dest.getUrl()
  };
}
