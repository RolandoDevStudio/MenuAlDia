-- Popular dish badge for public menu social proof

alter table public.dishes
  add column if not exists is_popular boolean not null default false;
