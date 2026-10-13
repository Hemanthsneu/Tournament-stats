-- When each player can play (days of the week + a time window), shown to captains in the auction.
-- Additive: one new table. Days: 0 = Sunday … 6 = Saturday. Times are league-local "HH:MM".
create table if not exists player_availability (
  player_id uuid primary key references players(id) on delete cascade,
  days smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  time_from text check (time_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  time_to text check (time_to ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'),
  note text check (char_length(note) <= 160),
  updated_at timestamptz not null default now()
);

alter table player_availability enable row level security;
drop policy if exists "public read" on player_availability;
create policy "public read" on player_availability for select using (true);
drop policy if exists "owner write" on player_availability;
create policy "owner write" on player_availability for all to authenticated
  using (player_id = my_player_id()) with check (player_id = my_player_id());
drop policy if exists "admin write" on player_availability;
create policy "admin write" on player_availability for all to authenticated
  using (is_admin()) with check (is_admin());

grant select on player_availability to anon, authenticated;
grant insert, update, delete on player_availability to authenticated;
grant all on player_availability to service_role;
