import { pool } from "../db.js";

const mapIntrusionRow = (row) => {
  const medioId =
    row?.medio_comunicacion_id === null || row?.medio_comunicacion_id === undefined
      ? null
      : Number(row.medio_comunicacion_id);

  const conclusionId =
    row?.conclusion_evento_id === null || row?.conclusion_evento_id === undefined
      ? null
      : Number(row.conclusion_evento_id);

  const sitioId =
    row?.sitio_id === null || row?.sitio_id === undefined
      ? null
      : Number(row.sitio_id);

  const fuerzaReaccionId =
    row?.fuerza_reaccion_id === null || row?.fuerza_reaccion_id === undefined
      ? null
      : Number(row.fuerza_reaccion_id);

  return {
    id: row?.id,
    ubicacion: row?.ubicacion ?? "",
    sitio_id: sitioId === null || Number.isNaN(sitioId) ? null : sitioId,
    sitio_nombre: row?.sitio_nombre ?? null,
    tipo: row?.tipo ?? "",
    estado: row?.estado ?? "",
    descripcion: row?.descripcion ?? "",
    fecha_evento: row?.fecha_evento ? new Date(row.fecha_evento).toISOString() : null,
    fecha_reaccion: row?.fecha_reaccion ? new Date(row.fecha_reaccion).toISOString() : null,
    fecha_reaccion_fuera: row?.fecha_reaccion_fuera
      ? new Date(row.fecha_reaccion_fuera).toISOString()
      : null,
    llego_alerta: Boolean(row?.llego_alerta),
    medio_comunicacion_id:
      medioId === null || Number.isNaN(medioId) ? null : Number(medioId),
    medio_comunicacion_descripcion: row?.medio_comunicacion_descripcion ?? null,
    conclusion_evento_id:
      conclusionId === null || Number.isNaN(conclusionId) ? null : Number(conclusionId),
    conclusion_evento_descripcion: row?.conclusion_evento_descripcion ?? null,
    sustraccion_material: Boolean(row?.sustraccion_material),
    fuerza_reaccion_id:
      fuerzaReaccionId === null || Number.isNaN(fuerzaReaccionId)
        ? null
        : Number(fuerzaReaccionId),
    fuerza_reaccion_descripcion: row?.fuerza_reaccion_descripcion ?? null,
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

const parseIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const listIntrusiones = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         i.id,
         i.ubicacion,
         i.sitio_id,
         i.tipo,
         i.estado,
         i.descripcion,
         i.fecha_evento,
         i.fecha_reaccion,
         i.fecha_reaccion_fuera,
         i.llego_alerta,
         i.medio_comunicacion_id,
        i.conclusion_evento_id,
        i.sustraccion_material,
        i.fuerza_reaccion_id,
        s.nombre AS sitio_nombre,
        m.descripcion AS medio_comunicacion_descripcion,
        ce.descripcion AS conclusion_evento_descripcion,
        fr.descripcion AS fuerza_reaccion_descripcion
       FROM public.intrusiones i
       LEFT JOIN public.sitios s ON i.sitio_id = s.id
       LEFT JOIN public.catalogo_medio_comunicacion m ON i.medio_comunicacion_id = m.id
       LEFT JOIN public.catalogo_conclusion_evento ce ON i.conclusion_evento_id = ce.id
       LEFT JOIN public."catalogo_fuerza_reaccion" fr ON i.fuerza_reaccion_id = fr.id
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
    fecha_reaccion_fuera,
    llego_alerta,
    medio_comunicacion_id,
    conclusion_evento_id,
    sustraccion_material,
    sitio_id,
    fuerza_reaccion_id,
  } = req.body || {};

  const fechaEventoValue = fecha_evento ? parseFechaValue(fecha_evento) : new Date();
  const fechaReaccionValue = fecha_reaccion ? parseFechaValue(fecha_reaccion) : null;
  const fechaReaccionFueraValue = fecha_reaccion_fuera
    ? parseFechaValue(fecha_reaccion_fuera)
    : null;
  const llegoAlertaValue =
    typeof llego_alerta === "boolean" ? llego_alerta : false;
  const medioComValue =
    medio_comunicacion_id === null || medio_comunicacion_id === undefined || medio_comunicacion_id === ""
      ? null
      : Number(medio_comunicacion_id);
  const conclusionEventoValue = parseIntegerOrNull(conclusion_evento_id);
  const sustraccionMaterialValue =
    typeof sustraccion_material === "boolean" ? sustraccion_material : false;
  const sitioIdValue = parseIntegerOrNull(sitio_id);
  const fuerzaReaccionValue = parseIntegerOrNull(fuerza_reaccion_id);

  if (sitioIdValue === undefined) {
    return res
      .status(400)
      .json({ mensaje: "El identificador del sitio no es válido." });
  }

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

  if (fecha_reaccion_fuera && !fechaReaccionFueraValue) {
    return res
      .status(400)
      .json({ mensaje: "La fecha y hora de reacción de fuera no es válida." });
  }

  if (
    fechaReaccionFueraValue &&
    fechaReaccionValue &&
    fechaReaccionFueraValue.getTime() <= fechaReaccionValue.getTime()
  ) {
    return res
      .status(400)
      .json({
        mensaje:
          "La fecha de reacción de fuera debe ser posterior a la fecha de reacción.",
      });
  }

  if (conclusionEventoValue === undefined) {
    return res
      .status(400)
      .json({ mensaje: "El identificador de la conclusión del evento no es válido." });
  }

  if (fuerzaReaccionValue === undefined) {
    return res
      .status(400)
      .json({ mensaje: "El identificador de la fuerza de reacción no es válido." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.intrusiones (ubicacion, sitio_id, tipo, estado, descripcion, fecha_evento, fecha_reaccion, fecha_reaccion_fuera, llego_alerta, medio_comunicacion_id, conclusion_evento_id, sustraccion_material, fuerza_reaccion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, ubicacion, sitio_id, tipo, estado, descripcion, fecha_evento, fecha_reaccion, fecha_reaccion_fuera, llego_alerta, medio_comunicacion_id, conclusion_evento_id, sustraccion_material, fuerza_reaccion_id, (SELECT nombre FROM public.sitios WHERE id = sitio_id) AS sitio_nombre, (SELECT descripcion FROM public."catalogo_fuerza_reaccion" WHERE id = fuerza_reaccion_id) AS fuerza_reaccion_descripcion`,
      [
        ubicacion ?? null,
        sitioIdValue,
        tipo ?? null,
        estado ?? null,
        descripcion ?? null,
        fechaEventoValue,
        fechaReaccionValue,
        fechaReaccionFueraValue,
        llegoAlertaValue,
        medioComValue,
        conclusionEventoValue,
        sustraccionMaterialValue,
        fuerzaReaccionValue,
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
    fecha_reaccion_fuera,
    conclusion_evento_id,
    sustraccion_material,
    sitio_id,
    fuerza_reaccion_id,
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
  if (sitio_id !== undefined) {
    const parsedSitio = parseIntegerOrNull(sitio_id);
    if (parsedSitio === undefined) {
      return res
        .status(400)
        .json({ mensaje: "El identificador del sitio no es válido." });
    }
    pushUpdate("sitio_id", parsedSitio);
  }
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

  let parsedFechaReaccion = null;
  let parsedFechaReaccionFuera = null;

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
    parsedFechaReaccion = parsedDate;
    pushUpdate("fecha_reaccion", parsedDate);
  }

  if (fecha_reaccion_fuera !== undefined) {
    const parsedDate = parseFechaValue(fecha_reaccion_fuera);
    if (!parsedDate && fecha_reaccion_fuera !== null && fecha_reaccion_fuera !== "") {
      return res
        .status(400)
        .json({ mensaje: "La fecha y hora de reacción de fuera no es válida." });
    }
    parsedFechaReaccionFuera = parsedDate;
    pushUpdate("fecha_reaccion_fuera", parsedDate);
  }

  if (
    parsedFechaReaccionFuera &&
    parsedFechaReaccion &&
    parsedFechaReaccionFuera.getTime() <= parsedFechaReaccion.getTime()
  ) {
    return res
      .status(400)
      .json({ mensaje: "La fecha de reacción de fuera debe ser posterior a la fecha de reacción." });
  }

  if (conclusion_evento_id !== undefined) {
    const parsedConclusion = parseIntegerOrNull(conclusion_evento_id);
    if (parsedConclusion === undefined) {
      return res
        .status(400)
        .json({ mensaje: "El identificador de la conclusión del evento no es válido." });
    }
    pushUpdate("conclusion_evento_id", parsedConclusion);
  }

  if (sustraccion_material !== undefined) {
    pushUpdate(
      "sustraccion_material",
      typeof sustraccion_material === "boolean" ? sustraccion_material : false,
    );
  }

  if (fuerza_reaccion_id !== undefined) {
    const parsedFuerza = parseIntegerOrNull(fuerza_reaccion_id);
    if (parsedFuerza === undefined) {
      return res
        .status(400)
        .json({ mensaje: "El identificador de la fuerza de reacción no es válido." });
    }
    pushUpdate("fuerza_reaccion_id", parsedFuerza);
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
      `UPDATE public.intrusiones SET ${updates.join(", ")} WHERE id = $${idParamIndex} RETURNING id, ubicacion, sitio_id, tipo, estado, descripcion, fecha_evento, fecha_reaccion, fecha_reaccion_fuera, llego_alerta, medio_comunicacion_id, conclusion_evento_id, sustraccion_material, fuerza_reaccion_id, (SELECT nombre FROM public.sitios WHERE id = sitio_id) AS sitio_nombre, (SELECT descripcion FROM public."catalogo_fuerza_reaccion" WHERE id = fuerza_reaccion_id) AS fuerza_reaccion_descripcion`,
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
