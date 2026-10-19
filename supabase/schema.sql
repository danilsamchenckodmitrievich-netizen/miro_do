-- Таблица объектов доски. Каждая строка — один стикер, фигура, стрелка и т.д.
create table if not exists public.board_objects (
  board_id   text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (board_id, id)
);

-- Доски открываются по ссылке без входа, поэтому анонимный доступ разрешён.
-- Кто знает id доски (часть ссылки после #), тот может её редактировать.
alter table public.board_objects enable row level security;

create policy "board read"   on public.board_objects for select to anon, authenticated using (true);
create policy "board insert" on public.board_objects for insert to anon, authenticated with check (true);
create policy "board update" on public.board_objects for update to anon, authenticated using (true) with check (true);
create policy "board delete" on public.board_objects for delete to anon, authenticated using (true);

-- Изменения в реальном времени.
alter publication supabase_realtime add table public.board_objects;
