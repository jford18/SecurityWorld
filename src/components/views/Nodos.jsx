// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { create, getAll, remove, update } from '../../services/nodos.service';

const ITEMS_PER_PAGE = 10;

const baseButtonClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2';
const primaryButtonClasses = `${baseButtonClasses} bg-yellow-400 text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:ring-yellow-400`;
const secondaryButtonClasses = `${baseButtonClasses} border border-yellow-400 text-[#1C2E4A] hover:bg-yellow-100 focus:ring-yellow-400`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500`;
const successButtonClasses = `${baseButtonClasses} bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500`;

const initialFormState = {
  nombre: '',
};

const Nodos = () => {
  const [nodos, setNodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNodo, setSelectedNodo] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchNodos = async () => {
    try {
      setLoading(true);
      const data = await getAll();
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }
      setNodos(data);
      setError('');
    } catch (err) {
      console.error('Error al cargar nodos:', err);
      setError(err?.message || 'Error al cargar los nodos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodos();
  }, []);

  const filteredNodos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return nodos;
    }
    return nodos.filter((nodo) =>
      [nodo.nombre, nodo.id].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term)
      )
    );
  }, [nodos, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredNodos.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNodos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNodos, currentPage]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedNodo(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (nodo) => {
    setIsEditing(true);
    setSelectedNodo(nodo);
    setFormState({ nombre: nodo.nombre ?? '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const nombre = formState.nombre.trim();

    if (!nombre) {
      setFormError('El nombre del nodo es obligatorio');
      return;
    }

    const duplicated = nodos.some(
      (nodo) =>
        nodo.nombre.toLowerCase() === nombre.toLowerCase() &&
        nodo.id !== (selectedNodo?.id ?? null)
    );

    if (duplicated) {
      setFormError('Ya existe un nodo con ese nombre');
      return;
    }

    try {
      if (isEditing && selectedNodo) {
        await update(selectedNodo.id, { nombre });
        alert('Nodo actualizado correctamente');
      } else {
        await create({ nombre });
        alert('Nodo creado correctamente');
      }
      await fetchNodos();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Error al guardar el nodo');
    }
  };

  const handleStatusChange = async (nodo) => {
    if (nodo.activo) {
      const confirmed = window.confirm(
        `¿Deseas inactivar el nodo "${nodo.nombre}"?`
      );

      if (!confirmed) {
        return;
      }

      try {
        await remove(nodo.id);
        alert('Nodo inactivado correctamente');
        await fetchNodos();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Error al inactivar el nodo');
      }
      return;
    }

    try {
      await update(nodo.id, { activo: true });
      alert('Nodo activado correctamente');
      await fetchNodos();
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error al activar el nodo');
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const renderStatus = (isActive) => (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        isActive
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-200 text-gray-600'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Nodos</h1>
          <p className="text-sm text-gray-500">
            Gestiona los nodos disponibles para las operaciones del sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Nodo
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
              placeholder="Buscar por nombre o ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando nodos...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredNodos.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron nodos.</p>
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
                      Nombre
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
                  {currentItems.map((nodo) => (
                    <tr key={nodo.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{nodo.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{nodo.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{renderStatus(nodo.activo)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {nodo.fecha_creacion
                          ? new Date(nodo.fecha_creacion).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClasses}
                            onClick={() => openEditModal(nodo)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={nodo.activo ? dangerButtonClasses : successButtonClasses}
                            onClick={() => handleStatusChange(nodo)}
                          >
                            {nodo.activo ? 'Eliminar' : 'Activar'}
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
              {isEditing ? 'Editar Nodo' : 'Nuevo Nodo'}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Nombre
                <input
                  type="text"
                  value={formState.nombre}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                  placeholder="Ingresa el nombre del nodo"
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

export default Nodos;
