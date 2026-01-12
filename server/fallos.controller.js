import { pool } from "./db.js";
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
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split("T")[0];
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

const mapFalloRowToDto = (row) => ({
  id: String(row.id),
  fecha: formatDate(row.fecha) || "",
  hora: row.hora || undefined,
  horaFallo: row.hora || undefined,
  fecha_hora_fallo: row.fecha_hora_fallo || undefined,
  fechaHoraFallo: row.fecha_hora_fallo || undefined,
  problema: row.problema || row.tipo_problema_descripcion || undefined,
  equipo_afectado: row.equipo_afectado ?? "",
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
  tipo_equipo_afectado: row.tipo_equipo_afectado || undefined,
  tipo_equipo_afectado_id: row.tipo_equipo_afectado_id ?? null,
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

const REPORTADO_COLUMNS = ["reportado_al_cliente", "reportado_cliente"];

const resolveReportadoClienteColumn = async (client) => {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'fallos_tecnicos'
       AND column_name = ANY($1)
     ORDER BY column_name`,
    [REPORTADO_COLUMNS]
  );

  return rows?.[0]?.column_name ?? null;
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
    return truthy;
  }

  if (falsy.includes(normalized)) {
    return falsy;
  }

  return undefined;
};

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

const insertSeguimientoDepartamento = async (
  client,
  { falloId, departamentoId, novedadDetectada, usuarioId }
) => {
  if (!departamentoId) {
    return false;
  }

  const ultimoDepartamentoResult = await client.query(
    `SELECT departamento_id
       FROM seguimiento_fallos
      WHERE fallo_id = $1
        AND departamento_id IS NOT NULL
      ORDER BY fecha_creacion DESC
      LIMIT 1`,
    [falloId]
  );

  const ultimoDepartamentoId = ultimoDepartamentoResult.rows[0]?.departamento_id;
  if (
    ultimoDepartamentoId &&
    Number(ultimoDepartamentoId) === Number(departamentoId)
  ) {
    return false;
  }

  await client.query(
    `INSERT INTO seguimiento_fallos (
       fallo_id,
       departamento_id,
       novedad_detectada,
       verificacion_supervisor_id,
       ultimo_usuario_edito_id,
       fecha_creacion
     ) VALUES ($1, $2, $3, $4, $4, NOW())`,
    [falloId, departamentoId, novedadDetectada || null, usuarioId || null]
  );

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
        ft.fecha_resolucion,
        ft.hora_resolucion,
        ft.estado,
        ft.fecha_creacion,
        ft.fecha_actualizacion,
        seguimiento.novedad_detectada,
        COALESCE(apertura.nombre_completo, apertura.nombre_usuario) AS verificacion_apertura,
        COALESCE(cierre.nombre_completo, cierre.nombre_usuario) AS verificacion_cierre,
        seguimiento.ultimo_usuario_edito_id,
        COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario) AS ultimo_usuario_edito_nombre,
        seguimiento.responsable_verificacion_cierre_id,
        COALESCE(responsable_cierre.nombre_completo, responsable_cierre.nombre_usuario) AS responsable_verificacion_cierre_nombre
      FROM fallos_tecnicos ft
      LEFT JOIN usuarios responsable ON responsable.id = ft.responsable_id
      LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
      LEFT JOIN sitios sitio ON sitio.id = ft.sitio_id
      LEFT JOIN catalogo_tipo_problema tp ON tp.id = ft.tipo_problema_id
      LEFT JOIN seguimiento_fallos seguimiento ON seguimiento.fallo_id = ft.id
      LEFT JOIN usuarios apertura ON apertura.id = seguimiento.verificacion_apertura_id
      LEFT JOIN usuarios cierre ON cierre.id = seguimiento.verificacion_cierre_id
      LEFT JOIN usuarios ultimo_editor ON ultimo_editor.id = seguimiento.ultimo_usuario_edito_id
      LEFT JOIN usuarios responsable_cierre ON responsable_cierre.id = seguimiento.responsable_verificacion_cierre_id
      WHERE ft.id = $1`,
    [id]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapFalloRowToDto(result.rows[0]);
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

    if (reportadoClienteValues) {
      const reportadoColumn = await resolveReportadoClienteColumn(client);
      if (reportadoColumn) {
        params.push(reportadoClienteValues);
        filtros.push(
          `AND LOWER(CAST(ft.${reportadoColumn} AS TEXT)) = ANY($${params.length})`
        );
      }
    }

    const whereFilters = filtros.length > 0 ? `WHERE 1 = 1 ${filtros.join(" ")}` : "";

    const result = await client.query(
      `SELECT
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
        dept.nombre AS departamento_responsable,
        ft.fecha_creacion,
        ft.fecha_actualizacion
      FROM fallos_tecnicos ft
      LEFT JOIN usuarios responsable ON responsable.id = ft.responsable_id
      LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
      LEFT JOIN consolas consola ON consola.id = ft.consola_id
      LEFT JOIN sitios sitio ON sitio.id = ft.sitio_id
      LEFT JOIN clientes cliente ON cliente.id = sitio.cliente_id
      LEFT JOIN hacienda hacienda ON hacienda.id = sitio.hacienda_id
      LEFT JOIN catalogo_tipo_problema tp ON tp.id = ft.tipo_problema_id
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
      ORDER BY ft.fecha DESC, ft.id DESC`,
      params
    ); // FIX: rewritten query uses LEFT JOINs only with existing lookup tables to avoid failing when optional relations are missing and to provide the consola name.

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

    const departamentoId = (() => {
      const parsed = Number(departamento_id);
      return Number.isFinite(parsed) ? parsed : null;
    })();

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
    novedad_detectada: novedadDetectada,
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

  if (!departamentoResponsableId || Number(departamentoResponsableId) <= 0) {
    return res.status(400).json({
      mensaje: "Debe seleccionar el departamento responsable.",
    });
  }

  const novedad =
    typeof novedadDetectada === "string"
      ? novedadDetectada.trim()
      : "";

  if (!novedad) {
    return res.status(400).json({
      mensaje: "Debe ingresar la novedad detectada.",
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

    const novedadNormalized = novedad || null;

    const departamentoIdValue = (() => {
      const parsed = Number(departamentoResponsableId);
      return Number.isFinite(parsed) ? parsed : null;
    })();

    const updateResult = await client.query(
      `UPDATE fallos_tecnicos
          SET fecha_resolucion = $1,
              hora_resolucion = $2,
              departamento_id = $3,
              fecha_actualizacion = NOW()
        WHERE id = $4
          AND (estado IS NULL OR estado <> 'CERRADO')`,
      [fechaResolucion, horaResolucion, departamentoIdValue, id]
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

    await client.query(
      `INSERT INTO seguimiento_fallos (
         fallo_id,
         departamento_id,
         verificacion_apertura_id,
         verificacion_cierre_id,
         novedad_detectada,
         fecha_creacion,
         ultimo_usuario_edito_id,
         responsable_verificacion_cierre_id,
         verificacion_supervisor_id
       ) VALUES ($1, NULL, NULL, $2, $3, NOW(), $2, $4, NULL)`,
      [
        id,
        usuarioCierreId,
        novedadNormalized,
        responsableVerificacionCierreId,
      ]
    );

    const seguimientoDepartamentoInsertado = await insertSeguimientoDepartamento(
      client,
      {
        falloId: id,
        departamentoId: departamentoIdValue,
        novedadDetectada: novedadNormalized,
        usuarioId: usuarioCierreId,
      }
    );

    console.log(
      "[cerrarFalloTecnico] seguimiento_fallos insertado para fallo_id:",
      id,
      "con verificacion_cierre_id:",
      usuarioCierreId,
      "y responsable_verificacion_cierre_id:",
      responsableVerificacionCierreId,
      "seguimiento_departamento_insertado:",
      seguimientoDepartamentoInsertado
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
  } = req.body || {};

  console.log("[createFallo] BODY COMPLETO:", JSON.stringify(req.body, null, 2));
  console.log("[createFallo] usuarioId recibido en body:", usuarioId);

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

    const departamentoId = dept.find((d) => {
      return String(d.nombre).trim().toLowerCase() ===
        String(deptResponsable || "").trim().toLowerCase();
    })?.id ?? null;

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
        fecha_resolucion,
        hora_resolucion,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
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

    const seguimientoInsert = await client.query(
      `
      INSERT INTO seguimiento_fallos (
          fallo_id,
          departamento_id,
          verificacion_apertura_id,
          verificacion_cierre_id,
          novedad_detectada,
          fecha_creacion,
          ultimo_usuario_edito_id,
          responsable_verificacion_cierre_id,
          verificacion_supervisor_id
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
      `,
      [
        falloId, // FALLO_ID
        departamentoId || null, // DEPARTAMENTO_ID
        verificacionAperturaId, // VERIFICACION_APERTURA_ID (usuario que registra el fallo)
        null, // VERIFICACION_CIERRE_ID (todavía no aplica)
        novedadDetectada || null, // NOVEDAD_DETECTADA
        verificacionAperturaId, // ULTIMO_USUARIO_EDITO_ID
        null, // RESPONSABLE_VERIFICACION_CIERRE_ID
        null, // VERIFICACION_SUPERVISOR_ID
      ]
    );

    console.log(
      "[createFallo] seguimiento_fallos INSERT rowCount:",
      seguimientoInsert.rowCount
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
  } = req.body || {};

  console.log("[actualizarFalloSupervisor] body:", req.body);

  if (!id) {
    return res
      .status(400)
      .json({ mensaje: "El identificador del fallo es obligatorio." });
  }

  if (fechaResolucion && horaResolucion) {
    const cierre = new Date(`${fechaResolucion}T${horaResolucion}`);
    if (!Number.isNaN(cierre.getTime()) && cierre.getTime() > Date.now()) {
      return res.status(400).json({
        message: "La fecha y hora de resolución no puede ser futura.",
      });
    }
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
      "SELECT id, fecha, hora, estado, departamento_id, fecha_resolucion, hora_resolucion, tipo_afectacion FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const existingFallo = existingResult.rows[0];

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

    const departamentoIdFromPayload = (() => {
      const parsed = Number(departamentoResponsableId);
      return Number.isFinite(parsed) ? parsed : null;
    })();

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

  const departamentoFinalId =
    departamentoId ?? existingFallo.departamento_id ?? null;

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
             fecha_actualizacion = NOW()
       WHERE id = $9`,
      [
        fechaFalloValue,
        horaFalloValue,
        departamentoFinalId,
        fechaResolucionValue,
        horaResolucionValue,
        encodingDeviceIdValue,
        ipSpeakerIdValue,
        alarmInputIdValue,
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

    const seguimientoResult = await client.query(
      "SELECT id FROM seguimiento_fallos WHERE fallo_id = $1",
      [id]
    );

    if (seguimientoResult.rowCount) {
      await client.query(
        `UPDATE seguimiento_fallos
           SET verificacion_apertura_id = $1,
               verificacion_cierre_id = $2,
               novedad_detectada = $3,
               ultimo_usuario_edito_id = $4,
               responsable_verificacion_cierre_id = COALESCE($5, responsable_verificacion_cierre_id),
               verificacion_supervisor_id = COALESCE($6, verificacion_supervisor_id),
               fecha_actualizacion = NOW()
         WHERE fallo_id = $7`,
        [
          verificacionAperturaId || null,
          verificacionCierreId || null,
          novedadDetectada || null,
          usuarioAutenticadoId,
          responsableVerificacionCierreId,
          usuarioAutenticadoId, // supervisor actual
          id,
        ]
      );
      console.log(
        "[actualizarFalloSupervisor] seguimiento_fallos actualizado/insertado para fallo_id:",
        id
      );
    } else {
      await client.query(
        `INSERT INTO seguimiento_fallos (
          fallo_id,
          departamento_id,
          verificacion_apertura_id,
          verificacion_cierre_id,
          novedad_detectada,
          fecha_creacion,
          fecha_actualizacion,
          ultimo_usuario_edito_id,
          responsable_verificacion_cierre_id,
          verificacion_supervisor_id
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8)`,
        [
          id,
          departamentoFinalId,
          verificacionAperturaId || null,
          verificacionCierreId || null,
          novedadDetectada || null,
          usuarioAutenticadoId,
          responsableVerificacionCierreId,
          usuarioAutenticadoId, // supervisor
        ]
      );
      console.log(
        "[actualizarFalloSupervisor] seguimiento_fallos actualizado/insertado para fallo_id:",
        id
      );
    }

    const seguimientoDepartamentoInsertado = await insertSeguimientoDepartamento(
      client,
      {
        falloId: id,
        departamentoId: departamentoFinalId,
        novedadDetectada,
        usuarioId: usuarioAutenticadoId,
      }
    );

    if (seguimientoDepartamentoInsertado) {
      console.log(
        "[actualizarFalloSupervisor] seguimiento_fallos departamento insertado para fallo_id:",
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
      "SELECT id, fecha_resolucion, hora_resolucion, estado FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!falloResult.rowCount) {
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const timelineResult = await client.query(
      `
      WITH timeline AS (
        SELECT
          sf.departamento_id,
          dept.nombre AS departamento_nombre,
          sf.fecha_creacion AS fecha_inicio,
          sf.novedad_detectada,
          sf.ultimo_usuario_edito_id,
          COALESCE(ultimo_editor.nombre_completo, ultimo_editor.nombre_usuario)
            AS ultimo_usuario_edito_nombre,
          LEAD(sf.fecha_creacion) OVER (
            PARTITION BY sf.fallo_id
            ORDER BY sf.fecha_creacion
          ) AS siguiente_fecha
        FROM seguimiento_fallos sf
        LEFT JOIN departamentos_responsables dept ON dept.id = sf.departamento_id
        LEFT JOIN usuarios ultimo_editor ON ultimo_editor.id = sf.ultimo_usuario_edito_id
        WHERE sf.fallo_id = $1
          AND sf.departamento_id IS NOT NULL
      )
      SELECT
        timeline.departamento_id,
        timeline.departamento_nombre,
        timeline.fecha_inicio,
        timeline.novedad_detectada,
        timeline.ultimo_usuario_edito_id,
        timeline.ultimo_usuario_edito_nombre,
        COALESCE(
          timeline.siguiente_fecha,
          CASE
            WHEN ft.fecha_resolucion IS NOT NULL THEN
              ft.fecha_resolucion + COALESCE(ft.hora_resolucion, '00:00'::time)
            ELSE NOW()
          END
        ) AS fecha_fin,
        EXTRACT(
          EPOCH FROM (
            COALESCE(
              timeline.siguiente_fecha,
              CASE
                WHEN ft.fecha_resolucion IS NOT NULL THEN
                  ft.fecha_resolucion + COALESCE(ft.hora_resolucion, '00:00'::time)
                ELSE NOW()
              END
            ) - timeline.fecha_inicio
          )
        )::BIGINT AS duracion_seg
      FROM timeline
      CROSS JOIN fallos_tecnicos ft
      WHERE ft.id = $1
      ORDER BY timeline.fecha_inicio
      `,
      [id]
    );

    return res.json(timelineResult.rows);
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
