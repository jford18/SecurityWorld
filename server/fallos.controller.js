import XLSX from "xlsx";
import { pool } from "./db.js";
import { logSql } from "./utils/sqlLogger.js";
import {
  nodos,
  nodoCliente,
  tiposEquipo,
  tiposProblemaEquipo,
  dispositivos,
  sitiosPorConsola,
} from "./data/technicalFailureCatalogs.js";

const formatDate = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const matchedDate = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matchedDate) {
      return matchedDate[1];
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimestampForFilename = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}`;
};

const formatDurationSeconds = (value) => {
  if (value === null || value === undefined) return "";
  const totalSeconds = Number(value);
  if (!Number.isFinite(totalSeconds)) return "";

  const safeSeconds = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const splitDateTimeValue = (value) => {
  if (!value || typeof value !== "string") {
    return { fecha: null, hora: null };
  }

  const [fechaParte, horaParteRaw] = value.split("T");
  const sanitizedHora = horaParteRaw
    ? horaParteRaw.replace("Z", "").split(".")[0]
    : null;

  const hora = sanitizedHora
    ? sanitizedHora.length === 5
      ? `${sanitizedHora}:00`
      : sanitizedHora
    : null;

  return {
    fecha: fechaParte?.trim() || null,
    hora,
  };
};

const resolveFechaHoraFallo = (body = {}) => {
  const fechaHora = body.fechaHoraFallo || body.fecha_hora_fallo;
  const { fecha: fechaCombinada, hora: horaCombinada } = splitDateTimeValue(fechaHora);

  return {
    fecha: formatDate(body.fecha) || fechaCombinada,
    hora: body.hora || body.horaFallo || horaCombinada,
  };
};

const findUserId = (users, nameOrUsername) => {
  if (!nameOrUsername) return null;
  const normalized = String(nameOrUsername).trim().toLowerCase();
  const user = users.find((u) =>
    [u.nombre_usuario, u.nombre_completo]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === normalized)
  );
  return user ? user.id : null;
};

const normalizeDepartamentoId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed === 0) {
    return null;
  }

  return parsed;
};

const validateDepartamentoId = (departamentoId) => {
  if (departamentoId !== null && departamentoId <= 0) {
    throw new Error("departamento_id inválido");
  }

  return departamentoId;
};

const mapFalloRowToDto = (row) => ({
  id: String(row.id),
  fecha: formatDate(row.fecha) || "",
  hora: row.hora || undefined,
  horaFallo: row.hora || undefined,
  fecha_hora_fallo: row.fecha_hora_fallo || undefined,
  fechaHoraFallo: row.fecha_hora_fallo || undefined,
  problema: row.problema || row.tipo_problema_descripcion || undefined,
  equipo_afectado: row.equipo_afectado ?? "",
  nombre_equipo: row.nombre_equipo ?? null,
  nombreEquipo: row.nombre_equipo ?? null,
  descripcion_fallo: row.descripcion_fallo ?? "",
  encoding_device_id: row.encoding_device_id ?? null,
  encodingDeviceId: row.encoding_device_id ?? null,
  ipSpeakerId: row.ip_speaker_id ?? null,
  alarm_input_id: row.alarm_input_id ?? null,
  alarmInputId: row.alarm_input_id ?? null,
  responsable: row.responsable || "",
  deptResponsable: row.departamento || undefined,
  departamento_responsable: row.departamento_responsable || undefined,
  departamentoResponsableId: row.departamento_id ?? null,
  consola: row.consola || undefined, // FIX: expose consola name retrieved via the LEFT JOIN so the frontend can display it without additional lookups.
  consola_id: row.consola_id ?? null,
  sitio_nombre: row.sitio_nombre || undefined,
  sitio: row.sitio || row.sitio_nombre || undefined,
  cliente_id: row.cliente_id ?? null,
  cliente_nombre: row.cliente_nombre || null,
  hacienda_id: row.hacienda_id ?? null,
  hacienda_nombre: row.hacienda_nombre || null,
  tipo_problema_id: row.tipo_problema_id ?? null,
  tipo_afectacion: row.tipo_afectacion || "",
  tipo_equipo_afectado: row.tipo_equipo_afectado ?? null,
  tipoEquipoAfectado: row.tipo_equipo_afectado ?? null,
  tipo_equipo_afectado_nombre: row.tipo_equipo_afectado_nombre || undefined,
  nodo_nombre: row.nodo_nombre || undefined,
  nodoNombre: row.nodo_nombre || undefined,
  tipo_afectacion_detalle: row.tipo_afectacion_detalle || undefined,
  tipoProblemaNombre: row.tipo_problema_descripcion || undefined,
  fechaResolucion: formatDate(row.fecha_resolucion) || undefined,
  horaResolucion: row.hora_resolucion || undefined,
  fechaHoraResolucion: row.fecha_hora_resolucion || undefined,
  estado: row.estado || undefined,
  estado_texto: row.estado_texto || undefined,
  fecha_creacion: row.fecha_creacion ? formatDate(row.fecha_creacion) : undefined,
  fecha_actualizacion: row.fecha_actualizacion ? formatDate(row.fecha_actualizacion) : undefined,
  verificacionApertura: row.verificacion_apertura || undefined,
  verificacionCierre: row.verificacion_cierre || undefined,
  novedad: row.novedad || row.novedad_detectada || undefined,
  novedadDetectada: row.novedad_detectada || undefined,
  ultimo_usuario_edito_id: row.ultimo_usuario_edito_id ?? null,
  ultimo_usuario_edito_nombre: row.ultimo_usuario_edito_nombre || null,
  ultimo_usuario_edito: row.ultimo_usuario_edito_nombre || undefined,
  reportado_al_cliente: normalizeReportadoClienteStoredValue(
    row.reportado_al_cliente ?? row.reportado_cliente ?? null
  ),
  reportadoCliente: normalizeReportadoClienteStoredValue(
    row.reportado_al_cliente ?? row.reportado_cliente ?? null
  ),
  responsable_verificacion_cierre_id:
    row.responsable_verificacion_cierre_id ?? null,
  responsable_verificacion_cierre_nombre:
    row.responsable_verificacion_cierre_nombre || null,
});

const parseOptionalNumberParam = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

const normalizeReportadoClienteFilter = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const truthy = ["true", "t", "1", "s", "si", "sí", "y", "yes"];
  const falsy = ["false", "f", "0", "n", "no"];

  if (truthy.includes(normalized)) {
    return true;
  }

  if (falsy.includes(normalized)) {
    return false;
  }

  return undefined;
};

const normalizeReportadoClienteStoredValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const truthy = ["true", "t", "1", "s", "si", "sí", "y", "yes"];
  return truthy.includes(normalized);
};

const parseReportadoClienteFromPayload = (body = {}) => {
  const candidate =
    body.reportado_al_cliente ??
    body.reportado_cliente ??
    body.reportadoCliente ??
    body.reportadoAlCliente;

  if (candidate === undefined) {
    return { value: false, provided: false };
  }

  const parsed = normalizeReportadoClienteFilter(candidate);
  if (parsed === undefined) {
    return { value: null, provided: true, invalid: true };
  }

  return { value: parsed ?? false, provided: true };
};

const reportadoBooleanSqlExpression = (alias) =>
  `COALESCE(${alias}.reportado_al_cliente, FALSE)`;

const toNullableUserId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getAuthenticatedUserId = (req) =>
  toNullableUserId(
    req.user?.id ||
      req.user?.userId ||
      req.user?.usuario_id ||
      req.headers["x-user-id"] ||
      req.headers["x-usuario-id"] ||
      req.body?.ultimoUsuarioEditoId
  );

const normalizeRoleName = (req) => {
  const candidate =
    req.user?.rol_nombre ||
    req.user?.roleName ||
    req.user?.rol ||
    req.headers["x-role-name"] ||
    req.headers["x-rol-nombre"] ||
    req.headers["x-role"] ||
    req.headers["x-rol"] ||
    "";

  return String(candidate).trim().toLowerCase();
};

const isAdminUser = (req) => {
  const roleName = normalizeRoleName(req);

  if (!roleName) {
    return Boolean(req.user?.es_admin || req.user?.is_admin);
  }

  return ["admin", "administrador", "administrator", "supervisor"].some((keyword) =>
    roleName.includes(keyword)
  );
};

const buildDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const datePart = formatDate(dateValue);
  if (!datePart) return null;

  const timePart = (timeValue || "00:00").toString().slice(0, 8);
  const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;

  const candidate = `${datePart}${normalizedTime ? `T${normalizedTime}` : ""}`;
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const validateResolutionDateNotFuture = (fechaResolucion, horaResolucion) => {
  if (!fechaResolucion || !horaResolucion) {
    return null;
  }

  const resolutionDateTime = buildDateTime(fechaResolucion, horaResolucion);
  if (!resolutionDateTime) {
    return null;
  }

  return resolutionDateTime.getTime() > Date.now()
    ? "La fecha y hora de resolución no puede ser futura."
    : null;
};

const PASO_SEGUIMIENTO = {
  INICIO: "INICIO",
  CAMBIO: "CAMBIO",
  CIERRE: "CIERRE",
};

const DEPARTAMENTO_MONITOREO_ID = 5;

const getSeguimientoAbierto = async (client, falloId) => {
  const result = await client.query(
    `SELECT id, departamento_id, fecha_inicio, fecha_hasta, paso
       FROM seguimiento_fallos
      WHERE fallo_id = $1
        AND fecha_hasta IS NULL
      ORDER BY COALESCE(fecha_inicio, fecha_creacion) DESC, id DESC
      LIMIT 1`,
    [falloId]
  );

  return result.rows[0] || null;
};

const cerrarSeguimientoAbierto = async (
  client,
  { seguimientoId, fechaHasta, usuarioId }
) => {
  if (!seguimientoId || !fechaHasta) {
    return false;
  }

  const result = await client.query(
    `UPDATE seguimiento_fallos
        SET fecha_hasta = $1,
            fecha_actualizacion = NOW(),
            ultimo_usuario_edito_id = COALESCE($2, ultimo_usuario_edito_id)
      WHERE id = $3
        AND fecha_hasta IS NULL`,
    [fechaHasta, usuarioId || null, seguimientoId]
  );

  return result.rowCount > 0;
};

const insertSeguimientoPersistido = async (
  client,
  {
    falloId,
    departamentoId,
    paso,
    fechaInicio,
    fechaHasta = null,
    novedadDetectada = null,
    usuarioId = null,
    verificacionAperturaId = null,
    verificacionCierreId = null,
    responsableVerificacionCierreId = null,
    verificacionSupervisorId = null,
  }
) => {
  if (!falloId || !departamentoId || !paso || !fechaInicio) {
    return false;
  }

  await client.query(
    `INSERT INTO seguimiento_fallos (
       fallo_id,
       departamento_id,
       fecha_inicio,
       fecha_hasta,
       paso,
       verificacion_apertura_id,
       verificacion_cierre_id,
       novedad_detectada,
       fecha_creacion,
       fecha_actualizacion,
       ultimo_usuario_edito_id,
       responsable_verificacion_cierre_id,
       verificacion_supervisor_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9, $10, $11
     )`,
    [
      falloId,
      departamentoId,
      fechaInicio,
      fechaHasta,
      paso,
      verificacionAperturaId,
      verificacionCierreId,
      novedadDetectada,
      usuarioId,
      responsableVerificacionCierreId,
      verificacionSupervisorId,
    ]
  );

  return true;
};

const insertSeguimientoDepartamento = async (
  client,
  { falloId, departamentoId, novedadDetectada, usuarioId, fechaHasta = new Date() }
) => {
  if (!departamentoId) {
    return false;
  }

  const seguimientoAbierto = await getSeguimientoAbierto(client, falloId);
  const ultimoDepartamentoId = seguimientoAbierto?.departamento_id;

  if (
    ultimoDepartamentoId &&
    Number(ultimoDepartamentoId) === Number(departamentoId)
  ) {
    return false;
  }

  if (seguimientoAbierto?.id) {
    await cerrarSeguimientoAbierto(client, {
      seguimientoId: seguimientoAbierto.id,
      fechaHasta,
      usuarioId,
    });
  }

  await insertSeguimientoPersistido(client, {
    falloId,
    departamentoId,
    paso: PASO_SEGUIMIENTO.CAMBIO,
    fechaInicio: fechaHasta,
    fechaHasta: null,
    novedadDetectada: novedadDetectada || null,
    usuarioId: usuarioId || null,
    verificacionSupervisorId: usuarioId || null,
  });

  return true;
};

const formatDurationFromMs = (durationMs) => {
  const totalMinutes = Math.floor(durationMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} día${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
  parts.push(`${minutes} minuto${minutes === 1 ? "" : "s"}`);

  return {
    duracionTexto: parts.join(" "),
    totalMinutos: totalMinutes,
  };
};

const fetchFalloById = async (client, id) => {
  const result = await client.query(
      `SELECT
        ft.id,
        ft.fecha,
        ft.hora,
        ft.equipo_afectado,
        ft.descripcion_fallo,
        ft.encoding_device_id,
        ft.ip_speaker_id,
        ft.alarm_input_id,
        COALESCE(responsable.nombre_completo, responsable.nombre_usuario) AS responsable,
        dept.nombre AS departamento,
        dept.id AS departamento_id,
        sitio.nombre AS sitio_nombre,
        ft.tipo_problema_id,
        tp.descripcion AS tipo_problema_descripcion,
        ft.tipo_afectacion,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN
            TRIM(
              REGEXP_REPLACE(
                SPLIT_PART(ft.equipo_afectado, ' en ', 1),
                '\\s*\\(.*\\)$',
                ''
              )
            )
          ELSE NULL
        END AS tipo_equipo_afectado,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN
            CASE
              WHEN ft.camera_id IS NOT NULL THEN 'CÁMARA'
              WHEN ft.encoding_device_id IS NOT NULL THEN 'GRABADOR'
              WHEN ft.ip_speaker_id IS NOT NULL THEN 'IP SPEAKER'
              WHEN ft.alarm_input_id IS NOT NULL THEN 'ALARM INPUT'
              ELSE TRIM(
                REGEXP_REPLACE(
                  SPLIT_PART(ft.equipo_afectado, ' en ', 1),
                  '\\s*\\(.*\\)$',
                  ''
                )
              )
            END
          ELSE NULL
        END AS tipo_equipo_afectado_nombre,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN ft.equipo_afectado
          ELSE NULL
        END AS nombre_equipo,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'NODO' THEN NULLIF(ft.equipo_afectado, '')
          ELSE NULL
        END AS nodo_nombre,
        ft.fecha_resolucion,
        ft.hora_resolucion,
        ft.estado,
        ft.fecha_creacion,
        ft.fecha_actualizacion,
        ft.responsable_verificacion_cierre_id,
        seguimiento.novedad_detectada,
        COALESCE(apertura.nombre_completo, apertura.nombre_usuario) AS verificacion_apertura,
        COALESCE(cierre.nombre_completo, cierre.nombre_usuario) AS verificacion_cierre,
        seguimiento.ultimo_usuario_edito_id,
        COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario) AS ultimo_usuario_edito_nombre,
        COALESCE(responsable_cierre.nombre_completo, responsable_cierre.nombre_usuario) AS responsable_verificacion_cierre_nombre,
        COALESCE(ft.reportado_al_cliente, FALSE) AS reportado_al_cliente
      FROM fallos_tecnicos ft
      LEFT JOIN usuarios responsable ON responsable.id = ft.responsable_id
      LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
      LEFT JOIN sitios sitio ON sitio.id = ft.sitio_id
      LEFT JOIN catalogo_tipo_problema tp ON tp.id = ft.tipo_problema_id
      LEFT JOIN LATERAL (
        SELECT
          sf.novedad_detectada,
          sf.verificacion_apertura_id,
          sf.verificacion_cierre_id,
          sf.ultimo_usuario_edito_id
        FROM seguimiento_fallos sf
        WHERE sf.fallo_id = ft.id
        ORDER BY sf.fecha_creacion DESC, sf.fecha_actualizacion DESC, sf.id DESC
        LIMIT 1
      ) seguimiento ON TRUE
      LEFT JOIN usuarios apertura ON apertura.id = seguimiento.verificacion_apertura_id
      LEFT JOIN usuarios cierre ON cierre.id = seguimiento.verificacion_cierre_id
      LEFT JOIN usuarios ultimo_editor ON ultimo_editor.id = seguimiento.ultimo_usuario_edito_id
      LEFT JOIN usuarios responsable_cierre ON responsable_cierre.id = ft.responsable_verificacion_cierre_id
      WHERE ft.id = $1`,
    [id]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapFalloRowToDto(result.rows[0]);
};

export const getFalloById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ mensaje: "El identificador del fallo es obligatorio." });
  }

  const client = await pool.connect();

  try {
    const fallo = await fetchFalloById(client, id);

    if (!fallo) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    return res.json(fallo);
  } catch (error) {
    console.error("Error al obtener el detalle del fallo técnico:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al obtener el detalle del fallo.",
    });
  } finally {
    client.release();
  }
};

export const getFallos = async (req, res) => {
  const client = await pool.connect();

  try {
    const clienteIdRaw = req.query.cliente_id;
    const reportadoClienteRaw = req.query.reportado_cliente;
    const consolaIdRaw = req.query.consola_id;
    const haciendaIdRaw = req.query.hacienda_id;

    const clienteId = parseOptionalNumberParam(clienteIdRaw);
    const consolaId = parseOptionalNumberParam(consolaIdRaw);
    const haciendaId = parseOptionalNumberParam(haciendaIdRaw);
    const reportadoClienteValues = normalizeReportadoClienteFilter(reportadoClienteRaw);

    if (clienteIdRaw && clienteId === undefined) {
      return res.status(400).json({ message: "El parámetro cliente_id debe ser válido." });
    }

    if (consolaIdRaw && consolaId === undefined) {
      return res.status(400).json({ message: "El parámetro consola_id debe ser válido." });
    }

    if (haciendaIdRaw && haciendaId === undefined) {
      return res.status(400).json({ message: "El parámetro hacienda_id debe ser válido." });
    }

    if (reportadoClienteRaw && reportadoClienteValues === undefined) {
      return res
        .status(400)
        .json({ message: "El parámetro reportado_cliente debe ser válido." });
    }

    const filtros = [];
    const params = [];

    if (consolaId) {
      params.push(consolaId);
      filtros.push(`AND ft.consola_id = $${params.length}`);
    }

    if (clienteId) {
      params.push(clienteId);
      filtros.push(`AND sitio.cliente_id = $${params.length}`);
    }

    if (haciendaId) {
      params.push(haciendaId);
      filtros.push(`AND sitio.hacienda_id = $${params.length}`);
    }

    if (reportadoClienteValues !== null) {
      params.push(reportadoClienteValues);
      filtros.push(`AND ${reportadoBooleanSqlExpression('ft')} = $${params.length}`);
    }

    const whereFilters = filtros.length > 0 ? `WHERE 1 = 1 ${filtros.join(" ")}` : "";

    const reportadoSelect = `${reportadoBooleanSqlExpression('ft')} AS reportado_al_cliente`;

    const sql = `SELECT
        ft.id,
        ft.fecha,
        ft.hora,
        COALESCE(
          TO_CHAR(ft.fecha::timestamp + COALESCE(ft.hora, '00:00:00'::time), 'YYYY-MM-DD HH24:MI'),
          TO_CHAR(ft.fecha_creacion, 'YYYY-MM-DD HH24:MI')
        ) AS fecha_hora_fallo,
        ft.equipo_afectado,
        ft.descripcion_fallo,
        ft.camera_id,
        ft.encoding_device_id,
        ft.ip_speaker_id,
        ft.alarm_input_id,
        COALESCE(responsable.nombre_completo, responsable.nombre_usuario) AS responsable,
        dept.nombre AS departamento,
        dept.id AS departamento_id,
        consola.nombre AS consola,
        ft.consola_id,
        COALESCE(sitio.nombre, 'Sin sitio asignado') AS sitio,
        sitio.nombre AS sitio_nombre,
        sitio.cliente_id AS cliente_id,
        cliente.nombre AS cliente_nombre,
        sitio.hacienda_id AS hacienda_id,
        hacienda.nombre AS hacienda_nombre,
        ft.tipo_problema_id,
        tp.descripcion AS tipo_problema_descripcion,
        tp.descripcion AS problema,
        ft.tipo_afectacion,
        CASE
          WHEN ft.tipo_afectacion = 'EQUIPO' THEN
            CASE
              WHEN ft.camera_id IS NOT NULL THEN 'EQUIPO-CÁMARA'
              WHEN ft.encoding_device_id IS NOT NULL THEN 'EQUIPO-GRABADOR'
              WHEN ft.ip_speaker_id IS NOT NULL THEN 'EQUIPO-IP SPEAKER'
              WHEN ft.alarm_input_id IS NOT NULL THEN 'EQUIPO-ALARM INPUT'
              ELSE 'EQUIPO'
            END
          ELSE COALESCE(ft.tipo_afectacion, 'SIN INFORMACIÓN')
        END AS tipo_afectacion_detalle,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN
            TRIM(
              REGEXP_REPLACE(
                SPLIT_PART(ft.equipo_afectado, ' en ', 1),
                '\\s*\\(.*\\)$',
                ''
              )
            )
          ELSE NULL
        END AS tipo_equipo_afectado,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN
            CASE
              WHEN ft.camera_id IS NOT NULL THEN 'CÁMARA'
              WHEN ft.encoding_device_id IS NOT NULL THEN 'GRABADOR'
              WHEN ft.ip_speaker_id IS NOT NULL THEN 'IP SPEAKER'
              WHEN ft.alarm_input_id IS NOT NULL THEN 'ALARM INPUT'
              ELSE TRIM(
                REGEXP_REPLACE(
                  SPLIT_PART(ft.equipo_afectado, ' en ', 1),
                  '\\s*\\(.*\\)$',
                  ''
                )
              )
            END
          ELSE NULL
        END AS tipo_equipo_afectado_nombre,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'EQUIPO' THEN ft.equipo_afectado
          ELSE NULL
        END AS nombre_equipo,
        CASE
          WHEN UPPER(ft.tipo_afectacion) = 'NODO' THEN NULLIF(ft.equipo_afectado, '')
          ELSE NULL
        END AS nodo_nombre,
        ${reportadoSelect},
        ft.fecha_resolucion,
        ft.hora_resolucion,
        ft.estado,
        CASE
          WHEN ft.fecha_resolucion IS NOT NULL THEN 'RESUELTO'
          WHEN ft.fecha IS NOT NULL THEN CONCAT(
            GREATEST(0, (CURRENT_DATE::date - ft.fecha)::int),
            ' días pendiente'
          )
          ELSE '0 días pendiente'
        END AS estado_texto,
        seguimiento_ultimo.novedad_detectada AS novedad,
        seguimiento_ultimo.novedad_detectada,
        seguimiento_ultimo.ultimo_usuario_edito_id,
        seguimiento_ultimo.ultimo_usuario_edito_nombre,
        ft.responsable_verificacion_cierre_id,
        COALESCE(responsable_cierre.nombre_completo, responsable_cierre.nombre_usuario) AS responsable_verificacion_cierre_nombre,
        dept.nombre AS departamento_responsable,
        ft.fecha_creacion,
        ft.fecha_actualizacion
      FROM fallos_tecnicos ft
      LEFT JOIN usuarios responsable ON responsable.id = ft.responsable_id
      LEFT JOIN usuarios responsable_cierre ON responsable_cierre.id = ft.responsable_verificacion_cierre_id
      LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
      LEFT JOIN consolas consola ON consola.id = ft.consola_id
      LEFT JOIN sitios sitio ON sitio.id = ft.sitio_id
      LEFT JOIN clientes cliente ON cliente.id = sitio.cliente_id
      LEFT JOIN hacienda hacienda ON hacienda.id = sitio.hacienda_id
      LEFT JOIN catalogo_tipo_problema tp ON tp.id = ft.tipo_problema_id
      LEFT JOIN hik_camera_resource_status camera ON camera.id = ft.camera_id
      LEFT JOIN hik_encoding_device_status encoding_device ON encoding_device.id = ft.encoding_device_id
      LEFT JOIN hik_ip_speaker_status ip_speaker ON ip_speaker.id = ft.ip_speaker_id
      LEFT JOIN hik_alarm_input_status alarm_input ON alarm_input.id = ft.alarm_input_id
      LEFT JOIN (
        SELECT DISTINCT ON (sf.fallo_id)
          sf.fallo_id,
          sf.novedad_detectada,
          sf.ultimo_usuario_edito_id,
          COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario) AS ultimo_usuario_edito_nombre
        FROM seguimiento_fallos sf
        LEFT JOIN usuarios ultimo_editor ON ultimo_editor.id = sf.ultimo_usuario_edito_id
        ORDER BY sf.fallo_id, sf.fecha_creacion DESC
      ) seguimiento_ultimo ON seguimiento_ultimo.fallo_id = ft.id
      ${whereFilters}
      ORDER BY ft.fecha DESC, ft.id DESC`;

    logSql("FALLOS_CONSULTAS_DATA", sql, params);
    const result = await client.query(sql, params); // FIX: rewritten query uses LEFT JOINs only with existing lookup tables to avoid failing when optional relations are missing and to provide the consola name.

    const fallos = result.rows.map(mapFalloRowToDto);

    return res.json(fallos);
  } catch (error) {
    console.error("Error al obtener los fallos técnicos:", error); // FIX: keep logging to help troubleshoot database errors without crashing the server.
    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    }); // FIX: respond with a consistent 500 payload that the frontend can handle gracefully.
  } finally {
    client.release();
  }
};

export const exportFallosTecnicosConsultasExcel = async (req, res) => {
  const client = await pool.connect();

  try {
    const clienteIdRaw = req.query.cliente_id;
    const reportadoClienteRaw = req.query.reportado_cliente;
    const consolaIdRaw = req.query.consola_id;
    const haciendaIdRaw = req.query.hacienda_id;
    const fechaDesdeRaw = req.query.fecha_desde ?? req.query.fechaDesde;
    const fechaHastaRaw = req.query.fecha_hasta ?? req.query.fechaHasta;
    const problemaRaw = req.query.problema;
    const tipoAfectacionRaw = req.query.tipo_afectacion;
    const sitioRaw = req.query.sitio;
    const estadoRaw = req.query.estado;
    const departamentoRaw = req.query.departamento;

    const clienteId = parseOptionalNumberParam(clienteIdRaw);
    const consolaId = parseOptionalNumberParam(consolaIdRaw);
    const haciendaId = parseOptionalNumberParam(haciendaIdRaw);
    const reportadoClienteValues = normalizeReportadoClienteFilter(reportadoClienteRaw);

    if (clienteIdRaw && clienteId === undefined) {
      return res.status(400).json({ message: "El parámetro cliente_id debe ser válido." });
    }

    if (consolaIdRaw && consolaId === undefined) {
      return res.status(400).json({ message: "El parámetro consola_id debe ser válido." });
    }

    if (haciendaIdRaw && haciendaId === undefined) {
      return res.status(400).json({ message: "El parámetro hacienda_id debe ser válido." });
    }

    if (reportadoClienteRaw && reportadoClienteValues === undefined) {
      return res
        .status(400)
        .json({ message: "El parámetro reportado_cliente debe ser válido." });
    }

    const normalizedEstado = estadoRaw ? String(estadoRaw).trim().toLowerCase() : "";
    if (
      normalizedEstado &&
      normalizedEstado !== "resuelto" &&
      normalizedEstado !== "pendiente"
    ) {
      return res.status(400).json({ message: "El parámetro estado debe ser válido." });
    }

    const parseDateFilter = (value) => {
      if (!value) return null;
      const parsed = new Date(String(value));
      if (Number.isNaN(parsed.getTime())) {
        return undefined;
      }
      return String(value);
    };

    const fechaDesde = parseDateFilter(fechaDesdeRaw);
    const fechaHasta = parseDateFilter(fechaHastaRaw);

    if (fechaDesdeRaw && fechaDesde === undefined) {
      return res.status(400).json({ message: "El parámetro fecha_desde debe ser válido." });
    }

    if (fechaHastaRaw && fechaHasta === undefined) {
      return res.status(400).json({ message: "El parámetro fecha_hasta debe ser válido." });
    }

    const sanitizeText = (value) =>
      value === undefined || value === null || String(value).trim() === ""
        ? null
        : String(value).trim();

    const problema = sanitizeText(problemaRaw);
    const tipoAfectacion = sanitizeText(tipoAfectacionRaw);
    const sitio = sanitizeText(sitioRaw);
    const departamento = sanitizeText(departamentoRaw);

    const filtros = [];
    const params = [];

    if (consolaId) {
      params.push(consolaId);
      filtros.push(`AND A.CONSOLA_ID = $${params.length}`);
    }

    if (clienteId) {
      params.push(clienteId);
      filtros.push(`AND sitio.cliente_id = $${params.length}`);
    }

    if (haciendaId) {
      params.push(haciendaId);
      filtros.push(`AND sitio.hacienda_id = $${params.length}`);
    }

    if (reportadoClienteValues !== null) {
      params.push(reportadoClienteValues);
      filtros.push(`AND ${reportadoBooleanSqlExpression('A')} = $${params.length}`);
    }

    const reportadoRawExpression = reportadoBooleanSqlExpression('A');
    const reportadoRawSelect = `${reportadoRawExpression} AS reportado_cliente_raw`;
    const reportadoSelect = `CASE
        WHEN ${reportadoRawExpression} THEN 'SI'
        ELSE 'NO'
      END AS reportado_al_cliente`;

    if (fechaDesde) {
      params.push(fechaDesde);
      filtros.push(`AND COALESCE(A.FECHA, A.FECHA_CREACION::date) >= $${params.length}`);
    }

    if (fechaHasta) {
      params.push(fechaHasta);
      filtros.push(`AND COALESCE(A.FECHA, A.FECHA_CREACION::date) <= $${params.length}`);
    }

    if (problema) {
      params.push(`%${problema}%`);
      filtros.push(
        `AND (TP.DESCRIPCION ILIKE $${params.length} OR A.DESCRIPCION_FALLO ILIKE $${params.length})`
      );
    }

    if (tipoAfectacion) {
      params.push(String(tipoAfectacion).toLowerCase());
      filtros.push(`AND LOWER(
        CASE
          WHEN A.TIPO_AFECTACION = 'EQUIPO' THEN
            CASE
              WHEN A.CAMERA_ID IS NOT NULL THEN 'EQUIPO-CÁMARA'
              WHEN A.ENCODING_DEVICE_ID IS NOT NULL THEN 'EQUIPO-GRABADOR'
              WHEN A.IP_SPEAKER_ID IS NOT NULL THEN 'EQUIPO-IP SPEAKER'
              WHEN A.ALARM_INPUT_ID IS NOT NULL THEN 'EQUIPO-ALARM INPUT'
              ELSE 'EQUIPO'
            END
          ELSE COALESCE(A.TIPO_AFECTACION, 'SIN INFORMACIÓN')
        END
      ) = $${params.length}`);
    }

    if (sitio) {
      params.push(`%${sitio}%`);
      filtros.push(`AND sitio.nombre ILIKE $${params.length}`);
    }

    if (departamento) {
      params.push(`%${departamento}%`);
      filtros.push(`AND dept_actual.nombre ILIKE $${params.length}`);
    }

    if (normalizedEstado === "resuelto") {
      filtros.push(
        "AND (A.FECHA_RESOLUCION IS NOT NULL OR UPPER(COALESCE(A.ESTADO, '')) = 'RESUELTO')"
      );
    }

    if (normalizedEstado === "pendiente") {
      filtros.push(
        "AND (A.FECHA_RESOLUCION IS NULL AND UPPER(COALESCE(A.ESTADO, '')) <> 'RESUELTO')"
      );
    }

    const whereFilters = filtros.length > 0 ? `WHERE 1 = 1 ${filtros.join(" ")}` : "WHERE 1 = 1";

    const query = `
      WITH MOVS AS (
          SELECT
              A.ID AS FALLO_ID,
              A.FECHA_CREACION AS FECHA_EVENTO,
              NULL::UUID AS SEGUIMIENTO_ID,
              A.DEPARTAMENTO_ID AS DEPARTAMENTO_ID,
              NULL::TEXT AS NOVEDAD_DETECTADA,
              A.RESPONSABLE_ID AS ULTIMO_USUARIO_EDITO_ID,
              NULL::INTEGER AS VERIFICACION_APERTURA_ID,
              NULL::INTEGER AS VERIFICACION_CIERRE_ID,
              NULL::INTEGER AS RESPONSABLE_VERIFICACION_CIERRE_ID,
              NULL::INTEGER AS VERIFICACION_SUPERVISOR_ID,
              NULL::INTEGER AS VERIFICACION_CIERRE_ID_USUARIO,
              NULL::TIMESTAMP AS FECHA_ACTUALIZACION_SEGUIMIENTO
          FROM FALLOS_TECNICOS A

          UNION ALL

          SELECT
              B.FALLO_ID AS FALLO_ID,
              B.FECHA_CREACION AS FECHA_EVENTO,
              B.ID AS SEGUIMIENTO_ID,
              B.DEPARTAMENTO_ID AS DEPARTAMENTO_ID,
              B.NOVEDAD_DETECTADA AS NOVEDAD_DETECTADA,
              B.ULTIMO_USUARIO_EDITO_ID AS ULTIMO_USUARIO_EDITO_ID,
              B.VERIFICACION_APERTURA_ID AS VERIFICACION_APERTURA_ID,
              B.VERIFICACION_CIERRE_ID AS VERIFICACION_CIERRE_ID,
              B.RESPONSABLE_VERIFICACION_CIERRE_ID AS RESPONSABLE_VERIFICACION_CIERRE_ID,
              B.VERIFICACION_SUPERVISOR_ID AS VERIFICACION_SUPERVISOR_ID,
              B.VERIFICACION_CIERRE_ID AS VERIFICACION_CIERRE_ID_USUARIO,
              B.FECHA_ACTUALIZACION AS FECHA_ACTUALIZACION_SEGUIMIENTO
          FROM SEGUIMIENTO_FALLOS B
      ),
      BASE AS (
          SELECT
              A.ID AS ID_FALLO,
              ROW_NUMBER() OVER (
                  PARTITION BY A.ID
                  ORDER BY B.FECHA_EVENTO, CASE WHEN B.SEGUIMIENTO_ID IS NULL THEN 0 ELSE 1 END
              ) - 1 AS NUM_EVENTO,
              B.FECHA_EVENTO AS FECHA_EVENTO,
              EXTRACT(EPOCH FROM (
                  B.FECHA_EVENTO - COALESCE(
                      LAG(B.FECHA_EVENTO) OVER (
                          PARTITION BY A.ID
                          ORDER BY B.FECHA_EVENTO, CASE WHEN B.SEGUIMIENTO_ID IS NULL THEN 0 ELSE 1 END
                      ),
                      A.FECHA_CREACION
                  )
              ))::INT AS DURACION_DESDE_ULTIMA_MODIFICACION_SEG,
              EXTRACT(EPOCH FROM (
                  COALESCE(
                      CASE
                          WHEN A.FECHA_RESOLUCION IS NOT NULL AND A.HORA_RESOLUCION IS NOT NULL THEN (A.FECHA_RESOLUCION::TIMESTAMP + A.HORA_RESOLUCION)
                          WHEN A.FECHA_RESOLUCION IS NOT NULL THEN (A.FECHA_RESOLUCION::TIMESTAMP)
                          ELSE NOW()::TIMESTAMP
                      END,
                      NOW()::TIMESTAMP
                  ) - (A.FECHA_CREACION::TIMESTAMP)
              ))::INT AS DURACION_TOTAL_FALLO_SEG,

              -- CAMPOS DEL EVENTO / SEGUIMIENTO
              B.SEGUIMIENTO_ID AS ID_SEGUIMIENTO,
              B.DEPARTAMENTO_ID AS DEPARTAMENTO_ID_EVENTO,
              C.NOMBRE AS DEPARTAMENTO_NOMBRE_EVENTO,
              B.NOVEDAD_DETECTADA AS NOVEDAD_DETECTADA,
              B.ULTIMO_USUARIO_EDITO_ID AS ULTIMO_USUARIO_EDITO_ID,
              D.NOMBRE_USUARIO AS ULTIMO_USUARIO_EDITO_USUARIO,
              D.NOMBRE_COMPLETO AS ULTIMO_USUARIO_EDITO_NOMBRE_COMPLETO,
              B.VERIFICACION_APERTURA_ID AS VERIFICACION_APERTURA_ID,
              B.VERIFICACION_CIERRE_ID AS VERIFICACION_CIERRE_ID,
              B.RESPONSABLE_VERIFICACION_CIERRE_ID AS RESPONSABLE_VERIFICACION_CIERRE_ID,
              B.VERIFICACION_SUPERVISOR_ID AS VERIFICACION_SUPERVISOR_ID,
              B.VERIFICACION_CIERRE_ID_USUARIO AS VERIFICACION_CIERRE_ID_USUARIO,
              B.FECHA_ACTUALIZACION_SEGUIMIENTO AS FECHA_ACTUALIZACION_SEGUIMIENTO,

              -- TODOS LOS CAMPOS DE FALLOS_TECNICOS (repetidos por fila)
              A.FECHA,
              A.EQUIPO_AFECTADO,
              A.DESCRIPCION_FALLO,
              A.RESPONSABLE_ID,
              A.DEPARTAMENTO_ID AS DEPARTAMENTO_ID_ACTUAL,
              dept_actual.NOMBRE AS DEPARTAMENTO_NOMBRE_ACTUAL,
              A.TIPO_PROBLEMA_ID,
              A.CONSOLA_ID,
              A.FECHA_RESOLUCION,
              A.HORA_RESOLUCION,
              A.ESTADO,
              A.FECHA_CREACION,
              A.FECHA_ACTUALIZACION,
              A.SITIO_ID,
              A.HORA,
              A.TIPO_AFECTACION,
              A.CAMERA_ID,
              A.ENCODING_DEVICE_ID,
              A.IP_SPEAKER_ID,
              A.ALARM_INPUT_ID,
              ${reportadoRawSelect},
              sitio.nombre AS sitio_nombre,
              consola.nombre AS nombre_consola,
              cliente.nombre AS cliente_nombre,
              hacienda.nombre AS hacienda_nombre,
              COALESCE(nodo.nombre, CASE
                WHEN UPPER(A.TIPO_AFECTACION) = 'NODO' THEN NULLIF(TRIM(A.EQUIPO_AFECTADO), '')
                ELSE NULL
              END) AS nodo_nombre,
              COALESCE(responsable.nombre_completo, responsable.nombre_usuario) AS nombre_co,
              CASE
                WHEN UPPER(A.TIPO_AFECTACION) = 'EQUIPO' THEN
                  CASE
                    WHEN A.CAMERA_ID IS NOT NULL THEN 'Cámaras'
                    WHEN A.ENCODING_DEVICE_ID IS NOT NULL THEN 'Grabador'
                    WHEN A.IP_SPEAKER_ID IS NOT NULL THEN 'Megáfono IP'
                    WHEN A.ALARM_INPUT_ID IS NOT NULL THEN 'Alarm Input'
                    ELSE NULLIF(
                      TRIM(
                        REGEXP_REPLACE(
                          SPLIT_PART(A.EQUIPO_AFECTADO, ' en ', 1),
                          '\\s*\\(.*\\)$',
                          ''
                        )
                      ),
                      ''
                    )
                  END
                ELSE NULL
              END AS tipo_equipo_afectado_nombre,
              CASE
                WHEN UPPER(A.TIPO_AFECTACION) = 'EQUIPO' THEN COALESCE(
                  NULLIF(TRIM(
                    CASE
                      WHEN A.CAMERA_ID IS NOT NULL THEN (camera.camera_name || ' - ' || camera.ip_address)
                      WHEN A.ENCODING_DEVICE_ID IS NOT NULL THEN encoding_device.name
                      WHEN A.IP_SPEAKER_ID IS NOT NULL THEN ip_speaker.name
                      WHEN A.ALARM_INPUT_ID IS NOT NULL THEN alarm_input.name
                      ELSE NULL
                    END
                  ), ''),
                  NULLIF(TRIM(A.EQUIPO_AFECTADO), ''),
                  '-'
                )
                ELSE COALESCE(NULLIF(TRIM(A.EQUIPO_AFECTADO), ''), '-')
              END AS nombre_equipo,
              ${reportadoSelect}

          FROM FALLOS_TECNICOS A
          JOIN MOVS B ON (B.FALLO_ID = A.ID)
          LEFT JOIN DEPARTAMENTOS_RESPONSABLES C ON (C.ID = B.DEPARTAMENTO_ID)
          LEFT JOIN USUARIOS D ON (D.ID = B.ULTIMO_USUARIO_EDITO_ID)
          LEFT JOIN USUARIOS responsable ON (responsable.ID = A.RESPONSABLE_ID)
          LEFT JOIN DEPARTAMENTOS_RESPONSABLES dept_actual ON (dept_actual.ID = A.DEPARTAMENTO_ID)
          LEFT JOIN CATALOGO_TIPO_PROBLEMA TP ON (TP.ID = A.TIPO_PROBLEMA_ID)
          LEFT JOIN CONSOLAS consola ON (consola.ID = A.CONSOLA_ID)
          LEFT JOIN SITIOS sitio ON (sitio.ID = A.SITIO_ID)
          LEFT JOIN CLIENTES cliente ON (cliente.ID = sitio.CLIENTE_ID)
          LEFT JOIN HACIENDA hacienda ON (hacienda.ID = sitio.HACIENDA_ID)
          LEFT JOIN LATERAL (
            SELECT n.nombre
            FROM nodos_sitios ns
            JOIN nodos n ON n.id = ns.nodo_id
            WHERE ns.sitio_id = sitio.id
            ORDER BY ns.fecha_asignacion DESC NULLS LAST, ns.nodo_id DESC
            LIMIT 1
          ) nodo ON TRUE
          LEFT JOIN hik_camera_resource_status camera ON camera.id = A.camera_id
          LEFT JOIN hik_encoding_device_status encoding_device ON encoding_device.id = A.encoding_device_id
          LEFT JOIN hik_ip_speaker_status ip_speaker ON ip_speaker.id = A.ip_speaker_id
          LEFT JOIN hik_alarm_input_status alarm_input ON alarm_input.id = A.alarm_input_id
          ${whereFilters}
      )
      SELECT *
      FROM BASE
      ORDER BY ID_FALLO, NUM_EVENTO;
    `;

    logSql("FALLOS_CONSULTAS_EXPORT", query, params);
    const result = await client.query(query, params);

    console.log('[EXPORT][DB rows length]', result.rows?.length);
    console.log('[EXPORT][DB sample row]', result.rows?.[0]);
    console.log('[EXPORT][SAMPLE tipo_equipo_afectado_nombre]', result.rows?.slice(0, 10).map(r => ({
      id_fallo: r.id_fallo,
      equipo_afectado: r.equipo_afectado,
      tipo_afectacion: r.tipo_afectacion,
      tipo_equipo_afectado_nombre: r.tipo_equipo_afectado_nombre
    })));
    console.log(
      '[EXPORT][DB sample tipo_equipo_afectado_nombre]',
      result.rows?.[0]?.tipo_equipo_afectado_nombre
    );
    console.log('[EXPORT][DB sample keys]', Object.keys(result.rows?.[0] || {}));

    const rowsToSend = result.rows.map((row) => ({
      ...row,
      duracion_desde_ultima_modificacion_hhmmss: formatDurationSeconds(
        row.duracion_desde_ultima_modificacion_seg
      ),
      duracion_total_fallo_hhmmss: formatDurationSeconds(row.duracion_total_fallo_seg),
    }));

    console.log('[EXPORT][RESPONSE sample row]', rowsToSend?.[0] || result.rows?.[0]);
    console.log(
      '[EXPORT][RESPONSE sample tipo_equipo_afectado_nombre]',
      (rowsToSend?.[0] || result.rows?.[0])?.tipo_equipo_afectado_nombre
    );

    return res.status(200).json(rowsToSend);
  } catch (error) {
    console.error("Error al exportar fallos técnicos:", error);
    return res.status(500).json({
      message: "No se pudo exportar fallos técnicos",
      detail: error?.message,
    });
  } finally {
    client.release();
  }
};

export const guardarCambiosFallo = async (req, res) => {
  const { id } = req.params;
  const { departamento_id, novedad_detectada } = req.body || {};

  console.log("[guardarCambiosFallo] BODY COMPLETO:", req.body);

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador del fallo es obligatorio." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT estado FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    if (existingResult.rows[0].estado === "CERRADO") {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ mensaje: "Fallo cerrado, no editable." });
    }

    let departamentoId = normalizeDepartamentoId(departamento_id);
    departamentoId = validateDepartamentoId(departamentoId);

    console.log("departamento_id final:", departamentoId);

    const novedad =
      typeof novedad_detectada === "string"
        ? novedad_detectada.trim() || null
        : null;

    const updateResult = await client.query(
      `UPDATE fallos_tecnicos
          SET departamento_id = $1,
              fecha_actualizacion = NOW()
        WHERE id = $2
          AND (estado IS NULL OR estado <> 'CERRADO')`,
      [departamentoId, id]
    );

    if (!updateResult.rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ mensaje: "Fallo cerrado, no editable." });
    }

    const supervisorId = getAuthenticatedUserId(req);

    console.log("[guardarCambiosFallo] supervisorId:", supervisorId);
    console.log("[guardarCambiosFallo] novedad:", novedad);

    const seguimientoInsertado = await insertSeguimientoDepartamento(client, {
      falloId: id,
      departamentoId,
      novedadDetectada: novedad,
      usuarioId: supervisorId,
    });

    console.log(
      "[guardarCambiosFallo] seguimiento_fallos insertado para fallo_id:",
      id,
      "resultado:",
      seguimientoInsertado,
    );

    await client.query("COMMIT");

    const fallo = await fetchFalloById(client, id);
    return res.json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al guardar cambios del fallo:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al guardar los cambios." });
  } finally {
    client.release();
  }
};

export const cerrarFalloTecnico = async (req, res) => {
  const { id } = req.params;
  const {
    fecha_resolucion: fechaResolucion,
    hora_resolucion: horaResolucion,
    departamento_id: departamentoResponsableId,
    responsable_verificacion_cierre_id: responsableVerificacionCierreIdRaw,
  } = req.body || {};

  console.log("[cerrarFalloTecnico] BODY COMPLETO:", req.body);

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador del fallo es obligatorio." });
  }

  if (!fechaResolucion || !horaResolucion) {
    return res.status(400).json({
      mensaje: "Debe ingresar la fecha y hora de resolución para cerrar el fallo.",
    });
  }

  const futureResolutionError = validateResolutionDateNotFuture(
    fechaResolucion,
    horaResolucion
  );

  if (futureResolutionError) {
    return res.status(400).json({
      mensaje: futureResolutionError,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT estado FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    if (existingResult.rows[0].estado === "CERRADO") {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: "Ya está cerrado." });
    }

    let departamentoIdValue = normalizeDepartamentoId(departamentoResponsableId);
    departamentoIdValue = validateDepartamentoId(departamentoIdValue);

    console.log("departamento_id final:", departamentoIdValue);

    const updateResult = await client.query(
      `UPDATE fallos_tecnicos
          SET fecha_resolucion = $1,
              hora_resolucion = $2,
              departamento_id = $3,
              responsable_verificacion_cierre_id = $4,
              fecha_actualizacion = NOW()
        WHERE id = $5
          AND (estado IS NULL OR estado <> 'CERRADO')`,
      [
        fechaResolucion,
        horaResolucion,
        departamentoIdValue,
        toNullableUserId(responsableVerificacionCierreIdRaw),
        id,
      ]
    );

    if (!updateResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: "Ya está cerrado." });
    }

    const usuarioCierreId = getAuthenticatedUserId(req);
    const responsableVerificacionCierreId = toNullableUserId(
      responsableVerificacionCierreIdRaw
    );

    console.log("[cerrarFalloTecnico] usuarioCierreId:", usuarioCierreId);
    console.log(
      "[cerrarFalloTecnico] responsableVerificacionCierreIdRaw:",
      responsableVerificacionCierreIdRaw
    );
    console.log(
      "[cerrarFalloTecnico] responsableVerificacionCierreId (normalizado):",
      responsableVerificacionCierreId
    );

    const seguimientoAbierto = await getSeguimientoAbierto(client, id);
    const fechaCierreSeguimiento = buildDateTime(fechaResolucion, horaResolucion);

    if (!fechaCierreSeguimiento) {
      throw new Error(
        "No fue posible construir la fecha de cierre para seguimiento_fallos"
      );
    }

    if (seguimientoAbierto?.id) {
      await cerrarSeguimientoAbierto(client, {
        seguimientoId: seguimientoAbierto.id,
        fechaHasta: fechaCierreSeguimiento,
        usuarioId: usuarioCierreId,
      });
    }

    await insertSeguimientoPersistido(client, {
      falloId: id,
      departamentoId:
        departamentoIdValue ??
        seguimientoAbierto?.departamento_id ??
        DEPARTAMENTO_MONITOREO_ID,
      paso: PASO_SEGUIMIENTO.CIERRE,
      fechaInicio: fechaCierreSeguimiento,
      fechaHasta: fechaCierreSeguimiento,
      usuarioId: usuarioCierreId,
      verificacionCierreId: usuarioCierreId,
      responsableVerificacionCierreId,
      verificacionSupervisorId: usuarioCierreId,
    });

    console.log("Registro de cierre persistido en seguimiento_fallos");

    console.log(
      "[cerrarFalloTecnico] seguimiento_fallos insertado para fallo_id:",
      id,
      "con verificacion_cierre_id:",
      usuarioCierreId,
      "y responsable_verificacion_cierre_id:",
      responsableVerificacionCierreId
    );

    await client.query("COMMIT");

    const fallo = await fetchFalloById(client, id);
    return res.json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al cerrar el fallo técnico:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al cerrar el fallo técnico." });
  } finally {
    client.release();
  }
};

export const createFallo = async (req, res) => {
  const {
    fecha,
    hora,
    equipo_afectado,
    descripcion_fallo,
    responsable,
    deptResponsable,
    departamento_id: departamentoIdSnake,
    departamentoId: departamentoIdCamel,
    tipoProblema,
    tipo_problema_id: tipoProblemaIdSnake,
    tipoProblemaId: tipoProblemaIdCamel,
    consola,
    fechaResolucion,
    horaResolucion,
    horaFallo,
    fechaHoraFallo,
    tipo_afectacion,
    affectationType,
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
    sitio_id: rawSitioId,
    sitioId: rawSitioIdCamel,
    nodo,
    nodoId,
    nodo_id: nodoIdSnake,
    usuarioId,
    camera_id,
    encodingDeviceId,
    encoding_device_id: encodingDeviceIdSnake,
    ipSpeakerId,
    ip_speaker_id: ipSpeakerIdSnake,
    alarmInputId,
    alarm_input_id: alarmInputIdSnake,
    reportadoCliente,
    reportado_al_cliente: reportadoAlClienteSnake,
    reportado_cliente: reportadoClienteSnake,
    reportadoAlCliente,
  } = req.body || {};

  console.log("[createFallo] BODY COMPLETO:", JSON.stringify(req.body, null, 2));
  console.log("[createFallo] usuarioId recibido en body:", usuarioId);

  const reportadoClientePayload = parseReportadoClienteFromPayload({
    reportadoCliente,
    reportado_al_cliente: reportadoAlClienteSnake,
    reportado_cliente: reportadoClienteSnake,
    reportadoAlCliente,
  });

  if (reportadoClientePayload.invalid) {
    return res.status(400).json({
      mensaje: "El campo reportadoCliente/reportado_al_cliente no es válido.",
    });
  }

  console.log(
    "[createFallo] reportado al cliente recibido/parseado:",
    reportadoClientePayload
  );

  const { fecha: fechaFalloValue, hora: horaFalloValue } = resolveFechaHoraFallo({
    fecha,
    hora,
    horaFallo,
    fechaHoraFallo,
  });

  console.log(
    "[createFallo] fechaFalloValue:",
    fechaFalloValue,
    "horaFalloValue:",
    horaFalloValue
  );

  if (
    !fechaFalloValue ||
    !equipo_afectado ||
    !descripcion_fallo ||
    !responsable
  ) {
    return res.status(400).json({
      mensaje:
        "Los campos fecha, equipo_afectado, descripcion_fallo y responsable son obligatorios.",
    });
  }

  const sitioIdSource =
    rawSitioId !== undefined && rawSitioId !== null && rawSitioId !== ""
      ? rawSitioId
      : rawSitioIdCamel;

  const sitioIdValue =
    sitioIdSource === undefined || sitioIdSource === null || sitioIdSource === ""
      ? null
      : Number(sitioIdSource);

  const cameraIdValue = (() => {
    if (camera_id === undefined || camera_id === null || camera_id === "") {
      return null;
    }
    const parsed = Number(camera_id);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  if (
    sitioIdSource !== undefined &&
    sitioIdSource !== null &&
    sitioIdSource !== "" &&
    (Number.isNaN(sitioIdValue) || !Number.isInteger(sitioIdValue))
  ) {
    return res.status(400).json({
      mensaje: "El identificador del sitio proporcionado no es válido.",
    });
  }

  const tipoProblemaIdSource =
    tipoProblemaIdSnake !== undefined &&
    tipoProblemaIdSnake !== null &&
    tipoProblemaIdSnake !== ""
      ? tipoProblemaIdSnake
      : tipoProblemaIdCamel;

  const parsedTipoProblemaId =
    tipoProblemaIdSource === undefined ||
    tipoProblemaIdSource === null ||
    tipoProblemaIdSource === ""
      ? null
      : Number(tipoProblemaIdSource);

  if (
    tipoProblemaIdSource !== undefined &&
    tipoProblemaIdSource !== null &&
    tipoProblemaIdSource !== "" &&
    (Number.isNaN(parsedTipoProblemaId) || !Number.isInteger(parsedTipoProblemaId))
  ) {
    return res.status(400).json({
      mensaje: "El identificador del tipo de problema proporcionado no es válido.",
    });
  }

  const rawTipoAfectacion = tipo_afectacion ?? affectationType;
  const tipoAfectacionValue =
    rawTipoAfectacion === undefined || rawTipoAfectacion === null
      ? null
      : String(rawTipoAfectacion).trim() || null;

  const encodingDeviceIdSource =
    encodingDeviceId !== undefined && encodingDeviceId !== null && encodingDeviceId !== ""
      ? encodingDeviceId
      : encodingDeviceIdSnake;

  const parsedEncodingDeviceId = (() => {
    const normalized = String(encodingDeviceIdSource ?? "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  const encodingDeviceIdValue =
    tipoAfectacionValue && tipoAfectacionValue.toLowerCase() === "equipo"
      ? parsedEncodingDeviceId
      : null;

  const ipSpeakerIdSource =
    ipSpeakerId !== undefined && ipSpeakerId !== null && ipSpeakerId !== ""
      ? ipSpeakerId
      : ipSpeakerIdSnake;

  const parsedIpSpeakerId = (() => {
    const normalized = String(ipSpeakerIdSource ?? "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  const ipSpeakerIdValue =
    tipoAfectacionValue && tipoAfectacionValue.toLowerCase() === "equipo"
      ? parsedIpSpeakerId
      : null;

  const alarmInputIdSource =
    alarmInputId !== undefined && alarmInputId !== null && alarmInputId !== ""
      ? alarmInputId
      : alarmInputIdSnake;

  const parsedAlarmInputId = (() => {
    const normalized = String(alarmInputIdSource ?? "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  const alarmInputIdValue =
    tipoAfectacionValue && tipoAfectacionValue.toLowerCase() === "equipo"
      ? parsedAlarmInputId
      : null;

  const nodoIdentificador =
    nodo === undefined || nodo === null || nodo === ""
      ? nodoId ?? nodoIdSnake
      : nodo;

  if (
    tipoAfectacionValue?.toLowerCase() === "nodo" &&
    (nodoIdentificador === undefined || nodoIdentificador === null || nodoIdentificador === "")
  ) {
    return res.status(400).json({ mensaje: "Debe seleccionar un nodo." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const usuariosResult = await client.query(
      "SELECT id, nombre_usuario, nombre_completo FROM usuarios WHERE activo = true"
    );
    const usuarios = usuariosResult.rows;

    const responsableId =
      findUserId(usuarios, responsable) ||
      findUserId(usuarios, req.body?.responsableUsername);

    if (!responsableId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "No se encontró el usuario responsable proporcionado.",
      });
    }

    const deptResult = await client.query(
      "SELECT id, nombre FROM departamentos_responsables"
    );
    const dept = deptResult.rows;

    const departamentoIdFromPayload = validateDepartamentoId(
      normalizeDepartamentoId(departamentoIdSnake ?? departamentoIdCamel)
    );
    const departamentoId =
      departamentoIdFromPayload ??
      dept.find((d) => {
        return String(d.nombre).trim().toLowerCase() ===
          String(deptResponsable || "").trim().toLowerCase();
      })?.id ?? null;

    console.log("departamento_id final:", departamentoId);

    const tiposProblemaResult = await client.query(
      "SELECT id, descripcion FROM catalogo_tipo_problema"
    );
    const tipos = tiposProblemaResult.rows;
    let tipoProblemaId = parsedTipoProblemaId;
    if (tipoProblemaId === null) {
      tipoProblemaId =
        tipos.find((t) => {
          return String(t.descripcion).trim().toLowerCase() ===
            String(tipoProblema || descripcion_fallo || "").trim().toLowerCase();
        })?.id ?? null;
    }

    const consolasResult = await client.query(
      "SELECT id, nombre FROM consolas"
    );
    const consolasRows = consolasResult.rows;
    const consolaId = consolasRows.find((c) => {
      return String(c.nombre).trim().toLowerCase() ===
        String(consola || "").trim().toLowerCase();
    })?.id ?? null;

    console.log(
      "[createFallo] IDs resueltos => responsableId:",
      responsableId,
      "departamentoId:",
      departamentoId,
      "tipoProblemaId:",
      tipoProblemaId,
      "consolaId:",
      consolaId,
      "sitioIdValue:",
      sitioIdValue,
      "tipoAfectacionValue:",
      tipoAfectacionValue
    );

    const usuarioDesdeBody = toNullableUserId(usuarioId);
    const usuarioDesdeRequest = getAuthenticatedUserId(req); // puede venir en 0/null si no hay auth
    let verificacionAperturaId = usuarioDesdeBody || usuarioDesdeRequest || null;

    // Fallback final: si no se pudo determinar el usuario autenticado,
    // usa el mismo responsableId (mejor que dejar NULL).
    if (!verificacionAperturaId && responsableId) {
      verificacionAperturaId = responsableId;
    }

    console.log("[createFallo] usuarioDesdeBody:", usuarioDesdeBody);
    console.log("[createFallo] usuarioDesdeRequest:", usuarioDesdeRequest);
    console.log("[createFallo] responsableId:", responsableId);
    console.log("[createFallo] verificacionAperturaId FINAL:", verificacionAperturaId);

    const insertResult = await client.query(
      `INSERT INTO fallos_tecnicos (
        fecha,
        hora,
        equipo_afectado,
        descripcion_fallo,
        responsable_id,
        departamento_id,
        tipo_problema_id,
        consola_id,
        sitio_id,
        camera_id,
        encoding_device_id,
        ip_speaker_id,
        alarm_input_id,
        tipo_afectacion,
        reportado_al_cliente,
        fecha_resolucion,
        hora_resolucion,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
      ) RETURNING id`,
      [
        fechaFalloValue,
        horaFalloValue || null,
        equipo_afectado,
        descripcion_fallo,
        responsableId,
        departamentoId,
        tipoProblemaId,
        consolaId,
        sitioIdValue,
        cameraIdValue,
        encodingDeviceIdValue,
        ipSpeakerIdValue,
        alarmInputIdValue,
        tipoAfectacionValue,
        reportadoClientePayload.value,
        fechaResolucion || null,
        horaResolucion || null, // FIX: exclude estado so the generated column is calculated by PostgreSQL during inserts.
      ]
    );

    console.log("[createFallo] Resultado INSERT fallos_tecnicos:", insertResult.rows);
    const falloId = insertResult.rows[0]?.id;
    console.log("[createFallo] falloId generado:", falloId);

    if (!falloId) {
      throw new Error("No se pudo crear el fallo técnico.");
    }

    const fechaInicioSeguimiento = buildDateTime(
      fechaFalloValue,
      horaFalloValue || null
    );

    const seguimientoInsertado = await insertSeguimientoPersistido(client, {
      falloId,
      departamentoId: DEPARTAMENTO_MONITOREO_ID,
      paso: PASO_SEGUIMIENTO.INICIO,
      fechaInicio: fechaInicioSeguimiento,
      fechaHasta: null,
      novedadDetectada: novedadDetectada || null,
      usuarioId: verificacionAperturaId,
      verificacionAperturaId,
    });

    console.log(
      "[createFallo] seguimiento_fallos INSERT realizado:",
      seguimientoInsertado
    );

    await client.query("COMMIT");

    const fallo = await fetchFalloById(client, falloId);
    return res.status(201).json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear el fallo técnico (DEBUG):", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al crear el fallo técnico." });
  } finally {
    client.release();
  }
};

export const actualizarFalloSupervisor = async (req, res) => {
  const { id } = req.params;
  const {
    fecha,
    hora,
    deptResponsable,
    departamentoResponsableId,
    fechaResolucion,
    horaResolucion,
    horaFallo,
    fechaHoraFallo,
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
    ultimoUsuarioEditoId,
    responsable_verificacion_cierre_id,
    affectationType,
    tipo_afectacion,
    encodingDeviceId,
    encoding_device_id: encodingDeviceIdSnake,
    ipSpeakerId,
    ip_speaker_id: ipSpeakerIdSnake,
    alarmInputId,
    alarm_input_id: alarmInputIdSnake,
    reportadoCliente,
    reportado_al_cliente: reportadoAlClienteSnake,
    reportado_cliente: reportadoClienteSnake,
    reportadoAlCliente,
  } = req.body || {};

  console.log("[actualizarFalloSupervisor] body:", req.body);

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador del fallo es obligatorio." });
  }

  const futureResolutionError = validateResolutionDateNotFuture(
    fechaResolucion,
    horaResolucion
  );

  if (futureResolutionError) {
    return res.status(400).json({
      mensaje: futureResolutionError,
    });
  }

  const client = await pool.connect();
  const usuarioAutenticadoId = getAuthenticatedUserId(req);
  const responsableVerificacionCierreId = toNullableUserId(
    responsable_verificacion_cierre_id
  );

  console.log("[actualizarFalloSupervisor] usuarioAutenticadoId:", usuarioAutenticadoId);

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT id, fecha, hora, estado, departamento_id, fecha_resolucion, hora_resolucion, tipo_afectacion, COALESCE(reportado_al_cliente, FALSE) AS reportado_al_cliente FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const existingFallo = existingResult.rows[0];

    const reportadoClientePayload = parseReportadoClienteFromPayload({
      reportadoCliente,
      reportado_al_cliente: reportadoAlClienteSnake,
      reportado_cliente: reportadoClienteSnake,
      reportadoAlCliente,
    });

    if (reportadoClientePayload.invalid) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje: "El campo reportadoCliente/reportado_al_cliente no es válido.",
      });
    }

    console.log(
      "[actualizarFalloSupervisor] reportado al cliente recibido/parseado:",
      reportadoClientePayload
    );

    if (existingFallo.estado === "CERRADO") {
      await client.query("ROLLBACK");
      const statusCode = isAdminUser(req) ? 400 : 403;
      return res
        .status(statusCode)
        .json({ mensaje: "No se puede modificar un fallo que ya está cerrado." });
    }

    const deptResult = await client.query(
      "SELECT id, nombre FROM departamentos_responsables"
    );
    const dept = deptResult.rows;

    const departamentoIdFromPayload = validateDepartamentoId(
      normalizeDepartamentoId(departamentoResponsableId)
    );

    console.log("departamento_id final:", departamentoIdFromPayload);

    const departamentoId =
      departamentoIdFromPayload ??
      dept.find((d) => {
        return (
          String(d.nombre).trim().toLowerCase() ===
          String(deptResponsable || "").trim().toLowerCase()
        );
      })?.id ?? null;
    const { fecha: fechaFalloPayload, hora: horaFalloPayload } =
      resolveFechaHoraFallo({
        fecha,
        hora,
        horaFallo,
        fechaHoraFallo,
      });

    const fechaFalloValue =
      fechaFalloPayload || formatDate(existingFallo?.fecha) || null;
    const horaFalloValue = horaFalloPayload || existingFallo?.hora || null;

    const departamentoFinalId = departamentoId;

    const fechaResolucionValue =
      fechaResolucion ?? existingFallo.fecha_resolucion ?? null;
    const horaResolucionValue =
      horaResolucion ?? existingFallo.hora_resolucion ?? null;

    const tipoAfectacionFinal =
      tipo_afectacion ?? affectationType ?? existingFallo.tipo_afectacion ?? null;

    const encodingDeviceIdSource =
      encodingDeviceId !== undefined && encodingDeviceId !== null && encodingDeviceId !== ""
        ? encodingDeviceId
        : encodingDeviceIdSnake;

    const parsedEncodingDeviceId = (() => {
      const normalized = String(encodingDeviceIdSource ?? "").trim();
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    })();

  const encodingDeviceIdValue =
    tipoAfectacionFinal && tipoAfectacionFinal.toLowerCase() === "equipo"
      ? parsedEncodingDeviceId
      : null;

  const ipSpeakerIdSource =
    ipSpeakerId !== undefined && ipSpeakerId !== null && ipSpeakerId !== ""
      ? ipSpeakerId
      : ipSpeakerIdSnake;

  const parsedIpSpeakerId = (() => {
    const normalized = String(ipSpeakerIdSource ?? "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  const ipSpeakerIdValue =
    tipoAfectacionFinal && tipoAfectacionFinal.toLowerCase() === "equipo"
      ? parsedIpSpeakerId
      : null;

  const alarmInputIdSource =
    alarmInputId !== undefined && alarmInputId !== null && alarmInputId !== ""
      ? alarmInputId
      : alarmInputIdSnake;

  const parsedAlarmInputId = (() => {
    const normalized = String(alarmInputIdSource ?? "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  })();

  const alarmInputIdValue =
    tipoAfectacionFinal && tipoAfectacionFinal.toLowerCase() === "equipo"
      ? parsedAlarmInputId
      : null;

    if (fechaResolucionValue && !departamentoFinalId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        mensaje:
          "Debe seleccionar un Departamento Responsable antes de cerrar el fallo.",
      });
    }

    await client.query(
      `UPDATE fallos_tecnicos
         SET fecha = $1,
             hora = $2,
             departamento_id = $3,
             fecha_resolucion = $4,
             hora_resolucion = $5,
             encoding_device_id = $6,
             ip_speaker_id = $7,
             alarm_input_id = $8,
             reportado_al_cliente = $9,
             responsable_verificacion_cierre_id = $10,
             fecha_actualizacion = NOW()
       WHERE id = $11`,
      [
        fechaFalloValue,
        horaFalloValue,
        departamentoFinalId,
        fechaResolucionValue,
        horaResolucionValue,
        encodingDeviceIdValue,
        ipSpeakerIdValue,
        alarmInputIdValue,
        reportadoClientePayload.provided
          ? reportadoClientePayload.value
          : normalizeReportadoClienteStoredValue(existingFallo.reportado_al_cliente),
        responsableVerificacionCierreId,
        id,
      ]
    );

    const usuariosResult = await client.query(
      "SELECT id, nombre_usuario, nombre_completo FROM usuarios WHERE activo = true"
    );
    const usuarios = usuariosResult.rows;

    const verificacionAperturaId = findUserId(usuarios, verificacionApertura);
    const verificacionCierreId = findUserId(usuarios, verificacionCierre);

    console.log(
      "[actualizarFalloSupervisor] verificacionAperturaId:",
      verificacionAperturaId,
      "verificacionCierreId:",
      verificacionCierreId
    );

    const seguimientoAbierto = await getSeguimientoAbierto(client, id);

    if (seguimientoAbierto?.id) {
      await client.query(
        `UPDATE seguimiento_fallos
           SET verificacion_apertura_id = COALESCE($1, verificacion_apertura_id),
               verificacion_cierre_id = COALESCE($2, verificacion_cierre_id),
               novedad_detectada = $3,
               ultimo_usuario_edito_id = $4,
               responsable_verificacion_cierre_id = COALESCE($5, responsable_verificacion_cierre_id),
               verificacion_supervisor_id = COALESCE($6, verificacion_supervisor_id),
               fecha_actualizacion = NOW()
         WHERE id = $7`,
        [
          verificacionAperturaId || null,
          verificacionCierreId || null,
          novedadDetectada || null,
          usuarioAutenticadoId,
          responsableVerificacionCierreId,
          usuarioAutenticadoId,
          seguimientoAbierto.id,
        ]
      );
      console.log(
        "[actualizarFalloSupervisor] seguimiento abierto actualizado para fallo_id:",
        id
      );
    }

    const departamentoSeguimientoId =
      departamentoFinalId ??
      seguimientoAbierto?.departamento_id ??
      existingFallo.departamento_id ??
      DEPARTAMENTO_MONITOREO_ID;

    let seguimientoDepartamentoInsertado = false;

    if (fechaResolucionValue && horaResolucionValue) {
      const fechaCierreSeguimiento = buildDateTime(
        fechaResolucionValue,
        horaResolucionValue
      );

      if (!fechaCierreSeguimiento) {
        throw new Error(
          "No fue posible construir la fecha de cierre para seguimiento_fallos"
        );
      }

      if (seguimientoAbierto?.id) {
        await cerrarSeguimientoAbierto(client, {
          seguimientoId: seguimientoAbierto.id,
          fechaHasta: fechaCierreSeguimiento,
          usuarioId: usuarioAutenticadoId,
        });
      }

      await insertSeguimientoPersistido(client, {
        falloId: id,
        departamentoId: departamentoSeguimientoId,
        paso: PASO_SEGUIMIENTO.CIERRE,
        fechaInicio: fechaCierreSeguimiento,
        fechaHasta: fechaCierreSeguimiento,
        novedadDetectada: novedadDetectada || null,
        usuarioId: usuarioAutenticadoId,
        verificacionAperturaId: verificacionAperturaId || null,
        verificacionCierreId: verificacionCierreId || usuarioAutenticadoId || null,
        responsableVerificacionCierreId,
        verificacionSupervisorId: usuarioAutenticadoId,
      });

      seguimientoDepartamentoInsertado = true;
    } else {
      seguimientoDepartamentoInsertado = await insertSeguimientoDepartamento(
        client,
        {
          falloId: id,
          departamentoId: departamentoSeguimientoId,
          novedadDetectada,
          usuarioId: usuarioAutenticadoId,
        }
      );
    }

    if (seguimientoDepartamentoInsertado) {
      console.log(
        "[actualizarFalloSupervisor] seguimiento_fallos persistido para fallo_id:",
        id
      );
    }

    await client.query("COMMIT");

    const fallo = await fetchFalloById(client, id);
    return res.json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al actualizar fallo supervisor:", error);
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

export const getDuracionFallo = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT fecha, hora, fecha_resolucion, hora_resolucion FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const fallo = result.rows[0];

    if (!fallo.fecha_resolucion || !fallo.hora_resolucion) {
      return res.status(400).json({
        mensaje: "Debe ingresar la fecha y hora de resolución antes de cerrar el fallo.",
      });
    }

    const fechaHoraFallo = buildDateTime(fallo.fecha, fallo.hora);
    const fechaHoraResolucion = buildDateTime(
      fallo.fecha_resolucion,
      fallo.hora_resolucion
    );

    if (!fechaHoraFallo || !fechaHoraResolucion) {
      return res.status(400).json({
        mensaje: "No es posible calcular la duración con la información disponible.",
      });
    }

    const diffMs = Math.max(0, fechaHoraResolucion.getTime() - fechaHoraFallo.getTime());
    const duration = formatDurationFromMs(diffMs);

    return res.json(duration);
  } catch (error) {
    console.error("Error al calcular la duración del fallo técnico:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al calcular la duración del fallo.",
    });
  } finally {
    client.release();
  }
};

export const getHistorialFallo = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const falloResult = await client.query(
      `SELECT
         ft.id,
         ft.fecha,
         ft.hora,
         ft.fecha_resolucion,
         ft.hora_resolucion,
         CASE
           WHEN ft.fecha_resolucion IS NOT NULL AND ft.hora_resolucion IS NOT NULL THEN
             MAKE_TIMESTAMP(
               EXTRACT(YEAR FROM ft.fecha_resolucion)::INTEGER,
               EXTRACT(MONTH FROM ft.fecha_resolucion)::INTEGER,
               EXTRACT(DAY FROM ft.fecha_resolucion)::INTEGER,
               EXTRACT(HOUR FROM ft.hora_resolucion)::INTEGER,
               EXTRACT(MINUTE FROM ft.hora_resolucion)::INTEGER,
               EXTRACT(SECOND FROM ft.hora_resolucion)
             )
           ELSE NULL
         END AS fecha_resolucion_ts,
         ft.estado,
         ft.fecha_creacion,
         dept.nombre AS departamento
       FROM fallos_tecnicos ft
       LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
       WHERE ft.id = $1`,
      [id]
    );

    if (!falloResult.rowCount) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const fallo = falloResult.rows[0];
    const accionesResult = await client.query(
      `SELECT
         sf.id,
         sf.novedad_detectada,
         sf.fecha_creacion,
         sf.fecha_actualizacion,
       COALESCE(apertura.nombre_completo, apertura.nombre_usuario) AS verificacion_apertura,
       COALESCE(cierre.nombre_completo, cierre.nombre_usuario) AS verificacion_cierre
      FROM seguimiento_fallos sf
      LEFT JOIN usuarios apertura ON apertura.id = sf.verificacion_apertura_id
      LEFT JOIN usuarios cierre ON cierre.id = sf.verificacion_cierre_id
      WHERE sf.fallo_id = $1
      ORDER BY sf.fecha_creacion DESC`,
      [id]
    );

    const fechaHoraFallo = buildDateTime(fallo.fecha, fallo.hora);
    const fechaHoraResolucion = buildDateTime(
      fallo.fecha_resolucion,
      fallo.hora_resolucion
    );

    const duration =
      fechaHoraFallo && fechaHoraResolucion
        ? formatDurationFromMs(
            Math.max(0, fechaHoraResolucion.getTime() - fechaHoraFallo.getTime())
          )
        : null;

    return res.json({
      departamento_responsable: fallo.departamento || null,
      fecha: formatDate(fallo.fecha) || null,
      hora: fallo.hora || null,
      fecha_resolucion: formatDate(fallo.fecha_resolucion) || null,
      hora_resolucion: fallo.hora_resolucion || null,
      fecha_resolucion_ts: fallo.fecha_resolucion_ts,
      fecha_creacion: formatDate(fallo.fecha_creacion) || null,
      estado: fallo.estado || null,
      duracionTexto: duration?.duracionTexto || null,
      totalMinutos: duration?.totalMinutos ?? null,
      acciones: accionesResult.rows,
    });
  } catch (error) {
    console.error("Error al obtener historial del fallo técnico:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al obtener el historial del fallo.",
    });
  } finally {
    client.release();
  }
};

export const getHistorialDepartamentosFallo = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const falloResult = await client.query(
      `SELECT id, fecha_resolucion, hora_resolucion
         FROM fallos_tecnicos
        WHERE id = $1`,
      [id]
    );

    if (!falloResult.rowCount) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const timelineResult = await client.query(
      `SELECT
         sf.departamento_id,
         d.nombre AS departamento,
         d.nombre AS departamento_nombre,
         sf.fecha_inicio,
         COALESCE(sf.fecha_hasta, NOW()) AS fecha_hasta,
         COALESCE(sf.fecha_hasta, NOW()) AS fecha_fin,
         EXTRACT(
           EPOCH FROM (COALESCE(sf.fecha_hasta, NOW()) - sf.fecha_inicio)
         )::BIGINT AS duracion_seg,
         sf.paso,
         sf.novedad_detectada,
         sf.ultimo_usuario_edito_id,
         COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario)
           AS ultimo_usuario_edito_nombre,
         COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario)
           AS usuario,
         sf.departamento_id AS departamento_id_evento,
         d.nombre AS departamento_nombre_evento
       FROM seguimiento_fallos sf
       LEFT JOIN departamentos_responsables d ON d.id = sf.departamento_id
       LEFT JOIN usuarios ultimo_editor ON ultimo_editor.id = sf.ultimo_usuario_edito_id
       WHERE sf.fallo_id = $1
       ORDER BY sf.fecha_inicio ASC, sf.id ASC`,
      [id]
    );

    console.log("Historial persistido por departamento:", timelineResult.rows);

    const duracionTotalResult = await client.query(
      `SELECT EXTRACT(EPOCH FROM (
          (CASE
            WHEN ft.fecha_resolucion IS NOT NULL AND ft.hora_resolucion IS NOT NULL THEN
              MAKE_TIMESTAMP(
                EXTRACT(YEAR FROM ft.fecha_resolucion)::INTEGER,
                EXTRACT(MONTH FROM ft.fecha_resolucion)::INTEGER,
                EXTRACT(DAY FROM ft.fecha_resolucion)::INTEGER,
                EXTRACT(HOUR FROM ft.hora_resolucion)::INTEGER,
                EXTRACT(MINUTE FROM ft.hora_resolucion)::INTEGER,
                EXTRACT(SECOND FROM ft.hora_resolucion)
              )
            ELSE NOW()
          END) - ft.fecha
        ))::BIGINT AS duracion_total_seg
       FROM fallos_tecnicos ft
       WHERE ft.id = $1`,
      [id]
    );

    return res.json({
      historial: timelineResult.rows,
      duracion_total_seg: duracionTotalResult.rows[0]?.duracion_total_seg ?? 0,
    });
  } catch (error) {
    console.error("Error al obtener historial por departamento:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al obtener el historial por departamento.",
    });
  } finally {
    client.release();
  }
};

export const eliminarFalloTecnico = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const falloResult = await client.query(
      "SELECT id, estado FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!falloResult.rowCount) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    if (!isAdminUser(req)) {
      return res.status(403).json({
        mensaje: "Solo un usuario administrador puede eliminar fallos técnicos.",
      });
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM seguimiento_fallos WHERE fallo_id = $1", [id]);
    await client.query("DELETE FROM fallos_tecnicos WHERE id = $1", [id]);
    await client.query("COMMIT");

    return res.json({ mensaje: "Fallo técnico eliminado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar el fallo técnico:", error);
    return res.status(500).json({
      mensaje: "Ocurrió un error al eliminar el fallo técnico.",
    });
  } finally {
    client.release();
  }
};

export const getCatalogos = async (req, res) => {
  const client = await pool.connect();

  try {
    const [departamentosResult, tiposProblemaResult, responsablesResult] = await Promise.all([
      client.query("SELECT id, nombre FROM departamentos_responsables ORDER BY nombre"),
      client.query("SELECT id, descripcion FROM catalogo_tipo_problema ORDER BY descripcion"),
      client.query(`
        SELECT u.id, COALESCE(u.nombre_completo, u.nombre_usuario) AS nombre
        FROM usuarios u
        WHERE u.activo = true
        ORDER BY nombre
      `),
    ]);

    return res.json({
      departamentos: departamentosResult.rows,
      tiposProblema: tiposProblemaResult.rows,
      responsablesVerificacion: responsablesResult.rows,
      nodos,
      nodoCliente,
      tiposEquipo,
      tiposProblemaEquipo,
      dispositivos,
      sitiosPorConsola,
    });
  } catch (error) {
    console.error("Error al obtener los catálogos de fallos técnicos:", error);
    return res
      .status(500)
      .json({ mensaje: "Ocurrió un error al obtener los catálogos." });
  } finally {
    client.release();
  }
};
