ALTER TABLE public.seguimiento_fallos
ADD COLUMN IF NOT EXISTS hasta TIMESTAMP;

WITH seguimiento_ordenado AS (
  SELECT
    sf.id,
    LEAD(sf.fecha_creacion) OVER (
      PARTITION BY sf.fallo_id
      ORDER BY sf.fecha_creacion, sf.id
    ) AS siguiente_fecha_creacion
  FROM public.seguimiento_fallos sf
)
UPDATE public.seguimiento_fallos sf
SET hasta = so.siguiente_fecha_creacion
FROM seguimiento_ordenado so
WHERE sf.id = so.id
  AND sf.hasta IS NULL
  AND so.siguiente_fecha_creacion IS NOT NULL;

UPDATE public.seguimiento_fallos a
SET hasta = (b.fecha_resolucion::timestamp + b.hora_resolucion)
FROM public.fallos_tecnicos b
WHERE a.fallo_id = b.id
  AND a.hasta IS NULL
  AND b.fecha_resolucion IS NOT NULL
  AND b.hora_resolucion IS NOT NULL;

-- Validación base:
SELECT *
FROM public.seguimiento_fallos
WHERE hasta IS NULL;

-- Validación recomendada para detectar duplicados abiertos por fallo:
SELECT fallo_id, COUNT(*) AS abiertos
FROM public.seguimiento_fallos
WHERE hasta IS NULL
GROUP BY fallo_id
HAVING COUNT(*) > 1;
