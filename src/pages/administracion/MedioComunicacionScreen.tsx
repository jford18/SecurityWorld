import React, { useEffect, useMemo, useState } from 'react';
import {
  createMedioComunicacion,
  deleteMedioComunicacion,
  getAllMediosComunicacion,
  updateMedioComunicacion,
  type MedioComunicacionDTO,
} from '../../services/medioComunicacionService';

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;

interface MedioComunicacionFormState {
  descripcion: string;
}

const initialFormState: MedioComunicacionFormState = {
  descripcion: '',
};

const MedioComunicacionScreen: React.FC = () => {
  const [records, setRecords] = useState<MedioComunicacionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedioComunicacionDTO | null>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await getAllMediosComunicacion();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setRecords(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar los medios de comunicación:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los medios de comunicación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

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

  const openEditModal = (record: MedioComunicacionDTO) => {
    setIsEditing(true);
    setSelectedRecord(record);
    setFormState({ descripcion: record.descripcion ?? '' });
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
      setFormError('Ya existe un medio de comunicación con esa descripción');
      return;
    }

    try {
      if (isEditing && selectedRecord) {
        await updateMedioComunicacion(selectedRecord.id, { descripcion });
        alert('Medio de comunicación actualizado correctamente');
      } else {
        await createMedioComunicacion({ descripcion });
        alert('Medio de comunicación creado correctamente');
      }
      await fetchRecords();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el medio de comunicación'
      );
    }
  };

  const handleDelete = async (record: MedioComunicacionDTO) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar el medio de comunicación "${record.descripcion}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteMedioComunicacion(record.id);
      alert('Medio de comunicación eliminado correctamente');
      await fetchRecords();
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : 'Error al eliminar el medio de comunicación'
      );
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">
            Mantenimiento de Medios de Comunicación
          </h1>
          <p className="text-sm text-gray-500">
            Administra los medios disponibles para registrar las vías de contacto.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Medio de Comunicación
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
          <p className="text-sm text-gray-500">Cargando medios de comunicación...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredRecords.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron medios de comunicación.</p>
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
                      Fecha creación
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
                            className={dangerButtonClasses}
                            onClick={() => handleDelete(record)}
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
              {isEditing ? 'Editar Medio de Comunicación' : 'Nuevo Medio de Comunicación'}
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
                  placeholder="Ej: Llamada telefónica, WhatsApp, etc."
                />
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

export default MedioComunicacionScreen;
