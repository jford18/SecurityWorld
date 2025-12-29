import { pool } from "../db.js";

const mapIntrusionRow = (row) => {
  const hikAlarmEventoIdRaw =
    row?.hik_alarm_evento_id === undefined
      ? row?.hik_alarm_eventoid ?? row?.hik_alarm_evento
      : row.hik_alarm_evento_id;
  const hikAlarmEventoId =
    hikAlarmEventoIdRaw === null || hikAlarmEventoIdRaw === undefined
      ? null
      : Number(hikAlarmEventoIdRaw);

  const noLlegoAlerta =
    typeof row?.no_llego_alerta === "boolean"
      ? row.no_llego_alerta
      : row?.llego_alerta !== undefined
      ? !row.llego_alerta
      : false;

  const completado = Boolean(row?.completado);
  const fechaCompletado = row?.fecha_completado
    ? new Date(row.fecha_completado).toISOString()
    : null;
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
    origen: row?.origen ?? null,
    hik_alarm_evento_id:
      hikAlarmEventoId === null || Number.isNaN(hikAlarmEventoId) ? null : hikAlarmEventoId,
    ubicacion: row?.ubicacion ?? "",
    sitio_id: sitioId === null || Number.isNaN(sitioId) ? null : sitioId,
    sitio_nombre: row?.sitio_nombre ?? null,
    tipo: row?.tipo ?? "",
    estado: row?.estado ?? "",
    descripcion: row?.descripcion ?? "",
    fecha_evento: row?.fecha_evento ? new Date(row.fecha_evento).toISOString() : null,
    fecha_reaccion: row?.fecha_reaccion ? new Date(row.fecha_reaccion).toISOString() : null,
    fecha_reaccion_enviada: row?.fecha_reaccion_enviada
      ? new Date(row.fecha_reaccion_enviada).toISOString()
      : null,
    fecha_llegada_fuerza_reaccion: row?.fecha_llegada_fuerza_reaccion
      ? new Date(row.fecha_llegada_fuerza_reaccion).toISOString()
      : row?.fecha_reaccion_fuera
      ? new Date(row.fecha_reaccion_fuera).toISOString()
      : null,
    no_llego_alerta: noLlegoAlerta,
    completado,
    fecha_completado: fechaCompletado,
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

const validateCompletionRequirements = (config) => {
  const {
    completado,
    necesitaProtocolo,
    fechaReaccion,
    medioComunicacionId,
    personaId,
    fechaReaccionEnviada,
    fechaLlegadaFuerzaReaccion,
    conclusionEventoId,
    sustraccionMaterial,
  } = config;

  if (!completado) {
    return [];
  }

  const missing = [];

  if (!fechaReaccion) missing.push("fecha_reaccion");
  if (!medioComunicacionId) missing.push("medio_comunicacion_id");
  if (!personaId) missing.push("persona_id");

  if (necesitaProtocolo) {
    if (!fechaReaccionEnviada) missing.push("fecha_reaccion_enviada");
    if (!fechaLlegadaFuerzaReaccion) missing.push("fecha_llegada_fuerza_reaccion");
    if (!conclusionEventoId && conclusionEventoId !== 0) {
      missing.push("conclusion_evento_id");
    }
    if (sustraccionMaterial === undefined || sustraccionMaterial === null) {
      missing.push("sustraccion_material");
    }
  }

  return missing;
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

const truthyValues = ["1", "t", "true", "TRUE", "si", "sí", "yes", "y", "S", "s"];

const buildAuthorizationCondition = (metadata, { authorized }) => {
  if (metadata?.authorizedColumn) {
    if (metadata.authorizedColumnType === "boolean") {
      return `COALESCE(i.${metadata.authorizedColumn}, FALSE) = ${authorized ? "TRUE" : "FALSE"}`;
    }

    const inClause = `COALESCE(NULLIF(TRIM(CAST(i.${metadata.authorizedColumn} AS TEXT)), ''), '0') ${
      authorized ? "IN" : "NOT IN"
    } (${truthyValues.map((value) => `'${value}'`).join(", ")})`;

    return authorized ? inClause : `${inClause} OR i.${metadata.authorizedColumn} IS NULL`;
  }

  if (metadata?.hasTipoIntrusionId) {
    return authorized
      ? "COALESCE(TRIM(cti.protocolo), '') = ''"
      : "COALESCE(TRIM(cti.protocolo), '') <> ''";
  }

  return authorized ? "FALSE" : "FALSE";
};

const getIntrusionesMetadata = async () => {
  if (intrusionesColumnCache) {
    return intrusionesColumnCache;
  }

  const columnsResult = await pool.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'intrusiones'`
  );

  const columnNames = new Set(columnsResult.rows.map((row) => row.column_name));
  const columnTypes = columnsResult.rows.reduce((acc, row) => {
    acc[row.column_name] = row.data_type;
    return acc;
  }, {});
  const personaColumn = columnNames.has("persona_id")
    ? "persona_id"
    : columnNames.has("personal_id")
    ? "personal_id"
    : null;

  const authorizedColumnCandidates = [
    "es_autorizado",
    "autorizado",
    "es_autorizada",
    "estado_autorizacion",
    "estado_autorizado",
  ];
  const authorizedColumn = authorizedColumnCandidates.find((name) => columnNames.has(name)) || null;

  intrusionesColumnCache = {
    hasTipoIntrusionId: columnNames.has("tipo_intrusion_id"),
    hasTipoText: columnNames.has("tipo"),
    personaColumn,
    hasFechaReaccionEnviada: columnNames.has("fecha_reaccion_enviada"),
    hasSustraccionPersonal: columnNames.has("sustraccion_personal"),
    hasNoLlegoAlerta: columnNames.has("no_llego_alerta"),
    hasHikAlarmEventoId: columnNames.has("hik_alarm_evento_id"),
    hasOrigen: columnNames.has("origen"),
    hasCompletado: columnNames.has("completado"),
    hasFechaCompletado: columnNames.has("fecha_completado"),
    hasNecesitaProtocolo: columnNames.has("necesita_protocolo"),
    hasFechaLlegadaFuerzaReaccion: columnNames.has("fecha_llegada_fuerza_reaccion"),
    authorizedColumn,
    authorizedColumnType: authorizedColumn ? columnTypes[authorizedColumn] : null,
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
    const selectColumns = [
      "i.id",
      "i.descripcion",
      "i.ubicacion",
      "i.estado",
      "i.sitio_id",
      "i.tipo",
      "i.fecha_evento",
      "i.fecha_reaccion",
      metadata.hasFechaLlegadaFuerzaReaccion
        ? "i.fecha_llegada_fuerza_reaccion"
        : "i.fecha_reaccion_fuera",
      metadata.hasNoLlegoAlerta ? "i.no_llego_alerta" : "i.llego_alerta",
      metadata.hasFechaReaccionEnviada ? "i.fecha_reaccion_enviada" : null,
      metadata.hasCompletado ? "i.completado" : null,
      metadata.hasFechaCompletado ? "i.fecha_completado" : null,
      metadata.hasNecesitaProtocolo ? "i.necesita_protocolo" : null,
      metadata.hasOrigen ? "i.origen" : null,
      metadata.hasHikAlarmEventoId ? "i.hik_alarm_evento_id" : null,
      "i.medio_comunicacion_id",
      "i.conclusion_evento_id",
      "i.sustraccion_material",
      "i.fuerza_reaccion_id",
      metadata.personaColumn ? `i.${metadata.personaColumn} AS persona_id` : null,
      metadata.personaColumn
        ? "CONCAT_WS(' ', p.nombre, p.apellido) AS persona_nombre"
        : null,
      metadata.personaColumn ? "c.descripcion AS cargo_descripcion" : null,
      "s.nombre AS sitio_nombre",
      "m.descripcion AS medio_comunicacion_descripcion",
      "ce.descripcion AS conclusion_evento_descripcion",
      "fr.descripcion AS fuerza_reaccion_descripcion",
    ].filter(Boolean);

    const joins = [
      "LEFT JOIN public.sitios AS s ON s.id = i.sitio_id",
      "LEFT JOIN public.catalogo_medio_comunicacion AS m ON m.id = i.medio_comunicacion_id",
      "LEFT JOIN public.catalogo_conclusion_evento AS ce ON ce.id = i.conclusion_evento_id",
      'LEFT JOIN public."catalogo_fuerza_reaccion" AS fr ON fr.id = i.fuerza_reaccion_id',
    ];

    if (metadata.personaColumn) {
      joins.push(
        `LEFT JOIN public.persona AS p ON p.id = i.${metadata.personaColumn}`,
        "LEFT JOIN public.catalogo_cargo AS c ON c.id = p.cargo_id"
      );
    }

    const sql = `SELECT ${selectColumns.join(", ")}
       FROM public.intrusiones AS i
       ${joins.join("\n       ")}
       ORDER BY i.fecha_evento DESC NULLS LAST, i.id DESC`;

    const params = [];

    const result = await pool.query(sql, params);
    const intrusiones = result.rows.map(mapIntrusionRow);
    return res.json(intrusiones);
  } catch (error) {
    console.error("Error al listar intrusiones:", error);
    return res.status(500).json({ mensaje: "Error al listar las intrusiones" });
  }
};

export const listIntrusionesEncoladasHc = async (req, res) => {
  const { page = 1, limit = 20, search = "", orderBy = "fecha_evento_hc", orderDir = "desc" } =
    req.query || {};

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const hasPagination = Number.isInteger(pageNumber) && pageNumber > 0 && Number.isInteger(pageSize) && pageSize > 0;

  const allowedOrderByEncolados = {
    fecha_evento_hc: "V.FECHA_EVENTO_HC",
    region: "V.REGION",
    name: "V.NAME",
    trigger_event: "V.TRIGGER_EVENT",
    status: "V.STATUS",
    alarm_category: "V.ALARM_CATEGORY",
    completado: "V.COMPLETADO",
  };

  const orderColumn =
    allowedOrderByEncolados[String(orderBy || "").toLowerCase()] ||
    allowedOrderByEncolados.fecha_evento_hc;
  const orderDirection = String(orderDir || "").toLowerCase() === "asc" ? "ASC" : "DESC";

  const filterValues = [];
  const whereParts = [];

  if (typeof search === "string" && search.trim()) {
    filterValues.push(`%${search.trim()}%`);
    const placeholder = `$${filterValues.length}`;
    whereParts.push(
      `(V.REGION ILIKE ${placeholder} OR V.NAME ILIKE ${placeholder} OR V.TRIGGER_EVENT ILIKE ${placeholder} OR V.STATUS ILIKE ${placeholder} OR V.ALARM_CATEGORY ILIKE ${placeholder})`
    );
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const values = [...filterValues];

  const paginationClause = hasPagination
    ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}`
    : "";

  if (hasPagination) {
    values.push(pageSize, (pageNumber - 1) * pageSize);
  }

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total FROM public.v_intrusiones_encolados_hc v LEFT JOIN public.hik_alarm_evento e ON (e.id = v.hik_alarm_evento_id) ${whereClause}`,
      filterValues
    );

    const selectSql = `SELECT V.HIK_ALARM_EVENTO_ID,
            V.FECHA_EVENTO_HC,
            V.REGION,
            V.NAME,
            V.TRIGGER_EVENT,
            V.STATUS,
            COALESCE(E.ALARM_CATEGORY, V.ALARM_CATEGORY) AS ALARM_CATEGORY,
            V.INTRUSION_ID,
            V.COMPLETADO,
            E.SOURCE,
            E.ALARM_ACKNOWLEDGMENT_TIME
         FROM public.v_intrusiones_encolados_hc V
         LEFT JOIN public.hik_alarm_evento E ON (E.ID = V.HIK_ALARM_EVENTO_ID)
         ${whereClause}
         ORDER BY ${orderColumn} ${orderDirection}
         ${paginationClause}`;

    const result = await pool.query(selectSql, values);

    return res.json({ data: result.rows ?? [], total: Number(totalResult.rows?.[0]?.total) || 0 });
  } catch (error) {
    console.error("Error al listar intrusiones encoladas de HC:", error);
    return res.status(500).json({ mensaje: "No se pudieron obtener las intrusiones encoladas." });
  }
};

export const openIntrusionDesdeHc = async (req, res) => {
  const { hikAlarmEventoId } = req.params;
  console.log('[API] abrir HC params=', req.params);
  console.log('[API] abrir HC hikAlarmEventoId=', req.params.hikAlarmEventoId);
  const parsedId = Number(hikAlarmEventoId);

  if (!Number.isInteger(parsedId)) {
    return res.status(400).json({ mensaje: "El identificador del evento de HikCentral no es válido." });
  }

  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("No se pudo preparar metadata de intrusiones:", error);
    return res.status(500).json({ mensaje: "No se pudo preparar la apertura de la intrusión." });
  }

  try {
    const selectColumns = [
      "id",
    ];

    console.log('[API] abrir HC buscando intrusion por HIK_ALARM_EVENTO_ID...');
    const existingResult = await pool.query(
      `SELECT ${selectColumns.join(", ")} FROM public.intrusiones WHERE hik_alarm_evento_id = $1 LIMIT 1`,
      [parsedId]
    );
    console.log('[API] abrir HC found=', existingResult?.rows?.[0]);

    if (existingResult.rowCount > 0) {
      return res.json({ id: existingResult.rows[0].id });
    }

    const columns = [];
    const values = [];

    if (metadata.hasOrigen) {
      columns.push("origen");
      values.push("HC");
    }

    if (metadata.hasHikAlarmEventoId) {
      columns.push("hik_alarm_evento_id");
      values.push(parsedId);
    }

    if (metadata.hasNoLlegoAlerta) {
      columns.push("no_llego_alerta");
      values.push(false);
    } else {
      columns.push("llego_alerta");
      values.push(true);
    }

    if (metadata.hasCompletado) {
      columns.push("completado");
      values.push(false);
    }

    columns.push("fecha_evento");
    values.push(new Date());

    const placeholders = columns.map((_, index) => `$${index + 1}`);

    const returningColumns = ["id"];

    console.log('[API] abrir HC INSERT intrusiones con hikId=', parsedId);
    const insertResult = await pool.query(
      `INSERT INTO public.intrusiones (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${returningColumns.join(", ")}`,
      values
    );
    console.log('[API] abrir HC insert result=', insertResult?.rows?.[0]);

    return res.status(201).json({ id: insertResult.rows[0].id });
  } catch (error) {
    console.error('[API] abrir HC ERROR', error);
    console.error("Error al abrir intrusión desde HC:", error);
    return res.status(500).json({ mensaje: "No se pudo abrir la intrusión encolada." });
  }
};

export const createIntrusion = async (req, res) => {
  const body = req.body || {};
  const rawUbicacion =
    body.ubicacion ?? body.UBICACION ?? body.sitio_nombre ?? body.SITIO_NOMBRE ?? null;
  const rawTipoText = body.tipo ?? body.TIPO ?? null;
  const rawSitioId = body.sitio_id ?? body.SITIO_ID ?? body.sitioId ?? null;
  const rawFechaEvento = body.fecha_evento ?? body.FECHA_EVENTO ?? null;
  const rawFechaReaccion = body.fecha_reaccion ?? body.FECHA_REACCION ?? null;
  const rawFechaReaccionEnviada =
    body.fecha_reaccion_enviada ?? body.FECHA_REACCION_ENVIADA ?? null;
  const rawFechaLlegadaFuerzaReaccion =
    body.fecha_llegada_fuerza_reaccion ??
    body.FECHA_LLEGADA_FUERZA_REACCION ??
    body.fecha_reaccion_fuera ??
    body.FECHA_REACCION_FUERA ??
    null;
  const rawNoLlegoAlerta =
    body.no_llego_alerta ?? body.NO_LLEGO_ALERTA ?? body.llego_alerta ?? body.LLEGO_ALERTA;
  const rawMedioComunicacionId = body.medio_comunicacion_id ?? body.MEDIO_COMUNICACION_ID;
  const rawConclusionEventoId = body.conclusion_evento_id ?? body.CONCLUSION_EVENTO_ID;
  const rawSustraccionMaterial = body.sustraccion_material ?? body.SUSTRACCION_MATERIAL;
  const rawFuerzaReaccionId = body.fuerza_reaccion_id ?? body.FUERZA_REACCION_ID;
  const rawPersonaId = body.persona_id ?? body.personal_id ?? body.PERSONA_ID ?? body.PERSONAL_ID;
  const rawEstado = body.estado ?? body.ESTADO ?? null;
  const rawDescripcion = body.descripcion ?? body.DESCRIPCION ?? null;
  const rawOrigen = body.origen ?? body.ORIGEN ?? "MANUAL";
  const rawHikAlarmEventoId = body.hik_alarm_evento_id ?? body.HIK_ALARM_EVENTO_ID ?? null;
  const rawCompletado = body.completado ?? body.COMPLETADO ?? false;
  const rawNecesitaProtocolo = body.necesita_protocolo ?? body.NECESITA_PROTOCOLO;

  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("No se pudo obtener metadata de intrusiones:", error);
    return res
      .status(500)
      .json({ mensaje: "No se pudo preparar el registro de intrusiones." });
  }

  console.log("[INTRUSIONES][CREATE] payload:", {
    tipo: body.tipo ?? body.TIPO,
    sitio_id: rawSitioId,
    persona_id: rawPersonaId,
    origen: rawOrigen,
    hik_alarm_evento_id: rawHikAlarmEventoId,
  });

  const fechaEventoValue = rawFechaEvento ? parseFechaValue(rawFechaEvento) : new Date();
  const fechaReaccionValue = rawFechaReaccion ? parseFechaValue(rawFechaReaccion) : null;
  const fechaReaccionEnviadaValue = rawFechaReaccionEnviada
    ? parseFechaValue(rawFechaReaccionEnviada)
    : null;
  const fechaLlegadaFuerzaReaccionValue = rawFechaLlegadaFuerzaReaccion
    ? parseFechaValue(rawFechaLlegadaFuerzaReaccion)
    : null;
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
  const tipoTextValue = typeof rawTipoText === "string" ? rawTipoText.trim() : "";
  const hikAlarmEventoValue = metadata.hasHikAlarmEventoId
    ? parseIntegerOrNull(rawHikAlarmEventoId)
    : null;
  const origenValue = metadata.hasOrigen
    ? typeof rawOrigen === "string" && rawOrigen.trim()
      ? rawOrigen.trim().toUpperCase()
      : "MANUAL"
    : null;
  const noLlegoAlertaValue = metadata.hasNoLlegoAlerta
    ? hikAlarmEventoValue || origenValue === "HC"
      ? false
      : Boolean(rawNoLlegoAlerta)
    : false;
  const completadoValue = metadata.hasCompletado ? Boolean(rawCompletado) : false;
  const necesitaProtocoloValue = metadata.hasNecesitaProtocolo
    ? Boolean(rawNecesitaProtocolo)
    : false;

  const missingFields = [];

  if (rawSitioId === undefined || rawSitioId === null || rawSitioId === "") {
    missingFields.push("sitio_id");
  }

  if (metadata.hasTipoText && !tipoTextValue) {
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

  if (rawFechaReaccionEnviada && !fechaReaccionEnviadaValue) {
    return res.status(400).json({
      message: "La fecha y hora de reacción enviada no es válida.",
      details: { field: "fecha_reaccion_enviada" },
    });
  }

  if (rawFechaLlegadaFuerzaReaccion && !fechaLlegadaFuerzaReaccionValue) {
    return res.status(400).json({
      message: "La fecha y hora de llegada de la fuerza de reacción no es válida.",
      details: { field: "fecha_llegada_fuerza_reaccion" },
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

  if (
    fechaLlegadaFuerzaReaccionValue &&
    fechaReaccionValue &&
    fechaLlegadaFuerzaReaccionValue.getTime() <= fechaReaccionValue.getTime()
  ) {
    return res.status(400).json({
      message: "La fecha de llegada de la fuerza de reacción debe ser posterior a la fecha de reacción.",
      details: { field: "fecha_llegada_fuerza_reaccion" },
    });
  }

  if (
    rawConclusionEventoId !== undefined &&
    rawConclusionEventoId !== null &&
    conclusionEventoValue === undefined
  ) {
    return res.status(400).json({
      message: "El identificador de la conclusión del evento no es válido.",
      details: { field: "conclusion_evento_id" },
    });
  }

  if (
    rawFuerzaReaccionId !== undefined &&
    rawFuerzaReaccionId !== null &&
    fuerzaReaccionValue === undefined
  ) {
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

  const missingCompletionFields = validateCompletionRequirements({
    completado: completadoValue,
    necesitaProtocolo: necesitaProtocoloValue,
    fechaReaccion: fechaReaccionValue,
    medioComunicacionId: medioComValue,
    personaId: personaIdValue,
    fechaReaccionEnviada: fechaReaccionEnviadaValue,
    fechaLlegadaFuerzaReaccion: fechaLlegadaFuerzaReaccionValue,
    conclusionEventoId: conclusionEventoValue,
    sustraccionMaterial: sustraccionMaterialValue,
  });

  if (missingCompletionFields.length) {
    return res.status(400).json({
      message: "Faltan campos obligatorios para completar la intrusión.",
      details: { missingFields: missingCompletionFields },
    });
  }

  try {
    const columns = ["ubicacion", "sitio_id", "tipo"];
    const values = [rawUbicacion ?? null, sitioIdValue, tipoTextValue || null];

    columns.push("estado", "descripcion", "fecha_evento", "fecha_reaccion");
    values.push(rawEstado ?? null, rawDescripcion ?? null, fechaEventoValue, fechaReaccionValue);

    if (metadata.hasFechaLlegadaFuerzaReaccion) {
      columns.push("fecha_llegada_fuerza_reaccion");
      values.push(fechaLlegadaFuerzaReaccionValue);
    } else {
      columns.push("fecha_reaccion_fuera");
      values.push(fechaLlegadaFuerzaReaccionValue);
    }

    if (metadata.hasFechaReaccionEnviada) {
      columns.push("fecha_reaccion_enviada");
      values.push(fechaReaccionEnviadaValue);
    }

    if (metadata.hasNoLlegoAlerta) {
      columns.push("no_llego_alerta");
      values.push(noLlegoAlertaValue);
    } else {
      columns.push("llego_alerta");
      values.push(!noLlegoAlertaValue);
    }

    columns.push(
      "medio_comunicacion_id",
      "conclusion_evento_id",
      "sustraccion_material",
      "fuerza_reaccion_id"
    );

    values.push(medioComValue, conclusionEventoValue, sustraccionMaterialValue, fuerzaReaccionValue);

    if (metadata.hasCompletado) {
      columns.push("completado");
      values.push(completadoValue);
    }

    if (metadata.hasNecesitaProtocolo) {
      columns.push("necesita_protocolo");
      values.push(necesitaProtocoloValue);
    }

    if (metadata.hasOrigen) {
      columns.push("origen");
      values.push(origenValue);
    }

    if (metadata.hasHikAlarmEventoId) {
      columns.push("hik_alarm_evento_id");
      values.push(hikAlarmEventoValue);
    }

    if (metadata.personaColumn) {
      columns.push(metadata.personaColumn);
      values.push(personaIdValue);
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);

    const returningColumns = [
      "id",
      "ubicacion",
      "sitio_id",
      "tipo",
      "estado",
      "descripcion",
      "fecha_evento",
      "fecha_reaccion",
      metadata.hasFechaLlegadaFuerzaReaccion ? "fecha_llegada_fuerza_reaccion" : "fecha_reaccion_fuera",
      metadata.hasNoLlegoAlerta ? "no_llego_alerta" : "llego_alerta",
      metadata.hasFechaReaccionEnviada ? "fecha_reaccion_enviada" : null,
      metadata.hasCompletado ? "completado" : null,
      metadata.hasFechaCompletado ? "fecha_completado" : null,
      metadata.hasNecesitaProtocolo ? "necesita_protocolo" : null,
      metadata.hasOrigen ? "origen" : null,
      metadata.hasHikAlarmEventoId ? "hik_alarm_evento_id" : null,
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
    if (error?.code === "23514") {
      return res.status(400).json({
        message:
          "No se puede marcar 'No llegó alerta' para eventos provenientes de HikCentral. Verifique el origen del evento.",
      });
    }

    const backendDetail = error?.detail || error?.message;
    return res.status(500).json({
      message: "Error al registrar la intrusión",
      mensaje: backendDetail || "Error al registrar la intrusión",
    });
  }
};

export const updateIntrusion = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador de la intrusión es obligatorio." });
  }

  let metadata;
  try {
    metadata = await getIntrusionesMetadata();
  } catch (error) {
    console.error("No se pudo obtener metadata de intrusiones:", error);
    return res.status(500).json({ mensaje: "No se pudo preparar la actualización." });
  }

  const parsedId = Number(id);
  if (!Number.isInteger(parsedId)) {
    return res.status(400).json({ mensaje: "El identificador de la intrusión no es válido." });
  }

  let currentRow;
  try {
    const selectColumns = [
      "id",
      "sitio_id",
      "tipo",
      "estado",
      "descripcion",
      "fecha_evento",
      "fecha_reaccion",
      metadata.hasFechaLlegadaFuerzaReaccion ? "fecha_llegada_fuerza_reaccion" : "fecha_reaccion_fuera",
      metadata.hasFechaReaccionEnviada ? "fecha_reaccion_enviada" : null,
      metadata.hasNoLlegoAlerta ? "no_llego_alerta" : "llego_alerta",
      metadata.hasCompletado ? "completado" : null,
      metadata.hasNecesitaProtocolo ? "necesita_protocolo" : null,
      metadata.hasOrigen ? "origen" : null,
      metadata.hasHikAlarmEventoId ? "hik_alarm_evento_id" : null,
      "medio_comunicacion_id",
      "conclusion_evento_id",
      "sustraccion_material",
      "fuerza_reaccion_id",
      metadata.personaColumn,
    ].filter(Boolean);

    const currentResult = await pool.query(
      `SELECT ${selectColumns.join(", ")} FROM public.intrusiones WHERE id = $1`,
      [parsedId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ mensaje: "La intrusión solicitada no existe." });
    }

    currentRow = currentResult.rows[0];
  } catch (error) {
    console.error("No se pudo obtener la intrusión para actualizar:", error);
    return res.status(500).json({ mensaje: "No se pudo preparar la actualización." });
  }

  const rawOrigen = body.origen ?? body.ORIGEN ?? currentRow?.origen;
  const rawHikAlarm = body.hik_alarm_evento_id ?? body.HIK_ALARM_EVENTO_ID ?? currentRow?.hik_alarm_evento_id;
  const rawNoLlego = body.no_llego_alerta ?? body.NO_LLEGO_ALERTA ?? body.llego_alerta ?? currentRow?.no_llego_alerta ?? currentRow?.llego_alerta;
  const rawCompletado = body.completado ?? body.COMPLETADO ?? currentRow?.completado;
  const rawNecesitaProtocolo = body.necesita_protocolo ?? body.NECESITA_PROTOCOLO ?? currentRow?.necesita_protocolo;

  const updates = [];
  const values = [];

  const pushUpdate = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  const sitioValue =
    body.sitio_id !== undefined ? parseIntegerOrNull(body.sitio_id) : parseIntegerOrNull(currentRow?.sitio_id);
  if (body.sitio_id !== undefined && sitioValue === undefined) {
    return res.status(400).json({ mensaje: "El identificador del sitio no es válido." });
  }
  if (body.sitio_id !== undefined) pushUpdate("sitio_id", sitioValue);

  const tipoValue = body.tipo ?? currentRow?.tipo;
  if (body.tipo !== undefined) pushUpdate("tipo", tipoValue);

  if (body.estado !== undefined) pushUpdate("estado", body.estado);
  if (body.descripcion !== undefined) pushUpdate("descripcion", body.descripcion);
  if (body.ubicacion !== undefined) pushUpdate("ubicacion", body.ubicacion);

  const fechaEventoValue =
    body.fecha_evento !== undefined ? parseFechaValue(body.fecha_evento) : parseFechaValue(currentRow?.fecha_evento);
  if (body.fecha_evento !== undefined && !fechaEventoValue) {
    return res.status(400).json({ mensaje: "La fecha y hora del evento no es válida." });
  }
  if (body.fecha_evento !== undefined) pushUpdate("fecha_evento", fechaEventoValue);

  const fechaReaccionValue =
    body.fecha_reaccion !== undefined
      ? parseFechaValue(body.fecha_reaccion)
      : parseFechaValue(currentRow?.fecha_reaccion);
  if (body.fecha_reaccion !== undefined && !fechaReaccionValue && body.fecha_reaccion !== null && body.fecha_reaccion !== "") {
    return res.status(400).json({ mensaje: "La fecha y hora de reacción no es válida." });
  }
  if (body.fecha_reaccion !== undefined) pushUpdate("fecha_reaccion", fechaReaccionValue);

  const fechaReaccionEnviadaValue = metadata.hasFechaReaccionEnviada
    ? body.fecha_reaccion_enviada !== undefined
      ? parseFechaValue(body.fecha_reaccion_enviada)
      : parseFechaValue(currentRow?.fecha_reaccion_enviada)
    : null;
  if (
    metadata.hasFechaReaccionEnviada &&
    body.fecha_reaccion_enviada !== undefined &&
    !fechaReaccionEnviadaValue &&
    body.fecha_reaccion_enviada !== null &&
    body.fecha_reaccion_enviada !== ""
  ) {
    return res.status(400).json({ mensaje: "La fecha y hora de reacción enviada no es válida." });
  }
  if (metadata.hasFechaReaccionEnviada && body.fecha_reaccion_enviada !== undefined) {
    pushUpdate("fecha_reaccion_enviada", fechaReaccionEnviadaValue);
  }

  const fechaLlegadaValue = metadata.hasFechaLlegadaFuerzaReaccion
    ? body.fecha_llegada_fuerza_reaccion !== undefined
      ? parseFechaValue(body.fecha_llegada_fuerza_reaccion)
      : parseFechaValue(currentRow?.fecha_llegada_fuerza_reaccion)
    : parseFechaValue(body.fecha_reaccion_fuera ?? currentRow?.fecha_reaccion_fuera);
  if (
    (body.fecha_llegada_fuerza_reaccion !== undefined || body.fecha_reaccion_fuera !== undefined) &&
    !fechaLlegadaValue &&
    body.fecha_llegada_fuerza_reaccion !== null &&
    body.fecha_llegada_fuerza_reaccion !== "" &&
    body.fecha_reaccion_fuera !== null &&
    body.fecha_reaccion_fuera !== ""
  ) {
    return res.status(400).json({ mensaje: "La fecha de llegada de la fuerza de reacción no es válida." });
  }

  if (metadata.hasFechaLlegadaFuerzaReaccion) {
    if (body.fecha_llegada_fuerza_reaccion !== undefined) {
      pushUpdate("fecha_llegada_fuerza_reaccion", fechaLlegadaValue);
    }
  } else if (body.fecha_reaccion_fuera !== undefined) {
    pushUpdate("fecha_reaccion_fuera", fechaLlegadaValue);
  }

  if (
    fechaReaccionValue &&
    fechaEventoValue &&
    fechaReaccionValue.getTime() <= fechaEventoValue.getTime()
  ) {
    return res.status(400).json({ mensaje: "La fecha y hora de reacción debe ser mayor que la fecha y hora de intrusión." });
  }

  if (
    fechaLlegadaValue &&
    fechaReaccionValue &&
    fechaLlegadaValue.getTime() <= fechaReaccionValue.getTime()
  ) {
    return res
      .status(400)
      .json({ mensaje: "La fecha de llegada de la fuerza de reacción debe ser posterior a la fecha de reacción." });
  }

  const medioValue =
    body.medio_comunicacion_id !== undefined
      ? body.medio_comunicacion_id === null || body.medio_comunicacion_id === ""
        ? null
        : Number(body.medio_comunicacion_id)
      : currentRow?.medio_comunicacion_id ?? null;
  if (body.medio_comunicacion_id !== undefined) {
    pushUpdate("medio_comunicacion_id", medioValue);
  }

  const conclusionValue =
    body.conclusion_evento_id !== undefined
      ? parseIntegerOrNull(body.conclusion_evento_id)
      : parseIntegerOrNull(currentRow?.conclusion_evento_id);
  if (body.conclusion_evento_id !== undefined && conclusionValue === undefined) {
    return res.status(400).json({ mensaje: "El identificador de la conclusión del evento no es válido." });
  }
  if (body.conclusion_evento_id !== undefined) {
    pushUpdate("conclusion_evento_id", conclusionValue);
  }

  const sustraccionValue =
    body.sustraccion_material !== undefined
      ? Boolean(body.sustraccion_material)
      : Boolean(currentRow?.sustraccion_material);
  if (body.sustraccion_material !== undefined) {
    pushUpdate("sustraccion_material", sustraccionValue);
  }

  const fuerzaValue =
    body.fuerza_reaccion_id !== undefined
      ? parseIntegerOrNull(body.fuerza_reaccion_id)
      : parseIntegerOrNull(currentRow?.fuerza_reaccion_id);
  if (body.fuerza_reaccion_id !== undefined && fuerzaValue === undefined) {
    return res.status(400).json({ mensaje: "El identificador de la fuerza de reacción no es válido." });
  }
  if (body.fuerza_reaccion_id !== undefined) {
    pushUpdate("fuerza_reaccion_id", fuerzaValue);
  }

  const personaValue = metadata.personaColumn
    ? body[metadata.personaColumn] !== undefined
      ? parseIntegerOrNull(body[metadata.personaColumn])
      : parseIntegerOrNull(currentRow?.[metadata.personaColumn])
    : null;
  if (metadata.personaColumn && body[metadata.personaColumn] !== undefined && personaValue === undefined) {
    return res.status(400).json({ mensaje: "El identificador de la persona no es válido." });
  }
  if (metadata.personaColumn && body[metadata.personaColumn] !== undefined) {
    pushUpdate(metadata.personaColumn, personaValue);
  }

  const hikValue = metadata.hasHikAlarmEventoId
    ? parseIntegerOrNull(rawHikAlarm)
    : null;
  if (metadata.hasHikAlarmEventoId && body.hik_alarm_evento_id !== undefined) {
    pushUpdate("hik_alarm_evento_id", hikValue);
  }

  const origenValue = metadata.hasOrigen
    ? typeof rawOrigen === "string" && rawOrigen.trim()
      ? rawOrigen.trim().toUpperCase()
      : currentRow?.origen ?? null
    : null;
  if (metadata.hasOrigen && body.origen !== undefined) {
    pushUpdate("origen", origenValue);
  }

  const noLlegoValue = metadata.hasNoLlegoAlerta
    ? hikValue || origenValue === "HC" || currentRow?.origen === "HC"
      ? false
      : rawNoLlego === undefined
      ? Boolean(currentRow?.no_llego_alerta)
      : Boolean(rawNoLlego)
    : false;
  if (metadata.hasNoLlegoAlerta) {
    pushUpdate("no_llego_alerta", noLlegoValue);
  } else if (body.llego_alerta !== undefined) {
    pushUpdate("llego_alerta", typeof body.llego_alerta === "boolean" ? body.llego_alerta : false);
  }

  const completadoValue = metadata.hasCompletado
    ? Boolean(rawCompletado ?? currentRow?.completado)
    : false;
  const necesitaProtocoloValue = metadata.hasNecesitaProtocolo
    ? Boolean(rawNecesitaProtocolo ?? currentRow?.necesita_protocolo)
    : false;

  if (metadata.hasCompletado && body.completado !== undefined) {
    pushUpdate("completado", completadoValue);
  }

  if (metadata.hasNecesitaProtocolo && body.necesita_protocolo !== undefined) {
    pushUpdate("necesita_protocolo", necesitaProtocoloValue);
  }

  const missingCompletion = validateCompletionRequirements({
    completado: completadoValue,
    necesitaProtocolo: necesitaProtocoloValue,
    fechaReaccion: fechaReaccionValue,
    medioComunicacionId: medioValue,
    personaId: personaValue,
    fechaReaccionEnviada: fechaReaccionEnviadaValue,
    fechaLlegadaFuerzaReaccion: fechaLlegadaValue,
    conclusionEventoId: conclusionValue,
    sustraccionMaterial: sustraccionValue,
  });

  if (missingCompletion.length) {
    return res.status(400).json({
      message: "Faltan campos obligatorios para completar la intrusión.",
      details: { missingFields: missingCompletion },
    });
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ mensaje: "No se proporcionaron datos para actualizar." });
  }

  values.push(parsedId);

  try {
    const result = await pool.query(
      `UPDATE public.intrusiones SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id, ubicacion, sitio_id, tipo, estado, descripcion, fecha_evento, fecha_reaccion, ${
        metadata.hasFechaLlegadaFuerzaReaccion ? "fecha_llegada_fuerza_reaccion" : "fecha_reaccion_fuera"
      }, ${metadata.hasNoLlegoAlerta ? "no_llego_alerta" : "llego_alerta"}, ${
        metadata.hasFechaReaccionEnviada ? "fecha_reaccion_enviada" : "NULL"
      } AS fecha_reaccion_enviada, ${metadata.hasCompletado ? "completado" : "FALSE"} AS completado, ${
        metadata.hasNecesitaProtocolo ? "necesita_protocolo" : "FALSE"
      } AS necesita_protocolo, ${metadata.hasOrigen ? "origen" : "NULL"} AS origen, ${
        metadata.hasHikAlarmEventoId ? "hik_alarm_evento_id" : "NULL"
      } AS hik_alarm_evento_id, medio_comunicacion_id, conclusion_evento_id, sustraccion_material, fuerza_reaccion_id, (SELECT nombre FROM public.sitios WHERE id = sitio_id) AS sitio_nombre, (SELECT descripcion FROM public."catalogo_fuerza_reaccion" WHERE id = fuerza_reaccion_id) AS fuerza_reaccion_descripcion${
        metadata.personaColumn ? `, ${metadata.personaColumn} AS persona_id` : ""
      }`,
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
    if (error?.code === "23514") {
      return res.status(400).json({
        message:
          "No se puede marcar 'No llegó alerta' para eventos provenientes de HikCentral. Verifique el origen del evento.",
      });
    }

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

export const getEventosNoAutorizadosDashboard = async (_req, res) => {
  try {
    const totalResult = await pool.query(
      `SELECT
    COUNT(*) AS TOTAL
FROM PUBLIC.INTRUSIONES A
JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
WHERE B.NECESITA_PROTOCOLO = TRUE;`
    );

    const tiempoLlegadaResult = await pool.query(
      `SELECT
    COALESCE(C.DESCRIPCION, C.NOMBRE) AS SITIO_DESCRIPCION,
    ROUND(AVG(EXTRACT(EPOCH FROM (A.FECHA_REACCION - A.FECHA_EVENTO)) / 60.0), 2) AS TIEMPO_LLEGADA_PROM_MIN
FROM PUBLIC.INTRUSIONES A
JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
LEFT JOIN PUBLIC.SITIOS C ON (C.ID = A.SITIO_ID)
WHERE B.NECESITA_PROTOCOLO = TRUE
  AND A.FECHA_EVENTO IS NOT NULL
  AND A.FECHA_REACCION IS NOT NULL
GROUP BY COALESCE(C.DESCRIPCION, C.NOMBRE)
ORDER BY TIEMPO_LLEGADA_PROM_MIN DESC
LIMIT 15; /* A: PUBLIC.INTRUSIONES, B: PUBLIC.CATALOGO_TIPO_INTRUSION, filtro principal: B.NECESITA_PROTOCOLO = TRUE */`
    );

    const resumenResult = await pool.query(
      `SELECT
    COALESCE(C.DESCRIPCION, C.NOMBRE) AS SITIO_DESCRIPCION,
    TO_CHAR(A.FECHA_EVENTO, 'DD/MM/YYYY') AS FECHA_INTRUSION,
    TO_CHAR(A.FECHA_EVENTO, 'HH24:MI:SS') AS HORA_INTRUSION,
    D.DESCRIPCION AS PRIMERA_COMUNICACION,
    E.DESCRIPCION AS RESULTADO_FUERZA_REACCION,
    ROUND(EXTRACT(EPOCH FROM (A.FECHA_REACCION - A.FECHA_EVENTO)) / 60.0, 2) AS TIEMPO_LLEGADA_MIN,
    F.DESCRIPCION AS CONCLUSION_EVENTO
FROM PUBLIC.INTRUSIONES A
JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
LEFT JOIN PUBLIC.SITIOS C ON (C.ID = A.SITIO_ID)
LEFT JOIN PUBLIC.CATALOGO_MEDIO_COMUNICACION D ON (D.ID = A.MEDIO_COMUNICACION_ID)
LEFT JOIN PUBLIC.CATALOGO_FUERZA_REACCION E ON (E.ID = A.FUERZA_REACCION_ID)
LEFT JOIN PUBLIC.CATALOGO_CONCLUSION_EVENTO F ON (F.ID = A.CONCLUSION_EVENTO_ID)
WHERE B.NECESITA_PROTOCOLO = TRUE
ORDER BY A.FECHA_EVENTO DESC NULLS LAST, A.ID DESC
LIMIT 50; /* A: PUBLIC.INTRUSIONES, B: PUBLIC.CATALOGO_TIPO_INTRUSION, filtro principal: B.NECESITA_PROTOCOLO = TRUE */`
    );

    const total = Number(totalResult?.rows?.[0]?.total) || 0;

    const tiempoLlegada = (tiempoLlegadaResult?.rows ?? []).map((row) => ({
      sitio_descripcion: row?.sitio_descripcion ?? null,
      sitio: row?.sitio_descripcion || "SIN SITIO",
      minutos:
        row?.tiempo_llegada_prom_min === null || row?.tiempo_llegada_prom_min === undefined
          ? 0
          : Number(row.tiempo_llegada_prom_min),
    }));

    console.log(
      "[INTRUSIONES][DASHBOARD][NO_AUTORIZADOS] tiempoLlegada sample:",
      tiempoLlegada.slice(0, 3)
    );

    const resumen = (resumenResult?.rows ?? []).map((row) => ({
      sitio_descripcion: row?.sitio_descripcion ?? null,
      nombre_sitio: row?.sitio_descripcion ?? null,
      fecha_intrusion: row?.fecha_intrusion ?? null,
      hora_intrusion: row?.hora_intrusion ?? null,
      primera_comunicacion: row?.primera_comunicacion ?? null,
      resultado_fuerza_reaccion: row?.resultado_fuerza_reaccion ?? null,
      tiempo_llegada_min:
        row?.tiempo_llegada_min === null || row?.tiempo_llegada_min === undefined
          ? null
          : Number(row.tiempo_llegada_min),
      conclusion_evento: row?.conclusion_evento ?? null,
    }));

    console.log(
      "[INTRUSIONES][DASHBOARD][NO_AUTORIZADOS] SIN ZONA - total:",
      total,
      "tiempoLlegada:",
      tiempoLlegada.length,
      "resumen:",
      resumen.length
    );

    return res.json({
      total,
      tiempoLlegada,
      resumen,
    });
  } catch (err) {
    console.error("[INTRUSIONES][DASHBOARD][NO_AUTORIZADOS] error:", err);
    return res.status(500).json({
      message: "Error al cargar dashboard de eventos no autorizados",
      detail: err?.message ?? null,
      total: 0,
      tiempoLlegada: [],
      resumen: [],
    });
  }
};

export const getEventosAutorizadosDashboard = async (_req, res) => {
  console.log(
    "[INTRUSIONES][DASHBOARD][AUTORIZADOS] usando JOIN CATALOGO_TIPO_INTRUSION.DESCRIPCION = INTRUSIONES.TIPO y NECESITA_PROTOCOLO=FALSE"
  );
  try {
    const totalResult = await pool.query(
      `SELECT
    COUNT(*) AS TOTAL
FROM PUBLIC.INTRUSIONES A
LEFT JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
WHERE COALESCE(B.NECESITA_PROTOCOLO, FALSE) = FALSE;`
    );

    const porDiaResult = await pool.query(
      `SELECT
    TO_CHAR(A.FECHA_EVENTO, 'YYYYMMDD')::INT AS PERIODO,
    COUNT(*) AS TOTAL
FROM PUBLIC.INTRUSIONES A
LEFT JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
WHERE COALESCE(B.NECESITA_PROTOCOLO, FALSE) = FALSE
GROUP BY TO_CHAR(A.FECHA_EVENTO, 'YYYYMMDD')::INT
ORDER BY PERIODO;`
    );

    const porSitioResult = await pool.query(
      `SELECT
    A.SITIO_ID,
    COALESCE(C.DESCRIPCION, C.NOMBRE) AS SITIO_DESCRIPCION,
    COUNT(*) AS TOTAL
FROM PUBLIC.INTRUSIONES A
LEFT JOIN PUBLIC.CATALOGO_TIPO_INTRUSION B ON (B.DESCRIPCION = A.TIPO)
LEFT JOIN PUBLIC.SITIOS C ON (C.ID = A.SITIO_ID)
WHERE COALESCE(B.NECESITA_PROTOCOLO, FALSE) = FALSE
GROUP BY A.SITIO_ID, COALESCE(C.DESCRIPCION, C.NOMBRE)
ORDER BY TOTAL DESC; /* A: PUBLIC.INTRUSIONES, B: PUBLIC.CATALOGO_TIPO_INTRUSION, filtro principal: COALESCE(B.NECESITA_PROTOCOLO, FALSE) = FALSE */`
    );

    const responsePayload = {
      total: Number(totalResult.rows?.[0]?.total) || 0,
      porDia: (porDiaResult.rows ?? [])
        .map((row) => ({
          periodo: row?.periodo === null || row?.periodo === undefined ? null : Number(row.periodo),
          total: row?.total === null || row?.total === undefined ? 0 : Number(row.total),
        }))
        .filter((row) => row.periodo !== null),
      porSitio: (porSitioResult.rows ?? []).map((row) => ({
        sitio_id: row?.sitio_id === null || row?.sitio_id === undefined ? null : Number(row.sitio_id),
        sitio_descripcion: row?.sitio_descripcion ?? null,
        sitio_nombre: row?.sitio_descripcion ?? null,
        total: row?.total === null || row?.total === undefined ? 0 : Number(row.total),
      })),
    };

    console.log("[INTRUSIONES][DASHBOARD] result:", {
      total: responsePayload.total,
      porDiaCount: responsePayload.porDia.length,
      porSitioCount: responsePayload.porSitio.length,
    });

    return res.json(responsePayload);
  } catch (err) {
    console.error("[INTRUSIONES][DASHBOARD] error:", err);
    return res.status(500).json({
      message: "Error al cargar dashboard de eventos autorizados",
      detail: err?.message ?? null,
      total: 0,
      porDia: [],
      porSitio: [],
    });
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
