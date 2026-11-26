/** Short-lived JWT sent on every request (httpOnly cookie). */
export const ACCESS_COOKIE_NAME = "sb_at";
/** Opaque refresh token; its SHA-256 hash identifies a row in user_sessions. */
export const REFRESH_COOKIE_NAME = "sb_rt";
/** Cookie used before revocable sessions existed; cleared when seen. */
export const LEGACY_SESSION_COOKIE_NAME = "sleevebuild_session";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Default session length (absolute, counted from sign-in). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24;
/** Session length with "Keep me signed in". */
export const REMEMBER_ME_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const JWT_ISSUER = "sleevebuild";
export const JWT_AUDIENCE = "sleevebuild-app";

export const USERNAME_CHANGE_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
export const DELETION_GRACE_DAYS = 30;
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt only uses the first 72 bytes; longer input is rejected up front. */
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;
