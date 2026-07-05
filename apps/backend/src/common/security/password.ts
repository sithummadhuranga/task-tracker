// Single source of truth for the bcrypt cost factor — every place that hashes a password
// (registration, the admin seed user) must use the same value, or verifying against an
// older hash costed differently would still work, but silently drift the two apart is a
// footgun waiting to happen.
export const BCRYPT_COST = 12;
