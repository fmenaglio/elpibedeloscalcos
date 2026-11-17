-- Ejecutar en Supabase SQL Editor antes de desplegar.
-- Conserva las tablas existentes y agrega los campos necesarios.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apellido text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domicilio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS localidad text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'cliente';
ALTER TABLE public.pedidos ALTER COLUMN dni DROP NOT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_auth_id ON public.pedidos(cliente_auth_id);
