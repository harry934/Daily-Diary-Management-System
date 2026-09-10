/**
 * Single-intern authentication: salted SHA-256 password, CacheService
 * sessions, and login rate limiting.
 */

var SESSION_TTL_SECONDS = 21600; // CacheService maximum (6 hours)
var LOGIN_WINDOW_SECONDS = 900;
var MAX_LOGIN_ATTEMPTS = 5;

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

function buildProfile_() {
  var props = PropertiesService.getScriptProperties();
  return {
    email: props.getProperty('INTERN_EMAIL') || '',
    name: props.getProperty('INTERN_NAME') || '',
    company: getCompany_(),
    programmeStart: getProgrammeStart_(),
    timezone: getTimezone_()
  };
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

function clearFailedLogin_(email) {
  var store = cache_();
  store.remove(loginFailKey_(email));
  store.remove(loginLockKey_(email));
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
  if (!profile) {
    throw new Error('Session expired. Please sign in again.');
  }
  return profile;
}

function login_(email, password) {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PASSWORD_HASH') || !props.getProperty('PASSWORD_SALT')) {
    return {
      ok: false,
      error: 'System is not set up. Run setupInitialize in the Apps Script editor.'
    };
  }

  var normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: 'Enter your email and password.' };
  }

  assertNotRateLimited_(normalized);

  var expectedEmail = String(props.getProperty('INTERN_EMAIL') || '').trim().toLowerCase();
  var expectedHash = props.getProperty('PASSWORD_HASH');
  var salt = props.getProperty('PASSWORD_SALT');
  var actualHash = hashPassword_(password, salt);
  var valid = hashesMatch_(actualHash, expectedHash) && hashesMatch_(normalized, expectedEmail);

  if (!valid) {
    recordFailedLogin_(normalized);
    return { ok: false, error: 'Invalid email or password.' };
  }

  clearFailedLogin_(normalized);
  var profile = buildProfile_();
  return {
    ok: true,
    token: createSession_(profile),
    profile: profile
  };
}

function logout_(token) {
  if (token) {
    cache_().remove('sess_' + token);
  }
  return { ok: true };
}

function getSession_(token) {
  var profile = readSession_(token);
  if (!profile) {
    return { ok: false, error: 'Session expired. Please sign in again.' };
  }
  cache_().put('sess_' + token, JSON.stringify(profile), SESSION_TTL_SECONDS);
  return { ok: true, profile: profile };
}
