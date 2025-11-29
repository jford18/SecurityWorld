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
        A.fecha_creacion,
        B.nombre AS nodo_nombre,
        C.nombre AS sitio_nombre
      FROM nodos_sitios A
      INNER JOIN nodos B ON A.nodo_id = B.id
      INNER JOIN sitios C ON A.sitio_id = C.id
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
  const { nodoId, sitiosIds } = req.body;

  if (!nodoId) {
    return res.status(400).json(formatError("nodoId es requerido"));
  }

  const ids = Array.isArray(sitiosIds) ? sitiosIds : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM public.nodos_sitios WHERE nodo_id = $1;", [
      nodoId,
    ]);

    if (ids.length > 0) {
      await client.query(
        "DELETE FROM public.nodos_sitios WHERE sitio_id = ANY($1::int[]) AND nodo_id <> $2;",
        [ids, nodoId]
      );
    }

    if (ids.length > 0) {
      await client.query(
        `
        INSERT INTO public.nodos_sitios (nodo_id, sitio_id, fecha_creacion)
        SELECT $1, UNNEST($2::int[]), NOW();
        `,
        [nodoId, ids]
      );
    }

    await client.query("COMMIT");
    return res.json(
      formatSuccess("Asignación de sitios guardada correctamente")
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al asignar sitio al nodo:", error);
    return res.status(500).json(formatError("Error al asignar sitios al nodo"));
  } finally {
    client.release();
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
      RETURNING nodo_id, sitio_id, fecha_creacion`,
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
