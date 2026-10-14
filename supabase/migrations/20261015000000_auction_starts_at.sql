-- When the auction is planned to start, shown to players as a countdown. Additive only.
alter table auctions add column if not exists starts_at timestamptz;
