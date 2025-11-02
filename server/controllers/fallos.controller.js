import pool from "../config/db.js";

const falloSelectBase = `
  SELECT
    f.id,
    COALESCE(f.descripcion, f.descripcion_fallo) AS descripcion,
    COALESCE(f.estado, 'PENDIENTE') AS estado,
    COALESCE(f.fecha_fallo, f.fecha) AS fecha_fallo,
    f.nodo_id,
    f.cliente_id,
    f.tipo_problema_id,
    f.usuario_id,
    f.tipo_equipo_id,
    f.dispositivo_id,
    f.sitio_id,
    n.nombre AS nodo,
    c.nombre AS cliente,
    COALESCE(tp.nombre, tp.descripcion) AS tipo_problema,
    COALESCE(u.nombre_usuario, u.nombre_completo) AS usuario,
    dept.nombre AS departamento,
    f.fecha_resolucion,
    f.hora_resolucion,
    seguimiento.novedad_detectada,
    COALESCE(apertura.nombre_usuario, apertura.nombre_completo) AS verificacion_apertura,
    COALESCE(cierre.nombre_usuario, cierre.nombre_completo) AS verificacion_cierre,
    disp.nombre AS dispositivo,
    te.nombre AS tipo_equipo,
    s.nombre AS sitio
  FROM fallos_tecnicos f
  LEFT JOIN nodos n ON n.id = f.nodo_id
  LEFT JOIN clientes c ON c.id = f.cliente_id
  LEFT JOIN catalogo_tipo_problema tp ON tp.id = f.tipo_problema_id
  LEFT JOIN usuarios u ON u.id = f.usuario_id
  LEFT JOIN departamentos_responsables dept ON dept.id = f.departamento_id
  LEFT JOIN seguimiento_fallos seguimiento ON seguimiento.fallo_id = f.id
  LEFT JOIN usuarios apertura ON apertura.id = seguimiento.verificacion_apertura_id
  LEFT JOIN usuarios cierre ON cierre.id = seguimiento.verificacion_cierre_id
  LEFT JOIN dispositivos disp ON disp.id = f.dispositivo_id
  LEFT JOIN tipos_equipo te ON te.id = f.tipo_equipo_id
  LEFT JOIN sitios s ON s.id = f.sitio_id
`;

const mapFalloRow = (row = {}) => ({
  id: row.id,
  descripcion: row.descripcion,
  estado: row.estado,
  fecha_fallo: row.fecha_fallo,
  nodo: row.nodo,
  nodo_id: row.nodo_id,
  cliente: row.cliente,
  cliente_id: row.cliente_id,
  tipo_problema: row.tipo_problema,
  tipo_problema_id: row.tipo_problema_id,
  usuario: row.usuario,
  usuario_id: row.usuario_id,
  departamento: row.departamento,
  fecha_resolucion: row.fecha_resolucion,
  hora_resolucion: row.hora_resolucion,
  verificacion_apertura: row.verificacion_apertura,
  verificacion_cierre: row.verificacion_cierre,
  novedad_detectada: row.novedad_detectada,
  dispositivo: row.dispositivo,
  dispositivo_id: row.dispositivo_id,
  tipo_equipo: row.tipo_equipo,
  tipo_equipo_id: row.tipo_equipo_id,
  sitio: row.sitio,
  sitio_id: row.sitio_id,
});

const fetchFalloById = async (client, id) => {
  const result = await client.query(
    `${falloSelectBase} WHERE f.id = $1`,
    [id]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapFalloRow(result.rows[0]);
};

const isFutureDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const now = new Date();
  return date.getTime() > now.getTime();
};

const resolveUsuarioId = async (client, { usuarioId, usuarioNombre }) => {
  if (usuarioId) {
    return usuarioId;
  }

  if (!usuarioNombre) {
    return null;
  }

  const result = await client.query(
    `SELECT id FROM usuarios WHERE LOWER(nombre_usuario) = LOWER($1) LIMIT 1`,
    [usuarioNombre]
  );

  return result.rows[0]?.id ?? null;
};

const normalizeNumero = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getFallos = async (_req, res) => {
  try {
    const result = await pool.query(
      `${falloSelectBase} ORDER BY COALESCE(f.fecha_fallo, f.fecha) DESC, f.id DESC`
    );

    return res.json(result.rows.map(mapFalloRow));
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/fallos (getFallos):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  }
};

export const createFallo = async (req, res) => {
  const {
    descripcion,
    descripcion_fallo,
    estado,
    fecha_fallo,
    nodo_id,
    cliente_id,
    tipo_problema_id,
    usuario_id,
    usuario,
    tipo_equipo_id,
    dispositivo_id,
    sitio_id,
  } = req.body ?? {};

  const nodoId = normalizeNumero(nodo_id);
  const clienteId = normalizeNumero(cliente_id);

  if (!nodoId || !clienteId) {
    return res
      .status(422)
      .json({ message: "Debe seleccionar un nodo válido." });
  }

  if (!fecha_fallo) {
    return res
      .status(422)
      .json({ message: "La fecha del fallo es obligatoria." });
  }

  if (isFutureDate(fecha_fallo)) {
    return res
      .status(422)
      .json({ message: "La fecha del fallo no puede ser futura." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resolvedUsuarioId = await resolveUsuarioId(client, {
      usuarioId: normalizeNumero(usuario_id),
      usuarioNombre: usuario,
    });

    const insertResult = await client.query(
      `INSERT INTO fallos_tecnicos (
          descripcion,
          estado,
          fecha_fallo,
          nodo_id,
          cliente_id,
          tipo_problema_id,
          usuario_id,
          tipo_equipo_id,
          dispositivo_id,
          sitio_id,
          fecha_creacion,
          fecha_actualizacion
        ) VALUES (
          $1,
          COALESCE($2, 'PENDIENTE'),
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          NOW(),
          NOW()
        )
        RETURNING id`,
      [
        descripcion ?? descripcion_fallo ?? "",
        estado,
        fecha_fallo,
        nodoId,
        clienteId,
        normalizeNumero(tipo_problema_id),
        resolvedUsuarioId,
        normalizeNumero(tipo_equipo_id),
        normalizeNumero(dispositivo_id),
        normalizeNumero(sitio_id),
      ]
    );

    const falloId = insertResult.rows[0]?.id;

    const fallo = await fetchFalloById(client, falloId);

    await client.query("COMMIT");

    return res.status(201).json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      `[${new Date().toISOString()}] Error en /api/fallos (createFallo):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

export const updateFallo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ message: "El identificador del fallo es obligatorio." });
  }

  const {
    descripcion,
    descripcion_fallo,
    estado,
    fecha_fallo,
    nodo_id,
    cliente_id,
    tipo_problema_id,
    usuario_id,
    usuario,
    tipo_equipo_id,
    dispositivo_id,
    sitio_id,
  } = req.body ?? {};

  const nodoId = normalizeNumero(nodo_id);
  const clienteId = normalizeNumero(cliente_id);

  if (!nodoId || !clienteId) {
    return res
      .status(422)
      .json({ message: "Debe seleccionar un nodo válido." });
  }

  if (fecha_fallo && isFutureDate(fecha_fallo)) {
    return res
      .status(422)
      .json({ message: "La fecha del fallo no puede ser futura." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM fallos_tecnicos WHERE id = $1",
      [id]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "El fallo técnico no existe." });
    }

    const resolvedUsuarioId = await resolveUsuarioId(client, {
      usuarioId: normalizeNumero(usuario_id),
      usuarioNombre: usuario,
    });

    await client.query(
      `UPDATE fallos_tecnicos
          SET descripcion = $1,
              estado = COALESCE($2, estado),
              fecha_fallo = COALESCE($3, fecha_fallo),
              nodo_id = $4,
              cliente_id = $5,
              tipo_problema_id = $6,
              usuario_id = COALESCE($7, usuario_id),
              tipo_equipo_id = $8,
              dispositivo_id = $9,
              sitio_id = $10,
              fecha_actualizacion = NOW()
        WHERE id = $11`,
      [
        descripcion ?? descripcion_fallo ?? "",
        estado,
        fecha_fallo,
        nodoId,
        clienteId,
        normalizeNumero(tipo_problema_id),
        resolvedUsuarioId,
        normalizeNumero(tipo_equipo_id),
        normalizeNumero(dispositivo_id),
        normalizeNumero(sitio_id),
        id,
      ]
    );

    const fallo = await fetchFalloById(client, id);

    await client.query("COMMIT");

    return res.json(fallo);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      `[${new Date().toISOString()}] Error en /api/fallos (updateFallo):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

export const getFallo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ message: "El identificador del fallo es obligatorio." });
  }

  const client = await pool.connect();

  try {
    const fallo = await fetchFalloById(client, id);

    if (!fallo) {
      return res.status(404).json({ message: "El fallo técnico no existe." });
    }

    return res.json(fallo);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error en /api/fallos (getFallo):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

export const deleteFallo = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res
      .status(400)
      .json({ message: "El identificador del fallo es obligatorio." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM seguimiento_fallos WHERE fallo_id = $1", [
      id,
    ]);

    const result = await client.query(
      "DELETE FROM fallos_tecnicos WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "El fallo técnico no existe." });
    }

    await client.query("COMMIT");

    return res.json({ message: "Fallo técnico eliminado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      `[${new Date().toISOString()}] Error en /api/fallos (deleteFallo):`,
      error.message
    );
    return res
      .status(500)
      .json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};
