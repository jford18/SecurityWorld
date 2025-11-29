import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createTipoEquipoAfectado,
  deleteTipoEquipoAfectado,
  getAllTipoEquipoAfectado,
  updateTipoEquipoAfectado,
  TipoEquipoAfectado,
} from '@/services/tipoEquipoAfectadoService';

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const maybeResponse = (error as { response?: { data?: { message?: string } } }).response;
    if (maybeResponse?.data?.message) {
      return maybeResponse.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return fallback;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const pageSizeOptions = [5, 10, 20, 50];

const TipoEquipoAfectadoScreen: React.FC = () => {
  const [items, setItems] = useState<TipoEquipoAfectado[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [formError, setFormError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((total || 0) / (pageSize || 1))),
    [pageSize, total]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllTipoEquipoAfectado({
        search: search.trim() || undefined,
        page,
        limit: pageSize,
      });

      setItems(response.items ?? []);
      setTotal(response.total ?? 0);
      setPage(response.page ?? 1);
      setPageSize(response.pageSize ?? pageSize);
      setError(null);
    } catch (err) {
      const message = resolveErrorMessage(err, 'No se pudo cargar el catálogo');
      console.error('[ERROR] No se pudo cargar el catálogo de tipo equipo afectado:', err);
      setError(message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setSelectedId(null);
    setNombre('');
    setDescripcion('');
    setActivo(true);
    setFormError('');
    setSubmitting(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item: TipoEquipoAfectado) => {
    setSelectedId(item.id);
    setNombre(item.nombre ?? '');
    setDescripcion(item.descripcion ?? '');
    setActivo(Boolean(item.activo));
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const trimmedName = nombre.trim();
    if (!trimmedName) {
      setFormError('El nombre es obligatorio');
      return;
    }

    const payload = {
      nombre: trimmedName,
      descripcion: descripcion.trim() || null,
      activo,
    };

    try {
      setSubmitting(true);
      if (selectedId) {
        await updateTipoEquipoAfectado(selectedId, payload);
        window.alert('Tipo de equipo afectado actualizado correctamente');
      } else {
        await createTipoEquipoAfectado(payload);
        window.alert('Tipo de equipo afectado creado correctamente');
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      const message = resolveErrorMessage(err, 'No se pudo guardar el registro');
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: TipoEquipoAfectado) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar el tipo de equipo afectado "${item.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      await deleteTipoEquipoAfectado(item.id);
      window.alert('Tipo de equipo afectado eliminado correctamente');
      await fetchData();
    } catch (err) {
      const message = resolveErrorMessage(err, 'No se pudo eliminar el registro');
      window.alert(message);
    }
  };

  const handleChangePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const handleChangePage = (nextPage: number) => {
    const clampedPage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(clampedPage);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Tipo de Equipo Afectado</h1>
          <p className="text-sm text-gray-500">Gestiona el catálogo de tipos de equipo afectados en los incidentes.</p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo
        </button>
      </header>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex flex-1 items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">Buscar:</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
              placeholder="Nombre del tipo de equipo"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => handleChangePageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando registros...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No hay registros para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1C2E4A]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Activo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Fecha de creación</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.descripcion || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.activo ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.fecha_creacion)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 space-x-2">
                      <button
                        type="button"
                        className={secondaryButtonClasses}
                        onClick={() => openEditModal(item)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClasses}
                        onClick={() => handleDelete(item)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Página {page} de {totalPages} • {total} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={secondaryButtonClasses}
              disabled={page <= 1}
              onClick={() => handleChangePage(page - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className={secondaryButtonClasses}
              disabled={page >= totalPages}
              onClick={() => handleChangePage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#1C2E4A]">
                  {selectedId ? 'Editar Tipo de Equipo Afectado' : 'Nuevo Tipo de Equipo Afectado'}
                </h2>
                <p className="text-sm text-gray-500">Completa la información requerida.</p>
              </div>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Nombre *</span>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Nombre del tipo de equipo"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Descripción</span>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Descripción opcional"
                  rows={3}
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                Activo
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className={primaryButtonClasses} disabled={submitting}>
                  {selectedId ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TipoEquipoAfectadoScreen;
