DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'persona_nombre_apellido_cargo_id_uk'
       AND conrelid = 'public.persona'::regclass
  ) THEN
    ALTER TABLE public.persona
      ADD CONSTRAINT persona_nombre_apellido_cargo_id_uk UNIQUE (nombre, apellido, cargo_id);
  END IF;
END;
$$;
