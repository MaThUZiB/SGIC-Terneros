-- Índices de FK para operaciones y consultas con crecimiento de datos.
begin;
do $do$
declare fk record; idx text;
begin
  for fk in
    select rel.relname as table_name, att.attname as col_name,
           con.conrelid as table_oid, att.attnum as col_number
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class rel on rel.oid=con.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
    join pg_catalog.pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1]
    where con.contype='f' and ns.nspname='public' and array_length(con.conkey,1)=1
  loop
    if not exists(
      select 1 from pg_catalog.pg_index i
      where i.indrelid=fk.table_oid and i.indisvalid and i.indkey[0]=fk.col_number
    ) then
      idx:=left('sgic_fk_'||fk.table_name||'_'||fk.col_name,63);
      execute format('create index if not exists %I on public.%I (%I)',idx,fk.table_name,fk.col_name);
    end if;
  end loop;
end $do$;
commit;