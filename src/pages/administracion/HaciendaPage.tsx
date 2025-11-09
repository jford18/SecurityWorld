import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createHacienda,
  deleteHacienda,
  getHacienda,
  getHaciendas,
  updateHacienda,
  type HaciendaPayload,
  type HaciendaRecord,
  type HaciendaListResponse,
} from "@/services/haciendaService";
import { useSession } from '../../components/context/SessionContext';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-[#1C2E4A] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#243b55] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A] focus:ring-offset-2';
const secondaryButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-[#1C2E4A] px-4 py-2 text-sm font-semibold text-[#1C2E4A] transition-colors hover:bg-[#1C2E4A]/10 focus:outline-none focus:ring-2 focus:ring-[#1C2E4A] focus:ring-offset-2';
const dangerButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2';

const initialFormState: HaciendaPayload = {
  nombre: '',
  direccion: '',
  activo: true,
};

type ModalMode = 'create' | 'edit';
type ActivoFilter = 'all' | 'true' | 'false';

type FetchState = {
  data: HaciendaRecord[];
  meta: HaciendaListResponse['meta'];
};

const defaultMeta: HaciendaListResponse['meta'] = {
  page: 1,
  limit: 10,
  total: 0,
};

const formatDateTime = (value: string) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const maybeResponse = (error as { response?: { data?: { message?: unknown } } }).response;
    const responseMessage = maybeResponse?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const HaciendaPage: React.FC = () => {
  const { session } = useSession();
  const hasAuthToken = Boolean(session.token);
  const [fetchState, setFetchState] = useState<FetchState>({ data: [], meta: defaultMeta });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [formState, setFormState] = useState<HaciendaPayload>(initialFormState);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<HaciendaRecord | null>(null);

  const totalPages = useMemo(() => {
    if (fetchState.meta.limit <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(fetchState.meta.total / fetchState.meta.limit));
  }, [fetchState.meta.limit, fetchState.meta.total]);

  const fetchHaciendas = useCallback(async () => {
    if (!hasAuthToken) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data: haciendasResponse } = await getHaciendas({
        page,
        limit,
        q: searchTerm || undefined,
        activo: activoFilter === 'all' ? undefined : activoFilter,
      });

      setFetchState({
        data: Array.isArray(haciendasResponse?.data) ? haciendasResponse.data : [],
        meta: haciendasResponse?.meta ?? { ...defaultMeta, page, limit },
      });
    } catch (error) {
      const message = resolveErrorMessage(error, 'No se pudieron cargar las haciendas');
      setErrorMessage(message);
      setFetchState({ data: [], meta: { ...defaultMeta, page: 1, limit } });
    } finally {
      setLoading(false);
    }
  }, [activoFilter, hasAuthToken, limit, page, searchTerm]);

  useEffect(() => {
    if (!hasAuthToken) {
      return;
    }

    fetchHaciendas();
  }, [fetchHaciendas, hasAuthToken]);

  const openCreateModal = () => {
    setModalMode('create');
    setFormState(initialFormState);
    setFormError('');
    setCurrentRecord(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (record: HaciendaRecord) => {
    setModalMode('edit');
    setSubmitting(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const { data: haciendaResponse } = await getHacienda(record.id);
      const data = haciendaResponse.data ?? record;
      setCurrentRecord(data);
      setFormState({
        nombre: data.nombre ?? '',
        direccion: data.direccion ?? '',
        activo: Boolean(data.activo),
      });
      setIsModalOpen(true);
    } catch (error) {
      const message = resolveErrorMessage(error, 'No se pudo obtener la información de la hacienda');
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentRecord(null);
    setFormError('');
    setSubmitting(false);
  };

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const { name, checked } = target;
      setFormState((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    const { name, value } = target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const nombre = formState.nombre?.trim() ?? '';
    const direccion = formState.direccion?.toString().trim() ?? '';
    const activo = Boolean(formState.activo);

    if (!nombre) {
      setFormError('El nombre es obligatorio');
      return;
    }

    if (nombre.length > 150) {
      setFormError('El nombre no puede superar los 150 caracteres');
      return;
    }

    const payload: HaciendaPayload = {
      nombre,
      direccion,
      activo,
    };

    try {
      setSubmitting(true);
      if (modalMode === 'edit' && currentRecord) {
        await updateHacienda(currentRecord.id, payload);
        setSuccessMessage('Hacienda actualizada correctamente');
      } else {
        await createHacienda(payload);
        setSuccessMessage('Hacienda creada correctamente');
      }

      closeModal();
      fetchHaciendas();
    } catch (error) {
      const message = resolveErrorMessage(error, 'No se pudo guardar la hacienda');
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: HaciendaRecord) => {
    const confirmed = window.confirm(
      `¿Deseas desactivar la hacienda "${record.nombre}"? Podrás reactivarla editándola posteriormente.`
    );

    if (!confirmed) {
      return;
    }

    setSuccessMessage('');

    try {
      await deleteHacienda(record.id);
      setSuccessMessage('Hacienda desactivada correctamente');
      fetchHaciendas();
    } catch (error) {
      const message = resolveErrorMessage(error, 'No se pudo desactivar la hacienda');
      setErrorMessage(message);
    }
  };

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setActivoFilter('all');
    setPage(1);
  };

  const handleChangeActivoFilter = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ActivoFilter;
    setActivoFilter(value);
    setPage(1);
  };

  const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    setLimit(Number.isFinite(value) && value > 0 ? value : 10);
    setPage(1);
  };

  const goToPreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const renderStatus = (activo: boolean) => {
    return activo ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        Activo
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Inactivo
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-[#1C2E4A]">Hacienda</h1>
        <p className="text-sm text-gray-600">
          Administra las haciendas registradas. Puedes crear nuevas, editar sus datos y desactivarlas cuando sea necesario.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col sm:w-64">
            <label htmlFor="hacienda-search" className="text-sm font-medium text-gray-700">
              Buscar por nombre
            </label>
            <input
              id="hacienda-search"
              name="q"
              type="text"
              autoComplete="off"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]"
              placeholder="Ej. Hacienda Central"
            />
          </div>

          <div className="flex w-full flex-col sm:w-52">
            <label htmlFor="hacienda-activo" className="text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              id="hacienda-activo"
              value={activoFilter}
              onChange={handleChangeActivoFilter}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]"
            >
              <option value="all">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>

          <div className="flex w-full flex-col sm:w-44">
            <label htmlFor="hacienda-limit" className="text-sm font-medium text-gray-700">
              Registros por página
            </label>
            <select
              id="hacienda-limit"
              value={limit}
              onChange={handleLimitChange}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]"
            >
              {[10, 20, 50].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button type="submit" className={primaryButtonClasses}>
              Buscar
            </button>
            <button type="button" className={secondaryButtonClasses} onClick={handleResetFilters}>
              Limpiar
            </button>
          </div>

          <div className="ml-auto flex w-full justify-end sm:w-auto">
            <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
              Nuevo
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Nombre
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Dirección
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Activo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Fecha creación
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Cargando haciendas...
                </td>
              </tr>
            ) : fetchState.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  No se encontraron haciendas con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              fetchState.data.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {record.direccion && record.direccion.trim().length > 0 ? record.direccion : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{renderStatus(Boolean(record.activo))}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(record.fecha_creacion)}</td>
                  <td className="px-4 py-3 text-sm">
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
              ))
            )}
          </tbody>
        </table>

        <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Mostrando{' '}
            <span className="font-semibold text-gray-800">
              {fetchState.data.length === 0
                ? 0
                : (fetchState.meta.page - 1) * fetchState.meta.limit + 1}
            </span>{' '}
            -{' '}
            <span className="font-semibold text-gray-800">
              {fetchState.data.length === 0
                ? 0
                : (fetchState.meta.page - 1) * fetchState.meta.limit + fetchState.data.length}
            </span>{' '}
            de <span className="font-semibold text-gray-800">{fetchState.meta.total}</span> hacienda(s)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={page <= 1}
              className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                page <= 1
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-[#1C2E4A]'
              }`}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={page >= totalPages}
              className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                page >= totalPages
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 focus:ring-[#1C2E4A]'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {modalMode === 'edit' ? 'Editar hacienda' : 'Nueva hacienda'}
              </h2>
              <button
                type="button"
                className="text-2xl leading-none text-gray-500 transition-colors hover:text-gray-700"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="hacienda-nombre" className="text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  id="hacienda-nombre"
                  name="nombre"
                  type="text"
                  value={formState.nombre ?? ''}
                  onChange={handleFormChange}
                  maxLength={150}
                  autoFocus
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]"
                  required
                />
              </div>

              <div>
                <label htmlFor="hacienda-direccion" className="text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <textarea
                  id="hacienda-direccion"
                  name="direccion"
                  value={formState.direccion ?? ''}
                  onChange={handleFormChange}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-2 focus:ring-[#1C2E4A]"
                  placeholder="Ingrese la dirección física"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hacienda-activo-switch"
                  name="activo"
                  type="checkbox"
                  checked={Boolean(formState.activo)}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                />
                <label htmlFor="hacienda-activo-switch" className="text-sm font-medium text-gray-700">
                  Activa
                </label>
              </div>

              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={primaryButtonClasses}
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : modalMode === 'edit' ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HaciendaPage;
