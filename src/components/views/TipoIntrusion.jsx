// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  create,
  getAll,
  remove,
  update,
} from '../../services/tipoIntrusion.service';

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;
const successButtonClasses = `${baseButtonClasses} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500`;

const initialFormState = {
  descripcion: '',
  activo: true,
  necesita_protocolo: false,
};

const TipoIntrusion = () => {
  const [tiposIntrusion, setTiposIntrusion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTipoIntrusion, setSelectedTipoIntrusion] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTiposIntrusion = async () => {
    try {
      setLoading(true);
      const data = await getAll();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setTiposIntrusion(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar tipos de intrusión:', err);
      setError(err?.message || 'Error al cargar los tipos de intrusión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiposIntrusion();
  }, []);

  const filteredTiposIntrusion = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return tiposIntrusion;
    }
    return tiposIntrusion.filter((tipo) =>
      [tipo.descripcion, tipo.id].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      )
    );
  }, [tiposIntrusion, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTiposIntrusion.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTiposIntrusion.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTiposIntrusion, currentPage]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedTipoIntrusion(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (tipo) => {
    setIsEditing(true);
    setSelectedTipoIntrusion(tipo);
    setFormState({
      descripcion: tipo.descripcion ?? '',
      activo: Boolean(tipo.activo),
      necesita_protocolo: Boolean(tipo.necesita_protocolo),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const descripcion = formState.descripcion.trim();
    const activo = Boolean(formState.activo);
    const necesitaProtocolo = Boolean(formState.necesita_protocolo);

    if (!descripcion) {
      setFormError('La descripción es obligatoria');
      return;
    }

    const duplicated = tiposIntrusion.some(
      (tipo) =>
        String(tipo.descripcion ?? '').toLowerCase() === descripcion.toLowerCase() &&
        tipo.id !== (selectedTipoIntrusion?.id ?? null)
    );

    if (duplicated) {
      setFormError('Ya existe un tipo de intrusión con esa descripción');
      return;
    }

    try {
      if (isEditing && selectedTipoIntrusion) {
        await update(selectedTipoIntrusion.id, {
          descripcion,
          activo,
          necesita_protocolo: necesitaProtocolo,
        });
        alert('Tipo de intrusión actualizado correctamente');
      } else {
        await create({
          descripcion,
          activo,
          necesita_protocolo: necesitaProtocolo,
        });
        alert('Tipo de intrusión creado correctamente');
      }
      await fetchTiposIntrusion();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Error al guardar el tipo de intrusión');
    }
  };

  const toggleActivo = async (tipo) => {
    if (tipo.activo) {
      const confirmed = window.confirm(
        '¿Está seguro de desactivar este tipo de intrusión?'
      );

      if (!confirmed) {
        return;
      }

      try {
        await remove(tipo.id);
        alert('Tipo de intrusión inactivado correctamente');
        await fetchTiposIntrusion();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Error al inactivar el tipo de intrusión');
      }
      return;
    }

    try {
      await update(tipo.id, { activo: true });
      alert('Tipo de intrusión activado correctamente');
      await fetchTiposIntrusion();
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error al activar el tipo de intrusión');
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const renderStatus = (isActive) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );

  const renderNecesitaProtocolo = (needsProtocol) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        needsProtocol ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {needsProtocol ? 'Sí' : 'No'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Tipo de Intrusión</h1>
          <p className="text-sm text-gray-500">
            Gestiona los tipos de intrusión disponibles para las operaciones del sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Tipo de Intrusión
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
          <p className="text-sm text-gray-500">Cargando tipos de intrusión...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredTiposIntrusion.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron tipos de intrusión.</p>
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
                      Necesita Protocolo
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
                  {currentItems.map((tipo) => (
                    <tr key={tipo.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{tipo.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{tipo.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderStatus(tipo.activo)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {renderNecesitaProtocolo(tipo.necesita_protocolo)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {tipo.fecha_creacion
                          ? new Date(tipo.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(tipo)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={tipo.activo ? dangerButtonClasses : successButtonClasses}
                            onClick={() => toggleActivo(tipo)}
                          >
                            {tipo.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTiposIntrusion.length)} de {filteredTiposIntrusion.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className={secondaryButtonClasses}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEditing ? 'Editar Tipo de Intrusión' : 'Nuevo Tipo de Intrusión'}
              </h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={closeModal}
              >
                <span className="sr-only">Cerrar</span>
                ✕
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="descripcion">
                  Descripción
                </label>
                <input
                  id="descripcion"
                  type="text"
                  value={formState.descripcion}
                  onChange={(e) => setFormState({ ...formState, descripcion: e.target.value })}
                  placeholder="Ingrese la descripción"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Activo</p>
                    <p className="text-xs text-gray-500">Determina si el tipo de intrusión está disponible.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={formState.activo}
                      onChange={(e) => setFormState({ ...formState, activo: e.target.checked })}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[4px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Necesita protocolo</p>
                    <p className="text-xs text-gray-500">Indica si este tipo de intrusión requiere protocolo.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={formState.necesita_protocolo}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          necesita_protocolo: e.target.checked,
                        })
                      }
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[4px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                {isEditing ? 'Guardar cambios' : 'Crear tipo de intrusión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TipoIntrusion;
