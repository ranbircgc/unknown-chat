-- Minimal report records: no chat transcript or message contents are stored.
CREATE TABLE IF NOT EXISTS conversation_reports (
  id TEXT PRIMARY KEY,
  reporter_session_id TEXT NOT NULL,
  reported_session_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'Harassment or bullying',
    'Threats or violence',
    'Hate speech',
    'Sexual harassment or exploitation',
    'Scam or spam',
    'Sharing private information',
    'Other'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_reports_status_created
  ON conversation_reports (status, created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_session_id TEXT NOT NULL,
  blocked_session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_session_id, blocked_session_id),
  CHECK (blocker_session_id <> blocked_session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON user_blocks (blocked_session_id, blocker_session_id);
