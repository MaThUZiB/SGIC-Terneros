-- SGIC-Terneros / base de operaciones autorizadas.
-- SECURITY DEFINER se utiliza solo en RPC con autorización explícita y GRANT limitado.
begin;
create or replace function sgic_private.actor(p_admin boolean default false)
returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.perfil p join auth.users u on u.id=p.id
    where p.id=v_actor and p.activo=true and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and (not p_admin or p.rol='ADMIN')
  ) then
    raise exception 'Acceso no autorizado o perfil inactivo' using errcode='42501';
  end if;
  return v_actor;
end;
$fn$;
revoke all on function sgic_private.actor(boolean) from public,anon,authenticated;

create or replace function sgic_private.audit(p_actor uuid,p_action text,p_model text,p_id bigint,p_new jsonb)
returns void language plpgsql security invoker set search_path=''
as $fn$
begin
  insert into public.registro_auditoria(usuario_id,accion,modelo,objeto_id,datos_nuevos)
  values(p_actor,p_action,p_model,p_id,p_new);
end;
$fn$;
revoke all on function sgic_private.audit(uuid,text,text,bigint,jsonb) from public,anon,authenticated;

create or replace function public.sgic_catalogo(p_tipo text,p_nombre text,p_opciones jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_id bigint; v_title text := trim(p_nombre);
begin
  a := sgic_private.actor(true);
  if length(v_title)<2 or length(v_title)>120 then raise exception 'Nombre inválido'; end if;
  case p_tipo
    when 'raza' then insert into public.raza(nombre) values(v_title) returning id into v_id;
    when 'proveedor' then insert into public.proveedor(nombre,rut,telefono,email,direccion)
      values(v_title,nullif(trim(p_opciones->>'rut'),''),nullif(trim(p_opciones->>'telefono'),''),
             nullif(trim(p_opciones->>'email'),''),nullif(trim(p_opciones->>'direccion'),''))
      returning id into v_id;
    when 'categoria_producto' then
      insert into public.categoria_producto(nombre) values(v_title) returning id into v_id;
    when 'categoria_gasto' then
      insert into public.categoria_gasto(nombre) values(v_title) returning id into v_id;
    when 'unidad_medida' then
      if nullif(trim(p_opciones->>'codigo'),'') is null or nullif(trim(p_opciones->>'tipo'),'') is null then
        raise exception 'Indique código y tipo de unidad';
      end if;
      insert into public.unidad_medida(nombre,codigo,tipo,decimales)
      values(v_title,trim(p_opciones->>'codigo'),trim(p_opciones->>'tipo'),2) returning id into v_id;
    when 'producto' then
      insert into public.producto(nombre,categoria_id,unidad_base_id,stock_minimo)
      values(v_title,(p_opciones->>'categoria_id')::bigint,(p_opciones->>'unidad_base_id')::bigint,
        coalesce((p_opciones->>'stock_minimo')::numeric,0)) returning id into v_id;
    when 'plan_consumo' then
      insert into public.plan_consumo(nombre,descripcion)
      values(v_title,nullif(trim(p_opciones->>'descripcion'),'')) returning id into v_id;
    when 'lote' then
      insert into public.lote(codigo,fecha_ingreso,cantidad_original,cantidad_actual)
      values(v_title,coalesce((p_opciones->>'fecha_ingreso')::date,current_date),0,0) returning id into v_id;
    else raise exception 'Catálogo no permitido';
  end case;
  perform sgic_private.audit(a,'CREAR',p_tipo,v_id,jsonb_build_object('nombre',v_title));
  return v_id;
end;
$fn$;
revoke all on function public.sgic_catalogo(text,text,jsonb) from public,anon;
grant execute on function public.sgic_catalogo(text,text,jsonb) to authenticated;

create or replace function public.sgic_registrar_compra_animales(
  p_lote_codigo text,p_proveedor_id bigint,p_animales jsonb,p_fecha date default current_date,p_lote_id bigint default null
) returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_lote bigint; v_compra bigint; v_animal bigint; item jsonb; total numeric(12,2):=0; n integer:=0;
  precio numeric(12,2); peso numeric(8,2);
begin
  a := sgic_private.actor(true);
  if jsonb_typeof(p_animales)<>'array' or jsonb_array_length(p_animales)=0 or jsonb_array_length(p_animales)>200 then
    raise exception 'Incluya entre 1 y 200 animales'; end if;
  if p_lote_id is null then
    if nullif(trim(p_lote_codigo),'') is null then raise exception 'Indique código de lote nuevo'; end if;
    insert into public.lote(codigo,fecha_ingreso,cantidad_original,cantidad_actual)
    values(trim(p_lote_codigo),p_fecha,0,0) returning id into v_lote;
  else
    select id into v_lote from public.lote where id=p_lote_id and estado='ACTIVO' for update;
    if v_lote is null then raise exception 'Lote existente no disponible'; end if;
  end if;
  if p_proveedor_id is not null and not exists(select 1 from public.proveedor where id=p_proveedor_id and activo) then
    raise exception 'Proveedor inválido';
  end if;
  insert into public.compra_animal(fecha,proveedor_id,total) values(p_fecha,p_proveedor_id,0) returning id into v_compra;
  for item in select value from jsonb_array_elements(p_animales) loop
    precio := (item->>'precio_adquisicion')::numeric;
    peso := nullif(item->>'peso_ingreso_kg','')::numeric;
    if nullif(trim(item->>'diio'),'') is null or precio is null or precio<0 or
       not exists(select 1 from public.raza where id=(item->>'raza_id')::bigint) then
      raise exception 'Animal sin DIIO, raza o precio válido'; end if;
    insert into public.animal(diio,lote_id,raza_id,sexo,edad_aproximada_dias,fecha_adquisicion,precio_adquisicion,peso_ingreso_kg)
    values(trim(item->>'diio'),v_lote,(item->>'raza_id')::bigint,
      coalesce(nullif(item->>'sexo',''),'MACHO'),coalesce((item->>'edad_aproximada_dias')::integer,0),
      p_fecha,precio,peso) returning id into v_animal;
    insert into public.detalle_compra_animal(compra_id,animal_id,precio_adquisicion,peso_compra)
    values(v_compra,v_animal,precio,peso);
    total:=total+precio; n:=n+1;
  end loop;
  update public.compra_animal set total=total where id=v_compra;
  update public.lote set cantidad_original=cantidad_original+n,cantidad_actual=cantidad_actual+n where id=v_lote;
  perform sgic_private.audit(a,'CREAR','compra_animal',v_compra,
    jsonb_build_object('lote_id',v_lote,'animales',n,'total',total));
  return v_compra;
end;
$fn$;
revoke all on function public.sgic_registrar_compra_animales(text,bigint,jsonb,date,bigint) from public,anon;
grant execute on function public.sgic_registrar_compra_animales(text,bigint,jsonb,date,bigint) to authenticated;

create or replace function public.sgic_registrar_peso(p_animal_id bigint,p_peso numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint;
begin
  a:=sgic_private.actor();
  if p_peso is null or p_peso<=0 or not exists(select 1 from public.animal where id=p_animal_id and estado='ACTIVO') then
    raise exception 'Animal activo y peso positivo requeridos'; end if;
  insert into public.peso_animal(animal_id,peso_kg,fecha)
  values(p_animal_id,p_peso,p_fecha) returning id into r;
  perform sgic_private.audit(a,'CREAR','peso_animal',r,jsonb_build_object('animal_id',p_animal_id,'peso_kg',p_peso));
  return r;
end;
$fn$;
revoke all on function public.sgic_registrar_peso(bigint,numeric,date) from public,anon;
grant execute on function public.sgic_registrar_peso(bigint,numeric,date) to authenticated;

create or replace function public.sgic_fallecimiento(p_animal_id bigint,p_motivo text)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_lote bigint;
begin
  a:=sgic_private.actor(true);
  if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Indique motivo del fallecimiento'; end if;
  select lote_id into v_lote from public.animal where id=p_animal_id and estado='ACTIVO';
  if v_lote is null then raise exception 'Animal no disponible'; end if;
  perform 1 from public.lote where id=v_lote for update;
  update public.animal set estado='FALLECIDO',observaciones=concat_ws(E'\n',observaciones,'Fallecido: '||p_motivo)
  where id=p_animal_id and estado='ACTIVO';
  if not found then raise exception 'El animal ya no está activo'; end if;
  update public.lote set cantidad_actual=cantidad_actual-1 where id=v_lote;
  update public.lote set estado='CERRADO' where id=v_lote and cantidad_actual=0;
  perform sgic_private.audit(a,'FALLECER','animal',p_animal_id,jsonb_build_object('motivo',p_motivo));
  return true;
end;
$fn$;
revoke all on function public.sgic_fallecimiento(bigint,text) from public,anon;
grant execute on function public.sgic_fallecimiento(bigint,text) to authenticated;

create or replace function public.sgic_dividir_lote(p_lote_id bigint,p_codigo text,p_animales bigint[])
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_n integer; v_lote bigint; v_codigo text; v_nuevo bigint;
begin
  a:=sgic_private.actor(true);
  v_n:=coalesce(array_length(p_animales,1),0);
  if v_n=0 or v_n>200 then raise exception 'Seleccione animales activos'; end if;
  select id,codigo into v_lote,v_codigo from public.lote where id=p_lote_id and estado='ACTIVO' for update;
  if v_lote is null then raise exception 'Lote no activo'; end if;
  if (select count(distinct x) from unnest(p_animales) x)<>v_n or
     (select count(*) from public.animal where id=any(p_animales) and lote_id=p_lote_id and estado='ACTIVO')<>v_n
  then raise exception 'Selección de animales inválida'; end if;
  -- Bloquear divisiones cuando existen costos compartidos o ventas previas:
  -- requieren una política explícita de reasignación histórica.
  if exists(select 1 from public.consumo where lote_id=p_lote_id)
     or exists(select 1 from public.gasto where lote_id=p_lote_id)
     or exists(select 1 from public.tratamiento t join public.animal an on an.id=t.animal_id where an.lote_id=p_lote_id)
     or exists(select 1 from public.detalle_venta where lote_id=p_lote_id)
  then raise exception 'Lote con costos o ventas históricos: división no permitida sin reasignación'; end if;
  insert into public.lote(codigo,lote_origen_id,fecha_ingreso,cantidad_original,cantidad_actual)
  values(trim(p_codigo),p_lote_id,current_date,v_n,v_n) returning id into v_nuevo;
  update public.animal set lote_id=v_nuevo where id=any(p_animales) and lote_id=p_lote_id and estado='ACTIVO';
  update public.lote set cantidad_actual=cantidad_actual-v_n where id=p_lote_id;
  update public.lote set estado='CERRADO' where id=p_lote_id and cantidad_actual=0;
  perform sgic_private.audit(a,'DIVIDIR','lote',p_lote_id,jsonb_build_object('derivado',v_nuevo,'cantidad',v_n));
  return v_nuevo;
end;
$fn$;
revoke all on function public.sgic_dividir_lote(bigint,text,bigint[]) from public,anon;
grant execute on function public.sgic_dividir_lote(bigint,text,bigint[]) to authenticated;
commit;