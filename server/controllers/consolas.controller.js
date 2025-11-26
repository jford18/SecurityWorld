import pool from "../db.js";

const formatError = (message) => ({
  status: "error",
  message,
});

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

export const getConsolas = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, fecha_creacion FROM public.consolas ORDER BY id"
    );

    res.status(200).json(formatSuccess("Listado de consolas", result.rows));
  } catch (error) {
    console.error("Error al obtener consolas:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const getConsolaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, nombre, fecha_creacion FROM public.consolas WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Consola no encontrada"));
    }

    res
      .status(200)
      .json(formatSuccess("Consola obtenida correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener consola:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const createConsola = async (req, res) => {
  try {
    const { nombre } = req.body ?? {};
    const trimmedName = typeof nombre === "string" ? nombre.trim() : "";

    if (!trimmedName) {
      return res.status(400).json(formatError("El nombre es obligatorio"));
    }

    const result = await pool.query(
      "INSERT INTO public.consolas (nombre) VALUES ($1) RETURNING id, nombre, fecha_creacion",
      [trimmedName]
    );

    res
      .status(201)
      .json(formatSuccess("Consola creada correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al crear consola:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const updateConsola = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body ?? {};
    const trimmedName = typeof nombre === "string" ? nombre.trim() : "";

    if (!trimmedName) {
      return res.status(400).json(formatError("El nombre es obligatorio"));
    }

    const result = await pool.query(
      "UPDATE public.consolas SET nombre = $1 WHERE id = $2 RETURNING id, nombre, fecha_creacion",
      [trimmedName, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Consola no encontrada"));
    }

    res
      .status(200)
      .json(formatSuccess("Consola actualizada correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar consola:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};

export const deleteConsola = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM public.consolas WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("Consola no encontrada"));
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar consola:", error);
    res.status(500).json(formatError("Error interno del servidor"));
  }
};
