import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  create as createCargo,
  getAll as getCargos,
  remove as removeCargo,
  update as updateCargo,
} from '../../services/cargo.service';

interface Cargo {
  id: number;
  descripcion: string;
  activo: boolean;
  fecha_creacion: string;
}

interface FormState {
  descripcion: string;
  activo: boolean;
}

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;
const successButtonClasses = `${baseButtonClasses} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500`;

const initialFormState: FormState = {
  descripcion: '',
  activo: true,
};

const CargoScreen: React.FC = () => {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCargos = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const data = await getCargos(search);
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setCargos(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar cargos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los cargos');
      setCargos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCargos();
  }, [fetchCargos]);

  const filteredCargos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return cargos;
    }
    return cargos.filter((cargo) =>
      [cargo.descripcion, cargo.id].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      )
    );
  }, [cargos, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCargos.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCargos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCargos, currentPage]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedCargo(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cargo: Cargo) => {
    setIsEditing(true);
    setSelectedCargo(cargo);
    setFormState({ descripcion: cargo.descripcion ?? '', activo: cargo.activo });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const descripcion = formState.descripcion.trim();

    if (!descripcion) {
      setFormError('La descripción del cargo es obligatoria');
      return;
    }

    const duplicated = cargos.some(
      (cargo) =>
        cargo.descripcion.toLowerCase() === descripcion.toLowerCase() &&
        cargo.id !== (selectedCargo?.id ?? null)
    );

    if (duplicated) {
      setFormError('Ya existe un cargo con esa descripción');
      return;
    }

    try {
      if (isEditing && selectedCargo) {
        await updateCargo(selectedCargo.id, {
          descripcion,
          activo: formState.activo,
        });
        alert('Cargo actualizado correctamente');
      } else {
        await createCargo({
          descripcion,
          activo: formState.activo,
        });
        alert('Cargo creado correctamente');
      }
      await fetchCargos(searchTerm);
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el cargo'
      );
    }
  };

  const handleStatusChange = async (cargo: Cargo) => {
    if (cargo.activo) {
      const confirmed = window.confirm(
        `¿Deseas inactivar el cargo "${cargo.descripcion}"?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await removeCargo(cargo.id);
        alert('Cargo inactivado correctamente');
        await fetchCargos(searchTerm);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : 'Error al inactivar el cargo');
      }
      return;
    }

    try {
      await updateCargo(cargo.id, { activo: true, descripcion: cargo.descripcion });
      alert('Cargo activado correctamente');
      await fetchCargos(searchTerm);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al activar el cargo');
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    fetchCargos(value);
    setCurrentPage(1);
  };

  const renderStatus = (isActive: boolean) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Cargos</h1>
          <p className="text-sm text-gray-500">
            Administra los cargos de personal registrados en el sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Cargo
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Buscar</span>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Buscar por descripción o ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando cargos...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredCargos.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron cargos.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#1C2E4A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Activo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Fecha creación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentItems.map((cargo) => (
                    <tr key={cargo.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{cargo.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{cargo.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderStatus(cargo.activo)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {cargo.fecha_creacion
                          ? new Date(cargo.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(cargo)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={cargo.activo ? dangerButtonClasses : successButtonClasses}
                            onClick={() => handleStatusChange(cargo)}
                          >
                            {cargo.activo ? 'Eliminar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-[#1C2E4A]">
              {isEditing ? 'Editar Cargo' : 'Nuevo Cargo'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Descripción
                <input
                  type="text"
                  value={formState.descripcion}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      descripcion: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa la descripción del cargo"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.activo}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      activo: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                />
                Activo
              </label>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
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

export default CargoScreen;
