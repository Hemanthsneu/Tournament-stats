-- Season match days (organizer-picked calendar dates) and each player's answer per date.
-- Additive only: new tables, nothing existing changes.

create table if not exists season_match_days (
  season_id uuid not null references seasons(id) on delete cascade,
  day date not null,
  label text check (char_length(label) <= 40),
  created_at timestamptz not null default now(),
  primary key (season_id, day)
);

create table if not exists player_date_availability (
  player_id uuid not null references players(id) on delete cascade,
  season_id uuid not null,
  day date not null,
  status text not null check (status in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (player_id, season_id, day),
  -- Removing a match day removes the answers for it.
  foreign key (season_id, day) references season_match_days(season_id, day) on delete cascade
);

create index if not exists player_date_availability_season on player_date_availability (season_id, day);

alter table season_match_days enable row level security;
alter table player_date_availability enable row level security;

drop policy if exists "public read" on season_match_days;
create policy "public read" on season_match_days for select using (true);
drop policy if exists "admin write" on season_match_days;
create policy "admin write" on season_match_days for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "public read" on player_date_availability;
create policy "public read" on player_date_availability for select using (true);
drop policy if exists "owner write" on player_date_availability;
create policy "owner write" on player_date_availability for all to authenticated
  using (player_id = my_player_id()) with check (player_id = my_player_id());
drop policy if exists "admin write" on player_date_availability;
create policy "admin write" on player_date_availability for all to authenticated using (is_admin()) with check (is_admin());

grant select on season_match_days, player_date_availability to anon, authenticated;
grant insert, update, delete on season_match_days, player_date_availability to authenticated;
grant all on season_match_days, player_date_availability to service_role;
