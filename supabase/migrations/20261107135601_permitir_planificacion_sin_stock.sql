-- Planificar alimentación futura sin depender del stock actual.
-- El registro PLANIFICADO nunca descuenta existencias ni se registra como costo real.
-- Se admite un registro real posterior para las mismas fechas: plan y ejecución son independientes.
alter table public.periodo_alimentacion
  drop constraint periodo_alimentacion_estado_check,
  add constraint periodo_alimentacion_estado_check
    check (estado in ('PLANIFICADO','ESTIMADO','DESCONTADO'));
alter table public.periodo_alimentacion
  drop constraint periodo_alimentacion_estado_consumo,
  add constraint periodo_alimentacion_estado_consumo
    check ((estado in ('PLANIFICADO','ESTIMADO') and consumo_id is null)
       or (estado='DESCONTADO' and consumo_id is not null));

create or replace function public.sgic_registrar_periodo_alimentacion(p jsonb)
returns bigint language plpgsql security definer set search_path='' as $fn$
declare
  actor uuid:=sgic_private.actor();
  solicitud_id uuid;
  v_lote bigint;
  inicial date;
  final date;
  actual date:=(now() at time zone 'America/Santiago')::date;
  descontar boolean;
  nota text;
  r bigint;
  consumo_registro bigint;
  detalle record;
  producto record;
  costo numeric;
  total_items integer;
  suministros_dia integer;
  dias_periodo integer;
  v_pauta_id bigint;
  tipo_registro text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Datos inválidos'; end if;
  solicitud_id:=(p->>'solicitud')::uuid;
  v_lote:=(p->>'lote_id')::bigint;
  inicial:=(p->>'fecha_inicio')::date;
  final:=(p->>'fecha_fin')::date;
  descontar:=coalesce((p->>'descontar_stock')::boolean,false);
  nota:=nullif(left(trim(coalesce(p->>'observaciones','')),500),'');
  suministros_dia:=coalesce((p->>'suministros_dia')::integer,2);
  v_pauta_id:=nullif(p->>'pauta_id','')::bigint;
  tipo_registro:=coalesce(nullif(p->>'tipo_registro',''),case when descontar then 'DESCONTADO' when final>actual then 'PLANIFICADO' else 'ESTIMADO' end);
  if solicitud_id is null or v_lote is null or inicial is null or final is null then
    raise exception 'Lote, fechas e identificador son obligatorios';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(solicitud_id::text,0));
  select id into r from public.periodo_alimentacion where solicitud=solicitud_id;
  if found then return r; end if;
  if inicial>final or final-inicial>365 then
    raise exception 'El período debe tener fechas válidas y durar como máximo 366 días';
  end if;
  if tipo_registro not in ('PLANIFICADO','ESTIMADO','DESCONTADO')
     or (tipo_registro='DESCONTADO') is distinct from descontar then
    raise exception 'Modo de alimentación incompatible con el descuento de stock';
  end if;
  if tipo_registro<>'PLANIFICADO' and final>actual then
    raise exception 'Para fechas futuras usa Planificación; los consumos reales e históricos no pueden terminar en el futuro';
  end if;
  dias_periodo:=final-inicial+1;
  if suministros_dia<1 or suministros_dia>6 then raise exception 'Los suministros diarios deben estar entre 1 y 6'; end if;
  if v_pauta_id is not null and not exists(select 1 from public.pauta_alimentacion where id=v_pauta_id and activo=true) then
    raise exception 'La pauta elegida no está disponible';
  end if;
  perform 1 from public.lote where id=v_lote for update;
  if not found then raise exception 'Lote inexistente'; end if;
  if exists (
    select 1 from public.periodo_alimentacion x
    where x.lote_id=v_lote and x.fecha_inicio<=final and x.fecha_fin>=inicial
      and (x.estado='PLANIFICADO')=(tipo_registro='PLANIFICADO')
  ) then raise exception 'El lote ya tiene un período del mismo tipo que se superpone con estas fechas'; end if;
  -- No volver a cargar como período las jornadas que ya se descontaron manualmente.
  if tipo_registro<>'PLANIFICADO' and exists (
    select 1 from public.consumo c
    where c.lote_id=v_lote and c.fecha between inicial and final and c.origen in ('REAL','PLAN')
  ) then raise exception 'Ya existen consumos reales en estas fechas; revisa el historial antes de registrar un período'; end if;
  if jsonb_typeof(p->'detalles') is distinct from 'array' then
    raise exception 'Debes agregar insumos al período';
  end if;
  total_items:=jsonb_array_length(p->'detalles');
  if total_items<1 or total_items>20 then raise exception 'Agrega de 1 a 20 insumos'; end if;
  if (select count(distinct (value->>'producto_id')::bigint) from jsonb_array_elements(p->'detalles'))
    <> total_items then raise exception 'No repitas un insumo en el mismo período'; end if;
  -- Validar todos los renglones y bloquear existencias ANTES de registrar el período.
  for detalle in
    select (value->>'producto_id')::bigint as producto_id,
           nullif(value->>'cantidad_por_suministro','')::numeric as cantidad_por_suministro,
           case when value ? 'cantidad_por_suministro'
             then (value->>'cantidad_por_suministro')::numeric*suministros_dia*dias_periodo
             else (value->>'cantidad')::numeric end as cantidad
    from pg_catalog.jsonb_array_elements(p->'detalles')
    order by 1
  loop
    if detalle.producto_id is null or detalle.cantidad is null or
       detalle.cantidad<=0 or detalle.cantidad<>round(detalle.cantidad,3)
       or (detalle.cantidad_por_suministro is not null and
          (detalle.cantidad_por_suministro<=0 or detalle.cantidad_por_suministro<>round(detalle.cantidad_por_suministro,3))) then
      raise exception 'La cantidad por suministro y el total deben ser positivos, con máximo tres decimales';
    end if;
    select id,unidad_base_id,stock_actual,costo_promedio,activo,tipo_insumo,nombre
      into producto from public.producto where id=detalle.producto_id for update;
    if not found or not producto.activo or producto.tipo_insumo not in ('LECHE','CONCENTRADO') then
      raise exception 'Selecciona solo insumos activos de leche o concentrado';
    end if;
    if descontar and producto.stock_actual<detalle.cantidad then
      raise exception 'Stock insuficiente para %: disponible %, solicitado %',
        producto.nombre,producto.stock_actual,detalle.cantidad;
    end if;
  end loop;
  if descontar then
    insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones)
    values(v_lote,final,'REAL',actor,'Consumo aproximado consolidado por período')
    returning id into consumo_registro;
  end if;
  insert into public.periodo_alimentacion(solicitud,lote_id,fecha_inicio,fecha_fin,estado,observaciones,consumo_id,usuario_id,suministros_dia,pauta_id)
  values(solicitud_id,v_lote,inicial,final,tipo_registro,
     nota,consumo_registro,actor,suministros_dia,v_pauta_id) returning id into r;
  if consumo_registro is not null then
    update public.consumo set observaciones='PERIODO_ALIMENTACION:'||r||'|APROXIMADO' where id=consumo_registro;
  end if;
  for detalle in
    select (value->>'producto_id')::bigint as producto_id,
           nullif(value->>'cantidad_por_suministro','')::numeric as cantidad_por_suministro,
           case when value ? 'cantidad_por_suministro'
             then (value->>'cantidad_por_suministro')::numeric*suministros_dia*dias_periodo
             else (value->>'cantidad')::numeric end as cantidad
    from pg_catalog.jsonb_array_elements(p->'detalles')
    order by 1
  loop
    select unidad_base_id,costo_promedio into producto
      from public.producto where id=detalle.producto_id for update;
    costo:=round(detalle.cantidad*producto.costo_promedio,2);
    if descontar then
      costo:=sgic_private.stock_salida(detalle.producto_id,detalle.cantidad,actor,'CONSUMO_PERIODO',consumo_registro);
      insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total)
      values(consumo_registro,detalle.producto_id,detalle.cantidad,producto.unidad_base_id,producto.costo_promedio,costo);
    end if;
    insert into public.detalle_periodo_alimentacion(periodo_id,producto_id,cantidad_total,unidad_id,costo_referencia,cantidad_por_suministro)
    values(r,detalle.producto_id,detalle.cantidad,producto.unidad_base_id,costo,detalle.cantidad_por_suministro);
  end loop;
  perform sgic_private.audit(actor,'CREAR','periodo_alimentacion',r,
    jsonb_build_object('lote_id',v_lote,'fecha_inicio',inicial,'fecha_fin',final,
       'modo',tipo_registro,'descontado',descontar,'insumos',total_items,'consumo_id',consumo_registro,'suministros_dia',suministros_dia,'pauta_id',v_pauta_id));
  return r;
end $fn$;

