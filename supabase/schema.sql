-- Miro Do: схема Supabase. Выполните целиком в SQL Editor нового проекта.
-- Доски открываются по ссылке без входа: кто знает id доски (часть ссылки после #), тот может её редактировать.

-- Объекты доски: каждая строка — карточка, стикер, фигура, связь, файл и т.д.
create table if not exists public.board_objects (
  board_id   text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (board_id, id)
);

-- Название и прочие свойства доски.
create table if not exists public.boards (
  id         text        primary key,
  title      text        not null default 'Без названия',
  updated_at timestamptz not null default now()
);

alter table public.board_objects enable row level security;
alter table public.boards enable row level security;

create policy "objects read"   on public.board_objects for select to anon, authenticated using (true);
create policy "objects insert" on public.board_objects for insert to anon, authenticated with check (true);
create policy "objects update" on public.board_objects for update to anon, authenticated using (true) with check (true);
create policy "objects delete" on public.board_objects for delete to anon, authenticated using (true);

create policy "boards read"   on public.boards for select to anon, authenticated using (true);
create policy "boards insert" on public.boards for insert to anon, authenticated with check (true);
create policy "boards update" on public.boards for update to anon, authenticated using (true) with check (true);

-- Изменения в реальном времени.
alter publication supabase_realtime add table public.board_objects, public.boards;

-- Хранилище для файлов и картинок (до 50 МБ на файл), ссылки на файлы публичные.
insert into storage.buckets (id, name, public, file_size_limit)
values ('board-files', 'board-files', true, 52428800)
on conflict (id) do nothing;

create policy "board files upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'board-files');
