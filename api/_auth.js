const crypto = require("node:crypto");

const COOKIE_NAME = "pricing_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function authIsConfigured() {
  return Boolean(process.env.APP_PASSWORD && process.env.SESSION_SECRET);
}

function safeTextEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function passwordIsValid(password) {
  return authIsConfigured() && safeTextEqual(password || "", process.env.APP_PASSWORD);
}

function createSessionToken() {
  if (!authIsConfigured()) return "";
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(String(expiresAt))
    .digest("base64url");
  return `${expiresAt}.${signature}`;
}

function sessionTokenIsValid(token) {
  if (!authIsConfigured() || !token || typeof token !== "string" || token.length > 160) return false;
  const [expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(expiresAtText)
    .digest("base64url");
  return safeTextEqual(signature, expected);
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header.split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = "";
    }
    return cookies;
  }, {});
}

function requestHasValidSession(request) {
  return sessionTokenIsValid(parseCookies(request)[COOKIE_NAME]);
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

module.exports = {
  authIsConfigured,
  clearSessionCookie,
  createSessionToken,
  passwordIsValid,
  requestHasValidSession,
  sessionCookie
};
