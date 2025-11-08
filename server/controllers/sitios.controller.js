import pool from "../db.js";

const normalizeSitioPayload = (body) => {
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const descripcion =
    typeof body.descripcion === "string" ? body.descripcion.trim() : null;
  const ubicacion =
    typeof body.ubicacion === "string" ? body.ubicacion.trim() : null;
  const activoRaw = body.activo;

  const activo =
    typeof activoRaw === "boolean"
      ? activoRaw
      : typeof activoRaw === "string"
      ? activoRaw.toLowerCase() === "true"
      : true;

  return { nombre, descripcion, ubicacion, activo };
};

export const getSitios = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, descripcion, ubicacion, activo, fecha_creacion
       FROM sitios
       ORDER BY nombre`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener sitios:", error);
    res.status(500).json({ message: "Error al obtener sitios" });
  }
};

export const getSitioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, nombre, descripcion, ubicacion, activo, fecha_creacion
       FROM sitios
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener el sitio:", error);
    res.status(500).json({ message: "Error al obtener el sitio" });
  }
};

export const createSitio = async (req, res) => {
  try {
    const { nombre, descripcion, ubicacion, activo } = normalizeSitioPayload(
      req.body ?? {}
    );

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const existe = await pool.query(
      "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1)",
      [nombre]
    );

    if (existe.rowCount > 0) {
      return res.status(409).json({ message: "El sitio ya existe" });
    }

    const result = await pool.query(
      `INSERT INTO sitios (nombre, descripcion, ubicacion, activo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, descripcion, ubicacion, activo, fecha_creacion`,
      [nombre, descripcion, ubicacion, activo]
    );

    res.status(201).json({
      message: "Sitio creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error al crear el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateSitio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, ubicacion, activo } = normalizeSitioPayload(
      req.body ?? {}
    );

    if (!nombre) {
      return res.status(422).json({ message: "El nombre es obligatorio" });
    }

    const existe = await pool.query(
      "SELECT id FROM sitios WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
      [nombre, id]
    );

    if (existe.rowCount > 0) {
      return res.status(409).json({ message: "Ya existe otro sitio con ese nombre" });
    }

    const result = await pool.query(
      `UPDATE sitios
       SET nombre = $1,
           descripcion = $2,
           ubicacion = $3,
           activo = $4
       WHERE id = $5
       RETURNING id, nombre, descripcion, ubicacion, activo, fecha_creacion`,
      [nombre, descripcion, ubicacion, activo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json({
      message: "Sitio actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error al actualizar el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteSitio = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM sitios WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Sitio no encontrado" });
    }

    res.status(200).json({ message: "Sitio eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el sitio:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
