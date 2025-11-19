import { pool } from "../db.js";

const mapIntrusionRow = (row) => {
  const medioId =
    row?.medio_comunicacion_id === null || row?.medio_comunicacion_id === undefined
      ? null
      : Number(row.medio_comunicacion_id);

  return {
    id: row?.id,
    ubicacion: row?.ubicacion ?? "",
    tipo: row?.tipo ?? "",
    estado: row?.estado ?? "",
    descripcion: row?.descripcion ?? "",
    fecha_evento: row?.fecha_evento ? new Date(row.fecha_evento).toISOString() : null,
    fecha_reaccion: row?.fecha_reaccion ? new Date(row.fecha_reaccion).toISOString() : null,
    llego_alerta: Boolean(row?.llego_alerta),
    medio_comunicacion_id:
      medioId === null || Number.isNaN(medioId) ? null : Number(medioId),
    medio_comunicacion_descripcion: row?.medio_comunicacion_descripcion ?? null,
  };
};

const parseFechaValue = (value) => {
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
      `SELECT
         i.id,
         i.ubicacion,
         i.tipo,
         i.estado,
         i.descripcion,
         i.fecha_evento,
         i.fecha_reaccion,
         i.llego_alerta,
         i.medio_comunicacion_id,
         m.descripcion AS medio_comunicacion_descripcion
       FROM public.intrusiones i
       LEFT JOIN public.catalogo_medio_comunicacion m ON i.medio_comunicacion_id = m.id
       ORDER BY i.fecha_evento DESC NULLS LAST, i.id DESC`
    );
    const intrusiones = result.rows.map(mapIntrusionRow);
    return res.json(intrusiones);
  } catch (error) {
    console.error("Error al listar intrusiones:", error);
    return res.status(500).json({ mensaje: "Error al listar las intrusiones" });
  }
};

export const createIntrusion = async (req, res) => {
  const {
    ubicacion,
    tipo,
    estado,
    descripcion,
    fecha_evento,
    fecha_reaccion,
    llego_alerta,
    medio_comunicacion_id,
  } = req.body || {};

  const fechaEventoValue = fecha_evento ? parseFechaValue(fecha_evento) : new Date();
  const fechaReaccionValue = fecha_reaccion ? parseFechaValue(fecha_reaccion) : null;
  const llegoAlertaValue =
    typeof llego_alerta === "boolean" ? llego_alerta : false;
  const medioComValue =
    medio_comunicacion_id === null || medio_comunicacion_id === undefined || medio_comunicacion_id === ""
      ? null
      : Number(medio_comunicacion_id);

  if (fecha_evento && !fechaEventoValue) {
    return res
      .status(400)
      .json({ mensaje: "La fecha y hora del evento no es válida." });
  }

  if (fecha_reaccion && !fechaReaccionValue) {
    return res
      .status(400)
      .json({ mensaje: "La fecha y hora de reacción no es válida." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.intrusiones (ubicacion, tipo, estado, descripcion, fecha_evento, fecha_reaccion, llego_alerta, medio_comunicacion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, ubicacion, tipo, estado, descripcion, fecha_evento, fecha_reaccion, llego_alerta, medio_comunicacion_id`,
      [
        ubicacion ?? null,
        tipo ?? null,
        estado ?? null,
        descripcion ?? null,
        fechaEventoValue,
        fechaReaccionValue,
        llegoAlertaValue,
        medioComValue,
      ]
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
  const {
    ubicacion,
    tipo,
    estado,
    descripcion,
    fecha_evento,
    fecha_reaccion,
    llego_alerta,
    medio_comunicacion_id,
  } = req.body || {};

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
  if (llego_alerta !== undefined)
    pushUpdate("llego_alerta", typeof llego_alerta === "boolean" ? llego_alerta : false);
  if (medio_comunicacion_id !== undefined) {
    const medioValue =
      medio_comunicacion_id === null || medio_comunicacion_id === ""
        ? null
        : Number(medio_comunicacion_id);
    pushUpdate("medio_comunicacion_id", medioValue);
  }

  if (fecha_evento !== undefined) {
    const parsedDate = parseFechaValue(fecha_evento);
    if (!parsedDate) {
      return res
        .status(400)
        .json({ mensaje: "La fecha y hora del evento no es válida." });
    }
    pushUpdate("fecha_evento", parsedDate);
  }

  if (fecha_reaccion !== undefined) {
    const parsedDate = parseFechaValue(fecha_reaccion);
    if (!parsedDate && fecha_reaccion !== null && fecha_reaccion !== "") {
      return res
        .status(400)
        .json({ mensaje: "La fecha y hora de reacción no es válida." });
    }
    pushUpdate("fecha_reaccion", parsedDate);
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
      `UPDATE public.intrusiones SET ${updates.join(", ")} WHERE id = $${idParamIndex} RETURNING id, ubicacion, tipo, estado, descripcion, fecha_evento, fecha_reaccion, llego_alerta, medio_comunicacion_id`,
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
