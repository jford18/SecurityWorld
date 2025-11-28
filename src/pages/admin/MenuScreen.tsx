import React, { useEffect, useMemo, useState } from 'react';
import {
  MenuPayload,
  createMenu,
  deleteMenu,
  getMenusForManagement,
  updateMenu,
} from '@/services/menuService';

export type MenuItem = {
  id: number;
  nombre: string;
  icono: string | null;
  ruta: string;
  seccion: string | null;
  orden: number | null;
  activo: boolean;
};

type ModalMode = 'create' | 'edit';

type MenuFormState = {
  nombre: string;
  icono: string;
  ruta: string;
  seccion: string;
  orden: string;
  activo: boolean;
};

const primaryButtonClasses =
  'inline-flex justify-center rounded-md bg-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';
const secondaryButtonClasses =
  'inline-flex justify-center rounded-md border border-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';

const emptyForm: MenuFormState = {
  nombre: '',
  icono: '',
  ruta: '',
  seccion: '',
  orden: '',
  activo: true,
};

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'Error al conectar con el servidor';
    }
    return error.message;
  }
  return 'Error al conectar con el servidor';
};

const MenuScreen: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [formState, setFormState] = useState<MenuFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadMenus = async () => {
    try {
      setLoading(true);
      const data = await getMenusForManagement();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setMenus(data as MenuItem[]);
      setFetchError('');
    } catch (error) {
      console.error('Error al cargar menús:', error);
      const message = resolveErrorMessage(error);
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMenus();
  }, []);

  const filteredMenus = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return menus;
    }
    return menus.filter((menu) =>
      [menu.nombre, menu.ruta, menu.seccion ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [menus, searchTerm]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedMenu(null);
    setFormState(emptyForm);
    setFormErrors({});
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (menu: MenuItem) => {
    setModalMode('edit');
    setSelectedMenu(menu);
    setFormState({
      nombre: menu.nombre ?? '',
      icono: menu.icono ?? '',
      ruta: menu.ruta ?? '',
      seccion: menu.seccion ?? '',
      orden: menu.orden?.toString() ?? '',
      activo: menu.activo,
    });
    setFormErrors({});
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type } = target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox && target instanceof HTMLInputElement ? target.checked : undefined;
    setFormState((prev) => ({
      ...prev,
      [name]: isCheckbox ? Boolean(checked) : value,
    }));
    setFormErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const { [name]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formState.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio';
    }
    if (!formState.ruta.trim()) {
      errors.ruta = 'La ruta es obligatoria';
    }

    const duplicated = menus.some(
      (menu) =>
        menu.nombre.trim().toLowerCase() === formState.nombre.trim().toLowerCase() &&
        menu.id !== selectedMenu?.id
    );
    if (duplicated) {
      errors.nombre = 'El menú ya existe';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = (): MenuPayload => {
    const trimmedOrden = formState.orden.trim();
    const parsedOrden = trimmedOrden ? Number(trimmedOrden) : null;
    const normalizedOrden =
      parsedOrden === null || Number.isNaN(parsedOrden) ? null : Math.trunc(parsedOrden);

    return {
      nombre: formState.nombre.trim(),
      icono: formState.icono.trim() ? formState.icono.trim() : null,
      ruta: formState.ruta.trim(),
      seccion: formState.seccion.trim() ? formState.seccion.trim() : null,
      orden: normalizedOrden,
      activo: formState.activo,
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const payload = buildPayload();

    try {
      if (modalMode === 'create') {
        await createMenu(payload);
        alert('Menú creado correctamente');
      } else if (selectedMenu) {
        await updateMenu(selectedMenu.id, payload);
        alert('Menú actualizado correctamente');
      }
      await loadMenus();
      closeModal();
    } catch (error) {
      console.error('Error al guardar menú:', error);
      setFormError(resolveErrorMessage(error));
    }
  };

  const handleDelete = async (menu: MenuItem) => {
    const confirmDelete = window.confirm('¿Desea desactivar este menú?');
    if (!confirmDelete) {
      return;
    }

    try {
      await deleteMenu(menu.id);
      alert('Menú desactivado correctamente');
      await loadMenus();
    } catch (error) {
      console.error('Error al desactivar menú:', error);
      setFetchError(resolveErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Catálogo de Menús</h1>
          <p className="text-sm text-gray-500">
            Administra los menús visibles en las diferentes secciones del sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Menú
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700" htmlFor="menu-search">
            Buscar menú
          </label>
          <input
            id="menu-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Filtrar por nombre, ruta o sección"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
          />
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : fetchError ? (
          <p className="text-sm text-red-600">{fetchError}</p>
        ) : filteredMenus.length === 0 ? (
          <p className="text-sm text-gray-500">No hay menús registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1C2E4A]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Icono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Ruta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Sección
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Orden
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredMenus.map((menu) => (
                  <tr key={menu.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{menu.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{menu.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{menu.icono ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{menu.ruta}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{menu.seccion ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {menu.orden !== null && menu.orden !== undefined ? menu.orden : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {menu.activo ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                        <button
                          type="button"
                          className="w-full sm:w-auto bg-yellow-400 border border-yellow-600 px-3 py-1 text-white rounded-lg font-medium shadow-sm transition-colors hover:bg-yellow-500"
                          onClick={() => openEditModal(menu)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="w-full sm:w-auto bg-red-400 border border-red-500 px-3 py-1 text-white rounded-lg font-medium shadow-sm transition-colors hover:bg-red-500"
                          onClick={() => handleDelete(menu)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-[#1C2E4A] mb-4">
              {modalMode === 'create' ? 'Nuevo Menú' : 'Editar Menú'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="nombre">
                  Nombre
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={formState.nombre}
                  onChange={handleInputChange}
                  className={`mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C2E4A] ${
                    formErrors.nombre ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.nombre ? (
                  <p className="mt-1 text-sm text-red-600">{formErrors.nombre}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="icono">
                  Icono
                </label>
                <input
                  id="icono"
                  name="icono"
                  type="text"
                  value={formState.icono}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="ruta">
                  Ruta
                </label>
                <input
                  id="ruta"
                  name="ruta"
                  type="text"
                  value={formState.ruta}
                  onChange={handleInputChange}
                  className={`mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C2E4A] ${
                    formErrors.ruta ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.ruta ? (
                  <p className="mt-1 text-sm text-red-600">{formErrors.ruta}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="seccion">
                  Sección
                </label>
                <input
                  id="seccion"
                  name="seccion"
                  type="text"
                  value={formState.seccion}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="orden">
                  Orden
                </label>
                <input
                  id="orden"
                  name="orden"
                  type="number"
                  value={formState.orden}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                />
              </div>

              <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="activo"
                  checked={formState.activo}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                />
                <span>Activo</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              {formError && <p className="text-sm text-red-600 mr-auto">{formError}</p>}
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MenuScreen;
