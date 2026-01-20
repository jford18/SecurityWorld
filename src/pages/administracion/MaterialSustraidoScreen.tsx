import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  create as createMaterialSustraido,
  getAll as getMaterialesSustraidos,
  remove as removeMaterialSustraido,
  update as updateMaterialSustraido,
} from '../../services/materialSustraido.service';

interface MaterialSustraido {
  id: number;
  descripcion: string;
  estado: boolean;
}

interface FormState {
  descripcion: string;
  estado: boolean;
}

const ITEMS_PER_PAGE = 10;
const MAX_DESCRIPCION_LENGTH = 200;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;
const successButtonClasses = `${baseButtonClasses} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500`;

const initialFormState: FormState = {
  descripcion: '',
  estado: true,
};

const MaterialSustraidoScreen: React.FC = () => {
  const [materiales, setMateriales] = useState<MaterialSustraido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialSustraido | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  }, [total]);

  const fetchMateriales = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getMaterialesSustraidos({
        search: searchTerm.trim() || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });

      if (!response || !Array.isArray(response.data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      setMateriales(response.data);
      setTotal(response.total ?? 0);
      setError('');
    } catch (err) {
      console.error('Error al cargar materiales sustraídos:', err);
      setError(
        err instanceof Error ? err.message : 'Error al cargar los materiales sustraídos'
      );
      setMateriales([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchMateriales();
  }, [fetchMateriales]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedMaterial(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (material: MaterialSustraido) => {
    setIsEditing(true);
    setSelectedMaterial(material);
    setFormState({
      descripcion: material.descripcion ?? '',
      estado: material.estado,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const descripcion = formState.descripcion.trim();

    if (!descripcion) {
      setFormError('La descripción del material sustraído es obligatoria');
      return;
    }

    if (descripcion.length > MAX_DESCRIPCION_LENGTH) {
      setFormError('La descripción no debe superar los 200 caracteres');
      return;
    }

    try {
      if (isEditing && selectedMaterial) {
        await updateMaterialSustraido(selectedMaterial.id, {
          descripcion,
          estado: formState.estado,
        });
        alert('Material sustraído actualizado correctamente');
      } else {
        await createMaterialSustraido({
          descripcion,
          estado: formState.estado,
        });
        alert('Material sustraído creado correctamente');
      }
      await fetchMateriales();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el material sustraído'
      );
    }
  };

  const handleStatusChange = async (material: MaterialSustraido) => {
    if (material.estado) {
      const confirmed = window.confirm(
        `¿Deseas inactivar el material sustraído "${material.descripcion}"?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await removeMaterialSustraido(material.id);
        alert('Material sustraído inactivado correctamente');
        await fetchMateriales();
      } catch (err) {
        console.error(err);
        alert(
          err instanceof Error
            ? err.message
            : 'Error al inactivar el material sustraído'
        );
      }
      return;
    }

    try {
      await updateMaterialSustraido(material.id, {
        descripcion: material.descripcion,
        estado: true,
      });
      alert('Material sustraído activado correctamente');
      await fetchMateriales();
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error ? err.message : 'Error al activar el material sustraído'
      );
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
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
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Material Sustraído</h1>
          <p className="text-sm text-gray-500">
            Administra los materiales sustraídos registrados en el sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Material
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
          <p className="text-sm text-gray-500">Cargando materiales sustraídos...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : materiales.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron materiales sustraídos.</p>
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
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {materiales.map((material) => (
                    <tr key={material.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{material.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {material.descripcion}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {renderStatus(material.estado)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(material)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={material.estado ? dangerButtonClasses : successButtonClasses}
                            onClick={() => handleStatusChange(material)}
                          >
                            {material.estado ? 'Eliminar' : 'Activar'}
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
              {isEditing ? 'Editar Material' : 'Nuevo Material'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Descripción
                <input
                  type="text"
                  value={formState.descripcion}
                  maxLength={MAX_DESCRIPCION_LENGTH}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      descripcion: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa la descripción del material"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.estado}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      estado: event.target.checked,
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

export default MaterialSustraidoScreen;
