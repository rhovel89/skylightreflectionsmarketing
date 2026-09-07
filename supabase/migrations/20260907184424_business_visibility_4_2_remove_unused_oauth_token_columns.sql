alter table public.business_visibility_google_connections
  drop column if exists token_ciphertext,
  drop column if exists refresh_token_ciphertext,
  drop column if exists access_token_expires_at;
