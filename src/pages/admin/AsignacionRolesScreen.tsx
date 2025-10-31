import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsuarios } from '../../services/usuariosService';
import {
  asignarRol,
  eliminarRol,
  fetchRolesDisponibles,
  fetchUsuarioRoles,
} from '../../services/usuarioRolesService';

export type UsuarioListado = {
  id: number;
  nombre_usuario: string;
  nombre_completo: string | null;
};

export type RolListado = {
  id: number;
  nombre: string;
};

export type UsuarioRolesAgrupado = {
  usuario_id: number;
  nombre_usuario: string;
  roles: RolListado[];
};

const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;

const AsignacionRolesScreen: React.FC = () => {
  // NEW: Estados base para mostrar la información proveniente del backend.
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [roles, setRoles] = useState<RolListado[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<number, Set<number>>>({});
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // NEW: Recupera usuarios, roles y sus asignaciones garantizando respuestas JSON válidas.
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const [usuariosResponse, rolesResponse, asignacionesResponse] = await Promise.all([
        getUsuarios(),
        fetchRolesDisponibles(),
        fetchUsuarioRoles(),
      ]);

      if (!Array.isArray(usuariosResponse) || !Array.isArray(rolesResponse) || !Array.isArray(asignacionesResponse)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const usuariosNormalizados = (usuariosResponse as UsuarioListado[]).map((usuario) => ({
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        nombre_completo: usuario.nombre_completo ?? null,
      }));

      const usuariosOrdenados = [...usuariosNormalizados].sort((a, b) => a.id - b.id);
      const rolesOrdenados = [...(rolesResponse as RolListado[])].sort((a, b) => a.id - b.id);

      const asignacionesMap: Record<number, Set<number>> = {};
      (asignacionesResponse as UsuarioRolesAgrupado[]).forEach((item) => {
        asignacionesMap[item.usuario_id] = new Set(item.roles.map((rol) => rol.id));
      });

      setUsuarios(usuariosOrdenados);
      setRoles(rolesOrdenados);
      setAsignaciones(asignacionesMap);

      if (usuariosOrdenados.length > 0) {
        setSelectedUserId((prev) => (prev && usuariosOrdenados.some((usuario) => usuario.id === prev) ? prev : usuariosOrdenados[0].id));
      } else {
        setSelectedUserId(null);
      }
    } catch (error) {
      console.error('Error al cargar asignaciones de roles', error); // FIX: Registro para diagnósticos del módulo.
      setErrorMessage((error as Error).message || 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // FIX: Memoizamos la asignación activa del usuario seleccionado para evitar cálculos innecesarios.
  const rolesAsignadosUsuario = useMemo(() => {
    if (!selectedUserId) {
      return new Set<number>();
    }
    return asignaciones[selectedUserId] ?? new Set<number>();
  }, [asignaciones, selectedUserId]);

  const setSavingFlag = (usuarioId: number, rolId: number, value: boolean) => {
    setSavingMap((prev) => ({ ...prev, [`${usuarioId}-${rolId}`]: value }));
  };

  const handleToggleRole = async (usuarioId: number, rolId: number, checked: boolean) => {
    if (!Number.isInteger(usuarioId) || !Number.isInteger(rolId)) {
      alert('Datos incompletos para asignar el rol');
      return;
    }

    setFeedbackMessage('');
    setErrorMessage('');

    const clave = `${usuarioId}-${rolId}`;
    if (savingMap[clave]) {
      return;
    }

    try {
      setSavingFlag(usuarioId, rolId, true);

      if (checked) {
        await asignarRol({ usuario_id: usuarioId, rol_id: rolId });
        setAsignaciones((prev) => {
          const current = new Set(prev[usuarioId] ?? []);
          current.add(rolId);
          return { ...prev, [usuarioId]: current };
        });
        setFeedbackMessage('Rol asignado correctamente');
      } else {
        const confirmed = window.confirm('¿Deseas eliminar este rol del usuario seleccionado?');
        if (!confirmed) {
          return;
        }

        await eliminarRol(usuarioId, rolId);
        setAsignaciones((prev) => {
          const current = new Set(prev[usuarioId] ?? []);
          current.delete(rolId);
          return { ...prev, [usuarioId]: current };
        });
        setFeedbackMessage('Rol eliminado correctamente');
      }
    } catch (error) {
      console.error('Error al actualizar rol de usuario', error); // FIX: Registro controlado para soporte.
      alert(checked ? 'No se pudo asignar el rol' : 'No se pudo eliminar el rol');
      setErrorMessage((error as Error).message || 'Error al actualizar roles del usuario');
    } finally {
      setSavingFlag(usuarioId, rolId, false);
    }
  };

  return (
    <div className="space-y-6">
      {/* NEW: Encabezado y descripción del módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Asignación de Roles a Usuarios</h1>
          <p className="text-sm text-gray-500">
            Selecciona un usuario para agregar o quitar roles disponibles en la plataforma.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClasses}
          onClick={() => {
            loadData();
          }}
        >
          Actualizar vista
        </button>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Usuarios</h2>
            {loading && <span className="text-sm text-gray-500">Cargando...</span>}
          </div>
          <ul className="space-y-2">
            {usuarios.map((usuario) => {
              const isActive = usuario.id === selectedUserId;
              return (
                <li key={usuario.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(usuario.id)}
                    className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-[#1C2E4A] bg-[#1C2E4A] text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-[#1C2E4A] hover:text-[#1C2E4A]'
                    }`}
                  >
                    <span className="font-semibold">{usuario.nombre_usuario}</span>
                    {usuario.nombre_completo && (
                      <span className="block text-sm text-gray-200 sm:text-gray-500">
                        {usuario.nombre_completo}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {usuarios.length === 0 && !loading && (
              <li className="text-sm text-gray-500">No hay usuarios disponibles.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Roles disponibles</h2>
            {selectedUserId && (
              <span className="text-sm text-gray-500">
                Usuario seleccionado: <strong>{usuarios.find((u) => u.id === selectedUserId)?.nombre_usuario}</strong>
              </span>
            )}
          </div>

          {!selectedUserId ? (
            <p className="text-sm text-gray-500">Selecciona un usuario para administrar sus roles.</p>
          ) : (
            <div className="space-y-3">
              {roles.map((rol) => {
                const checked = rolesAsignadosUsuario.has(rol.id);
                const clave = `${selectedUserId}-${rol.id}`;
                const isSaving = Boolean(savingMap[clave]);

                return (
                  <label
                    key={rol.id}
                    className={`flex items-center justify-between rounded-md border px-4 py-3 transition-colors ${
                      checked ? 'border-[#F1C40F] bg-[#FFF7D6]' : 'border-gray-200 hover:border-[#F1C40F]'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{rol.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isSaving && <span className="text-xs text-gray-500">Guardando…</span>}
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#F1C40F] focus:ring-[#F1C40F]"
                        checked={checked}
                        disabled={isSaving}
                        onChange={(event) => handleToggleRole(selectedUserId, rol.id, event.target.checked)}
                      />
                    </div>
                  </label>
                );
              })}

              {roles.length === 0 && !loading && (
                <p className="text-sm text-gray-500">No hay roles registrados en el sistema.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AsignacionRolesScreen;
