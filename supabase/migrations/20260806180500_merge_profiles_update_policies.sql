-- Duas policies permissivas de UPDATE para o mesmo role são avaliadas em toda query.
-- Uma única policy cobre os dois casos (dono ou admin).
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id or private.is_admin())
  with check ((select auth.uid()) = id or private.is_admin());
