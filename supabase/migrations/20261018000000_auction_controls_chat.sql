-- Auction controls (reopen a finished auction, restart or re-auction one player), bids that can't
-- stack when two captains tap together, and a chat for the audience. Additive: new columns, new
-- functions and one new table; existing rows are untouched.

-- ---------------------------------------------------------------------------
-- Rosters remember which auction wrote them, so a finished auction can be reopened.
-- ---------------------------------------------------------------------------
alter table roster_entries add column if not exists auction_id uuid references auctions(id) on delete set null;

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
  if a.is_practice then
    raise exception 'This is a practice auction, so it can''t create rosters. Restart or delete it instead';
  end if;
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
  insert into roster_entries (season_id, team_id, player_id, joined_on, auction_id)
  select a.season_id, s.team_id, s.player_id, current_date, a.id
    from signed s
   where not exists (
     select 1 from roster_entries r
      where r.season_id = a.season_id and r.player_id = s.player_id and r.left_on is null
   );
  get diagnostics v_count = row_count;

  update auctions set status = 'completed', registration_open = false where id = a.id;
  return v_count;
end $$;

-- Reopens a finished auction: takes back the roster entries it wrote (captains + buys) and returns it
-- to "starting soon". Results stay, so organizers can re-auction some players or restart from scratch,
-- then finish again. Returns how many roster entries were removed.
create or replace function auction_reopen(p_auction_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
  v_count int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'Auction not found';
  end if;
  if a.status <> 'completed' then
    raise exception 'This auction isn''t finished';
  end if;

  with signed as (
    select t.team_id, t.captain_player_id as player_id from auction_teams t
     where t.auction_id = a.id and t.captain_player_id is not null
    union
    select l.sold_team_id, l.player_id from auction_lots l
     where l.auction_id = a.id and l.status = 'sold'
  )
  delete from roster_entries r
   where r.auction_id = a.id
      or (r.auction_id is null                       -- finished before rosters were tagged
          and r.season_id = a.season_id
          and r.joined_on >= a.created_at::date
          and exists (select 1 from signed s where s.team_id = r.team_id and s.player_id = r.player_id));
  get diagnostics v_count = row_count;

  update auctions set status = 'setup', current_lot_id = null, paused_remaining_ms = null where id = a.id;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- One player at a time
-- ---------------------------------------------------------------------------

-- Restarts bidding on the player on the block: their bids are cleared and the timer starts again
-- (or waits, if the auction is paused).
create or replace function auction_restart_lot(p_lot_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
  v_draw int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into lot from auction_lots where id = p_lot_id for update;
  if not found then
    raise exception 'Player not found';
  end if;
  select * into a from auctions where id = lot.auction_id for update;
  if lot.status <> 'live' or a.current_lot_id is distinct from lot.id then
    raise exception 'That player isn''t on the block';
  end if;
  delete from auction_bids where lot_id = lot.id;
  select coalesce(max(draw_no), 0) + 1 into v_draw from auction_lots where auction_id = a.id;
  update auction_lots
     set current_bid = null, current_team_id = null, draw_no = v_draw,
         ends_at = case when a.status = 'live' then now() + make_interval(secs => a.timer_seconds) end
   where id = lot.id;
  if a.status = 'paused' then
    update auctions set paused_remaining_ms = a.timer_seconds * 1000 where id = a.id;
  end if;
end $$;

-- Sends one player back into the pool: the one on the block, or a sold/unsold result. Their bids are
-- cleared; everyone else's results stay.
create or replace function auction_return_lot(p_lot_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into lot from auction_lots where id = p_lot_id for update;
  if not found then
    raise exception 'Player not found';
  end if;
  select * into a from auctions where id = lot.auction_id for update;
  if a.status = 'completed' then
    raise exception 'This auction is finished. Reopen it first';
  end if;
  if lot.status = 'pool' then
    return;
  end if;
  delete from auction_bids where lot_id = lot.id;
  update auction_lots
     set status = 'pool', draw_no = null, current_bid = null, current_team_id = null, ends_at = null,
         sold_price = null, sold_team_id = null, closed_at = null
   where id = lot.id;
  if a.current_lot_id = lot.id then
    update auctions
       set current_lot_id = null, paused_remaining_ms = null,
           status = case when status = 'paused' then 'live' else status end
     where id = a.id;
  end if;
end $$;

-- Puts a chosen player on the block now (from the pool, or re-auctions a sold/unsold player).
create or replace function auction_redraw_lot(p_lot_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
  v_draw int;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into lot from auction_lots where id = p_lot_id for update;
  if not found then
    raise exception 'Player not found';
  end if;
  select * into a from auctions where id = lot.auction_id for update;
  if a.status = 'completed' then
    raise exception 'This auction is finished. Reopen it first';
  end if;
  if a.current_lot_id is not null then
    raise exception 'Finish the current player first';
  end if;
  if (select count(*) from auction_teams where auction_id = a.id) < 2 then
    raise exception 'Add at least 2 teams first';
  end if;
  delete from auction_bids where lot_id = lot.id;
  select coalesce(max(draw_no), 0) + 1 into v_draw from auction_lots where auction_id = a.id;
  update auction_lots
     set status = 'live', draw_no = v_draw, current_bid = null, current_team_id = null,
         sold_price = null, sold_team_id = null, closed_at = null,
         ends_at = now() + make_interval(secs => a.timer_seconds)
   where id = lot.id;
  update auctions set current_lot_id = lot.id, status = 'live', paused_remaining_ms = null where id = a.id;
end $$;

-- ---------------------------------------------------------------------------
-- Bids: checked against the price the captain saw
-- ---------------------------------------------------------------------------
drop function if exists auction_place_bid(uuid, int);
create or replace function auction_place_bid(p_lot_id uuid, p_amount int, p_seen_bid int default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  lot auction_lots%rowtype;
  a auctions%rowtype;
  v_team uuid;
  v_spent int;
  v_bought int;
  v_min int;
  v_max int;
  v_purse int;
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

  select t.team_id, coalesce(t.purse, a.purse) into v_team, v_purse
    from auction_teams t join player_accounts pa on pa.player_id = t.captain_player_id
   where t.auction_id = a.id and pa.user_id = auth.uid();
  if v_team is null then
    raise exception 'Only team captains can bid';
  end if;
  if lot.current_team_id = v_team then
    raise exception 'You already have the highest bid';
  end if;
  -- The bid must be based on the price the captain was looking at (-1 = no bid yet). Two taps landing
  -- together can then never stack into a jump the second captain didn't choose.
  if p_seen_bid is not null and coalesce(lot.current_bid, -1) <> p_seen_bid then
    raise exception 'Price changed: % now leads at %',
      coalesce((select name from teams where id = lot.current_team_id), 'another team'), lot.current_bid;
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
  v_max := v_purse - v_spent - greatest(a.min_buys - v_bought - 1, 0) * a.base_price;
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

-- ---------------------------------------------------------------------------
-- Audience chat
-- ---------------------------------------------------------------------------
alter table auctions add column if not exists chat_enabled boolean not null default true;

create table if not exists auction_messages (
  id bigint generated always as identity primary key,
  auction_id uuid not null references auctions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author text not null check (char_length(author) between 1 and 40),
  role text not null default 'fan' check (role in ('fan', 'player', 'captain', 'organizer')),
  team_id uuid references teams(id) on delete set null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists auction_messages_auction on auction_messages (auction_id, id desc);

alter table auction_messages enable row level security;
drop policy if exists "public read" on auction_messages;
create policy "public read" on auction_messages for select using (true);
drop policy if exists "admin delete" on auction_messages;
create policy "admin delete" on auction_messages for delete to authenticated using (is_admin());
grant select on auction_messages to anon, authenticated;
grant delete on auction_messages to authenticated;
grant all on auction_messages to service_role;

-- Signed-in viewers post through this (no direct inserts): it fills in their name and role, keeps
-- messages short and slows down anyone posting more than once every 2 seconds.
create or replace function auction_send_message(p_auction_id uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_player uuid;
  v_name text;
  v_role text := 'fan';
  v_team uuid;
  v_chat boolean;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Sign in to chat';
  end if;
  select chat_enabled into v_chat from auctions where id = p_auction_id;
  if not found then
    raise exception 'Auction not found';
  end if;
  if not v_chat then
    raise exception 'Chat is off for this auction';
  end if;
  if char_length(v_body) = 0 then
    raise exception 'Type a message first';
  end if;
  if char_length(v_body) > 200 then
    raise exception 'Keep it under 200 characters';
  end if;
  if exists (select 1 from auction_messages where user_id = v_uid and created_at > now() - interval '2 seconds') then
    raise exception 'Slow down a little';
  end if;

  select pa.player_id into v_player from player_accounts pa where pa.user_id = v_uid;
  if v_player is not null then
    select ign into v_name from players where id = v_player;
    select team_id into v_team from auction_teams where auction_id = p_auction_id and captain_player_id = v_player;
    v_role := case when v_team is not null then 'captain' else 'player' end;
  end if;
  if is_admin() then
    v_role := 'organizer';
    v_name := coalesce(v_name, 'Organizer');
  end if;

  insert into auction_messages (auction_id, user_id, author, role, team_id, body)
  values (p_auction_id, v_uid, left(coalesce(v_name, 'Fan'), 40), v_role, v_team, v_body)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function auction_reopen(uuid), auction_restart_lot(uuid), auction_return_lot(uuid),
  auction_redraw_lot(uuid), auction_place_bid(uuid, int, int), auction_send_message(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table auction_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
