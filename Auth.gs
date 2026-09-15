/**
 * Multi-user authentication: Users sheet, salted SHA-256 passwords,
 * CacheService sessions, and login/signup rate limiting.
 */

var SESSION_TTL_SECONDS = 21600; // CacheService maximum (6 hours)
var LOGIN_WINDOW_SECONDS = 900;
var MAX_LOGIN_ATTEMPTS = 5;
var MAX_SIGNUP_ATTEMPTS = 8;
var NAME_MAX_LENGTH = 80;
var ORG_MAX_LENGTH = 80;
var PASSWORD_MIN_LENGTH = 8;

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function hashPassword_(password, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + String(password),
    Utilities.Charset.UTF_8
  );
  return raw.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    var hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hashesMatch_(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  var mismatch = 0;
  for (var i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function sanitizePersonName_(value, label) {
  var text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new Error('Enter your ' + (label || 'name') + '.');
  }
  if (text.length > NAME_MAX_LENGTH) {
    throw new Error((label || 'Name') + ' must be ' + NAME_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function sanitizeOrganisation_(value) {
  var text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new Error('Enter the organisation name you want to use.');
  }
  if (text.length > ORG_MAX_LENGTH) {
    throw new Error('Organisation name must be ' + ORG_MAX_LENGTH + ' characters or fewer.');
  }
  return text;
}

function sanitizeEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 1 || email.indexOf('.') < 3) {
    throw new Error('Enter a valid email address.');
  }
  if (email.length > 120) {
    throw new Error('Email must be 120 characters or fewer.');
  }
  return email;
}

function sanitizePassword_(value) {
  var password = String(value || '');
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error('Password must be at least ' + PASSWORD_MIN_LENGTH + ' characters.');
  }
  if (password.length > 200) {
    throw new Error('Password is too long.');
  }
  return password;
}

function sanitizeProgrammeStart_(value) {
  var date = String(value || '').trim();
  if (!date) {
    date = PROGRAMME_START_DATE;
  }
  parseYmd_(date);
  return date;
}

function hydrateUser_(row) {
  if (!row) {
    return null;
  }
  var email = cellAsText_(row.email, 'yyyy-MM-dd').toLowerCase();
  var role = String(row.role || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
  if (isAdminEmail_(email)) {
    role = 'admin';
  }
  var status = String(row.status || 'approved').toLowerCase();
  if (status !== 'pending' && status !== 'disabled' && status !== 'approved') {
    status = 'approved';
  }
  if (role === 'admin' && status === 'pending') {
    status = 'approved';
  }
  row.email = email;
  row.name = cellAsText_(row.name, 'yyyy-MM-dd');
  row.organisation = cellAsText_(row.organisation, 'yyyy-MM-dd');
  row.passwordHash = String(row.passwordHash || '');
  row.passwordSalt = String(row.passwordSalt || '');
  row.programmeStart = cellAsText_(row.programmeStart, 'yyyy-MM-dd') || PROGRAMME_START_DATE;
  row.createdAt = cellAsText_(row.createdAt, 'yyyy-MM-dd HH:mm:ss');
  row.role = role;
  row.status = status;
  row.reportSpreadsheetId = cellAsText_(row.reportSpreadsheetId, 'yyyy-MM-dd');
  return row;
}

function profileFromUser_(user) {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organisation: user.organisation,
    company: user.organisation,
    programmeStart: user.programmeStart,
    timezone: getTimezone_(),
    role: user.role || 'user',
    status: user.status || 'approved',
    reportSpreadsheetId: user.reportSpreadsheetId || ''
  };
}

function findUserByEmail_(email) {
  var normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  var rows = readRecords_(getUsersSheet_(), USERS_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (cellAsText_(rows[i].email, 'yyyy-MM-dd').toLowerCase() === normalized) {
      return hydrateUser_(rows[i]);
    }
  }
  return null;
}

function findUserById_(id) {
  var wanted = String(id || '').trim();
  if (!wanted) {
    return null;
  }
  var rows = readRecords_(getUsersSheet_(), USERS_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === wanted) {
      return hydrateUser_(rows[i]);
    }
  }
  return null;
}

function assertUserActive_(user) {
  if (!user) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (user.status === 'pending') {
    throw new Error('Your account is waiting for admin approval.');
  }
  if (user.status === 'disabled') {
    throw new Error('This account has been disabled. Contact the admin.');
  }
}

function cache_() {
  return CacheService.getScriptCache();
}

function loginLockKey_(email) {
  return 'login_lock_' + email;
}

function loginFailKey_(email) {
  return 'login_fail_' + email;
}

function signupFailKey_(email) {
  return 'signup_fail_' + email;
}

function assertNotRateLimited_(email) {
  if (cache_().get(loginLockKey_(email)) === '1') {
    throw new Error('Too many failed attempts. Try again in 15 minutes.');
  }
}

function recordFailedLogin_(email) {
  var store = cache_();
  var count = Number(store.get(loginFailKey_(email)) || '0') + 1;
  store.put(loginFailKey_(email), String(count), LOGIN_WINDOW_SECONDS);
  if (count >= MAX_LOGIN_ATTEMPTS) {
    store.put(loginLockKey_(email), '1', LOGIN_WINDOW_SECONDS);
  }
}

function recordFailedSignup_(email) {
  var store = cache_();
  var count = Number(store.get(signupFailKey_(email)) || '0') + 1;
  store.put(signupFailKey_(email), String(count), LOGIN_WINDOW_SECONDS);
  if (count >= MAX_SIGNUP_ATTEMPTS) {
    store.put(loginLockKey_(email), '1', LOGIN_WINDOW_SECONDS);
  }
}

function clearFailedLogin_(email) {
  var store = cache_();
  store.remove(loginFailKey_(email));
  store.remove(loginLockKey_(email));
  store.remove(signupFailKey_(email));
}

function createSession_(profile) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache_().put('sess_' + token, JSON.stringify(profile), SESSION_TTL_SECONDS);
  return token;
}

function readSession_(token) {
  if (!token) {
    return null;
  }
  var raw = cache_().get('sess_' + token);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function requireSession_(token) {
  var profile = readSession_(token);
  if (!profile || !profile.userId) {
    throw new Error('Session expired. Please sign in again.');
  }
  var user = findUserById_(profile.userId);
  assertUserActive_(user);
  return profileFromUser_(user);
}

function programmeStartOf_(profile) {
  return (profile && profile.programmeStart) || getProgrammeStart_();
}

function organisationOf_(profile) {
  return (profile && (profile.organisation || profile.company)) || getCompany_();
}

function login_(email, password) {
  try {
    getUsersSheet_();
    migrateLegacyIntern_();
  } catch (err) {
    return {
      ok: false,
      error: 'System is not set up. Run setupInitialize in the Apps Script editor.'
    };
  }

  var normalized;
  try {
    normalized = sanitizeEmail_(email);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  if (!password) {
    return { ok: false, error: 'Enter your email and password.' };
  }

  try {
    assertNotRateLimited_(normalized);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  var user = findUserByEmail_(normalized);
  if (!user || !user.passwordHash || !user.passwordSalt) {
    recordFailedLogin_(normalized);
    return { ok: false, error: 'Invalid email or password.' };
  }

  var actualHash = hashPassword_(password, user.passwordSalt);
  if (!hashesMatch_(actualHash, user.passwordHash)) {
    recordFailedLogin_(normalized);
    return { ok: false, error: 'Invalid email or password.' };
  }

  clearFailedLogin_(normalized);
  ensureAdminAccount_();
  user = findUserById_(user.id) || user;
  if (user.status === 'pending') {
    return { ok: false, error: 'Your account is waiting for admin approval. You can sign in after it is approved.' };
  }
  if (user.status === 'disabled') {
    return { ok: false, error: 'This account has been disabled. Contact the admin.' };
  }
  var profile = profileFromUser_(user);
  return {
    ok: true,
    token: createSession_(profile),
    profile: profile
  };
}

function register_(payload) {
  payload = payload || {};
  try {
    getUsersSheet_();
    migrateLegacyIntern_();
  } catch (err) {
    return {
      ok: false,
      error: 'System is not set up. Run setupInitialize in the Apps Script editor.'
    };
  }

  var email;
  try {
    email = sanitizeEmail_(payload.email);
    assertNotRateLimited_(email);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  try {
    var name = sanitizePersonName_(payload.name, 'full name');
    var organisation = sanitizeOrganisation_(payload.organisation);
    var password = sanitizePassword_(payload.password);
    var programmeStart = sanitizeProgrammeStart_(payload.programmeStart);

    if (findUserByEmail_(email)) {
      recordFailedSignup_(email);
      return { ok: false, error: 'An account with that email already exists. Sign in instead.' };
    }

    var salt = generateSalt_();
    var isAdmin = isAdminEmail_(email);
    var user = {
      id: Utilities.getUuid(),
      email: email,
      name: name,
      organisation: organisation,
      passwordHash: hashPassword_(password, salt),
      passwordSalt: salt,
      programmeStart: programmeStart,
      createdAt: nowNairobi_(),
      role: isAdmin ? 'admin' : 'user',
      status: isAdmin ? 'approved' : 'pending',
      reportSpreadsheetId: ''
    };
    writeRecord_(getUsersSheet_(), USERS_HEADERS, 0, user);
    clearFailedLogin_(email);
    if (user.status === 'pending') {
      return {
        ok: true,
        pending: true,
        message: 'Account created. An admin must approve it before you can sign in.'
      };
    }
    var profile = profileFromUser_(user);
    return {
      ok: true,
      token: createSession_(profile),
      profile: profile
    };
  } catch (err) {
    recordFailedSignup_(email);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function logout_(token) {
  if (token) {
    cache_().remove('sess_' + token);
  }
  return { ok: true };
}

function getSession_(token) {
  try {
    ensureAdminAccount_();
    var profile = requireSession_(token);
    cache_().put('sess_' + token, JSON.stringify(profile), SESSION_TTL_SECONDS);
    return { ok: true, profile: profile };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
