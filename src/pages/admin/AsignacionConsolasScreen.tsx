import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsuarios } from '../../services/usuariosService';
import { getConsolas } from '../../services/consolasService';
import {
  createAsignacion,
  deleteAsignacion,
  fetchAsignaciones,
} from '../../services/usuarioConsolasService';

export type UsuarioOption = {
  id: number;
  nombre_usuario: string;
  nombre_completo?: string | null;
};

export type ConsolaOption = {
  id: number;
  nombre: string;
};

export type UsuarioConsolaAsignacion = {
  usuario_id: number;
  nombre_usuario: string;
  consola_id: number;
  consola_nombre: string;
  fecha_asignacion: string;
};

const dropdownClasses =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]/40';
const buttonBaseClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

const AsignacionConsolasScreen: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [consolas, setConsolas] = useState<ConsolaOption[]>([]);
  const [asignaciones, setAsignaciones] = useState<UsuarioConsolaAsignacion[]>([]);

  const [selectedUsuarioId, setSelectedUsuarioId] = useState<number | ''>('');
  const [selectedConsolaId, setSelectedConsolaId] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const normalizeUsuarios = (data: unknown): UsuarioOption[] => {
    if (!Array.isArray(data)) {
      throw new Error('Respuesta inválida del servidor');
    }

    return (data as UsuarioOption[])
      .map((usuario) => ({
        id: Number(usuario.id),
        nombre_usuario: usuario.nombre_usuario,
        nombre_completo: usuario.nombre_completo ?? null,
      }))
      .filter((usuario) => Number.isInteger(usuario.id));
  };

  const normalizeConsolas = (data: unknown): ConsolaOption[] => {
    if (!Array.isArray(data)) {
      throw new Error('Respuesta inválida del servidor');
    }

    return (data as ConsolaOption[])
      .map((consola) => ({
        id: Number(consola.id),
        nombre: consola.nombre,
      }))
      .filter((consola) => Number.isInteger(consola.id));
  };

  const normalizeAsignaciones = (data: unknown): UsuarioConsolaAsignacion[] => {
    if (!Array.isArray(data)) {
      throw new Error('Respuesta inválida del servidor');
    }

    return (data as UsuarioConsolaAsignacion[])
      .map((item) => ({
        usuario_id: Number(item.usuario_id),
        nombre_usuario: item.nombre_usuario,
        consola_id: Number(item.consola_id),
        consola_nombre: item.consola_nombre,
        fecha_asignacion: item.fecha_asignacion,
      }))
      .filter((item) => Number.isInteger(item.usuario_id) && Number.isInteger(item.consola_id));
  };

  const loadAsignaciones = useCallback(async () => {
    const data = await fetchAsignaciones();
    const normalizadas = normalizeAsignaciones(data);
    setAsignaciones(normalizadas);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const [asignacionesResponse, usuariosResponse, consolasResponse] = await Promise.all([
        fetchAsignaciones(),
        getUsuarios(),
        getConsolas(),
      ]);

      const asignacionesNormalizadas = normalizeAsignaciones(asignacionesResponse);
      const usuariosNormalizados = normalizeUsuarios(usuariosResponse).sort((a, b) =>
        a.nombre_usuario.localeCompare(b.nombre_usuario, 'es')
      );
      const consolasNormalizadas = normalizeConsolas(consolasResponse).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es')
      );

      setAsignaciones(asignacionesNormalizadas);
      setUsuarios(usuariosNormalizados);
      setConsolas(consolasNormalizadas);

      setSelectedUsuarioId((prev) => {
        if (prev !== '' && usuariosNormalizados.some((usuario) => usuario.id === prev)) {
          return prev;
        }
        return usuariosNormalizados.length > 0 ? usuariosNormalizados[0].id : '';
      });

      setSelectedConsolaId((prev) => {
        if (prev !== '' && consolasNormalizadas.some((consola) => consola.id === prev)) {
          return prev;
        }
        return consolasNormalizadas.length > 0 ? consolasNormalizadas[0].id : '';
      });
    } catch (error) {
      console.error('Error al cargar asignaciones usuario-consola:', error);
      setErrorMessage((error as Error).message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const asignacionesOrdenadas = useMemo(
    () =>
      [...asignaciones].sort((a, b) =>
        new Date(b.fecha_asignacion).getTime() - new Date(a.fecha_asignacion).getTime()
      ),
    [asignaciones]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedUsuarioId === '' || selectedConsolaId === '') {
      setErrorMessage('Seleccione un usuario y una consola.');
      return;
    }

    setSubmitting(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      await createAsignacion({ usuario_id: selectedUsuarioId, consola_id: selectedConsolaId });
      setFeedbackMessage('Asignación creada correctamente.');
      await loadAsignaciones();
    } catch (error) {
      console.error('Error al crear asignación usuario-consola:', error);
      setErrorMessage((error as Error).message || 'No se pudo crear la asignación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (usuarioId: number, consolaId: number) => {
    const confirmed = window.confirm('¿Eliminar asignación seleccionada?');
    if (!confirmed) {
      return;
    }

    setFeedbackMessage('');
    setErrorMessage('');

    try {
      await deleteAsignacion(usuarioId, consolaId);
      setFeedbackMessage('Asignación eliminada correctamente.');
      await loadAsignaciones();
    } catch (error) {
      console.error('Error al eliminar asignación usuario-consola:', error);
      setErrorMessage((error as Error).message || 'No se pudo eliminar la asignación');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Asignación de Usuarios ↔ Consolas</h1>
        <p className="text-sm text-gray-500">
          Relaciona a los usuarios del sistema con las consolas disponibles y administra sus asignaciones.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow md:flex-row md:items-end"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="usuarioId">
            Usuario
          </label>
          <select
            id="usuarioId"
            className={dropdownClasses}
            value={selectedUsuarioId === '' ? '' : selectedUsuarioId}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedUsuarioId(value ? Number(value) : '');
            }}
            disabled={loading || usuarios.length === 0}
          >
            {usuarios.length === 0 && <option value="">Sin usuarios disponibles</option>}
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nombre_usuario}
                {usuario.nombre_completo ? ` — ${usuario.nombre_completo}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="consolaId">
            Consola
          </label>
          <select
            id="consolaId"
            className={dropdownClasses}
            value={selectedConsolaId === '' ? '' : selectedConsolaId}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedConsolaId(value ? Number(value) : '');
            }}
            disabled={loading || consolas.length === 0}
          >
            {consolas.length === 0 && <option value="">Sin consolas disponibles</option>}
            {consolas.map((consola) => (
              <option key={consola.id} value={consola.id}>
                {consola.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className={`${buttonBaseClasses} bg-yellow-400 text-blue-900 hover:bg-yellow-500 focus:ring-yellow-300`}
          disabled={submitting || loading || usuarios.length === 0 || consolas.length === 0}
        >
          {submitting ? 'Guardando…' : 'Asignar'}
        </button>
      </form>

      {feedbackMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {feedbackMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-[#1C2E4A]">Asignaciones registradas</h2>
          {loading && <span className="text-sm text-gray-500">Cargando…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                  Usuario
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                  Consola
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">
                  Fecha de asignación
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium uppercase tracking-wide text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {asignacionesOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No hay asignaciones registradas actualmente.
                  </td>
                </tr>
              ) : (
                asignacionesOrdenadas.map((item) => (
                  <tr key={`${item.usuario_id}-${item.consola_id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.nombre_usuario}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{item.consola_nombre}</div>
                    </td>
                    <td className="px-4 py-3">
                      <time className="text-gray-500">
                        {new Date(item.fecha_asignacion).toLocaleString('es-MX', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={`${buttonBaseClasses} border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-200`}
                        onClick={() => handleDelete(item.usuario_id, item.consola_id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AsignacionConsolasScreen;
