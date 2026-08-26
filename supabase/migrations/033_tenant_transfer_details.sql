-- Optional tenant bank details for WhatsApp checkout (not platform SPEI).

alter table public.restaurants
  add column if not exists show_transfer_details boolean not null default false;

alter table public.restaurants
  add column if not exists bank_account_holder text not null default '';

alter table public.restaurants
  add column if not exists bank_name text not null default '';

alter table public.restaurants
  add column if not exists bank_clabe text not null default '';
