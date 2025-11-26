import React, { useEffect, useMemo, useState } from 'react';
import {
  createTipoServicio,
  getTiposServicio,
  toggleTipoServicioActivo,
  updateTipoServicio,
  type TipoServicioDTO,
} from '../../services/tipoServicioService';

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const neutralButtonClasses = `${baseButtonClasses} border border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-gray-300`;

interface FormState {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

const initialFormState: FormState = {
  nombre: '',
  descripcion: '',
  activo: true,
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const TiposServicioPage: React.FC = () => {
  const [records, setRecords] = useState<TipoServicioDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TipoServicioDTO | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await getTiposServicio();
      setRecords(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      console.error('Error al cargar los tipos de servicio:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar los tipos de servicio'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return records;

    return records.filter((record) =>
      [record.NOMBRE, record.DESCRIPCION, record.ID]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
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

  const openEditModal = (record: TipoServicioDTO) => {
    setIsEditing(true);
    setSelectedRecord(record);
    setFormState({
      nombre: record.NOMBRE ?? '',
      descripcion: record.DESCRIPCION ?? '',
      activo: Boolean(record.ACTIVO),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const nombre = formState.nombre.trim();
    const descripcion = formState.descripcion.trim();
    const activo = formState.activo;

    if (!nombre) {
      setFormError('El nombre es obligatorio');
      return;
    }

    try {
      if (isEditing && selectedRecord) {
        await updateTipoServicio(selectedRecord.ID, {
          nombre,
          descripcion: descripcion || null,
          activo,
        });
        alert('Tipo de servicio actualizado correctamente');
      } else {
        await createTipoServicio({
          nombre,
          descripcion: descripcion || null,
          activo,
        });
        alert('Tipo de servicio creado correctamente');
      }
      await fetchRecords();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el tipo de servicio'
      );
    }
  };

  const handleToggleActivo = async (record: TipoServicioDTO) => {
    try {
      await toggleTipoServicioActivo(record.ID);
      await fetchRecords();
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : 'Error al actualizar el estado del tipo de servicio'
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
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Tipos de Servicio</h1>
          <p className="text-sm text-gray-500">
            Administra los tipos de servicio disponibles en la plataforma.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Tipo de Servicio
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
              placeholder="Buscar por nombre, descripción o ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
          <div className="text-sm text-gray-500">{filteredRecords.length} registro(s)</div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-100">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha creación</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    Cargando tipos de servicio...
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    No hay tipos de servicio registrados.
                  </td>
                </tr>
              ) : (
                currentItems.map((record) => (
                  <tr key={record.ID}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.NOMBRE}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.DESCRIPCION || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          record.ACTIVO
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                        }`}
                      >
                        {record.ACTIVO ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(record.FECHA_CREACION)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => openEditModal(record)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={neutralButtonClasses}
                          onClick={() => handleToggleActivo(record)}
                        >
                          {record.ACTIVO ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={neutralButtonClasses}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className={neutralButtonClasses}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#1C2E4A]">
                  {isEditing ? 'Editar tipo de servicio' : 'Nuevo tipo de servicio'}
                </h2>
                <p className="text-sm text-gray-500">
                  Completa los campos para {isEditing ? 'actualizar' : 'crear'} un tipo de servicio.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nombre *</label>
                <input
                  type="text"
                  value={formState.nombre}
                  onChange={(e) => setFormState((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ej. Seguridad perimetral"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  value={formState.descripcion}
                  onChange={(e) => setFormState((prev) => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  rows={3}
                  placeholder="Agrega una descripción opcional"
                />
              </div>

              {isEditing && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.activo}
                    onChange={(e) => setFormState((prev) => ({ ...prev, activo: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                  />
                  Activo
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-gray-50">
              <button type="button" className={neutralButtonClasses} onClick={closeModal}>
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

export default TiposServicioPage;
