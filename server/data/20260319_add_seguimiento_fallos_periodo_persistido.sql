DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'seguimiento_fallos'
  ) THEN
    ALTER TABLE public.seguimiento_fallos
      ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP,
      ADD COLUMN IF NOT EXISTS fecha_hasta TIMESTAMP,
      ADD COLUMN IF NOT EXISTS paso VARCHAR(20);
  END IF;
END $$;
