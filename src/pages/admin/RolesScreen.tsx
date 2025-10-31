// NEW: Pantalla de mantenimiento para la gestión de roles del portal administrativo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Role = {
  id: number;
  nombre: string;
  fecha_creacion: string;
  usuarios_asignados?: number;
};

type ModalMode = 'create' | 'edit';

// NEW: Componentes reutilizados para mantener coherencia visual.
const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-[#1C2E4A] text-white hover:bg-[#243b55] focus:ring-[#1C2E4A]`;
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;

const RolesScreen: React.FC = () => {
  // NEW: Estados para gestionar la lista de roles y la interacción del usuario.
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fetchError, setFetchError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // NEW: Recupera la información de roles desde el backend.
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3000/api/roles');
      // FIX: Se apunta explícitamente al endpoint /api para evitar recibir el HTML de la SPA.

      if (!response.ok) {
        throw new Error('No se pudo obtener la lista de roles');
      }

      const data: Role[] = await response.json();
      if (!Array.isArray(data)) {
        // FIX: Se valida que la respuesta siga siendo JSON válido y no una página HTML de error.
        throw new Error('Respuesta inválida del servidor');
      }

      setRoles(data);
      setErrorMessage('');
      setFetchError('');
    } catch (error) {
      console.error(error);
      setFetchError('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // NEW: Filtrado en memoria para búsquedas rápidas.
  const filteredRoles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return roles;
    }

    return roles.filter((role) => role.nombre.toLowerCase().includes(term));
  }, [roles, searchTerm]);

  const resetModalState = () => {
    setErrorMessage('');
    setRoleName('');
    setSelectedRole(null);
  };

  const openCreateModal = () => {
    // NEW: Configura el modal para creación de un nuevo rol.
    resetModalState();
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    // NEW: Configura el modal para edición del rol seleccionado.
    resetModalState();
    setSelectedRole(role);
    setRoleName(role.nombre);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    // NEW: Validación previa antes de invocar al backend.
    const trimmedName = roleName.trim();

    if (!trimmedName) {
      setErrorMessage('El nombre del rol es obligatorio');
      return;
    }

    const duplicated = roles.some(
      (role) => role.nombre.toLowerCase() === trimmedName.toLowerCase() && role.id !== selectedRole?.id
    );

    if (duplicated) {
      setErrorMessage('Ya existe un rol con ese nombre');
      return;
    }

    try {
      const endpoint = selectedRole ? `/api/roles/${selectedRole.id}` : '/api/roles';
      const method = selectedRole ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: trimmedName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al guardar' }));
        throw new Error(errorData.message || 'Error al guardar');
      }

      await fetchRoles();
      handleCloseModal();
      alert(selectedRole ? 'Rol actualizado correctamente' : 'Rol creado correctamente');
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  const handleDelete = async (role: Role) => {
    // NEW: Confirma y elimina un rol si no tiene usuarios vinculados.
    const confirmDelete = window.confirm(
      `¿Deseas eliminar el rol "${role.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al eliminar' }));
        throw new Error(errorData.message || 'Error al eliminar');
      }

      await fetchRoles();
      alert('Rol eliminado correctamente');
    } catch (error) {
      console.error(error);
      alert((error as Error).message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      {/* NEW: Encabezado y acciones principales de la vista. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mantenimiento de Roles</h1>
          <p className="text-sm text-gray-500">Administra los roles disponibles para los usuarios del portal.</p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Rol
        </button>
      </div>

      {/* NEW: Barra de búsqueda opcional para el filtrado de roles. */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="search">
          Buscar rol
        </label>
        <input
          id="search"
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Ingresa un nombre de rol"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
        />
      </div>

      {fetchError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* NEW: Tabla con la información de roles. */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de creación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuarios asociados</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Cargando roles...
                </td>
              </tr>
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No se encontraron roles con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{role.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(role.fecha_creacion).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.usuarios_asignados ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      type="button"
                      className="text-[#1C2E4A] hover:text-[#243b55]"
                      onClick={() => openEditModal(role)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(role)}
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

      {/* NEW: Modal para creación y edición de roles. */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800">
              {modalMode === 'create' ? 'Crear nuevo rol' : `Editar rol: ${selectedRole?.nombre}`}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Define un nombre representativo para el rol dentro del portal.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700" htmlFor="roleName">
                Nombre del rol
              </label>
              <input
                id="roleName"
                type="text"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="Ej. Administrador"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              />
              {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" className={secondaryButtonClasses} onClick={handleCloseModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesScreen;
