-- Add review metadata without storing chat transcripts or identity documents.
ALTER TABLE conversation_reports ADD COLUMN reviewer TEXT;
ALTER TABLE conversation_reports ADD COLUMN reviewed_at INTEGER;
ALTER TABLE conversation_reports ADD COLUMN resolution_code TEXT;
ALTER TABLE conversation_reports ADD COLUMN moderator_note TEXT;

CREATE TABLE IF NOT EXISTS moderation_audit (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('reviewed', 'actioned', 'dismissed')),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_report_created
  ON moderation_audit (report_id, created_at);
