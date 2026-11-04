-- UNKNOWN guest sessions. Store only a hash of the bearer token.
CREATE TABLE IF NOT EXISTS guest_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'restricted')),
  age_attested_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expiry
  ON guest_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_status_expiry
  ON guest_sessions (status, expires_at);