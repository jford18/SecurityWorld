import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  create,
  getAll,
  remove,
  update,
  type ConclusionEventoDTO,
} from '../../services/conclusionEventoService';

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

const ConclusionEventoScreen: React.FC = () => {
  const [records, setRecords] = useState<ConclusionEventoDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ConclusionEventoDTO | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRecords = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const data = await getAll(search);
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setRecords(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar conclusiones del evento:', err);
      setError(
        err instanceof Error ? err.message : 'Error al cargar las conclusiones del evento'
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return records;
    }

    return records.filter((record) =>
      [record.descripcion, record.id].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      )
    );
  }, [records, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedRecord(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (record: ConclusionEventoDTO) => {
    setIsEditing(true);
    setSelectedRecord(record);
    setFormState({ descripcion: record.descripcion ?? '', activo: record.activo });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const descripcion = formState.descripcion.trim();

    if (!descripcion) {
      setFormError('La descripción es obligatoria');
      return;
    }

    const duplicated = records.some(
      (record) =>
        record.descripcion.toLowerCase() === descripcion.toLowerCase() &&
        record.id !== (selectedRecord?.id ?? null)
    );

    if (duplicated) {
      setFormError('Ya existe una conclusión con esa descripción');
      return;
    }

    try {
      if (isEditing && selectedRecord) {
        await update(selectedRecord.id, { descripcion, activo: formState.activo });
        alert('Conclusión del evento actualizada correctamente');
      } else {
        await create({ descripcion, activo: formState.activo });
        alert('Conclusión del evento creada correctamente');
      }
      await fetchRecords(searchTerm);
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar la conclusión del evento'
      );
    }
  };

  const handleStatusChange = async (record: ConclusionEventoDTO) => {
    if (record.activo) {
      const confirmed = window.confirm(
        `¿Deseas inactivar la conclusión "${record.descripcion}"?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await remove(record.id);
        alert('Conclusión del evento inactivada correctamente');
        await fetchRecords(searchTerm);
      } catch (err) {
        console.error(err);
        alert(
          err instanceof Error ? err.message : 'Error al inactivar la conclusión del evento'
        );
      }
      return;
    }

    try {
      await update(record.id, { descripcion: record.descripcion, activo: true });
      alert('Conclusión del evento activada correctamente');
      await fetchRecords(searchTerm);
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error ? err.message : 'Error al activar la conclusión del evento'
      );
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    fetchRecords(value);
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
          <h1 className="text-2xl font-bold text-[#1C2E4A]">
            Mantenimiento de Conclusiones del Evento
          </h1>
          <p className="text-sm text-gray-500">
            Gestiona las conclusiones posibles de un evento.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nueva Conclusión
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
          <p className="text-sm text-gray-500">Cargando conclusiones...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredRecords.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron conclusiones del evento.</p>
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
                      Fecha Creación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {currentItems.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderStatus(record.activo)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {record.fecha_creacion
                          ? new Date(record.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(record)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={record.activo ? dangerButtonClasses : successButtonClasses}
                            onClick={() => handleStatusChange(record)}
                          >
                            {record.activo ? 'Eliminar' : 'Activar'}
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
              {isEditing ? 'Editar Conclusión del Evento' : 'Nueva Conclusión del Evento'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Descripción
                <input
                  type="text"
                  value={formState.descripcion}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, descripcion: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ej: Evento resuelto sin novedad"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.activo}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, activo: event.target.checked }))
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

export default ConclusionEventoScreen;
