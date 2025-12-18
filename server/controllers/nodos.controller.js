import XLSX from "xlsx";
import pool from "../db.js";

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

export const listNodos = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        N.id,
        N.nombre,
        N.ip,
        N.proveedor_id,
        P.nombre AS proveedor_nombre,
        N.activo,
        N.fecha_creacion
      FROM nodos N
      LEFT JOIN proveedores P ON P.id = N.proveedor_id
      ORDER BY N.id`
    );
    res.status(200).json(formatSuccess("Listado de nodos", result.rows));
  } catch (error) {
    console.error("Error al listar nodos:", error);
    res.status(500).json(formatError("Error al listar los nodos"));
  }
};

export const exportNodosExcel = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        N.id,
        N.nombre,
        N.ip,
        N.activo,
        N.fecha_creacion,
        COALESCE(P.nombre, '') AS proveedor_nombre
      FROM nodos N
      LEFT JOIN proveedores P ON P.id = N.proveedor_id
      ORDER BY N.id;`
    );

    const worksheetData = [
      ["ID", "NOMBRE", "IP", "PROVEEDOR", "ACTIVO", "FECHA_CREACION"],
      ...rows.map((row) => [
        row.id ?? "",
        row.nombre ?? "",
        row.ip ?? "",
        row.proveedor_nombre ?? "",
        row.activo ? "Sí" : "No",
        row.fecha_creacion
          ? new Date(row.fecha_creacion)
              .toISOString()
              .replace("T", " ")
              .replace("Z", "")
          : "",
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nodos");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const timestamp = formatTimestamp();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NODOS_${timestamp}.xlsx"`
    );
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.removeHeader("ETag");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Error al exportar nodos:", error);
    return res.status(500).json({
      message: "No se pudo exportar nodos",
      detail: error?.message,
    });
  }
};

export const getSitioByNodo = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        S.id,
        S.nombre,
        S.descripcion,
        S.cliente_id
      FROM nodos_sitios NS
      INNER JOIN sitios S ON (S.id = NS.sitio_id)
      WHERE NS.nodo_id = $1
        AND S.activo = TRUE
      ORDER BY S.nombre;
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error("[NODOS] Error al obtener sitio por nodo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getNodoById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        N.id,
        N.nombre,
        N.ip,
        N.proveedor_id,
        P.nombre AS proveedor_nombre,
        N.activo,
        N.fecha_creacion
      FROM nodos N
      LEFT JOIN proveedores P ON P.id = N.proveedor_id
      WHERE N.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo obtenido correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al obtener nodo:", error);
    res.status(500).json(formatError("Error al obtener el nodo"));
  }
};

export const createNodo = async (req, res) => {
  const { nombre, ip, proveedorId } = req.body ?? {};
  const trimmedName = sanitizeText(nombre);
  const sanitizedIp = sanitizeText(ip) || null;
  const parsedProveedorId = parsePositiveInteger(proveedorId);

  if (!trimmedName) {
    return res
      .status(422)
      .json(formatError("El nombre del nodo es obligatorio"));
  }

  if (proveedorId !== undefined && proveedorId !== null && proveedorId !== "" && parsedProveedorId === null) {
    return res
      .status(400)
      .json(formatError("El proveedor seleccionado no es válido"));
  }

  try {
    const duplicate = await pool.query(
      "SELECT id FROM nodos WHERE LOWER(nombre) = LOWER($1)",
      [trimmedName]
    );

    if (duplicate.rowCount > 0) {
      return res
        .status(409)
        .json(formatError("Ya existe un nodo con ese nombre"));
    }

    const insertResult = await pool.query(
      `INSERT INTO nodos (nombre, ip, proveedor_id, activo)
      VALUES ($1, $2, $3, true)
      RETURNING id, nombre, ip, proveedor_id, activo, fecha_creacion`,
      [trimmedName, sanitizedIp, parsedProveedorId]
    );

    res
      .status(201)
      .json(
        formatSuccess(
          "Nodo creado correctamente",
          insertResult.rows[0]
        )
      );
  } catch (error) {
    console.error("Error al crear nodo:", error);
    res.status(500).json(formatError("Error al crear el nodo"));
  }
};

export const updateNodo = async (req, res) => {
  const { id } = req.params;
  const { nombre, activo, ip, proveedorId } = req.body ?? {};

  const updates = [];
  const values = [];
  let index = 1;

  if (nombre !== undefined) {
    const trimmedName = sanitizeText(nombre);

    if (!trimmedName) {
      return res
        .status(422)
        .json(formatError("El nombre del nodo es obligatorio"));
    }

    try {
      const duplicate = await pool.query(
        "SELECT id FROM nodos WHERE LOWER(nombre) = LOWER($1) AND id <> $2",
        [trimmedName, id]
      );

      if (duplicate.rowCount > 0) {
        return res
          .status(409)
          .json(formatError("Ya existe un nodo con ese nombre"));
      }
    } catch (error) {
      console.error("Error al validar duplicados de nodo:", error);
      return res
        .status(500)
        .json(formatError("Error al actualizar el nodo"));
    }

    updates.push(`nombre = $${index}`);
    values.push(trimmedName);
    index += 1;
  }

  if (ip !== undefined) {
    const sanitizedIp = sanitizeText(ip) || null;
    updates.push(`ip = $${index}`);
    values.push(sanitizedIp);
    index += 1;
  }

  if (proveedorId !== undefined) {
    const parsedProveedorId =
      proveedorId === null || proveedorId === ""
        ? null
        : parsePositiveInteger(proveedorId);

    if (proveedorId !== null && proveedorId !== "" && parsedProveedorId === null) {
      return res
        .status(400)
        .json(formatError("El proveedor seleccionado no es válido"));
    }

    updates.push(`proveedor_id = $${index}`);
    values.push(parsedProveedorId);
    index += 1;
  }

  if (activo !== undefined) {
    const normalizedActive =
      typeof activo === "string"
        ? ["1", "true", "t", "on"].includes(activo.trim().toLowerCase())
        : Boolean(activo);

    updates.push(`activo = $${index}`);
    values.push(normalizedActive);
    index += 1;
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json(formatError("No se enviaron campos para actualizar"));
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE nodos SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, nombre, ip, proveedor_id, activo, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo actualizado correctamente", result.rows[0]));
  } catch (error) {
    console.error("Error al actualizar nodo:", error);
    res.status(500).json(formatError("Error al actualizar el nodo"));
  }
};

export const deleteNodo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM nodos WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json(formatError("El nodo solicitado no existe"));
    }

    res
      .status(200)
      .json(formatSuccess("Nodo eliminado correctamente"));
  } catch (error) {
    console.error("Error al eliminar nodo:", error);
    res.status(500).json(formatError("Error al eliminar el nodo"));
  }
};
