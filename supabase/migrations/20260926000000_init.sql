-- WOW League database schema (initial migration). Safe to re-run (idempotent).
-- Totals are never stored: standings, NRR/NKR, awards and careers are computed from games + player_game_stats.

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  round_robins int not null default 2 check (round_robins between 1 and 3),
  points_win int not null default 2,
  points_loss int not null default 0,
  tiebreak_order text[] not null default array['nrr', 'nkr', 'h2h', 'kills'],
  mvp_kill_weight numeric not null default 1,
  mvp_revive_weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists season_teams (
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete restrict,
  primary key (season_id, team_id)
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  ign text not null,
  bgmi_uid text unique,
  real_name text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Previous IGNs, kept so old names stay searchable.
create table if not exists player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  ign text not null,
  changed_on date not null default current_date
);

-- Which team a player belongs to in a season. left_on is set on transfer/release.
create table if not exists roster_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_on date not null default current_date,
  left_on date
);
create unique index if not exists roster_one_active_team
  on roster_entries (season_id, player_id) where left_on is null;

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wow_map_id text,
  total_rounds int not null check (total_rounds > 0 and total_rounds % 2 = 1),
  created_at timestamptz not null default now()
);

create table if not exists season_maps (
  season_id uuid not null references seasons(id) on delete cascade,
  map_id uuid not null references maps(id) on delete restrict,
  sort_order int not null default 0,
  primary key (season_id, map_id)
);

-- A pairing of two teams: a league pairing inside a round robin, a playoff series, or a practice session.
create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  type text not null check (type in ('official', 'practice')),
  stage text not null check (stage in ('league', 'qualifier_1', 'eliminator', 'qualifier_2', 'final', 'practice')),
  round_robin int,
  matchday int,
  sort_order int not null default 0,
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  created_at timestamptz not null default now(),
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id)
);

-- One map played between the fixture's two teams.
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(id) on delete cascade,
  game_no int not null,
  map_id uuid references maps(id),
  scheduled_at timestamptz,
  squad_size int check (squad_size between 1 and 16),
  team_a_rounds int check (team_a_rounds >= 0),
  team_b_rounds int check (team_b_rounds >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed')),
  potm_player_id uuid references players(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (fixture_id, game_no)
);

create table if not exists player_game_stats (
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete restrict,
  team_id uuid not null references teams(id),
  kills int not null default 0 check (kills >= 0),
  revives int not null default 0 check (revives >= 0),
  primary key (game_id, player_id)
);

create index if not exists fixtures_season_idx on fixtures (season_id);
create index if not exists games_fixture_idx on games (fixture_id);
create index if not exists stats_player_idx on player_game_stats (player_id);
create index if not exists roster_season_idx on roster_entries (season_id);

-- Organizer allowlist. Emails here can edit everything; everyone else is read-only.
create table if not exists admins (
  email text primary key
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Row level security: public read, admin write.
do $$
declare t text;
begin
  foreach t in array array[
    'seasons', 'teams', 'season_teams', 'players', 'player_aliases', 'roster_entries',
    'maps', 'season_maps', 'fixtures', 'games', 'player_game_stats'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- No policies on admins: it is only readable through is_admin().
alter table admins enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
-- service_role (only used by local scripts like `npm run admin:add`) bypasses RLS.
grant all on all tables in schema public to service_role;

-- Saves a game result and its player stats atomically.
create or replace function save_game_result(
  p_game_id uuid,
  p_map_id uuid,
  p_squad_size int,
  p_team_a_rounds int,
  p_team_b_rounds int,
  p_potm_player_id uuid,
  p_stats jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  update games
     set map_id = p_map_id,
         squad_size = p_squad_size,
         team_a_rounds = p_team_a_rounds,
         team_b_rounds = p_team_b_rounds,
         potm_player_id = p_potm_player_id,
         status = 'completed',
         updated_at = now()
   where id = p_game_id;
  if not found then
    raise exception 'Game not found';
  end if;

  delete from player_game_stats where game_id = p_game_id;
  insert into player_game_stats (game_id, player_id, team_id, kills, revives)
  select p_game_id,
         (s ->> 'player_id')::uuid,
         (s ->> 'team_id')::uuid,
         coalesce((s ->> 'kills')::int, 0),
         coalesce((s ->> 'revives')::int, 0)
    from jsonb_array_elements(p_stats) s;
end $$;

-- Replaces a season's official schedule (league + playoff shells). Refuses once any official result exists.
create or replace function replace_official_schedule(p_season_id uuid, p_fixtures jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  f jsonb;
  g jsonb;
  new_fixture_id uuid;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from games gm join fixtures fx on fx.id = gm.fixture_id
     where fx.season_id = p_season_id and fx.type = 'official' and gm.status = 'completed'
  ) then
    raise exception 'Schedule is locked because results have already been entered';
  end if;

  delete from fixtures where season_id = p_season_id and type = 'official';

  for f in select * from jsonb_array_elements(p_fixtures) loop
    insert into fixtures (season_id, type, stage, round_robin, matchday, sort_order, team_a_id, team_b_id)
    values (
      p_season_id, 'official', f ->> 'stage',
      (f ->> 'round_robin')::int, (f ->> 'matchday')::int, (f ->> 'sort_order')::int,
      nullif(f ->> 'team_a_id', '')::uuid, nullif(f ->> 'team_b_id', '')::uuid
    )
    returning id into new_fixture_id;

    for g in select * from jsonb_array_elements(f -> 'games') loop
      insert into games (fixture_id, game_no, map_id)
      values (new_fixture_id, (g ->> 'game_no')::int, nullif(g ->> 'map_id', '')::uuid);
    end loop;
  end loop;
end $$;

grant execute on function is_admin() to anon, authenticated;
grant execute on function save_game_result(uuid, uuid, int, int, int, uuid, jsonb) to authenticated;
grant execute on function replace_official_schedule(uuid, jsonb) to authenticated;
