begin;
create or replace function sgic_private.confirmar_alimentacion(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(); asign public.asignacion_plan_lote%rowtype;
 r bigint; v_fecha date:=(p->>'fecha')::date; d record; qty numeric; costo numeric; prod public.producto%rowtype; positivos integer:=0;
begin
 select * into asign from public.asignacion_plan_lote where id=(p->>'asignacion_id')::bigint for share;
 if not found or not asign.activo or v_fecha is null or v_fecha>current_date or v_fecha<asign.fecha_inicio or (asign.fecha_fin is not null and v_fecha>asign.fecha_fin) then raise exception 'Asignación o fecha no vigente'; end if;
 perform 1 from public.lote where id=asign.lote_id and estado='ACTIVO' for update;
 if not found then raise exception 'Lote no activo'; end if;
 if exists(select 1 from public.consumo where lote_id=asign.lote_id and fecha=v_fecha and origen='PLAN' and observaciones='PLAN_ASIGNACION:'||asign.id) then
   raise exception 'Este plan ya se registró en esa fecha'; end if;
 if jsonb_typeof(p->'detalles') is distinct from 'array' then raise exception 'Detalle requerido'; end if;
 if jsonb_array_length(p->'detalles')<>(select count(*) from public.detalle_plan_consumo where plan_id=asign.plan_id)
 or exists(select 1 from jsonb_array_elements(p->'detalles') x where not exists(select 1 from public.detalle_plan_consumo dp where dp.id=(x->>'detalle_id')::bigint and dp.plan_id=asign.plan_id))
 or (select count(distinct x->>'detalle_id') from jsonb_array_elements(p->'detalles') x)<>jsonb_array_length(p->'detalles') then raise exception 'El plan cambió; vuelve a cargarlo'; end if;
 insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones) values(asign.lote_id,v_fecha,'PLAN',a,'PLAN_ASIGNACION:'||asign.id) returning id into r;
 for d in select * from public.detalle_plan_consumo where plan_id=asign.plan_id order by producto_id,id for share loop
   select (x->>'cantidad')::numeric into qty from jsonb_array_elements(p->'detalles') x where (x->>'detalle_id')::bigint=d.id;
   if qty is null or qty<0 or qty<>round(qty,3) or qty::text='NaN' then raise exception 'Cantidad inválida'; end if;
   if qty=0 then continue; end if;
   select * into prod from public.producto where id=d.producto_id and activo and apto_plan for update;
   if not found then raise exception 'Insumo no habilitado para el plan'; end if;
   costo:=sgic_private.stock_salida(d.producto_id,qty,a,'CONSUMO_PLAN',r);
   insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total) values(r,d.producto_id,qty,prod.unidad_base_id,prod.costo_promedio,costo);
   positivos:=positivos+1;
 end loop;
 if positivos=0 then raise exception 'Registra al menos una cantidad mayor que cero'; end if;
 perform sgic_private.audit(a,'CONFIRMAR','consumo',r,p); return r;
end $fn$;


commit;
