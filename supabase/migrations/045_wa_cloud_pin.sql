-- PIN de registro Cloud API (2FA Meta), cifrado en servidor.
alter table public.restaurant_whatsapp_accounts
  add column if not exists cloud_pin_encrypted text;
