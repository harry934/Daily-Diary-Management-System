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
var USERNAME_MIN_LENGTH = 3;
var USERNAME_MAX_LENGTH = 24;

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function bytesToHex_(raw) {
  return raw.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    var hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hashPasswordLegacy_(password, salt) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + String(password),
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(raw);
}

function hashPasswordV2_(password, salt) {
  var rounds = PASSWORD_PBKDF_ROUNDS || 12000;
  var derived = Utilities.computeHmacSha256Signature(String(password), String(salt));
  var i;
  for (i = 1; i < rounds; i++) {
    derived = Utilities.computeHmacSha256Signature(derived, String(salt));
  }
  return PASSWORD_HASH_VERSION + ':' + bytesToHex_(derived);
}

function hashPassword_(password, salt) {
  return hashPasswordV2_(password, salt);
}

function passwordMatches_(password, salt, storedHash) {
  var hash = String(storedHash || '');
  if (hash.indexOf(PASSWORD_HASH_VERSION + ':') === 0) {
    return hashesMatch_(hashPasswordV2_(password, salt), hash);
  }
  return hashesMatch_(hashPasswordLegacy_(password, salt), hash);
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

function sanitizeUsername_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (!text) {
    throw new Error('Enter a username.');
  }
  if (text.length < USERNAME_MIN_LENGTH || text.length > USERNAME_MAX_LENGTH) {
    throw new Error('Username must be ' + USERNAME_MIN_LENGTH + '–' + USERNAME_MAX_LENGTH + ' characters.');
  }
  if (!/^[a-z][a-z0-9._]*$/.test(text)) {
    throw new Error('Username must start with a letter and use only letters, numbers, dots, or underscores.');
  }
  return text;
}

function sanitizeEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  if (!email) {
    return '';
  }
  if (email.indexOf('@') < 1 || email.indexOf('.') < 3) {
    throw new Error('Enter a valid email address, or leave it blank.');
  }
  if (email.length > 120) {
    throw new Error('Email must be 120 characters or fewer.');
  }
  return email;
}

function assertPasswordsMatch_(password, confirm) {
  if (password !== String(confirm || '')) {
    throw new Error('Password and confirmation do not match.');
  }
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
  row.username = cellAsText_(row.username, 'yyyy-MM-dd').toLowerCase();
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
    username: user.username || '',
    email: user.email || '',
    name: user.name,
    organisation: user.organisation,
    company: user.organisation,
    programmeStart: user.programmeStart,
    timezone: getTimezone_(),
    role: user.role || 'user',
    status: user.status || 'approved',
    hasReportSheet: !!user.reportSpreadsheetId
  };
}

function findUserByUsername_(username) {
  var normalized = String(username || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  var rows = readRecords_(getUsersSheet_(), USERS_HEADERS);
  for (var i = 0; i < rows.length; i++) {
    if (cellAsText_(rows[i].username, 'yyyy-MM-dd').toLowerCase() === normalized) {
      return hydrateUser_(rows[i]);
    }
  }
  return null;
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

function findUserByLoginIdentifier_(identifier) {
  var text = String(identifier || '').trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (text.indexOf('@') >= 0) {
    return findUserByEmail_(text);
  }
  return findUserByUsername_(text);
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
  assertGlobalAuthBudget_();
  if (cache_().get(loginLockKey_(email)) === '1') {
    throw new Error('Too many failed attempts. Try again in 15 minutes.');
  }
}

function globalAuthFailKey_() {
  return 'auth_fail_global';
}

function globalAuthLockKey_() {
  return 'auth_lock_global';
}

function assertGlobalAuthBudget_() {
  if (cache_().get(globalAuthLockKey_()) === '1') {
    throw new Error('Too many failed attempts across the app. Try again in 15 minutes.');
  }
}

function recordGlobalAuthFailure_() {
  var store = cache_();
  var count = Number(store.get(globalAuthFailKey_()) || '0') + 1;
  store.put(globalAuthFailKey_(), String(count), LOGIN_WINDOW_SECONDS);
  if (count >= 40) {
    store.put(globalAuthLockKey_(), '1', LOGIN_WINDOW_SECONDS);
  }
}

function recordFailedLogin_(email) {
  recordGlobalAuthFailure_();
  var store = cache_();
  var count = Number(store.get(loginFailKey_(email)) || '0') + 1;
  store.put(loginFailKey_(email), String(count), LOGIN_WINDOW_SECONDS);
  if (count >= MAX_LOGIN_ATTEMPTS) {
    store.put(loginLockKey_(email), '1', LOGIN_WINDOW_SECONDS);
  }
}

function recordFailedSignup_(email) {
  recordGlobalAuthFailure_();
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

function userSessionKey_(userId) {
  return 'user_sess_' + String(userId || '');
}

function createSession_(profile) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var store = cache_();
  var userId = profile && profile.userId ? String(profile.userId) : '';
  if (userId) {
    var previous = store.get(userSessionKey_(userId));
    if (previous && previous !== token) {
      store.remove('sess_' + previous);
    }
    store.put(userSessionKey_(userId), token, SESSION_TTL_SECONDS);
  }
  store.put('sess_' + token, JSON.stringify(profile), SESSION_TTL_SECONDS);
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

function assertActiveSessionToken_(token, userId) {
  if (!userId) {
    throw new Error('Session expired. Please sign in again.');
  }
  var active = cache_().get(userSessionKey_(userId));
  if (!active) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (active !== token) {
    throw new Error('Signed in elsewhere. Please sign in again.');
  }
}

function requireSession_(token) {
  var profile = readSession_(token);
  if (!profile || !profile.userId) {
    throw new Error('Session expired. Please sign in again.');
  }
  assertActiveSessionToken_(token, profile.userId);
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

function login_(identifier, password) {
  try {
    getUsersSheet_();
  } catch (err) {
    return {
      ok: false,
      error: 'System is not set up. Run setupInitialize in the Apps Script editor.'
    };
  }

  var normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: 'Enter your username and password.' };
  }
  if (!password) {
    return { ok: false, error: 'Enter your username and password.' };
  }

  try {
    assertNotRateLimited_(normalized);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  var user = findUserByLoginIdentifier_(normalized);
  if (!user || !user.passwordHash || !user.passwordSalt) {
    recordFailedLogin_(normalized);
    return { ok: false, error: 'Invalid username or password.' };
  }

  if (!passwordMatches_(password, user.passwordSalt, user.passwordHash)) {
    recordFailedLogin_(normalized);
    return { ok: false, error: 'Invalid username or password.' };
  }

  if (String(user.passwordHash || '').indexOf(PASSWORD_HASH_VERSION + ':') !== 0) {
    user.passwordSalt = generateSalt_();
    user.passwordHash = hashPassword_(password, user.passwordSalt);
    writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
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
  } catch (err) {
    return {
      ok: false,
      error: 'System is not set up. Run setupInitialize in the Apps Script editor.'
    };
  }

  var username = '';
  var email = '';
  try {
    username = sanitizeUsername_(payload.username);
    email = sanitizeEmail_(payload.email);
    assertNotRateLimited_(username);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  try {
    if (isUsernameDeleted_(username)) {
      recordFailedSignup_(username);
      return { ok: false, error: 'That username is not available. Choose another.' };
    }
    if (findUserByUsername_(username)) {
      recordFailedSignup_(username);
      return { ok: false, error: 'That username is already taken. Choose another.' };
    }
    if (email && findUserByEmail_(email)) {
      recordFailedSignup_(username);
      return { ok: false, error: 'An account with that email already exists. Sign in instead.' };
    }

    var name = sanitizePersonName_(payload.name, 'full name');
    var organisation = sanitizeOrganisation_(payload.organisation);
    var password = sanitizePassword_(payload.password);
    assertPasswordsMatch_(password, payload.passwordConfirm);
    var programmeStart = sanitizeProgrammeStart_(payload.programmeStart);

    var salt = generateSalt_();
    var isAdmin = !!(email && isAdminEmail_(email));
    var user = {
      id: Utilities.getUuid(),
      username: username,
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
    clearUsernameDeleted_(username);
    if (email) {
      clearEmailDeleted_(email);
    }
    clearFailedLogin_(username);
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
    if (username) {
      recordFailedSignup_(username);
    }
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function changePassword_(profile, payload) {
  payload = payload || {};
  var user = findUserById_(profile.userId);
  if (!user) {
    throw new Error('Account not found.');
  }
  var rateKey = user.username || user.email || user.id;
  assertNotRateLimited_(rateKey);

  if (!payload.currentPassword) {
    throw new Error('Enter your current password.');
  }
  if (!passwordMatches_(payload.currentPassword, user.passwordSalt, user.passwordHash)) {
    recordFailedLogin_(rateKey);
    throw new Error('Current password is incorrect.');
  }

  var nextPassword = sanitizePassword_(payload.newPassword);
  assertPasswordsMatch_(nextPassword, payload.newPasswordConfirm);
  if (nextPassword === String(payload.currentPassword || '')) {
    throw new Error('Choose a new password that is different from your current one.');
  }

  var salt = generateSalt_();
  user.passwordSalt = salt;
  user.passwordHash = hashPassword_(nextPassword, salt);
  writeRecord_(getUsersSheet_(), USERS_HEADERS, user._rowIndex, user);
  clearFailedLogin_(rateKey);
  var freshProfile = profileFromUser_(user);
  return {
    ok: true,
    message: 'Password updated.',
    token: createSession_(freshProfile),
    profile: freshProfile
  };
}

function logout_(token) {
  if (token) {
    var store = cache_();
    var profile = readSession_(token);
    store.remove('sess_' + token);
    if (profile && profile.userId) {
      var key = userSessionKey_(profile.userId);
      if (store.get(key) === token) {
        store.remove(key);
      }
    }
  }
  return { ok: true };
}

function getSession_(token) {
  try {
    var profile = requireSession_(token);
    var store = cache_();
    store.put('sess_' + token, JSON.stringify(profile), SESSION_TTL_SECONDS);
    if (profile.userId) {
      store.put(userSessionKey_(profile.userId), token, SESSION_TTL_SECONDS);
    }
    return { ok: true, profile: profile };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
