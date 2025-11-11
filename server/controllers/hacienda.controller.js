import db from "../db.js";

export const getHaciendas = async (_req, res) => {
  try {
    const sql = `
      SELECT
        id,
        nombre,
        direccion,
        activo,
        fecha_creacion
      FROM public.hacienda
      ORDER BY id ASC;
    `;
    const { rows } = await db.query(sql);
    res.status(200).json(rows);
  } catch (err) {
    console.error("[API][ERROR] /api/v1/hacienda:", err.message);
    res
      .status(500)
      .json({ error: "Error al obtener las haciendas" });
  }
};

export const getHacienda = async (req, res) => {
    const { id } = req.params;
    try {
      const sql = `
        SELECT
          id,
          nombre,
          direccion,
          activo,
          fecha_creacion
        FROM public.hacienda
        WHERE id = $1;
      `;
      const { rows } = await db.query(sql, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Hacienda no encontrada" });
      }
      res.status(200).json(rows[0]);
    } catch (err) {
      console.error(`[API][ERROR] /api/v1/hacienda/${id}:`, err.message);
      res
        .status(500)
        .json({ error: "Error al obtener la hacienda" });
    }
};

export const createHacienda = async (req, res) => {
    const { nombre, direccion, activo } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: "El nombre es un campo requerido" });
    }

    try {
        const sql = `
            INSERT INTO public.hacienda (nombre, direccion, activo)
            VALUES ($1, $2, $3)
            RETURNING id, nombre, direccion, activo, fecha_creacion;
        `;
        const { rows } = await db.query(sql, [nombre, direccion, activo === undefined ? true : activo]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("[API][ERROR] /api/v1/hacienda (POST):", err.message);
        res
            .status(500)
            .json({ error: "Error al crear la hacienda" });
    }
};

export const updateHacienda = async (req, res) => {
    const { id } = req.params;
    const { nombre, direccion, activo } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: "El nombre es un campo requerido" });
    }

    try {
        const sql = `
            UPDATE public.hacienda
            SET nombre = $1, direccion = $2, activo = $3
            WHERE id = $4
            RETURNING id, nombre, direccion, activo, fecha_creacion;
        `;
        const { rows } = await db.query(sql, [nombre, direccion, activo, id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Hacienda no encontrada" });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error(`[API][ERROR] /api/v1/hacienda/${id} (PUT):`, err.message);
        res
            .status(500)
            .json({ error: "Error al actualizar la hacienda" });
    }
};

export const deleteHacienda = async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            DELETE FROM public.hacienda
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Hacienda no encontrada" });
        }
        res.status(204).send();
    } catch (err) {
        console.error(`[API][ERROR] /api/v1/hacienda/${id} (DELETE):`, err.message);
        res
            .status(500)
            .json({ error: "Error al eliminar la hacienda" });
    }
};
