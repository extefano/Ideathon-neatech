-- Índice parcial para los filtros de humedal del mercado (solo lotes publicados).
create index lotes_humedal_mercado_idx
  on public.lotes (porcentaje_humedal)
  where estado_publicacion = 'DISPONIBLE';
