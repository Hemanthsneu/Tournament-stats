-- Player photo uploads: a public "avatars" bucket where each claimed player can only write inside a
-- folder named after their own player id. Organizers can manage every photo. Additive only.

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute 'drop policy if exists "avatars: players write own folder" on storage.objects';
  execute $p$
    create policy "avatars: players write own folder" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_player_id()::text)
  $p$;

  execute 'drop policy if exists "avatars: players manage own files" on storage.objects';
  execute $p$
    create policy "avatars: players manage own files" on storage.objects for all to authenticated
    using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.my_player_id()::text or public.is_admin()))
    with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.my_player_id()::text or public.is_admin()))
  $p$;
end $$;
