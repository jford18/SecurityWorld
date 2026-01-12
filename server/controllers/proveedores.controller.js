import XLSX from "xlsx";
import {
  deleteProveedorById,
  exportProveedores,
  findAllProveedores,
  findProveedorById,
  insertProveedor,
  updateProveedorById,
} from "../services/proveedores.service.js";

console.log("[API] Controlador PROVEEDORES activo y conectado a la tabla public.proveedores");

const formatSuccess = (message, data = null) => ({
  status: "success",
  message,
  data,
});

const formatError = (message) => ({
  status: "error",
  message,
});

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "t", "on", "activo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "off", "inactivo", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
};

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const formatDateValue = (value) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().replace("T", " ").replace("Z", "");
};

export const getProveedores = async (req, res) => {
  try {
    const rawSearch = sanitizeText(req?.query?.q ?? req?.query?.search ?? "");
    const proveedores = await findAllProveedores(rawSearch);
    res.json(proveedores ?? []);
  } catch (error) {
    console.error("[PROVEEDORES] Error al listar proveedores:", error);
    res.status(500).json({
      message: "Error obteniendo proveedores",
      error,
    });
  }
};

export const getProveedorById = async (req, res) => {
  const proveedorId = parsePositiveInteger(req.params?.id);
  if (!proveedorId) {
    return res
      .status(400)
      .json(formatError("El identificador del proveedor no es válido"));
  }

  try {
    const proveedor = await findProveedorById(proveedorId);
    if (!proveedor) {
      return res
        .status(404)
        .json(formatError("El proveedor solicitado no existe"));
    }

    res.json(proveedor);
  } catch (error) {
    console.error("[PROVEEDORES] Error al obtener proveedor:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al obtener el proveedor"));
  }
};

export const createProveedor = async (req, res) => {
  const {
    nombre,
    identificacion = "",
    direccion = "",
    telefono = "",
    activo = true,
  } = req.body ?? {};

  const nombreLimpio = sanitizeText(nombre);
  const identificacionLimpia = sanitizeText(identificacion);
  const direccionLimpia = sanitizeText(direccion);
  const telefonoLimpio = sanitizeText(telefono);
  const activoNormalizado = normalizeBoolean(activo, true);

  if (!nombreLimpio) {
    return res.status(422).json(formatError("El nombre es obligatorio"));
  }

  try {
    const nuevoProveedor = await insertProveedor({
      nombre: nombreLimpio,
      identificacion: identificacionLimpia,
      direccion: direccionLimpia,
      telefono: telefonoLimpio,
      activo: activoNormalizado,
    });

    res
      .status(201)
      .json(formatSuccess("Proveedor creado correctamente", nuevoProveedor));
  } catch (error) {
    console.error("[PROVEEDORES] Error al crear proveedor:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al crear el proveedor"));
  }
};

export const updateProveedor = async (req, res) => {
  const proveedorId = parsePositiveInteger(req.params?.id);
  if (!proveedorId) {
    return res
      .status(400)
      .json(formatError("El identificador del proveedor no es válido"));
  }

  const { nombre, identificacion, direccion, telefono, activo } = req.body ?? {};

  const updates = {};

  if (nombre !== undefined) {
    const nombreLimpio = sanitizeText(nombre);
    if (!nombreLimpio) {
      return res
        .status(422)
        .json(formatError("El nombre del proveedor es obligatorio"));
    }
    updates.nombre = nombreLimpio;
  }

  if (identificacion !== undefined) {
    updates.identificacion = sanitizeText(identificacion);
  }

  if (direccion !== undefined) {
    updates.direccion = sanitizeText(direccion);
  }

  if (telefono !== undefined) {
    updates.telefono = sanitizeText(telefono);
  }

  if (activo !== undefined) {
    updates.activo = normalizeBoolean(activo);
  }

  if (Object.keys(updates).length === 0) {
    return res
      .status(400)
      .json(formatError("No se proporcionaron campos para actualizar"));
  }

  try {
    const updatedProveedor = await updateProveedorById(proveedorId, updates);

    if (!updatedProveedor) {
      return res
        .status(404)
        .json(formatError("El proveedor solicitado no existe"));
    }

    res.json(formatSuccess("Proveedor actualizado correctamente", updatedProveedor));
  } catch (error) {
    console.error("[PROVEEDORES] Error al actualizar proveedor:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al actualizar el proveedor"));
  }
};

export const deleteProveedor = async (req, res) => {
  const proveedorId = parsePositiveInteger(req.params?.id);
  if (!proveedorId) {
    return res
      .status(400)
      .json(formatError("El identificador del proveedor no es válido"));
  }

  try {
    const deleted = await deleteProveedorById(proveedorId);

    if (!deleted) {
      return res
        .status(404)
        .json(formatError("El proveedor solicitado no existe"));
    }

    res.json(formatSuccess("Proveedor eliminado correctamente", deleted));
  } catch (error) {
    console.error("[PROVEEDORES] Error al eliminar proveedor:", error);
    res
      .status(500)
      .json(formatError("Ocurrió un error al eliminar el proveedor"));
  }
};

export const exportProveedoresExcel = async (req, res) => {
  try {
    const rawSearch = sanitizeText(req?.query?.q ?? req?.query?.search ?? "");
    const proveedores = await exportProveedores(rawSearch);

    const worksheetData = [
      ["ID", "NOMBRE", "IDENTIFICACION", "TELEFONO", "DIRECCION", "ACTIVO", "FECHA_CREACION"],
      ...proveedores.map((row) => [
        row?.id ?? "",
        row?.nombre ?? "",
        row?.identificacion ?? "",
        row?.telefono ?? "",
        row?.direccion ?? "",
        row?.activo === null || row?.activo === undefined ? "" : row.activo ? "Sí" : "No",
        formatDateValue(row?.fecha_creacion),
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Proveedores");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const timestamp = formatTimestamp();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="PROVEEDORES_${timestamp}.xlsx"`
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
    console.error("Error al exportar proveedores:", error);
    return res.status(500).json({
      message: "No se pudo exportar proveedores",
      detail: error?.message,
    });
  }
};

export default {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  exportProveedoresExcel,
};
