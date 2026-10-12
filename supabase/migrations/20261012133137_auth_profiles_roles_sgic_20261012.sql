-- SGIC: perfiles bloqueados por defecto y auditoría de cambios de permisos.
-- La activación ADMIN se realiza solo desde SQL Editor autorizado; jamás desde el frontend.
begin;

alter table public.perfil alter column activo set default false;

create schema if not exists sgic_private;
revoke all on schema sgic_private from public, anon, authenticated;

create function sgic_private.crear_perfil_auth()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfil (id, nombre, rol, activo)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Usuario'), 'OPERADOR', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function sgic_private.crear_perfil_auth() from public, anon, authenticated;
create trigger sgic_auth_user_created
after insert on auth.users
for each row execute function sgic_private.crear_perfil_auth();

-- Rescata usuarios Auth existentes sin otorgarles acceso automáticamente.
insert into public.perfil (id, nombre, rol, activo)
select u.id, coalesce(nullif(split_part(u.email, '@', 1), ''), 'Usuario'), 'OPERADOR', false
from auth.users u
on conflict (id) do nothing;

create function sgic_private.auditar_cambio_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.rol is distinct from new.rol or old.activo is distinct from new.activo then
    insert into public.registro_auditoria
      (usuario_id, accion, modelo, datos_anteriores, datos_nuevos, motivo)
    values
      (auth.uid(), 'PERMISOS', 'perfil',
       jsonb_build_object('id', old.id, 'rol', old.rol, 'activo', old.activo),
       jsonb_build_object('id', new.id, 'rol', new.rol, 'activo', new.activo),
       'Cambio administrativo de autorización');
  end if;
  return new;
end;
$$;

revoke all on function sgic_private.auditar_cambio_perfil() from public, anon, authenticated;
create trigger sgic_audit_perfil
after update of rol, activo on public.perfil
for each row execute function sgic_private.auditar_cambio_perfil();

-- El cliente únicamente lee su propio perfil por la política de la migración anterior.
-- No existen GRANT de escritura ni RPC para autoasignarse ADMIN/activo.
commit;
