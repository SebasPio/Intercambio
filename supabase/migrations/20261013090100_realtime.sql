-- Habilita Realtime para las opciones de regalo.
-- La lectura pública (RLS USING true) permite que anon reciba los cambios.
-- Si Realtime resulta inviable en las pruebas, esta migración puede omitirse y
-- el frontend usará polling como respaldo.

do $$
begin
  alter publication supabase_realtime add table public.gift_options;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publicación supabase_realtime no encontrada; se omite.';
end;
$$;
