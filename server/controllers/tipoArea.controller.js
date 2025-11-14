import db from "../db.js";

const baseSelect = `
  SELECT id, nombre, descripcion, activo
  FROM public.tipo_area
`;

export const getTipoAreas = async (_req, res) => {
  try {
    const result = await db.query(`${baseSelect} ORDER BY nombre ASC`);
    res.json(result.rows);
  } catch (error) {
    console.error("[API][ERROR] /api/tipo-area (GET):", error);
    res.status(500).json({
      error: "[API][ERROR] /api/tipo-area",
      details: error.message,
    });
  }
};

export const getTipoAreaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`${baseSelect} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tipo de área no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(`[API][ERROR] /api/tipo-area/${req.params?.id ?? ""} (GET):`, error);
    res.status(500).json({
      error: "[API][ERROR] /api/tipo-area",
      details: error.message,
    });
  }
};

export const createTipoArea = async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    const result = await db.query(
      `
        INSERT INTO public.tipo_area (nombre, descripcion, activo)
        VALUES ($1, $2, $3)
        RETURNING id, nombre, descripcion, activo;
      `,
      [nombre, descripcion ?? null, activo ?? true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("[API][ERROR] /api/tipo-area (POST):", error);
    res.status(500).json({ message: "Error al crear el tipo de área" });
  }
};

export const updateTipoArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }

    const result = await db.query(
      `
        UPDATE public.tipo_area
        SET nombre = $1, descripcion = $2, activo = $3, fecha_actualizacion = NOW()
        WHERE id = $4
        RETURNING id, nombre, descripcion, activo;
      `,
      [nombre, descripcion ?? null, activo ?? true, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tipo de área no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(`[API][ERROR] /api/tipo-area/${req.params?.id ?? ""} (PUT):`, error);
    res.status(500).json({ message: "Error al actualizar el tipo de área" });
  }
};

export const deleteTipoArea = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `
        UPDATE public.tipo_area
        SET activo = FALSE, fecha_actualizacion = NOW()
        WHERE id = $1
        RETURNING id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tipo de área no encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(`[API][ERROR] /api/tipo-area/${req.params?.id ?? ""} (DELETE):`, error);
    res.status(500).json({ message: "Error al eliminar el tipo de área" });
  }
};
