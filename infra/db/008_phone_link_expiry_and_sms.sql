alter table project_phone_links
  add column if not exists expires_at timestamptz,
  add column if not exists last_sms_sent_at timestamptz,
  add column if not exists last_sms_to text;

