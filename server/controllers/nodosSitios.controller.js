import pool from "../db.js";

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

export const listAsignaciones = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        A.nodo_id,
        A.sitio_id,
        A.fecha_asignacion,
        B.nombre AS nodo_nombre,
        C.nombre AS sitio_nombre
      FROM nodos_sitios A
      INNER JOIN nodos B ON A.nodo_id = B.id
      INNER JOIN sitios C ON A.sitio_id = C.id
      WHERE A.activo = TRUE
      ORDER BY A.nodo_id, C.nombre`
    );

    res
      .status(200)
      .json(
        formatSuccess("Listado de asignaciones nodo-sitio", result.rows)
      );
  } catch (error) {
    console.error("Error al listar asignaciones nodo-sitio:", error);
    res
      .status(500)
      .json(formatError("Error al listar las asignaciones nodo-sitio"));
  }
};

export const listSitiosByNodo = async (req, res) => {
  const { nodo_id: nodoIdParam } = req.params;
  const nodoId = Number(nodoIdParam);

  if (!Number.isInteger(nodoId) || nodoId <= 0) {
    return res
      .status(400)
      .json(formatError("El identificador del nodo es inválido"));
  }

  try {
    const result = await pool.query(
      `SELECT
        S.id,
        S.nombre,
        S.descripcion,
        CASE WHEN NS.nodo_id = $1 THEN TRUE ELSE FALSE END AS asignado
      FROM sitios S
      LEFT JOIN nodos_sitios NS
        ON NS.sitio_id = S.id
        AND NS.activo = TRUE
      WHERE
        S.activo = TRUE
        AND (NS.nodo_id = $1 OR NS.nodo_id IS NULL)
      ORDER BY S.nombre`,
      [nodoId]
    );

    const sitios = result.rows;
    const asignados = sitios.filter((sitio) => sitio.asignado === true).length;

    res
      .status(200)
      .json(
        formatSuccess("Sitios obtenidos correctamente", {
          sitios,
          asignados,
        })
      );
  } catch (error) {
    console.error("Error al obtener sitios asignados al nodo:", error);
    res
      .status(500)
      .json(formatError("Error al obtener los sitios asignados del nodo"));
  }
};

const validatePayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { valid: false, message: "El cuerpo de la petición es obligatorio" };
  }

  const { nodo_id: nodoIdRaw, sitio_id: sitioIdRaw } = payload;
  const nodoId = Number(nodoIdRaw);
  const sitioId = Number(sitioIdRaw);

  if (!Number.isInteger(nodoId) || nodoId <= 0) {
    return { valid: false, message: "El identificador del nodo es inválido" };
  }

  if (!Number.isInteger(sitioId) || sitioId <= 0) {
    return { valid: false, message: "El identificador del sitio es inválido" };
  }

  return { valid: true, nodoId, sitioId };
};

export const assignSitio = async (req, res) => {
  const validation = validatePayload(req.body);

  if (!validation.valid) {
    return res.status(400).json(formatError(validation.message));
  }

  const { nodoId, sitioId } = validation;

  try {
    const existingAssignment = await pool.query(
      `SELECT nodo_id
      FROM nodos_sitios A
      WHERE A.sitio_id = $1 AND A.activo = TRUE
      LIMIT 1`,
      [sitioId]
    );

    if (existingAssignment.rowCount > 0) {
      const assignedNodoId = Number(existingAssignment.rows[0].nodo_id);

      if (assignedNodoId === nodoId) {
        return res
          .status(409)
          .json(formatError("La asignación ya existe para el nodo y sitio"));
      }

      return res.status(409).json(
        formatError(
          "El sitio ya está asignado a otro nodo. Libéralo antes de reasignarlo"
        )
      );
    }

    const insertResult = await pool.query(
      `INSERT INTO nodos_sitios (nodo_id, sitio_id, activo)
      VALUES ($1, $2, TRUE)
      RETURNING nodo_id, sitio_id, fecha_asignacion`,
      [nodoId, sitioId]
    );

    res.status(201).json(
      formatSuccess("Asignación creada correctamente", insertResult.rows[0])
    );
  } catch (error) {
    console.error("Error al asignar sitio al nodo:", error);
    res.status(500).json(formatError("Error al crear la asignación"));
  }
};

export const unassignSitio = async (req, res) => {
  const validation = validatePayload(req.body);

  if (!validation.valid) {
    return res.status(400).json(formatError(validation.message));
  }

  const { nodoId, sitioId } = validation;

  try {
    const deleteResult = await pool.query(
      `DELETE FROM nodos_sitios
      WHERE nodo_id = $1 AND sitio_id = $2
      RETURNING nodo_id, sitio_id, fecha_asignacion`,
      [nodoId, sitioId]
    );

    if (deleteResult.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("La asignación especificada no existe"));
    }

    res.status(200).json(
      formatSuccess("Asignación eliminada correctamente", deleteResult.rows[0])
    );
  } catch (error) {
    console.error("Error al eliminar la asignación nodo-sitio:", error);
    res.status(500).json(formatError("Error al eliminar la asignación"));
  }
};
