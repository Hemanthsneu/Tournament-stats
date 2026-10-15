-- Per-team budgets: each captain's purse can differ. NULL = the auction's default purse.
-- Additive: existing teams keep NULL, so nothing changes until an organizer sets a budget.
alter table auction_teams add column if not exists purse int check (purse is null or purse > 0);

-- Snapshot now includes each team's purse.
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
               'purse', coalesce(t.purse, (select au.purse from auctions au where au.id = t.auction_id)),
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

-- Bids are checked against the bidding team's own purse.
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
