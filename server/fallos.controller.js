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
  fechaHoraFallo: row.fecha_hora_fallo || undefined,
  problema: row.problema || row.tipo_problema_descripcion || undefined,
  equipo_afectado: row.equipo_afectado ?? "",
  descripcion_fallo: row.descripcion_fallo ?? "",
  responsable: row.responsable || "",
  deptResponsable: row.departamento || undefined,
  departamento_responsable: row.departamento_responsable || undefined,
  departamentoResponsableId: row.departamento_id ?? null,
  consola: row.consola || undefined, // FIX: expose consola name retrieved via the LEFT JOIN so the frontend can display it without additional lookups.
  sitio_nombre: row.sitio_nombre || undefined,
  sitio: row.sitio || row.sitio_nombre || undefined,
  tipo_problema_id: row.tipo_problema_id ?? null,
  tipo_afectacion: row.tipo_afectacion || "",
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
  novedadDetectada: row.novedad_detectada || undefined,
  ultimo_usuario_edito_id: row.ultimo_usuario_edito_id ?? null,
  ultimo_usuario_edito_nombre: row.ultimo_usuario_edito_nombre || null,
  responsable_verificacion_cierre_id:
    row.responsable_verificacion_cierre_id ?? null,
  responsable_verificacion_cierre_nombre:
    row.responsable_verificacion_cierre_nombre || null,
});

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
    const result = await client.query(
      `SELECT
        ft.id,
        ft.fecha,
        ft.hora,
        TO_CHAR(ft.fecha::timestamp + ft.hora, 'YYYY-MM-DD HH24:MI') AS fecha_hora_fallo,
        ft.equipo_afectado,
        ft.descripcion_fallo,
        COALESCE(responsable.nombre_completo, responsable.nombre_usuario) AS responsable,
        dept.nombre AS departamento,
        dept.id AS departamento_id,
        consola.nombre AS consola,
        COALESCE(sitio.nombre, 'Sin sitio asignado') AS sitio,
        sitio.nombre AS sitio_nombre,
        ft.tipo_problema_id,
        tp.descripcion AS tipo_problema_descripcion,
        tp.descripcion AS problema,
        ft.tipo_afectacion,
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
        dept.nombre AS departamento_responsable,
        ft.fecha_creacion,
        ft.fecha_actualizacion
      FROM fallos_tecnicos ft
      LEFT JOIN usuarios responsable ON responsable.id = ft.responsable_id
      LEFT JOIN departamentos_responsables dept ON dept.id = ft.departamento_id
      LEFT JOIN consolas consola ON consola.id = ft.consola_id
      LEFT JOIN sitios sitio ON sitio.id = ft.sitio_id
      LEFT JOIN catalogo_tipo_problema tp ON tp.id = ft.tipo_problema_id
      ORDER BY ft.fecha DESC, ft.id DESC`
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

    const usuarioId = getAuthenticatedUserId(req);

    await client.query(
      `INSERT INTO seguimiento_fallos (
         fallo_id,
         verificacion_apertura_id,
         novedad_detectada,
         fecha_creacion
       ) VALUES ($1, $2, $3, NOW())`,
      [id, usuarioId, novedad]
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
    novedad_detectada: novedadDetectada,
  } = req.body || {};

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

    const novedad =
      typeof novedadDetectada === "string"
        ? novedadDetectada.trim() || null
        : null;

    const updateResult = await client.query(
      `UPDATE fallos_tecnicos
          SET fecha_resolucion = $1,
              hora_resolucion = $2,
              fecha_actualizacion = NOW()
        WHERE id = $3
          AND (estado IS NULL OR estado <> 'CERRADO')`,
      [fechaResolucion, horaResolucion, id]
    );

    if (!updateResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensaje: "Ya está cerrado." });
    }

    const usuarioId = getAuthenticatedUserId(req);

    await client.query(
      `INSERT INTO seguimiento_fallos (
         fallo_id,
         verificacion_cierre_id,
         novedad_detectada,
         fecha_creacion
       ) VALUES ($1, $2, $3, NOW())`,
      [id, usuarioId, novedad]
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
  } = req.body || {};

  const { fecha: fechaFalloValue, hora: horaFalloValue } = resolveFechaHoraFallo({
    fecha,
    hora,
    horaFallo,
    fechaHoraFallo,
  });

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
        tipo_afectacion,
        fecha_resolucion,
        hora_resolucion,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
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
        tipoAfectacionValue,
        fechaResolucion || null,
        horaResolucion || null, // FIX: exclude estado so the generated column is calculated by PostgreSQL during inserts.
      ]
    );

    const falloId = insertResult.rows[0]?.id;

    if (!falloId) {
      throw new Error("No se pudo crear el fallo técnico.");
    }

    const verificacionAperturaId = toNullableUserId(usuarioId);
    const verificacionCierreId = findUserId(usuarios, verificacionCierre);

    if (
      verificacionAperturaId ||
      verificacionCierreId ||
      novedadDetectada
    ) {
      await client.query(
        `INSERT INTO seguimiento_fallos (
          fallo_id,
          verificacion_apertura_id,
          verificacion_cierre_id,
          novedad_detectada,
          fecha_creacion
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          falloId,
          verificacionAperturaId ?? null,
          verificacionCierreId ?? null,
          novedadDetectada || null,
        ]
      );
    }

    await client.query("COMMIT");

    const fallo = await fetchFalloById(client, falloId);
    return res.status(201).json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear el fallo técnico:", error);
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
  } = req.body || {};

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
  const usuarioAutenticadoId = (() => {
    const parsed = Number(ultimoUsuarioEditoId);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const responsableVerificacionCierreId = toNullableUserId(
    responsable_verificacion_cierre_id
  );

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
             fecha_actualizacion = NOW()
        WHERE id = $6`,
      [
        fechaFalloValue,
        horaFalloValue,
        departamentoFinalId,
        fechaResolucionValue,
        horaResolucionValue,
        id,
      ]
    );

    const usuariosResult = await client.query(
      "SELECT id, nombre_usuario, nombre_completo FROM usuarios WHERE activo = true"
    );
    const usuarios = usuariosResult.rows;

    const verificacionAperturaId = findUserId(usuarios, verificacionApertura);
    const verificacionCierreId = findUserId(usuarios, verificacionCierre);

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
               fecha_actualizacion = NOW()
         WHERE fallo_id = $6`,
        [
          verificacionAperturaId || null,
          verificacionCierreId || null,
          novedadDetectada || null,
          usuarioAutenticadoId,
          responsableVerificacionCierreId,
          id,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO seguimiento_fallos (
          fallo_id,
          verificacion_apertura_id,
          verificacion_cierre_id,
          novedad_detectada,
          fecha_creacion,
          fecha_actualizacion,
          ultimo_usuario_edito_id,
          responsable_verificacion_cierre_id
        ) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)`,
        [
          id,
          verificacionAperturaId || null,
          verificacionCierreId || null,
          novedadDetectada || null,
          usuarioAutenticadoId,
          responsableVerificacionCierreId,
        ]
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
