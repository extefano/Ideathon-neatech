-- Advisor 0011: las funciones trigger no deben depender del search_path del llamador.
alter function public.set_updated_at() set search_path = '';
alter function public.asignar_codigo_lote() set search_path = '';
alter function public.proteger_evidencia_origen() set search_path = '';
