import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutocompleteComboBox from '@/components/ui/AutocompleteComboBox';
import usuarioRolesService from '@/services/usuarioRolesService';
import { SaveRolMenuPayload, getMenusByRol, saveRolMenus } from '@/services/rolMenuService';

const toast = {
  success: (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.log(message);
  },
  error: (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    }
    console.error(message);
  },
};

type RolOption = {
  id: number;
  nombre: string;
};

type RolMenuStateItem = {
  menu_id: number;
  nombre: string;
  seccion: string | null;
  menu_activo: boolean;
  activo: boolean;
};

const RolMenuScreen: React.FC = () => {
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [selectedRolId, setSelectedRolId] = useState<number | null>(null);
  const [menus, setMenus] = useState<RolMenuStateItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(false);
  const [loadingMenus, setLoadingMenus] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const roleItems = useMemo(
    () => [
      { id: 'empty', label: roles.length === 0 ? 'No hay roles disponibles' : 'Seleccione un rol', value: '' },
      ...roles.map((rol) => ({
        id: String(rol.id),
        label: rol.nombre,
        value: String(rol.id),
      })),
    ],
    [roles]
  );

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      setErrorMessage('');

      const response = await usuarioRolesService.getRolesDisponibles();
      if (!Array.isArray(response)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const normalizedRoles = (response as RolOption[])
        .map((rol) => ({
          id: rol.id,
          nombre: rol.nombre,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setRoles(normalizedRoles);

      setSelectedRolId((prev) => {
        if (prev && normalizedRoles.some((rol) => rol.id === prev)) {
          return prev;
        }
        return normalizedRoles.length > 0 ? normalizedRoles[0].id : null;
      });
    } catch (error) {
      console.error('Error al cargar roles disponibles', error);
      const message = (error as Error).message || 'No se pudo cargar la lista de roles';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadMenus = useCallback(async (rolId: number) => {
    try {
      setLoadingMenus(true);
      setErrorMessage('');

      const response = await getMenusByRol(rolId);
      if (!Array.isArray(response)) {
        throw new Error('Respuesta inválida del servidor');
      }

      const normalizedMenus = response.map<RolMenuStateItem>((menu) => ({
        menu_id: menu.menu_id,
        nombre: menu.nombre,
        seccion: menu.seccion,
        menu_activo: menu.menu_activo,
        activo: Boolean(menu.asignado),
      }));

      setMenus(normalizedMenus);
    } catch (error) {
      console.error('Error al cargar menús del rol seleccionado', error);
      const message = (error as Error).message || 'No se pudo cargar los menús del rol seleccionado';
      setMenus([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingMenus(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (selectedRolId) {
      loadMenus(selectedRolId);
    } else {
      setMenus([]);
    }
  }, [loadMenus, selectedRolId]);

  const activeCount = useMemo(() => menus.filter((menu) => menu.activo).length, [menus]);

  const handleToggleMenu = (menuId: number, checked: boolean) => {
    setMenus((prev) =>
      prev.map((menu) =>
        menu.menu_id === menuId
          ? {
              ...menu,
              activo: checked,
            }
          : menu
      )
    );
  };

  const handleSave = async () => {
    if (!selectedRolId) {
      toast.error('Selecciona un rol para guardar los cambios');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      const payload: SaveRolMenuPayload[] = menus.map((menu) => ({
        menu_id: menu.menu_id,
        activo: menu.activo,
      }));

      const response = await saveRolMenus(selectedRolId, payload);
      toast.success(response.message || 'Cambios guardados correctamente');
      await loadMenus(selectedRolId);
    } catch (error) {
      console.error('Error al guardar la configuración de menús del rol', error);
      const message = (error as Error).message || 'No se pudieron guardar los cambios';
      toast.error(message);
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roles ↔ Menús</h1>
          <p className="text-sm text-gray-500">
            Selecciona un rol para definir qué menús del sistema estarán disponibles para sus usuarios.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1C2E4A] shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1C2E4A] focus:ring-offset-2"
          onClick={() => loadRoles()}
          disabled={loadingRoles || saving}
        >
          Actualizar catálogos
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <AutocompleteComboBox
          label="Rol del sistema"
          value={selectedRolId != null ? String(selectedRolId) : ''}
          onChange={(value: string) => {
            if (!value) {
              setSelectedRolId(null);
              return;
            }
            const parsed = Number(value);
            setSelectedRolId(Number.isNaN(parsed) ? null : parsed);
          }}
          items={roleItems}
          displayField="label"
          valueField="value"
          placeholder="Buscar rol..."
          disabled={loadingRoles || roles.length === 0}
          emptyMessage={roles.length === 0 ? 'No hay roles disponibles' : 'No se encontraron roles'}
        />
        {loadingRoles && <p className="mt-2 text-sm text-gray-500">Cargando roles...</p>}
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C2E4A]">Listado de menús</h2>
            <p className="text-sm text-gray-500">
              Activos: {activeCount} / {menus.length}
            </p>
          </div>
          {loadingMenus && <span className="text-sm text-gray-500">Cargando menús...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  Nombre del Menú
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  Sección
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  Activo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {menus.length === 0 && !loadingMenus ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                    {selectedRolId ? 'No hay menús configurados para este rol' : 'Selecciona un rol para visualizar sus menús'}
                  </td>
                </tr>
              ) : (
                menus.map((menu) => (
                  <tr key={menu.menu_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{menu.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{menu.seccion ?? 'Sin sección'}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 accent-green-500"
                        checked={menu.activo}
                        onChange={(event) => handleToggleMenu(menu.menu_id, event.target.checked)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedRolId || saving || loadingMenus || menus.length === 0}
            className={`bg-yellow-400 hover:bg-yellow-500 text-white font-medium rounded-lg px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
              saving ? 'animate-pulse' : ''
            }`}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolMenuScreen;
