-- Optional team colour (hex), chosen by organizers. Additive: existing rows keep NULL and get a
-- distinct default colour in the app.
alter table teams add column if not exists color text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teams_color_hex') then
    alter table teams add constraint teams_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;
