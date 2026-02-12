DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fallos_tecnicos'
      AND column_name = 'reportado_al_cliente'
  ) THEN
    ALTER TABLE public.fallos_tecnicos
      ADD COLUMN reportado_al_cliente BOOLEAN;
  END IF;
END $$;

UPDATE public.fallos_tecnicos
SET reportado_al_cliente = FALSE
WHERE reportado_al_cliente IS NULL;

ALTER TABLE public.fallos_tecnicos
  ALTER COLUMN reportado_al_cliente SET DEFAULT FALSE,
  ALTER COLUMN reportado_al_cliente SET NOT NULL;
