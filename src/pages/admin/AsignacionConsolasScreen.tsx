import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
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

// Type for react-select options
type SelectOption = {
  value: number | string;
  label: string;
};

export type UsuarioConsolaAsignacion = {
  usuario_id: number;
  nombre_usuario: string;
  consola_id: number;
  consola_nombre: string;
  fecha_asignacion: string;
};

export type ConsolaAsignada = {
  id: number;
  nombre: string;
};

export type UsuarioConsolaAgrupado = {
  usuario_id: number;
  nombre_usuario: string;
  consolas: ConsolaAsignada[];
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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioConsolaAgrupado | null>(null);

  const [selectedUsuarioId, setSelectedUsuarioId] = useState<number | ''>('');
  const [selectedConsolas, setSelectedConsolas] = useState<SelectOption[]>([]);

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

      // Reset selected consolas on data reload
      setSelectedConsolas([]);

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

  const asignacionesAgrupadas = useMemo(() => {
    const agrupado = asignaciones.reduce<Record<number, UsuarioConsolaAgrupado>>((acc, item) => {
      if (!acc[item.usuario_id]) {
        acc[item.usuario_id] = {
          usuario_id: item.usuario_id,
          nombre_usuario: item.nombre_usuario,
          consolas: [],
          fecha_asignacion: item.fecha_asignacion,
        };
      }
      acc[item.usuario_id].consolas.push({
        id: item.consola_id,
        nombre: item.consola_nombre,
      });
      return acc;
    }, {});

    return Object.values(agrupado).sort(
      (a, b) =>
        new Date(b.fecha_asignacion).getTime() - new Date(a.fecha_asignacion).getTime()
    );
  }, [asignaciones]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedUsuarioId === '' || selectedConsolas.length === 0) {
      setErrorMessage('Seleccione un usuario y al menos una consola.');
      return;
    }

    setSubmitting(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      const asignacionesPromises = selectedConsolas.map(consola =>
        createAsignacion({
          usuario_id: selectedUsuarioId,
          consola_id: consola.value as number,
        })
      );

      await Promise.all(asignacionesPromises);

      setFeedbackMessage('Asignación(es) creada(s) correctamente.');
      await loadAsignaciones();
      setSelectedConsolas([]); // Clear selection after successful submission
    } catch (error) {
      console.error('Error al crear asignación usuario-consola:', error);
      setErrorMessage((error as Error).message || 'No se pudo crear la asignación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (usuario: UsuarioConsolaAgrupado) => {
    setEditingUser(usuario);
    setIsEditModalOpen(true);
  };

  const handleUpdateConsolas = async (
    user: UsuarioConsolaAgrupado,
    consolasIds: (number | string)[]
  ) => {
    const consolasAEliminar =
      user.consolas.filter((c) => !consolasIds.includes(c.id)).map((c) => c.id) ?? [];

    if (consolasIds.length === 0) {
      const confirmed = window.confirm('¿Desea quitar todas las consolas del usuario?');
      if (!confirmed) return;
    }

    setFeedbackMessage('');
    setErrorMessage('');

    try {
      await Promise.all(
        consolasAEliminar.map((consolaId) => deleteAsignacion(user.usuario_id, consolaId))
      );
      setFeedbackMessage('Asignaciones actualizadas correctamente.');
      await loadAsignaciones();
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error al actualizar asignaciones:', error);
      setErrorMessage((error as Error).message || 'No se pudo actualizar las asignaciones');
    }
  };

  const consolaOptions: SelectOption[] = useMemo(
    () => consolas.map((c) => ({ value: c.id, label: c.nombre })),
    [consolas]
  );

  const handleSelectConsolas = (selected: readonly SelectOption[] | null) => {
    const selectedOptions = selected ? [...selected] : [];
    if (selectedOptions.some(option => option.value === '__ALL__')) {
      // If "Select All" is selected, select all individual consoles
      setSelectedConsolas(consolaOptions);
    } else {
      setSelectedConsolas(selectedOptions);
    }
  };

  const allConsolaOptions: SelectOption[] = useMemo(
    () => [{ value: '__ALL__', label: 'Seleccionar todas las consolas' }, ...consolaOptions],
    [consolaOptions]
  );

  return (
    <>
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
          <Select
            id="consolaId"
            isMulti
            options={allConsolaOptions}
            value={selectedConsolas}
            onChange={handleSelectConsolas}
            isDisabled={loading || consolas.length === 0}
            placeholder="Seleccione una o más consolas"
            noOptionsMessage={() => 'No hay consolas disponibles'}
            className="react-select-container"
            classNamePrefix="react-select"
          />
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
              {asignacionesAgrupadas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No hay asignaciones registradas actualmente.
                  </td>
                </tr>
              ) : (
                asignacionesAgrupadas.map((item) => (
                  <tr key={item.usuario_id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.nombre_usuario}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.consolas.map((c) => (
                          <span
                            key={c.id}
                            className="inline-block rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
                          >
                            {c.nombre}
                          </span>
                        ))}
                      </div>
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
                        className={`${buttonBaseClasses} border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 focus:ring-blue-200`}
                        onClick={() => handleEdit(item)}
                      >
                        Editar
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

{isEditModalOpen && editingUser && (
  <EditUserConsolesModal
    isOpen={isEditModalOpen}
    user={editingUser}
    onClose={() => {
      setIsEditModalOpen(false);
      setEditingUser(null);
    }}
    onSave={handleUpdateConsolas}
  />
)}
</>
);
};

type EditUserConsolesModalProps = {
  isOpen: boolean;
  user: UsuarioConsolaAgrupado;
  onClose: () => void;
  onSave: (user: UsuarioConsolaAgrupado, consolaIds: (number | string)[]) => void;
};

const EditUserConsolesModal: React.FC<EditUserConsolesModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
}) => {
  const [selectedConsolas, setSelectedConsolas] = useState<(number | string)[]>(
    user.consolas.map((c) => c.id)
  );

  const handleToggleConsola = (consolaId: number) => {
    setSelectedConsolas((prev) =>
      prev.includes(consolaId) ? prev.filter((id) => id !== consolaId) : [...prev, consolaId]
    );
  };

  const handleSave = () => {
    onSave(user, selectedConsolas);
  };

if (!isOpen) return null;

return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h2 id="modal-title" className="text-lg font-semibold text-gray-800">
        Editar consolas para: <br /> <span className="font-bold">{user.nombre_usuario}</span>
      </h2>

      <div className="mt-4 space-y-2">
        <p className="text-sm text-gray-600">
          Seleccione las consolas que desea mantener asignadas:
        </p>
        <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 p-2">
          {user.consolas.map((consola) => (
            <div key={consola.id} className="flex items-center justify-between p-2">
              <label
                htmlFor={`consola-${consola.id}`}
                className="flex cursor-pointer items-center justify-between p-2"
              >
                <span className="text-sm text-gray-700">{consola.nombre}</span>
                <input
                  type="checkbox"
                  id={`consola-${consola.id}`}
                  checked={selectedConsolas.includes(consola.id)}
                  onChange={() => handleToggleConsola(consola.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-2">
        <button
          type="button"
          className={`${buttonBaseClasses} bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-200`}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`${buttonBaseClasses} bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-300`}
          onClick={handleSave}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  </div>
);
};

export default AsignacionConsolasScreen;
