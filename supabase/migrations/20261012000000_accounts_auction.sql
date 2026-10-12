-- Season 2: player accounts, profile claiming and the live auction.
-- Additive: creates new tables and functions. The only change to existing objects is that organizer
-- access is now tied to the organizer's auth user id (admins.user_id) instead of just the email, so
-- opening player sign-ups can't let someone register an organizer's email first. League data
-- (seasons, teams, players, fixtures, games, stats) is not touched.

-- ---------------------------------------------------------------------------
-- Organizers: bind to auth user id
-- ---------------------------------------------------------------------------

alter table admins add column if not exists user_id uuid references auth.users(id) on delete cascade;
update admins a set user_id = u.id
  from auth.users u
 where a.user_id is null and lower(u.email) = lower(a.email);
create unique index if not exists admins_user_id_key on admins (user_id);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Player accounts & profiles
-- ---------------------------------------------------------------------------

-- One login owns one player profile (and vice versa).
create table if not exists player_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique references players(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- One-time codes organizers hand out (e.g. on WhatsApp). Deleted when used.
create table if not exists claim_codes (
  player_id uuid primary key references players(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- What a player can edit about themselves. Stats stay organizer-only.
create table if not exists player_profiles (
  player_id uuid primary key references players(id) on delete cascade,
  photo_url text,
  bio text check (char_length(bio) <= 280),
  role text check (role in ('Fragger', 'Support', 'IGL', 'Sniper', 'Flex')),
  instagram text,
  youtube text,
  updated_at timestamptz not null default now()
);

create or replace function my_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select player_id from player_accounts where user_id = auth.uid();
$$;

create or replace function claim_profile(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from player_accounts where user_id = auth.uid()) then
    raise exception 'This account already owns a profile';
  end if;
  select player_id into v_player from claim_codes where upper(code) = upper(trim(p_code)) for update;
  if v_player is null then
    raise exception 'That code is not valid. Check it or ask an organizer for a new one';
  end if;
  if exists (select 1 from player_accounts where player_id = v_player) then
    raise exception 'This profile has already been claimed';
  end if;
  insert into player_accounts (user_id, player_id) values (auth.uid(), v_player);
  delete from claim_codes where player_id = v_player;
  return v_player;
end $$;

-- ---------------------------------------------------------------------------
-- Auction
-- ---------------------------------------------------------------------------

create table if not exists auctions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete set null,
  name text not null,
  status text not null default 'setup' check (status in ('setup', 'live', 'paused', 'completed')),
  registration_open boolean not null default true,
  purse int not null default 1000 check (purse > 0),
  base_price int not null default 50 check (base_price >= 0),
  min_buys int not null default 3 check (min_buys >= 0),
  max_buys int not null default 6 check (max_buys >= 1),
  -- Bid steps: below `upto` the step is `step`; the last entry (upto null) applies above.
  increments jsonb not null default '[{"upto": 200, "step": 10}, {"upto": 500, "step": 25}, {"upto": null, "step": 50}]',
  timer_seconds int not null default 30 check (timer_seconds between 5 and 600),
  -- After every bid at least this many seconds remain, so others can respond.
  bid_extend_seconds int not null default 15 check (bid_extend_seconds between 0 and 300),
  -- Final "3, 2, 1" countdown (announced) before a player is sold.
  countdown_seconds int not null default 3 check (countdown_seconds between 0 and 10),
  -- 0 = auctioneer draws each player manually.
  auto_next_seconds int not null default 0 check (auto_next_seconds between 0 and 120),
  voice_enabled boolean not null default true,
  current_lot_id uuid,
  paused_remaining_ms int,
  created_at timestamptz not null default now(),
  check (min_buys <= max_buys)
);

create table if not exists auction_teams (
  auction_id uuid not null references auctions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete restrict,
  captain_player_id uuid references players(id) on delete set null,
  sort_order int not null default 0,
  primary key (auction_id, team_id),
  unique (auction_id, captain_player_id)
);

create table if not exists auction_lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auctions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  set_name text not null default 'Pool',
  set_order int not null default 0,
  base_price int check (base_price >= 0),
  status text not null default 'pool' check (status in ('pool', 'live', 'sold', 'unsold')),
  round int not null default 1,
  draw_no int,
  current_bid int,
  current_team_id uuid references teams(id),
  ends_at timestamptz,
  sold_price int,
  sold_team_id uuid references teams(id),
  closed_at timestamptz,
  registered_by_player boolean not null default false,
  created_at timestamptz not null default now(),
  unique (auction_id, player_id)
);
create index if not exists auction_lots_auction_idx on auction_lots (auction_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'auctions_current_lot_fk') then
    alter table auctions
      add constraint auctions_current_lot_fk foreign key (current_lot_id) references auction_lots(id) on delete set null;
  end if;
end $$;

create table if not exists auction_bids (
  id bigint generated always as identity primary key,
  auction_id uuid not null references auctions(id) on delete cascade,
  lot_id uuid not null references auction_lots(id) on delete cascade,
  team_id uuid not null references teams(id),
  amount int not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists auction_bids_lot_idx on auction_bids (lot_id);

-- A captain's private "want list".
create table if not exists auction_shortlists (
  auction_id uuid not null references auctions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (auction_id, user_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Security: public read, organizer write; players edit only their own profile/shortlist.
-- Captain bids, registration and claims go through the functions below.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['player_accounts', 'player_profiles', 'auctions', 'auction_teams', 'auction_lots', 'auction_bids'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

alter table claim_codes enable row level security;
drop policy if exists "admin all" on claim_codes;
create policy "admin all" on claim_codes for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "owner write" on player_profiles;
create policy "owner write" on player_profiles for all to authenticated
  using (player_id = my_player_id()) with check (player_id = my_player_id());

alter table auction_shortlists enable row level security;
drop policy if exists "owner all" on auction_shortlists;
create policy "owner all" on auction_shortlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on player_accounts, player_profiles, auctions, auction_teams, auction_lots, auction_bids to anon, authenticated;
grant select, insert, update, delete on player_accounts, player_profiles, claim_codes, auctions, auction_teams,
  auction_lots, auction_bids, auction_shortlists to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Live updates for the auction room.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['auctions', 'auction_teams', 'auction_lots', 'auction_bids'] loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Auction functions
-- ---------------------------------------------------------------------------

create or replace function server_now() returns timestamptz language sql stable as $$ select now() $$;

-- Step for the next bid above p_amount.
create or replace function auction_step(p_increments jsonb, p_amount int) returns int
language sql immutable as $$
  select coalesce((
    select (e ->> 'step')::int
      from jsonb_array_elements(p_increments) e
     where e ->> 'upto' is null or p_amount < (e ->> 'upto')::int
     order by coalesce((e ->> 'upto')::int, 2147483647)
     limit 1
  ), 10);
$$;

-- Everything the auction room needs, in one consistent read (plus the server clock).
create or replace function auction_snapshot(p_auction_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'now', now(),
    'auction', (select to_jsonb(a) from auctions a where a.id = p_auction_id),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
               'team_id', t.team_id,
               'captain_player_id', t.captain_player_id,
               'sort_order', t.sort_order,
               'spent', coalesce((select sum(l.sold_price) from auction_lots l
                                   where l.auction_id = t.auction_id and l.sold_team_id = t.team_id and l.status = 'sold'), 0),
               'bought', (select count(*) from auction_lots l
                           where l.auction_id = t.auction_id and l.sold_team_id = t.team_id and l.status = 'sold'))
             order by t.sort_order)
        from auction_teams t where t.auction_id = p_auction_id), '[]'::jsonb),
    'lots', coalesce((select jsonb_agg(to_jsonb(l) order by l.set_order, l.created_at)
                        from auction_lots l where l.auction_id = p_auction_id), '[]'::jsonb),
    'bids', coalesce((select jsonb_agg(to_jsonb(b) order by b.id desc)
                        from (select * from auction_bids where auction_id = p_auction_id order by id desc limit 40) b), '[]'::jsonb)
  );
$$;

create or replace function auction_place_bid(p_lot_id uuid, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
  v_team uuid;
  v_spent int;
  v_bought int;
  v_min int;
  v_max int;
begin
  select * into lot from auction_lots where id = p_lot_id for update;
  if not found then
    raise exception 'Player not found';
  end if;
  select * into a from auctions where id = lot.auction_id;
  if a.status = 'paused' then
    raise exception 'The auction is paused';
  end if;
  if a.status <> 'live' or lot.status <> 'live' or a.current_lot_id is distinct from lot.id then
    raise exception 'Bidding for this player has closed';
  end if;
  if lot.ends_at is null or now() >= lot.ends_at then
    raise exception 'Too late, time ran out';
  end if;

  select t.team_id into v_team
    from auction_teams t join player_accounts pa on pa.player_id = t.captain_player_id
   where t.auction_id = a.id and pa.user_id = auth.uid();
  if v_team is null then
    raise exception 'Only team captains can bid';
  end if;
  if lot.current_team_id = v_team then
    raise exception 'You already have the highest bid';
  end if;

  v_min := case when lot.current_bid is null then coalesce(lot.base_price, a.base_price)
                else lot.current_bid + auction_step(a.increments, lot.current_bid) end;
  if p_amount < v_min then
    raise exception 'Bid must be at least %', v_min;
  end if;

  select coalesce(sum(sold_price), 0), count(*) into v_spent, v_bought
    from auction_lots where auction_id = a.id and sold_team_id = v_team and status = 'sold';
  if v_bought >= a.max_buys then
    raise exception 'Your squad is full';
  end if;
  -- Keep enough purse to fill the minimum squad at base price.
  v_max := a.purse - v_spent - greatest(a.min_buys - v_bought - 1, 0) * a.base_price;
  if p_amount > v_max then
    raise exception 'Not enough purse. Your max bid is %', v_max;
  end if;

  insert into auction_bids (auction_id, lot_id, team_id, amount, user_id)
  values (a.id, lot.id, v_team, p_amount, auth.uid());
  update auction_lots
     set current_bid = p_amount,
         current_team_id = v_team,
         ends_at = greatest(ends_at, now() + make_interval(secs => a.bid_extend_seconds))
   where id = lot.id;
end $$;

-- Closes the player on the block once the timer has run out (anyone may call; the first call wins).
-- Organizers can force: p_force = 'sell' (to the current highest bidder) or 'unsold'.
create or replace function auction_close_lot(p_lot_id uuid, p_force text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
begin
  if p_force is not null and not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into lot from auction_lots where id = p_lot_id for update;
  if not found or lot.status <> 'live' then
    return 'noop';
  end if;
  select * into a from auctions where id = lot.auction_id for update;
  if p_force is null and (a.status <> 'live' or lot.ends_at is null or now() < lot.ends_at) then
    return 'running';
  end if;

  if p_force = 'unsold' or lot.current_team_id is null then
    update auction_lots
       set status = 'unsold', current_bid = null, current_team_id = null, ends_at = null, closed_at = now()
     where id = lot.id;
    update auctions set current_lot_id = null, paused_remaining_ms = null,
                        status = case when status = 'paused' then 'live' else status end
     where id = a.id;
    return 'unsold';
  end if;

  update auction_lots
     set status = 'sold', sold_price = lot.current_bid, sold_team_id = lot.current_team_id,
         ends_at = null, closed_at = now()
   where id = lot.id;
  update auctions set current_lot_id = null, paused_remaining_ms = null,
                      status = case when status = 'paused' then 'live' else status end
   where id = a.id;
  return 'sold';
end $$;

-- Puts a random player from the pool on the block (lowest round, then set, then random).
create or replace function auction_draw_next(p_auction_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  v_lot uuid;
  v_draw int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'Auction not found';
  end if;
  if a.status = 'completed' then
    raise exception 'This auction is finished';
  end if;
  if a.current_lot_id is not null then
    raise exception 'Finish the current player first';
  end if;
  if (select count(*) from auction_teams where auction_id = a.id) < 2 then
    raise exception 'Add at least 2 teams first';
  end if;

  select id into v_lot from auction_lots
   where auction_id = a.id and status = 'pool'
   order by round, set_order, random()
   limit 1;
  if v_lot is null then
    return null;
  end if;

  select coalesce(max(draw_no), 0) + 1 into v_draw from auction_lots where auction_id = a.id;
  update auction_lots
     set status = 'live', draw_no = v_draw, current_bid = null, current_team_id = null,
         ends_at = now() + make_interval(secs => a.timer_seconds), closed_at = null
   where id = v_lot;
  update auctions set current_lot_id = v_lot, status = 'live', paused_remaining_ms = null where id = a.id;
  return v_lot;
end $$;

create or replace function auction_set_paused(p_auction_id uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  lot auction_lots%rowtype;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if a.current_lot_id is not null then
    select * into lot from auction_lots where id = a.current_lot_id for update;
  end if;

  if p_paused and a.status = 'live' then
    update auctions
       set status = 'paused',
           paused_remaining_ms = case when lot.ends_at is null then null
                                      else greatest(extract(epoch from (lot.ends_at - now())) * 1000, 0)::int end
     where id = a.id;
    if lot.id is not null then
      update auction_lots set ends_at = null where id = lot.id;
    end if;
  elsif not p_paused and a.status = 'paused' then
    if lot.id is not null then
      update auction_lots
         set ends_at = now() + make_interval(secs => greatest(coalesce(a.paused_remaining_ms, 0), 5000) / 1000.0)
       where id = lot.id;
    end if;
    update auctions set status = 'live', paused_remaining_ms = null where id = a.id;
  end if;
end $$;

-- Puts the most recently closed player back into the pool (fixes a mistaken sale).
create or replace function auction_undo_last(p_auction_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lot uuid;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  if (select current_lot_id from auctions where id = p_auction_id) is not null then
    raise exception 'Finish the current player first';
  end if;
  select id into v_lot from auction_lots
   where auction_id = p_auction_id and status in ('sold', 'unsold')
   order by closed_at desc nulls last
   limit 1;
  if v_lot is null then
    raise exception 'Nothing to undo';
  end if;
  delete from auction_bids where lot_id = v_lot;
  update auction_lots
     set status = 'pool', draw_no = null, current_bid = null, current_team_id = null, ends_at = null,
         sold_price = null, sold_team_id = null, closed_at = null
   where id = v_lot;
  return v_lot;
end $$;

-- Sends every unsold player back for another round, optionally at a new base price.
create or replace function auction_restart_unsold(p_auction_id uuid, p_base_price int default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  update auction_lots
     set status = 'pool', round = round + 1, base_price = coalesce(p_base_price, base_price),
         draw_no = null, current_bid = null, current_team_id = null, closed_at = null
   where auction_id = p_auction_id and status = 'unsold';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Writes the result into the target season: its teams, plus captain + bought players on each roster.
create or replace function auction_finalize(p_auction_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  v_count int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if a.season_id is null then
    raise exception 'Pick which season this auction is for first';
  end if;
  if a.current_lot_id is not null then
    raise exception 'Finish the current player first';
  end if;

  insert into season_teams (season_id, team_id)
  select a.season_id, team_id from auction_teams where auction_id = a.id
  on conflict do nothing;

  with signed as (
    select t.team_id, t.captain_player_id as player_id from auction_teams t
     where t.auction_id = a.id and t.captain_player_id is not null
    union
    select l.sold_team_id, l.player_id from auction_lots l
     where l.auction_id = a.id and l.status = 'sold'
  )
  insert into roster_entries (season_id, team_id, player_id, joined_on)
  select a.season_id, s.team_id, s.player_id, current_date
    from signed s
   where not exists (
     select 1 from roster_entries r
      where r.season_id = a.season_id and r.player_id = s.player_id and r.left_on is null
   );
  get diagnostics v_count = row_count;

  update auctions set status = 'completed', registration_open = false where id = a.id;
  return v_count;
end $$;

-- A claimed player joins (or leaves) the auction pool while registration is open.
create or replace function auction_register(p_auction_id uuid, p_join boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  v_player uuid := my_player_id();
begin
  if v_player is null then
    raise exception 'Claim your player profile first';
  end if;
  select * into a from auctions where id = p_auction_id;
  if not found then
    raise exception 'Auction not found';
  end if;
  if not a.registration_open or a.status = 'completed' then
    raise exception 'Registration is closed';
  end if;
  if exists (select 1 from auction_teams where auction_id = a.id and captain_player_id = v_player) then
    raise exception 'Captains are already on a team';
  end if;
  if p_join then
    insert into auction_lots (auction_id, player_id, registered_by_player)
    values (a.id, v_player, true)
    on conflict (auction_id, player_id) do nothing;
  else
    delete from auction_lots where auction_id = a.id and player_id = v_player and status = 'pool';
  end if;
end $$;

grant execute on function server_now(), auction_step(jsonb, int), auction_snapshot(uuid),
  auction_close_lot(uuid, text) to anon, authenticated;
grant execute on function my_player_id(), claim_profile(text), auction_place_bid(uuid, int),
  auction_draw_next(uuid), auction_set_paused(uuid, boolean), auction_undo_last(uuid),
  auction_restart_unsold(uuid, int), auction_finalize(uuid), auction_register(uuid, boolean) to authenticated;
