import { pool } from "../db.js";

const mapIntrusionRow = (row) => ({
  id: row?.id,
  ubicacion: row?.ubicacion ?? "",
  tipo: row?.tipo ?? "",
  estado: row?.estado ?? "",
  descripcion: row?.descripcion ?? "",
  fecha_evento: row?.fecha_evento ? new Date(row.fecha_evento).toISOString() : null,
});

const parseFechaEvento = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value == null || value === "") {
    return null;
  }

  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

export const listIntrusiones = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, ubicacion, tipo, estado, descripcion, fecha_evento FROM public.intrusiones ORDER BY fecha_evento DESC NULLS LAST, id DESC"
    );
    const intrusiones = result.rows.map(mapIntrusionRow);
    return res.json(intrusiones);
  } catch (error) {
    console.error("Error al listar intrusiones:", error);
    return res.status(500).json({ mensaje: "Error al listar las intrusiones" });
  }
};

export const createIntrusion = async (req, res) => {
  const { ubicacion, tipo, estado, descripcion, fecha_evento } = req.body || {};

  const fechaEventoValue = fecha_evento
    ? parseFechaEvento(fecha_evento)
    : new Date();

  if (fecha_evento && !fechaEventoValue) {
    return res
      .status(400)
      .json({ mensaje: "La fecha y hora del evento no es válida." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.intrusiones (ubicacion, tipo, estado, descripcion, fecha_evento)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ubicacion, tipo, estado, descripcion, fecha_evento`,
      [ubicacion ?? null, tipo ?? null, estado ?? null, descripcion ?? null, fechaEventoValue]
    );

    const created = result.rows[0];
    return res.status(201).json(mapIntrusionRow(created));
  } catch (error) {
    console.error("Error al crear intrusión:", error);
    return res.status(500).json({ mensaje: "Error al registrar la intrusión" });
  }
};

export const updateIntrusion = async (req, res) => {
  const { id } = req.params;
  const { ubicacion, tipo, estado, descripcion, fecha_evento } = req.body || {};

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador de la intrusión es obligatorio." });
  }

  const updates = [];
  const values = [];

  const pushUpdate = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (ubicacion !== undefined) pushUpdate("ubicacion", ubicacion);
  if (tipo !== undefined) pushUpdate("tipo", tipo);
  if (estado !== undefined) pushUpdate("estado", estado);
  if (descripcion !== undefined) pushUpdate("descripcion", descripcion);

  if (fecha_evento !== undefined) {
    const parsedDate = parseFechaEvento(fecha_evento);
    if (!parsedDate) {
      return res
        .status(400)
        .json({ mensaje: "La fecha y hora del evento no es válida." });
    }
    pushUpdate("fecha_evento", parsedDate);
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ mensaje: "No se proporcionaron datos para actualizar." });
  }

  const idParamIndex = values.length + 1;
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.intrusiones SET ${updates.join(", ")} WHERE id = $${idParamIndex} RETURNING id, ubicacion, tipo, estado, descripcion, fecha_evento`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ mensaje: "La intrusión solicitada no existe." });
    }

    return res.json(mapIntrusionRow(result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar intrusión:", error);
    return res.status(500).json({ mensaje: "Error al actualizar la intrusión" });
  }
};
