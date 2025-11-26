import { pool } from "./db.js";
import technicalFailuresSeed from "./data/technicalFailuresSeed.js";
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

const seedFallosIfNeeded = async (client) => {
  const countResult = await client.query(
    "SELECT COUNT(*)::int AS total FROM fallos_tecnicos"
  );
  const total = countResult.rows[0]?.total ?? 0;

  if (total > 0) {
    return;
  }

  await client.query("BEGIN");

  try {
    const usersResult = await client.query(
      "SELECT id, nombre_usuario, nombre_completo FROM usuarios"
    );
    const usuarios = usersResult.rows;

    const departamentosResult = await client.query(
      "SELECT id, nombre FROM departamentos_responsables"
    );
    const departamentos = departamentosResult.rows;

    const tiposProblemaResult = await client.query(
      "SELECT id, descripcion FROM catalogo_tipo_problema"
    );
    const tiposProblema = tiposProblemaResult.rows;

    const consolasResult = await client.query(
      "SELECT id, nombre FROM consolas"
    );
    const consolas = consolasResult.rows;

    const defaultUserId = usuarios[0]?.id ?? null;
    const defaultDepartmentId = departamentos[0]?.id ?? null;
    const defaultTipoProblemaId = tiposProblema[0]?.id ?? null;
    const defaultConsolaId = consolas[0]?.id ?? null;

    const now = new Date();

    for (const seed of technicalFailuresSeed) {
      const responsableId =
        findUserId(usuarios, seed.responsableUsername) ||
        findUserId(usuarios, seed.responsable) ||
        defaultUserId;

      const departamentoId = departamentos.find((d) => {
        return String(d.nombre).trim().toLowerCase() ===
          String(seed.deptResponsable || "").trim().toLowerCase();
      })?.id ?? defaultDepartmentId;

      const tipoProblemaId = tiposProblema.find((tipo) => {
        return String(tipo.descripcion).trim().toLowerCase() ===
          String(seed.tipoProblema || seed.descripcion_fallo || "")
            .trim()
            .toLowerCase();
      })?.id ?? defaultTipoProblemaId;

      const consolaId = consolas.find((c) => {
        return String(c.nombre).trim().toLowerCase() ===
          String(seed.consola || "").trim().toLowerCase();
      })?.id ?? defaultConsolaId;

      const falloInsert = await client.query(
        `INSERT INTO fallos_tecnicos (
          fecha,
          hora,
          equipo_afectado,
          descripcion_fallo,
          responsable_id,
          departamento_id,
          tipo_problema_id,
          consola_id,
          fecha_resolucion,
          hora_resolucion,
          fecha_creacion,
          fecha_actualizacion
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING id`,
        [
          seed.fecha,
          seed.hora || null,
          seed.equipo_afectado,
          seed.descripcion_fallo,
          responsableId,
          departamentoId,
          tipoProblemaId,
          consolaId,
          seed.fechaResolucion || null,
          seed.horaResolucion || null,
          now, // FIX: omit estado because it is a generated column; PostgreSQL will derive it from fecha_resolucion.
          now,
        ]
      );

      const falloId = falloInsert.rows[0]?.id;

      if (!falloId) {
        continue;
      }

      const verificacionAperturaId =
        findUserId(usuarios, seed.verificacionAperturaUsername) ||
        findUserId(usuarios, seed.verificacionApertura);
      const verificacionCierreId =
        findUserId(usuarios, seed.verificacionCierreUsername) ||
        findUserId(usuarios, seed.verificacionCierre);

      if (
        verificacionAperturaId ||
        verificacionCierreId ||
        seed.novedadDetectada
      ) {
        await client.query(
          `INSERT INTO seguimiento_fallos (
            fallo_id,
            verificacion_apertura_id,
            verificacion_cierre_id,
            novedad_detectada,
            fecha_creacion
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            falloId,
            verificacionAperturaId ?? null,
            verificacionCierreId ?? null,
            seed.novedadDetectada || null,
            now,
          ]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const mapFalloRowToDto = (row) => ({
  id: String(row.id),
  fecha: formatDate(row.fecha) || "",
  hora: row.hora || undefined,
  horaFallo: row.hora || undefined,
  equipo_afectado: row.equipo_afectado ?? "",
  descripcion_fallo: row.descripcion_fallo ?? "",
  responsable: row.responsable || "",
  deptResponsable: row.departamento || undefined,
  consola: row.consola || undefined, // FIX: expose consola name retrieved via the LEFT JOIN so the frontend can display it without additional lookups.
  sitio_nombre: row.sitio_nombre || "",
  tipo_problema_id: row.tipo_problema_id ?? null,
  tipo_afectacion: row.tipo_afectacion || "",
  fechaResolucion: formatDate(row.fecha_resolucion) || undefined,
  horaResolucion: row.hora_resolucion || undefined,
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
        sitio.nombre AS sitio_nombre,
        ft.tipo_problema_id,
        tp.descripcion AS tipo_afectacion,
        ft.fecha_resolucion,
        ft.hora_resolucion,
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
    await seedFallosIfNeeded(client);

    const result = await client.query(
      `SELECT
        ft.id,
        ft.fecha,
        ft.hora,
        ft.equipo_afectado,
        ft.descripcion_fallo,
        COALESCE(responsable.nombre_completo, responsable.nombre_usuario) AS responsable,
        dept.nombre AS departamento,
        consola.nombre AS consola,
        sitio.nombre AS sitio_nombre,
        ft.tipo_problema_id,
        tp.descripcion AS tipo_afectacion,
        ft.fecha_resolucion,
        ft.hora_resolucion
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
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
    affectationType,
    sitio_id: rawSitioId,
    sitioId: rawSitioIdCamel,
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
        fecha_resolucion,
        hora_resolucion,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
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
        fechaResolucion || null,
        horaResolucion || null, // FIX: exclude estado so the generated column is calculated by PostgreSQL during inserts.
      ]
    );

    const falloId = insertResult.rows[0]?.id;

    if (!falloId) {
      throw new Error("No se pudo crear el fallo técnico.");
    }

    const verificacionAperturaId = findUserId(usuarios, verificacionApertura);
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

  const client = await pool.connect();
  const usuarioAutenticadoId = (() => {
    const parsed = Number(ultimoUsuarioEditoId);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const responsableVerificacionCierreId = (() => {
    const parsed = Number(responsable_verificacion_cierre_id);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT id, fecha, hora FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existingResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensaje: "El fallo técnico no existe." });
    }

    const deptResult = await client.query(
      "SELECT id, nombre FROM departamentos_responsables"
    );
    const dept = deptResult.rows;

    const departamentoId = dept.find((d) => {
      return (
        String(d.nombre).trim().toLowerCase() ===
        String(deptResponsable || "").trim().toLowerCase()
      );
    })?.id ?? null;

    const existingFallo = existingResult.rows[0];
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
        departamentoId,
        fechaResolucion || null,
        horaResolucion || null,
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
               responsable_verificacion_cierre_id = $5,
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
