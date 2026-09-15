-- WhatsApp SPEI payment proofs (private). Run AFTER 043_whatsapp_bot.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wa-payment-proofs',
  'wa-payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "wa_payment_proofs_member_select" on storage.objects;
drop policy if exists "wa_payment_proofs_member_insert" on storage.objects;
drop policy if exists "wa_payment_proofs_member_delete" on storage.objects;

create policy "wa_payment_proofs_member_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'wa-payment-proofs'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );

-- Inserts are service-role (webhook). Members may delete if needed.
create policy "wa_payment_proofs_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wa-payment-proofs'
    and (
      public.is_restaurant_member((storage.foldername(name))[1]::uuid)
      or public.is_super_admin()
    )
  );
