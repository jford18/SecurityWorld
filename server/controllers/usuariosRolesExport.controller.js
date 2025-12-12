import XLSX from "xlsx";
import pool from "../db.js";

// Referencia: patrón de exportación utilizado en Mantenimiento de Nodos (src/components/views/Nodos.jsx).

const getUsuarioColumnsAvailability = async () => {
  const { rows } = await pool.query(
    `
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'nombre_completo'
        ) AS has_nombre_completo,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'correo'
        ) AS has_correo,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'activo'
        ) AS has_activo
    `
  );

  return (
    rows[0] ?? {
      has_nombre_completo: false,
      has_correo: false,
      has_activo: false,
    }
  );
};

const mapUsuariosConRoles = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const existing = grouped.get(row.usuario_id) ?? {
      usuario_id: row.usuario_id,
      nombre_usuario: row.nombre_usuario,
      nombre_completo: row.nombre_completo,
      correo: row.correo,
      estado: row.estado,
      roles: [],
    };

    if (row.rol_nombre) {
      existing.roles.push(row.rol_nombre);
    }

    grouped.set(row.usuario_id, existing);
  });

  return Array.from(grouped.values()).sort((a, b) => a.usuario_id - b.usuario_id);
};

export const exportUsuariosRolesExcelPublic = async (_req, res) => {
  try {
    const columnInfo = await getUsuarioColumnsAvailability();
    const nombreCompletoField = columnInfo.has_nombre_completo
      ? "u.nombre_completo"
      : "NULL::text";
    const correoField = columnInfo.has_correo ? "u.correo" : "NULL::text";
    const estadoField = columnInfo.has_activo
      ? "CASE WHEN u.activo IS TRUE THEN 'Activo' WHEN u.activo IS FALSE THEN 'Inactivo' ELSE '' END"
      : "NULL::text";

    const query = `
      SELECT
        u.id AS usuario_id,
        u.nombre_usuario,
        ${nombreCompletoField} AS nombre_completo,
        ${correoField} AS correo,
        ${estadoField} AS estado,
        r.nombre AS rol_nombre
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
      LEFT JOIN roles r ON r.id = ur.rol_id
      ORDER BY u.id ASC, r.id ASC
    `;

    const { rows } = await pool.query(query);
    const usuariosAgrupados = mapUsuariosConRoles(rows);

    const worksheetData = [
      ["USUARIO", "NOMBRE", "CORREO", "ROLES", "ESTADO"],
      ...usuariosAgrupados.map((usuario) => [
        usuario.nombre_usuario ?? "",
        usuario.nombre_completo ?? "",
        usuario.correo ?? "",
        usuario.roles.join(", "),
        usuario.estado ?? "",
      ]),
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Usuarios y Roles");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"usuarios_roles.xlsx\""
    );

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Error al exportar usuarios y roles", error);
    return res.status(500).json({ message: "No se pudo generar el Excel" });
  }
};

// Ruta pública registrada en server/routes/usuariosRolesExportPublic.routes.js -> /api/usuarios-roles/export-excel-public (frontend: src/pages/admin/AsignacionRolesScreen.tsx)
