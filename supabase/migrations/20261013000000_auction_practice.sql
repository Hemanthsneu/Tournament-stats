-- Practice auctions + stop/restart controls. Only touches the Season 2 auction tables.

alter table auctions add column if not exists is_practice boolean not null default false;

-- Ends the live session without finishing: the player on the block goes back to the pool (their bids
-- are dropped), results so far are kept, and the auction returns to "starting soon".
create or replace function auction_stop(p_auction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'Auction not found';
  end if;
  if a.status = 'completed' then
    raise exception 'This auction is already finished';
  end if;
  if a.current_lot_id is not null then
    delete from auction_bids where lot_id = a.current_lot_id;
    update auction_lots
       set status = 'pool', draw_no = null, current_bid = null, current_team_id = null, ends_at = null
     where id = a.current_lot_id;
  end if;
  update auctions set status = 'setup', current_lot_id = null, paused_remaining_ms = null where id = a.id;
end $$;

-- Starts over: every player back in the pool, all bids deleted. A finished real auction can't be
-- restarted (its rosters were already written); practice auctions always can.
create or replace function auction_reset(p_auction_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only organizers can do that';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'Auction not found';
  end if;
  if a.status = 'completed' and not a.is_practice then
    raise exception 'This auction is finished and already written to the season rosters';
  end if;
  update auctions set status = 'setup', current_lot_id = null, paused_remaining_ms = null where id = a.id;
  delete from auction_bids where auction_id = a.id;
  update auction_lots
     set status = 'pool', round = 1, draw_no = null, current_bid = null, current_team_id = null,
         ends_at = null, sold_price = null, sold_team_id = null, closed_at = null
   where auction_id = a.id;
end $$;

-- Same as before, but practice auctions never write rosters.
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

-- Players can't register into a practice copy.
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
  if a.is_practice or not a.registration_open or a.status = 'completed' then
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

grant execute on function auction_stop(uuid), auction_reset(uuid) to authenticated;
