import pool from '../db.js';

// NEW: Listar todas las asignaciones entre usuarios y consolas mostrando metadatos relevantes.
export const getUsuarioConsolas = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT uc.usuario_id,
             u.nombre_usuario,
             uc.consola_id,
             c.nombre AS consola_nombre,
             uc.fecha_asignacion
      FROM usuario_consolas uc
      INNER JOIN usuarios u ON (u.id = uc.usuario_id)
      INNER JOIN consolas c ON (c.id = uc.consola_id)
      ORDER BY uc.fecha_asignacion DESC;
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener asignaciones usuario-consola:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// NEW: Crear una nueva asignación validando duplicados antes de insertar.
export const createUsuarioConsola = async (req, res) => {
  try {
    const { usuario_id: usuarioId, consola_id: consolaId } = req.body ?? {};

    if (!usuarioId || !consolaId) {
      return res.status(422).json({ message: 'usuario_id y consola_id son obligatorios' });
    }

    const exists = await pool.query(
      'SELECT 1 FROM usuario_consolas WHERE usuario_id = $1 AND consola_id = $2',
      [usuarioId, consolaId]
    );

    if (exists.rowCount > 0) {
      return res.status(409).json({ message: 'Esta asignación ya existe' });
    }

    const insert = await pool.query(
      'INSERT INTO usuario_consolas (usuario_id, consola_id) VALUES ($1, $2) RETURNING *',
      [usuarioId, consolaId]
    );

    res.status(201).json({ message: 'Asignación creada', data: insert.rows[0] });
  } catch (error) {
    console.error('Error al crear asignación usuario-consola:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// NEW: Eliminar una asignación usuario-consola existente.
export const deleteUsuarioConsola = async (req, res) => {
  try {
    const { usuario_id: usuarioId, consola_id: consolaId } = req.params;

    await pool.query('DELETE FROM usuario_consolas WHERE usuario_id = $1 AND consola_id = $2', [
      usuarioId,
      consolaId,
    ]);

    res.status(200).json({ message: 'Asignación eliminada' });
  } catch (error) {
    console.error('Error al eliminar asignación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
