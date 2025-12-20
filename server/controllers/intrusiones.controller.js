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

  const personaRaw =
    row?.persona_id === null || row?.persona_id === undefined
      ? row?.personal_id
      : row.persona_id;
  const personaId =
    personaRaw === null || personaRaw === undefined ? null : Number(personaRaw);

  const personaNombre = row?.persona_nombre ? String(row.persona_nombre).trim() : "";
  const cargoDescripcion = row?.cargo_descripcion
    ? String(row.cargo_descripcion).trim()
    : "";
  const personalIdentificado = cargoDescripcion && personaNombre
    ? `${cargoDescripcion} - ${personaNombre}`
    : personaNombre || row?.personal_identificado || null;

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
    persona_id: personaId === null || Number.isNaN(personaId) ? null : personaId,
    personal_identificado: personalIdentificado,
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

const normalizeDateParam = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeBooleanParam = (value) => {
  if (value === undefined) return undefined;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "si", "sí"].includes(normalized)) return true;
    if (["false", "f", "0", "no"].includes(normalized)) return false;
  }

  return Boolean(value);
};

const mapConsolidadoRow = (row) => {
  const fechaHoraIntrusion = row?.fecha_hora_intrusion
    ? new Date(row.fecha_hora_intrusion).toISOString()
    : null;

  const personaNombre = row?.persona_nombre ? String(row.persona_nombre).trim() : "";
  const cargoDescripcion = row?.cargo_descripcion ? String(row.cargo_descripcion).trim() : "";
  const personalIdentificado = cargoDescripcion && personaNombre
    ? `${cargoDescripcion} - ${personaNombre}`
    : personaNombre || "";

  return {
    id: row?.id ?? null,
    fechaHoraIntrusion,
    sitio: row?.sitio ?? "",
    tipoIntrusion: row?.tipo_intrusion ?? "",
    llegoAlerta: Boolean(row?.llego_alerta),
    personalIdentificado,
  };
};

export const buildIntrusionesFilterConfig = async (queryParams = {}) => {
  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("No se pudo obtener la metadata de intrusiones:", error);
    return {
      error: {
        status: 500,
        message: "No se pudo preparar la consulta de intrusiones.",
      },
    };
  }

  const {
    fechaDesde,
    fechaHasta,
    sitioId,
    clienteId,
    haciendaId,
    tipoIntrusionId,
    tipoIntrusion,
    llegoAlerta,
    personalId,
    page = 1,
    limit = 20,
  } = queryParams ?? {};

  const filters = [];
  const values = [];

  const parsedFechaDesde = normalizeDateParam(fechaDesde);
  if (fechaDesde !== undefined && fechaDesde !== "" && !parsedFechaDesde) {
    return {
      error: { status: 400, message: "El parámetro fechaDesde no es válido." },
    };
  }
  if (parsedFechaDesde) {
    values.push(parsedFechaDesde);
    filters.push(`i.fecha_evento >= $${values.length}`);
  }

  const parsedFechaHasta = normalizeDateParam(fechaHasta);
  if (fechaHasta !== undefined && fechaHasta !== "" && !parsedFechaHasta) {
    return {
      error: { status: 400, message: "El parámetro fechaHasta no es válido." },
    };
  }
  if (parsedFechaHasta) {
    values.push(parsedFechaHasta);
    filters.push(`i.fecha_evento <= $${values.length}`);
  }

  if (sitioId !== undefined && sitioId !== "") {
    const parsedSitioId = Number(sitioId);
    if (!Number.isInteger(parsedSitioId) || parsedSitioId <= 0) {
      return {
        error: { status: 400, message: "El parámetro sitioId no es válido." },
      };
    }
    values.push(parsedSitioId);
    filters.push(`i.sitio_id = $${values.length}`);
  }

  if (clienteId !== undefined && clienteId !== "") {
    const parsedClienteId = Number(clienteId);
    if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
      return {
        error: { status: 400, message: "El parámetro clienteId no es válido." },
      };
    }
    values.push(parsedClienteId);
    filters.push(`s.cliente_id = $${values.length}`);
  }

  if (haciendaId !== undefined && haciendaId !== "") {
    const parsedHaciendaId = Number(haciendaId);
    if (!Number.isInteger(parsedHaciendaId) || parsedHaciendaId <= 0) {
      return {
        error: { status: 400, message: "El parámetro haciendaId no es válido." },
      };
    }
    values.push(parsedHaciendaId);
    filters.push(`s.hacienda_id = $${values.length}`);
  }

  if (metadata.hasTipoIntrusionId && tipoIntrusionId !== undefined && tipoIntrusionId !== "") {
    const parsedTipo = Number(tipoIntrusionId);
    if (!Number.isInteger(parsedTipo) || parsedTipo <= 0) {
      return {
        error: { status: 400, message: "El parámetro tipoIntrusionId no es válido." },
      };
    }
    values.push(parsedTipo);
    filters.push(`i.tipo_intrusion_id = $${values.length}`);
  } else if (metadata.hasTipoText && (tipoIntrusionId || tipoIntrusion)) {
    const tipoValue =
      typeof tipoIntrusionId === "string" && tipoIntrusionId.trim()
        ? tipoIntrusionId
        : tipoIntrusion;

    if (typeof tipoValue === "string" && tipoValue.trim()) {
      values.push(`%${tipoValue.trim()}%`);
      filters.push(`i.tipo ILIKE $${values.length}`);
    }
  }

  const parsedLlegoAlerta = normalizeBooleanParam(llegoAlerta);
  if (parsedLlegoAlerta !== undefined) {
    values.push(parsedLlegoAlerta);
    filters.push(`i.llego_alerta = $${values.length}`);
  }

  if (metadata.personaColumn && personalId !== undefined && personalId !== "") {
    const parsedPersonal = Number(personalId);
    if (!Number.isInteger(parsedPersonal) || parsedPersonal <= 0) {
      return {
        error: { status: 400, message: "El parámetro personalId no es válido." },
      };
    }
    values.push(parsedPersonal);
    filters.push(`i.${metadata.personaColumn} = $${values.length}`);
  }

  return {
    metadata,
    values,
    whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
  };
};

const prepareConsolidadoQuery = async (
  queryParams,
  { includePagination = true } = {}
) => {
  const { page = 1, limit = 20 } = queryParams ?? {};

  let filterConfig;
  try {
    filterConfig = await buildIntrusionesFilterConfig(queryParams);
  } catch (error) {
    console.error("No se pudo obtener la metadata de intrusiones:", error);
    return {
      error: {
        status: 500,
        message: "No se pudo preparar la consulta de intrusiones.",
      },
    };
  }

  if (filterConfig?.error) {
    return { error: filterConfig.error };
  }

  const { metadata, whereClause } = filterConfig;
  const values = [...filterConfig.values];

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const hasValidPagination =
    includePagination &&
    Number.isInteger(pageNumber) &&
    pageNumber > 0 &&
    Number.isInteger(pageSize) &&
    pageSize > 0;

  const paginationClause = hasValidPagination
    ? ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`
    : "";

  const selectColumns = [
    "i.id",
    "i.fecha_evento AS fecha_hora_intrusion",
    "s.nombre AS sitio",
    metadata.hasTipoIntrusionId
      ? "COALESCE(cti.descripcion, CAST(i.tipo_intrusion_id AS TEXT)) AS tipo_intrusion"
      : "i.tipo AS tipo_intrusion",
    "i.llego_alerta",
    "COUNT(*) OVER() AS total_count",
  ];

  const joins = ["LEFT JOIN public.sitios AS s ON s.id = i.sitio_id"];
  if (metadata.hasTipoIntrusionId) {
    joins.push("LEFT JOIN public.catalogo_tipo_intrusion AS cti ON cti.id = i.tipo_intrusion_id");
  }

  if (metadata.personaColumn) {
    selectColumns.push(
      "p.id AS persona_id",
      "CONCAT_WS(' ', p.nombre, p.apellido) AS persona_nombre",
      "c.descripcion AS cargo_descripcion"
    );
    joins.push(
      `LEFT JOIN public.persona AS p ON p.id = i.${metadata.personaColumn}`,
      "LEFT JOIN public.catalogo_cargo AS c ON c.id = p.cargo_id"
    );
  }

  const orderByClause = "ORDER BY i.fecha_evento DESC NULLS LAST, i.id DESC";

  if (hasValidPagination) {
    values.push(pageSize, (pageNumber - 1) * pageSize);
  }

  const query = `SELECT ${selectColumns.join(", ")}
    FROM public.intrusiones AS i
    ${joins.join("\n    ")}
    ${whereClause}
    ${orderByClause}
    ${paginationClause}`;

  return {
    hasValidPagination,
    pageNumber,
    pageSize,
    query,
    values,
  };
};

let intrusionesColumnCache = null;
let sitiosColumnCache = null;

const getIntrusionesMetadata = async () => {
  if (intrusionesColumnCache) {
    return intrusionesColumnCache;
  }

  const columnsResult = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'intrusiones'`
  );

  const columnNames = new Set(columnsResult.rows.map((row) => row.column_name));
  const personaColumn = columnNames.has("persona_id")
    ? "persona_id"
    : columnNames.has("personal_id")
    ? "personal_id"
    : null;

  intrusionesColumnCache = {
    hasTipoIntrusionId: columnNames.has("tipo_intrusion_id"),
    hasTipoText: columnNames.has("tipo"),
    personaColumn,
    hasFechaReaccionEnviada: columnNames.has("fecha_reaccion_enviada"),
    hasSustraccionPersonal: columnNames.has("sustraccion_personal"),
  };

  return intrusionesColumnCache;
};

const getSitiosMetadata = async () => {
  if (sitiosColumnCache) {
    return sitiosColumnCache;
  }

  const columnsResult = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sitios'`
  );

  const columnNames = new Set(columnsResult.rows.map((row) => row.column_name));

  sitiosColumnCache = {
    hasDescripcion: columnNames.has("descripcion"),
    hasZona: columnNames.has("zona"),
  };

  return sitiosColumnCache;
};

export const listIntrusiones = async (_req, res) => {
  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("Error al preparar metadata de intrusiones:", error);
    return res
      .status(500)
      .json({ mensaje: "No se pudo preparar la consulta de intrusiones" });
  }

  try {
    const personaSelect = metadata.personaColumn
      ? `, i.${metadata.personaColumn} AS persona_id, CONCAT_WS(' ', p.nombre, p.apellido) AS persona_nombre, c.descripcion AS cargo_descripcion`
      : "";

    const personaJoin = metadata.personaColumn
      ? "LEFT JOIN public.persona AS p ON p.id = i." + metadata.personaColumn +
        " LEFT JOIN public.catalogo_cargo AS c ON c.id = p.cargo_id"
      : "";

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
         i.fuerza_reaccion_id${personaSelect},
         s.nombre AS sitio_nombre,
         m.descripcion AS medio_comunicacion_descripcion,
         ce.descripcion AS conclusion_evento_descripcion,
         fr.descripcion AS fuerza_reaccion_descripcion
       FROM public.intrusiones AS i
       LEFT JOIN public.sitios AS s ON s.id = i.sitio_id
       LEFT JOIN public.catalogo_medio_comunicacion AS m ON m.id = i.medio_comunicacion_id
       LEFT JOIN public.catalogo_conclusion_evento AS ce ON ce.id = i.conclusion_evento_id
       LEFT JOIN public."catalogo_fuerza_reaccion" AS fr ON fr.id = i.fuerza_reaccion_id
       ${personaJoin}
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
  const body = req.body || {};
  const rawUbicacion =
    body.ubicacion ?? body.UBICACION ?? body.sitio_nombre ?? body.SITIO_NOMBRE ?? null;
  const rawTipoText = body.tipo ?? body.TIPO ?? null;
  const rawTipoIntrusionId =
    body.tipo_intrusion_id ?? body.TIPO_INTRUSION_ID ?? body.tipoIntrusionId ?? null;
  const rawSitioId = body.sitio_id ?? body.SITIO_ID ?? body.sitioId ?? null;
  const rawFechaEvento = body.fecha_evento ?? body.FECHA_EVENTO ?? null;
  const rawFechaReaccion = body.fecha_reaccion ?? body.FECHA_REACCION ?? null;
  const rawFechaReaccionFuera =
    body.fecha_reaccion_fuera ?? body.FECHA_REACCION_FUERA ?? null;
  const rawLlegoAlerta = body.llego_alerta ?? body.LLEGO_ALERTA;
  const rawMedioComunicacionId = body.medio_comunicacion_id ?? body.MEDIO_COMUNICACION_ID;
  const rawConclusionEventoId = body.conclusion_evento_id ?? body.CONCLUSION_EVENTO_ID;
  const rawSustraccionMaterial = body.sustraccion_material ?? body.SUSTRACCION_MATERIAL;
  const rawFuerzaReaccionId = body.fuerza_reaccion_id ?? body.FUERZA_REACCION_ID;
  const rawPersonaId = body.persona_id ?? body.personal_id ?? body.PERSONA_ID ?? body.PERSONAL_ID;
  const rawEstado = body.estado ?? body.ESTADO ?? null;
  const rawDescripcion = body.descripcion ?? body.DESCRIPCION ?? null;

  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("No se pudo obtener metadata de intrusiones:", error);
    return res
      .status(500)
      .json({ mensaje: "No se pudo preparar el registro de intrusiones." });
  }

  const fechaEventoValue = rawFechaEvento ? parseFechaValue(rawFechaEvento) : new Date();
  const fechaReaccionValue = rawFechaReaccion ? parseFechaValue(rawFechaReaccion) : null;
  const fechaReaccionFueraValue = rawFechaReaccionFuera
    ? parseFechaValue(rawFechaReaccionFuera)
    : null;
  const llegoAlertaValue = typeof rawLlegoAlerta === "boolean" ? rawLlegoAlerta : false;
  const medioComValue =
    rawMedioComunicacionId === null || rawMedioComunicacionId === undefined || rawMedioComunicacionId === ""
      ? null
      : Number(rawMedioComunicacionId);
  const conclusionEventoValue = parseIntegerOrNull(rawConclusionEventoId);
  const sustraccionMaterialValue =
    typeof rawSustraccionMaterial === "boolean" ? rawSustraccionMaterial : false;
  const sitioIdValue = parseIntegerOrNull(rawSitioId);
  const fuerzaReaccionValue = parseIntegerOrNull(rawFuerzaReaccionId);
  const personaIdValue =
    metadata.personaColumn && rawPersonaId !== undefined
      ? parseIntegerOrNull(rawPersonaId)
      : null;
  const tipoIntrusionIdValue = metadata.hasTipoIntrusionId
    ? parseIntegerOrNull(rawTipoIntrusionId)
    : null;

  const missingFields = [];

  if (rawSitioId === undefined || rawSitioId === null || rawSitioId === "") {
    missingFields.push("sitio_id");
  }

  if (metadata.hasTipoIntrusionId && !rawTipoIntrusionId && !rawTipoText) {
    missingFields.push("tipo_intrusion_id");
  }

  if (!metadata.hasTipoIntrusionId && metadata.hasTipoText && !rawTipoText) {
    missingFields.push("tipo");
  }

  if (missingFields.length) {
    return res.status(400).json({
      message: "Faltan campos obligatorios para registrar la intrusión.",
      details: { missingFields },
    });
  }

  if (sitioIdValue === undefined) {
    return res.status(400).json({
      message: "El identificador del sitio no es válido.",
      details: { field: "sitio_id" },
    });
  }

  if (rawFechaEvento && !fechaEventoValue) {
    return res.status(400).json({
      message: "La fecha y hora del evento no es válida.",
      details: { field: "fecha_evento" },
    });
  }

  if (rawFechaReaccion && !fechaReaccionValue) {
    return res.status(400).json({
      message: "La fecha y hora de reacción no es válida.",
      details: { field: "fecha_reaccion" },
    });
  }

  if (
    fechaReaccionValue &&
    fechaEventoValue &&
    fechaReaccionValue.getTime() <= fechaEventoValue.getTime()
  ) {
    return res.status(400).json({
      message: "La fecha y hora de reacción debe ser mayor que la fecha y hora de intrusión.",
      details: { field: "fecha_reaccion" },
    });
  }

  if (rawFechaReaccionFuera && !fechaReaccionFueraValue) {
    return res.status(400).json({
      message: "La fecha y hora de reacción de fuera no es válida.",
      details: { field: "fecha_reaccion_fuera" },
    });
  }

  if (
    fechaReaccionFueraValue &&
    fechaReaccionValue &&
    fechaReaccionFueraValue.getTime() <= fechaReaccionValue.getTime()
  ) {
    return res.status(400).json({
      message: "La fecha de reacción de fuera debe ser posterior a la fecha de reacción.",
      details: { field: "fecha_reaccion_fuera" },
    });
  }

  if (conclusionEventoValue === undefined) {
    return res.status(400).json({
      message: "El identificador de la conclusión del evento no es válido.",
      details: { field: "conclusion_evento_id" },
    });
  }

  if (fuerzaReaccionValue === undefined) {
    return res.status(400).json({
      message: "El identificador de la fuerza de reacción no es válido.",
      details: { field: "fuerza_reaccion_id" },
    });
  }

  if (metadata.personaColumn && rawPersonaId !== undefined && personaIdValue === undefined) {
    return res.status(400).json({
      message: "El identificador de la persona no es válido.",
      details: { field: metadata.personaColumn },
    });
  }

  if (metadata.hasTipoIntrusionId && tipoIntrusionIdValue === undefined) {
    return res.status(400).json({
      message: "El identificador del tipo de intrusión no es válido.",
      details: { field: "tipo_intrusion_id" },
    });
  }

  try {
    const columns = ["ubicacion", "sitio_id"];
    const values = [rawUbicacion ?? null, sitioIdValue];

    if (metadata.hasTipoIntrusionId) {
      columns.push("tipo_intrusion_id");
      values.push(tipoIntrusionIdValue);
    }

    if (metadata.hasTipoText) {
      const tipoTextValue = rawTipoText ?? (tipoIntrusionIdValue != null ? String(tipoIntrusionIdValue) : null);
      columns.push("tipo");
      values.push(tipoTextValue);
    }

    columns.push(
      "estado",
      "descripcion",
      "fecha_evento",
      "fecha_reaccion",
      "fecha_reaccion_fuera",
      "llego_alerta",
      "medio_comunicacion_id",
      "conclusion_evento_id",
      "sustraccion_material",
      "fuerza_reaccion_id"
    );

    values.push(
      rawEstado ?? null,
      rawDescripcion ?? null,
      fechaEventoValue,
      fechaReaccionValue,
      fechaReaccionFueraValue,
      llegoAlertaValue,
      medioComValue,
      conclusionEventoValue,
      sustraccionMaterialValue,
      fuerzaReaccionValue
    );

    if (metadata.personaColumn) {
      columns.push(metadata.personaColumn);
      values.push(personaIdValue);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);

    const tipoReturningColumn = metadata.hasTipoText
      ? "tipo"
      : metadata.hasTipoIntrusionId
      ? `COALESCE((SELECT descripcion FROM public.catalogo_tipo_intrusion WHERE id = tipo_intrusion_id), CAST(tipo_intrusion_id AS TEXT)) AS tipo`
      : null;

    const returningColumns = [
      "id",
      "ubicacion",
      "sitio_id",
      metadata.hasTipoIntrusionId ? "tipo_intrusion_id" : null,
      tipoReturningColumn,
      "estado",
      "descripcion",
      "fecha_evento",
      "fecha_reaccion",
      "fecha_reaccion_fuera",
      "llego_alerta",
      "medio_comunicacion_id",
      "conclusion_evento_id",
      "sustraccion_material",
      "fuerza_reaccion_id",
      metadata.personaColumn
        ? `${metadata.personaColumn} AS persona_id`
        : null,
      "(SELECT nombre FROM public.sitios WHERE id = sitio_id) AS sitio_nombre",
      `(
        SELECT descripcion
          FROM public."catalogo_fuerza_reaccion"
         WHERE id = fuerza_reaccion_id
       ) AS fuerza_reaccion_descripcion`,
    ].filter(Boolean);

    const result = await pool.query(
      `INSERT INTO public.intrusiones (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${returningColumns.join(", ")}`,
      values
    );

    const created = result.rows[0];
    return res.status(201).json(mapIntrusionRow(created));
  } catch (error) {
    console.error("Error al crear intrusión:", error);
    return res
      .status(500)
      .json({ message: "Error al registrar la intrusión", mensaje: "Error al registrar la intrusión" });
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

  let parsedFechaEvento = null;
  let parsedFechaReaccion = null;
  let parsedFechaReaccionFuera = null;

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

  if (fecha_evento !== undefined) {
    const parsedDate = parseFechaValue(fecha_evento);
    if (!parsedDate) {
      return res
        .status(400)
        .json({ mensaje: "La fecha y hora del evento no es válida." });
    }
    parsedFechaEvento = parsedDate;
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
    parsedFechaReaccion &&
    parsedFechaEvento &&
    parsedFechaReaccion.getTime() <= parsedFechaEvento.getTime()
  ) {
    return res.status(400).json({
      message:
        "La fecha y hora de reacción debe ser mayor que la fecha y hora de intrusión.",
    });
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

export const deleteIntrusion = async (req, res) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId)) {
    return res
      .status(400)
      .json({ mensaje: "El identificador de la intrusión no es válido." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM public.intrusiones WHERE id = $1",
      [parsedId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: "Intrusión no encontrada" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar intrusión:", error);
    return res.status(500).json({ mensaje: "Error al eliminar la intrusión." });
  }
};

export const getConsolidadoIntrusiones = async (req, res) => {
  const queryConfig = await prepareConsolidadoQuery(req.query);

  if (queryConfig?.error) {
    const { status, message } = queryConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { hasValidPagination, pageNumber, pageSize, query, values } = queryConfig;

  try {
    const result = await pool.query(query, values);
    const totalRecords = result.rows[0]?.total_count ?? 0;
    const data = result.rows.map(mapConsolidadoRow);

    return res.json({
      data,
      total: Number(totalRecords) || data.length,
      page: hasValidPagination ? pageNumber : 1,
      pageSize: hasValidPagination ? pageSize : data.length,
    });
  } catch (error) {
    console.error("Error al obtener el consolidado de intrusiones:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al consultar el consolidado de intrusiones." });
  }
};

export const getEventosPorHaciendaSitio = async (req, res) => {
  const filterConfig = await buildIntrusionesFilterConfig(req.query);

  if (filterConfig?.error) {
    const { status, message } = filterConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { metadata, whereClause, values } = filterConfig;

  const tipoIntrusionExpression = metadata.hasTipoIntrusionId
    ? "COALESCE(cti.descripcion, CAST(i.tipo_intrusion_id AS TEXT))"
    : "i.tipo";

  const sitioNombreExpression = "COALESCE(NULLIF(TRIM(s.descripcion), ''), s.nombre)";

  const joins = [
    "LEFT JOIN public.sitios AS s ON s.id = i.sitio_id",
    "LEFT JOIN public.hacienda AS h ON h.id = s.hacienda_id",
  ];

  if (metadata.hasTipoIntrusionId) {
    joins.push("LEFT JOIN public.catalogo_tipo_intrusion AS cti ON cti.id = i.tipo_intrusion_id");
  }

  const query = `SELECT
    ${tipoIntrusionExpression} AS tipo_intrusion,
    s.hacienda_id,
    h.nombre AS hacienda_nombre,
    i.sitio_id,
    ${sitioNombreExpression} AS sitio_nombre,
    COUNT(*) AS total_eventos
  FROM public.intrusiones AS i
  ${joins.join("\n  ")}
  ${whereClause}
  GROUP BY ${tipoIntrusionExpression}, s.hacienda_id, h.nombre, i.sitio_id, ${sitioNombreExpression}
  ORDER BY COUNT(*) DESC, ${tipoIntrusionExpression} ASC NULLS LAST, h.nombre ASC NULLS LAST, ${sitioNombreExpression} ASC NULLS LAST;`;

  try {
    const result = await pool.query(query, values);
    return res.json(result.rows ?? []);
  } catch (error) {
    console.error("Error al obtener eventos por hacienda y sitio:", error);
    return res.status(500).json({ mensaje: "Ocurrió un error al consultar los eventos." });
  }
};

export const getEventosNoAutorizadosDashboard = async (req, res) => {
  const filterConfig = await buildIntrusionesFilterConfig(req.query);

  if (filterConfig?.error) {
    const { status = 400, message } = filterConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { metadata } = filterConfig;

  if (!metadata.hasTipoIntrusionId) {
    return res.status(500).json({
      mensaje: "La configuración actual no permite identificar intrusiones no autorizadas.",
    });
  }

  if (!metadata.hasFechaReaccionEnviada) {
    return res.status(500).json({
      mensaje: "No es posible calcular el tiempo de llegada de la fuerza de reacción.",
    });
  }

  const sitiosMetadata = await getSitiosMetadata();

  const values = [...filterConfig.values];
  const filters = [];

  if (filterConfig.whereClause) {
    filters.push(filterConfig.whereClause.replace(/^WHERE\s+/i, ""));
  }

  const protocoloExpression = "NULLIF(TRIM(cti.protocolo), '')";
  filters.push(`${protocoloExpression} IS NOT NULL`);

  const parsedSustraccionPersonal = normalizeBooleanParam(req.query?.sustraccionPersonal);
  if (parsedSustraccionPersonal === true) {
    if (!metadata.hasSustraccionPersonal) {
      return res.status(400).json({
        mensaje: "El filtro de sustracción personal no está disponible en esta instalación.",
      });
    }
    filters.push("i.sustraccion_personal = TRUE");
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const sitioDescripcionExpression = sitiosMetadata.hasDescripcion
    ? "COALESCE(NULLIF(TRIM(s.descripcion), ''), s.nombre)"
    : "s.nombre";

  const zonaExpression = sitiosMetadata.hasZona
    ? "COALESCE(NULLIF(TRIM(s.zona), ''), 'Sin zona')"
    : "'Sin zona'";

  const baseCTE = `WITH intrusiones_filtradas AS (
    SELECT
      i.id,
      i.sitio_id,
      ${sitioDescripcionExpression} AS sitio_descripcion,
      ${zonaExpression} AS zona,
      i.fecha_evento,
      i.fecha_reaccion,
      i.fecha_reaccion_enviada,
      ${metadata.hasSustraccionPersonal ? "COALESCE(i.sustraccion_personal, false)" : "false"} AS sustraccion_personal,
      mc.descripcion AS medio_comunicacion,
      ce.descripcion AS conclusion_evento,
      CASE
        WHEN i.fecha_reaccion_enviada IS NOT NULL
         AND i.fecha_reaccion IS NOT NULL
         AND i.fecha_reaccion_enviada >= i.fecha_reaccion
          THEN EXTRACT(EPOCH FROM (i.fecha_reaccion_enviada - i.fecha_reaccion)) / 60.0
        ELSE NULL
      END AS tiempo_llegada_min
    FROM public.intrusiones AS i
    LEFT JOIN public.sitios AS s ON s.id = i.sitio_id
    LEFT JOIN public.medio_comunicacion AS mc ON mc.id = i.medio_comunicacion_id
    LEFT JOIN public.catalogo_conclusion_evento AS ce ON ce.id = i.conclusion_evento_id
    LEFT JOIN public.catalogo_tipo_intrusion AS cti ON cti.id = i.tipo_intrusion_id
    ${whereClause}
  )`;

  const kpiQuery = `${baseCTE}
    SELECT COUNT(*) AS total_no_autorizados
    FROM intrusiones_filtradas;`;

  const chartQuery = `${baseCTE}
    SELECT
      zona,
      sitio_id,
      sitio_descripcion,
      AVG(tiempo_llegada_min) AS promedio_min
    FROM intrusiones_filtradas
    WHERE tiempo_llegada_min IS NOT NULL
    GROUP BY zona, sitio_id, sitio_descripcion
    ORDER BY promedio_min DESC NULLS LAST, sitio_descripcion ASC NULLS LAST
    LIMIT 15;`;

  const tableQuery = `${baseCTE}
    SELECT
      id,
      sitio_id,
      sitio_descripcion,
      fecha_evento,
      medio_comunicacion,
      fecha_reaccion_enviada,
      tiempo_llegada_min,
      conclusion_evento,
      sustraccion_personal
    FROM intrusiones_filtradas
    ORDER BY fecha_evento DESC NULLS LAST, id DESC;`;

  try {
    const [kpiResult, chartResult, tableResult] = await Promise.all([
      pool.query(kpiQuery, values),
      pool.query(chartQuery, values),
      pool.query(tableQuery, values),
    ]);

    const kpis = {
      total_no_autorizados: Number(kpiResult.rows[0]?.total_no_autorizados) || 0,
    };

    const chart = (chartResult.rows ?? []).map((row) => ({
      zona: row?.zona ?? "Sin zona",
      sitio_id: row?.sitio_id === null || row?.sitio_id === undefined ? null : Number(row.sitio_id),
      sitio_descripcion: row?.sitio_descripcion ?? "",
      promedio_min: row?.promedio_min === null || row?.promedio_min === undefined
        ? 0
        : Number(row.promedio_min),
    }));

    const tabla = (tableResult.rows ?? []).map((row) => ({
      id: row?.id ?? null,
      sitio_id: row?.sitio_id === null || row?.sitio_id === undefined ? null : Number(row.sitio_id),
      sitio_descripcion: row?.sitio_descripcion ?? "",
      fecha_evento: row?.fecha_evento ? new Date(row.fecha_evento).toISOString() : null,
      medio_comunicacion: row?.medio_comunicacion ?? null,
      fecha_reaccion_enviada: row?.fecha_reaccion_enviada
        ? new Date(row.fecha_reaccion_enviada).toISOString()
        : null,
      tiempo_llegada_min:
        row?.tiempo_llegada_min === null || row?.tiempo_llegada_min === undefined
          ? null
          : Number(row.tiempo_llegada_min),
      conclusion_evento: row?.conclusion_evento ?? null,
      sustraccion_personal: Boolean(row?.sustraccion_personal),
    }));

    return res.json({
      kpis,
      chart,
      tabla,
    });
  } catch (error) {
    console.error("Error al obtener el dashboard de eventos no autorizados:", error);
    return res.status(500).json({ mensaje: "Ocurrió un error al consultar el dashboard." });
  }
};

export const getEventosAutorizadosDashboard = async (req, res) => {
  const filterConfig = await buildIntrusionesFilterConfig(req.query);

  if (filterConfig?.error) {
    const { status = 400, message } = filterConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { metadata } = filterConfig;

  if (!metadata.hasTipoIntrusionId) {
    return res.status(500).json({
      mensaje: "La configuración actual no permite identificar intrusiones autorizadas.",
    });
  }

  const values = [...filterConfig.values];
  const filters = [];

  if (filterConfig.whereClause) {
    filters.push(filterConfig.whereClause.replace(/^WHERE\s+/i, ""));
  }

  const protocoloExpression = "COALESCE(NULLIF(TRIM(cti.protocolo), ''), '')";
  filters.push(`${protocoloExpression} = ''`);

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const personalCargoExpression = metadata.personaColumn
    ? "COALESCE(NULLIF(TRIM(c.descripcion), ''), 'Sin información')"
    : "'Sin información'";

  const sitioDescripcionExpression = "COALESCE(NULLIF(TRIM(s.descripcion), ''), s.nombre)";

  const baseCTE = `WITH base_intrusiones AS (
    SELECT
      i.id,
      i.sitio_id,
      ${sitioDescripcionExpression} AS sitio_descripcion,
      s.hacienda_id,
      h.nombre AS hacienda_nombre,
      ${personalCargoExpression} AS personal_cargo,
      i.fecha_evento,
      (i.fecha_evento AT TIME ZONE 'UTC')::DATE AS fecha,
      EXTRACT(ISODOW FROM i.fecha_evento) AS dia_semana_num
    FROM public.intrusiones AS i
    LEFT JOIN public.sitios AS s ON s.id = i.sitio_id
    LEFT JOIN public.hacienda AS h ON h.id = s.hacienda_id
    LEFT JOIN public.catalogo_tipo_intrusion AS cti ON cti.id = i.tipo_intrusion_id
    ${metadata.personaColumn ? `LEFT JOIN public.persona AS p ON p.id = i.${metadata.personaColumn}` : ""}
    ${metadata.personaColumn ? "LEFT JOIN public.catalogo_cargo AS c ON c.id = p.cargo_id" : ""}
    ${whereClause}
  )`;

  const barQuery = `${baseCTE}
SELECT
  b.hacienda_id,
  COALESCE(NULLIF(TRIM(b.hacienda_nombre), ''), 'Sin hacienda') AS hacienda_nombre,
  COUNT(*) AS total_eventos
FROM base_intrusiones AS b
GROUP BY b.hacienda_id, hacienda_nombre
ORDER BY total_eventos DESC, hacienda_nombre ASC
LIMIT 15;`;

  const donutQuery = `${baseCTE}
SELECT
  COALESCE(NULLIF(TRIM(b.personal_cargo), ''), 'Sin información') AS personal_identificado,
  COUNT(*) AS total_eventos
FROM base_intrusiones AS b
GROUP BY personal_identificado
ORDER BY total_eventos DESC, personal_identificado ASC;`;

  const diaSemanaQuery = `${baseCTE}
SELECT
  LOWER(TRIM(TO_CHAR(b.fecha, 'TMDay'))) AS dia_semana,
  COUNT(*) AS total_eventos,
  COUNT(DISTINCT b.sitio_id) AS total_sitios,
  MIN(b.dia_semana_num) AS orden_dia
FROM base_intrusiones AS b
GROUP BY dia_semana
ORDER BY orden_dia;`;

  const lineaQuery = `${baseCTE}
SELECT
  b.fecha AS fecha,
  COUNT(*) AS total_eventos
FROM base_intrusiones AS b
GROUP BY b.fecha
ORDER BY b.fecha;`;

  try {
    const [barResult, donutResult, diaSemanaResult, lineaResult] = await Promise.all([
      pool.query(barQuery, values),
      pool.query(donutQuery, values),
      pool.query(diaSemanaQuery, values),
      pool.query(lineaQuery, values),
    ]);

    const barHaciendas = (barResult.rows ?? []).map((row) => ({
      hacienda_id: row?.hacienda_id === null || row?.hacienda_id === undefined ? null : Number(row.hacienda_id),
      hacienda_nombre: row?.hacienda_nombre ?? "",
      total_eventos: row?.total_eventos === null || row?.total_eventos === undefined
        ? 0
        : Number(row.total_eventos),
    }));

    const donutPersonal = (donutResult.rows ?? []).map((row) => ({
      personal_identificado: row?.personal_identificado ?? "Sin información",
      total_eventos: row?.total_eventos === null || row?.total_eventos === undefined
        ? 0
        : Number(row.total_eventos),
    }));

    const tablaDiaSemana = (diaSemanaResult.rows ?? []).map((row) => ({
      dia_semana: row?.dia_semana ?? "",
      total_eventos: row?.total_eventos === null || row?.total_eventos === undefined
        ? 0
        : Number(row.total_eventos),
      total_sitios: row?.total_sitios === null || row?.total_sitios === undefined
        ? 0
        : Number(row.total_sitios),
    }));

    const lineaPorFecha = (lineaResult.rows ?? []).map((row) => ({
      fecha: row?.fecha ? new Date(row.fecha).toISOString().slice(0, 10) : null,
      total_eventos: row?.total_eventos === null || row?.total_eventos === undefined
        ? 0
        : Number(row.total_eventos),
    }));

    return res.json({
      barHaciendas,
      donutPersonal,
      tablaDiaSemana,
      lineaPorFecha,
    });
  } catch (error) {
    console.error("Error al obtener el dashboard de eventos autorizados:", error);
    return res.status(500).json({ mensaje: "Ocurrió un error al consultar el dashboard." });
  }
};

export const exportConsolidadoIntrusiones = async (req, res) => {
  const queryConfig = await prepareConsolidadoQuery(req.query, {
    includePagination: false,
  });

  if (queryConfig?.error) {
    const { status, message } = queryConfig.error;
    return res.status(status).json({ mensaje: message });
  }

  const { query, values } = queryConfig;

  try {
    const result = await pool.query(query, values);
    const data = result.rows.map(mapConsolidadoRow);
    const totalRecords = result.rows[0]?.total_count ?? data.length;

    return res.json({
      data,
      total: Number(totalRecords) || data.length,
    });
  } catch (error) {
    console.error("Error al exportar el consolidado de intrusiones:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al exportar el consolidado de intrusiones." });
  }
};
