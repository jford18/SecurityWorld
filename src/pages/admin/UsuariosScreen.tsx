import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutocompleteComboBox from '@/components/ui/AutocompleteComboBox';
import {
  createUsuario,
  deleteUsuario,
  exportUsuariosExcel,
  getUsuarios,
  updateUsuario,
  UsuarioPayload,
  UsuarioUpdatePayload,
} from '../../services/usuariosService';

export type Usuario = {
  id: number;
  nombre_usuario: string;
  nombre_completo: string | null;
  activo: boolean;
  fecha_creacion: string;
};

type ModalMode = 'create' | 'edit';

const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-[#1C2E4A] text-white hover:bg-[#243b55] focus:ring-[#1C2E4A]`;
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-600 text-white hover:bg-red-700 focus:ring-red-600`;

const initialCreateState: UsuarioPayload = {
  nombre_usuario: '',
  contrasena: '',
  nombre_completo: '',
};

const initialUpdateState: UsuarioUpdatePayload = {
  nombre_usuario: '',
  nombre_completo: '',
  activo: true,
  contrasena: '',
};

const statusItems = [
  { id: 'empty', label: 'Seleccione...', value: '' },
  { id: 'true', label: 'Activo', value: 'true' },
  { id: 'false', label: 'Inactivo', value: 'false' },
];

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ title, onClose, onSubmit, submitLabel, children, disabled }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ×
        </button>
      </div>
      <div className="space-y-4">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={secondaryButtonClasses} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={primaryButtonClasses} onClick={onSubmit} disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </div>
  </div>
);

const UsuariosScreen: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [createForm, setCreateForm] = useState<UsuarioPayload>(initialCreateState);
  const [updateForm, setUpdateForm] = useState<UsuarioUpdatePayload>(initialUpdateState);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [filterId, setFilterId] = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterNombreCompleto, setFilterNombreCompleto] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFechaCreacion, setFilterFechaCreacion] = useState('');
  const [sortField, setSortField] = useState<
    'id' | 'usuario' | 'nombreCompleto' | 'estado' | 'fechaCreacion' | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // FIX: Centralizamos la carga de usuarios y capturamos errores del backend.
  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await getUsuarios();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setUsuarios(data);
    } catch (error) {
      console.error('Error al obtener usuarios', error); // FIX: Registro para soporte.
      const message = (error as Error).message || '';
      const normalized =
        message === 'Failed to fetch' || message.toLowerCase().includes('network')
          ? 'No se pudo conectar al servidor'
          : message || 'No se pudo conectar al servidor';
      setErrorMessage(normalized);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const openCreateModal = () => {
    setModalMode('create');
    setCreateForm(initialCreateState);
    setErrorMessage('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleExportToExcel = async () => {
    if (exporting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    try {
      setExporting(true);
      const { blob, filename } = await exportUsuariosExcel({
        id: filterId,
        usuario: filterUsuario,
        nombreCompleto: filterNombreCompleto,
        estado: filterEstado,
        fechaCreacion: filterFechaCreacion,
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'USUARIOS.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setSuccessMessage('Exportación de usuarios generada correctamente');
    } catch (error) {
      setErrorMessage((error as Error).message || 'No se pudo exportar usuarios');
    } finally {
      setExporting(false);
    }
  };

  const openEditModal = (usuario: Usuario) => {
    setModalMode('edit');
    setSelectedUsuario(usuario);
    setUpdateForm({
      nombre_usuario: usuario.nombre_usuario,
      nombre_completo: usuario.nombre_completo ?? '',
      activo: usuario.activo,
      contrasena: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUsuario(null);
  };

  const handleCreateChange = (field: keyof UsuarioPayload, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateChange = (field: keyof UsuarioUpdatePayload, value: string | boolean) => {
    setUpdateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    const trimmedUsername = createForm.nombre_usuario.trim();
    const trimmedPassword = createForm.contrasena.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMessage('Nombre de usuario y contraseña son obligatorios');
      return;
    }

    try {
      await createUsuario({
        nombre_usuario: trimmedUsername,
        contrasena: trimmedPassword,
        nombre_completo: createForm.nombre_completo?.trim() || undefined,
      });
      setSuccessMessage('Usuario creado correctamente');
      closeModal();
      fetchUsuarios();
    } catch (error) {
      // FIX: Mostramos el mensaje exacto recibido del backend cuando es posible.
      setErrorMessage((error as Error).message || 'Error al crear usuario');
    }
  };

  const handleUpdate = async () => {
    if (!selectedUsuario) {
      return;
    }

    const trimmedUsername = updateForm.nombre_usuario.trim();
    const trimmedName = updateForm.nombre_completo?.trim() ?? '';

    if (!trimmedUsername) {
      setErrorMessage('El nombre de usuario es obligatorio');
      return;
    }

    if (typeof updateForm.activo !== 'boolean') {
      setErrorMessage('Debes indicar un estado válido');
      return;
    }

    try {
      const payload: UsuarioUpdatePayload = {
        nombre_usuario: trimmedUsername,
        nombre_completo: trimmedName,
        activo: Boolean(updateForm.activo),
      };

      const trimmedPassword = updateForm.contrasena?.trim();
      if (trimmedPassword) {
        payload.contrasena = trimmedPassword;
      }

      await updateUsuario(selectedUsuario.id, payload);
      setSuccessMessage('Usuario actualizado correctamente');
      closeModal();
      fetchUsuarios();
    } catch (error) {
      setErrorMessage((error as Error).message || 'Error al actualizar usuario');
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar al usuario "${usuario.nombre_usuario}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteUsuario(usuario.id);
      setSuccessMessage('Usuario eliminado correctamente');
      fetchUsuarios();
    } catch (error) {
      setErrorMessage((error as Error).message || 'Error al eliminar usuario');
    }
  };

  const handleSort = (field: 'id' | 'usuario' | 'nombreCompleto' | 'estado' | 'fechaCreacion') => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
        return currentField;
      }

      setSortDirection('asc');
      return field;
    });
  };

  const renderSortIndicator = (
    field: 'id' | 'usuario' | 'nombreCompleto' | 'estado' | 'fechaCreacion'
  ) => {
    if (sortField !== field) {
      return null;
    }

    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const usuariosFiltradosOrdenados = useMemo(() => {
    const filtered = usuarios.filter((usuario) => {
      const filterIdLower = filterId.trim().toLowerCase();
      const filterUsuarioLower = filterUsuario.trim().toLowerCase();
      const filterNombreLower = filterNombreCompleto.trim().toLowerCase();
      const filterEstadoNormalized = filterEstado.trim().toLowerCase();
      const filterFechaLower = filterFechaCreacion.trim().toLowerCase();

      const idMatch = String(usuario.id).toLowerCase().includes(filterIdLower);
      const usuarioMatch = usuario.nombre_usuario.toLowerCase().includes(filterUsuarioLower);
      const nombreMatch = (usuario.nombre_completo ?? '').toLowerCase().includes(filterNombreLower);
      const estadoLabel = usuario.activo ? 'activo' : 'inactivo';
      const estadoMatch = filterEstadoNormalized === '' || estadoLabel.includes(filterEstadoNormalized);
      const fechaFormateada = new Date(usuario.fecha_creacion).toLocaleString();
      const fechaMatch = fechaFormateada.toLowerCase().includes(filterFechaLower);

      return idMatch && usuarioMatch && nombreMatch && estadoMatch && fechaMatch;
    });

    if (!sortField) {
      return filtered;
    }

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'id') {
        comparison = a.id - b.id;
      } else if (sortField === 'usuario') {
        comparison = a.nombre_usuario.localeCompare(b.nombre_usuario, 'es', {
          sensitivity: 'accent',
        });
      } else if (sortField === 'nombreCompleto') {
        comparison = (a.nombre_completo ?? '').localeCompare(b.nombre_completo ?? '', 'es', {
          sensitivity: 'accent',
        });
      } else if (sortField === 'estado') {
        comparison = Number(a.activo) - Number(b.activo);
      } else if (sortField === 'fechaCreacion') {
        comparison =
          new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime();
      }

      return comparison * directionMultiplier;
    });
  }, [filterEstado, filterFechaCreacion, filterId, filterNombreCompleto, filterUsuario, sortDirection, sortField, usuarios]);

  return (
    <div className="space-y-6">
      {/* NEW: Encabezado principal y acción de creación. */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mantenimiento de Usuarios</h1>
          <p className="text-sm text-gray-500">Gestiona las cuentas registradas en el sistema.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClasses}
            onClick={handleExportToExcel}
            disabled={exporting}
          >
            {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
          <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
            Nuevo Usuario
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{errorMessage}</div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">{successMessage}</div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-2 font-semibold text-gray-700"
                    >
                      <span>ID</span>
                      <span className="text-gray-400">{renderSortIndicator('id')}</span>
                    </button>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                      placeholder="Filtrar…"
                      value={filterId}
                      onChange={(event) => setFilterId(event.target.value)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('usuario')}
                      className="flex items-center gap-2 font-semibold text-gray-700"
                    >
                      <span>Usuario</span>
                      <span className="text-gray-400">{renderSortIndicator('usuario')}</span>
                    </button>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                      placeholder="Filtrar…"
                      value={filterUsuario}
                      onChange={(event) => setFilterUsuario(event.target.value)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('nombreCompleto')}
                      className="flex items-center gap-2 font-semibold text-gray-700"
                    >
                      <span>Nombre completo</span>
                      <span className="text-gray-400">{renderSortIndicator('nombreCompleto')}</span>
                    </button>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                      placeholder="Filtrar…"
                      value={filterNombreCompleto}
                      onChange={(event) => setFilterNombreCompleto(event.target.value)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('estado')}
                      className="flex items-center gap-2 font-semibold text-gray-700"
                    >
                      <span>Estado</span>
                      <span className="text-gray-400">{renderSortIndicator('estado')}</span>
                    </button>
                    <select
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                      value={filterEstado}
                      onChange={(event) => setFilterEstado(event.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('fechaCreacion')}
                      className="flex items-center gap-2 font-semibold text-gray-700"
                    >
                      <span>Fecha creación</span>
                      <span className="text-gray-400">{renderSortIndicator('fechaCreacion')}</span>
                    </button>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
                      placeholder="Filtrar…"
                      value={filterFechaCreacion}
                      onChange={(event) => setFilterFechaCreacion(event.target.value)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : usuariosFiltradosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No se encontraron usuarios con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                usuariosFiltradosOrdenados.map((usuario) => (
                  <tr key={usuario.id}>
                    <td className="px-4 py-4 text-sm text-gray-700">{usuario.id}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{usuario.nombre_usuario}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{usuario.nombre_completo || '—'}</td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          usuario.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {new Date(usuario.fecha_creacion).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex gap-2">
                        <button type="button" className={secondaryButtonClasses} onClick={() => openEditModal(usuario)}>
                          Editar
                        </button>
                        <button type="button" className={dangerButtonClasses} onClick={() => handleDelete(usuario)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && modalMode === 'create' && (
        <Modal title="Nuevo Usuario" onClose={closeModal} onSubmit={handleCreate} submitLabel="Crear">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="nombre_usuario">
              Nombre de usuario
            </label>
            <input
              id="nombre_usuario"
              type="text"
              value={createForm.nombre_usuario}
              onChange={(event) => handleCreateChange('nombre_usuario', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="contrasena">
              Contraseña
            </label>
            <input
              id="contrasena"
              type="password"
              value={createForm.contrasena}
              onChange={(event) => handleCreateChange('contrasena', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="nombre_completo">
              Nombre completo (opcional)
            </label>
            <input
              id="nombre_completo"
              type="text"
              value={createForm.nombre_completo ?? ''}
              onChange={(event) => handleCreateChange('nombre_completo', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
        </Modal>
      )}

      {isModalOpen && modalMode === 'edit' && selectedUsuario && (
        <Modal title="Editar Usuario" onClose={closeModal} onSubmit={handleUpdate} submitLabel="Guardar cambios">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="edit_nombre_usuario">
              Nombre de usuario
            </label>
            <input
              id="edit_nombre_usuario"
              type="text"
              value={updateForm.nombre_usuario}
              onChange={(event) => handleUpdateChange('nombre_usuario', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="edit_nombre_completo">
              Nombre completo
            </label>
            <input
              id="edit_nombre_completo"
              type="text"
              value={updateForm.nombre_completo}
              onChange={(event) => handleUpdateChange('nombre_completo', event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="edit_contrasena">
              Contraseña (opcional)
            </label>
            <input
              id="edit_contrasena"
              type="password"
              value={updateForm.contrasena ?? ''}
              onChange={(event) => handleUpdateChange('contrasena', event.target.value)}
              placeholder="Deja en blanco para mantener la actual"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <AutocompleteComboBox
              label="Estado"
              value={updateForm.activo ? 'true' : 'false'}
              onChange={(value: string) => handleUpdateChange('activo', value === 'true')}
              items={statusItems}
              displayField="label"
              valueField="value"
              placeholder="Buscar estado..."
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default UsuariosScreen;
