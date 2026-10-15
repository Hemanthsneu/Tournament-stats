-- Playoff formats per season (top 4 IPL style, top 4 semi-finals, top 3, top 2, none).
-- Additive: existing seasons get 'ipl4', the format Season 1 already uses, and the fixture stage
-- list only grows (two semi-final stages), so every existing row stays valid.
alter table seasons add column if not exists playoff_format text not null default 'ipl4';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'seasons_playoff_format_check') then
    alter table seasons add constraint seasons_playoff_format_check
      check (playoff_format in ('ipl4', 'semis4', 'top3', 'final2', 'none'));
  end if;
end $$;

alter table fixtures drop constraint if exists fixtures_stage_check;
alter table fixtures add constraint fixtures_stage_check
  check (stage in ('league', 'qualifier_1', 'semi_final_1', 'semi_final_2', 'eliminator', 'qualifier_2', 'final', 'practice'));
