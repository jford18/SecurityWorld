// NEW: Pantalla administrativa para el mantenimiento del catálogo tipo problema.
import React, { useCallback, useEffect, useState } from 'react';
import type { CatalogoTipoProblema } from '../../types';
import {
  createCatalogoTipoProblema,
  deleteCatalogoTipoProblema,
  fetchCatalogoTiposProblema,
  updateCatalogoTipoProblema,
} from '../../services/catalogoTipoProblemaService';

const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-[#1C2E4A] text-white hover:bg-[#243b55] focus:ring-[#1C2E4A]`;
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;
const dangerButtonClasses = `${baseButtonClasses} bg-red-600 text-white hover:bg-red-700 focus:ring-red-600`;

type ModalMode = 'create' | 'edit';

const CatalogoTipoProblemaScreen: React.FC = () => {
  const [tipos, setTipos] = useState<CatalogoTipoProblema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selected, setSelected] = useState<CatalogoTipoProblema | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState('');

  // FIX: Carga inicial con captura de errores para mostrar feedback en pantalla y evitar estados silenciosos.
  const loadTipos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCatalogoTiposProblema();
      setTipos(data);
    } catch (error) {
      console.error('Error al cargar tipos de problema', error);
      const message = (error as Error).message || 'Error al cargar tipos de problema';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTipos();
  }, [loadTipos]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelected(null);
    setDescripcion('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (tipo: CatalogoTipoProblema) => {
    setModalMode('edit');
    setSelected(tipo);
    setDescripcion(tipo.descripcion);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    const normalized = descripcion.trim();

    // FIX: Validación en cliente para impedir envíos vacíos y anticipar el error 422 del servidor.

    if (!normalized) {
      setFormError('La descripción es obligatoria');
      return;
    }

    const duplicated = tipos.some(
      (tipo) => tipo.descripcion.toLowerCase() === normalized.toLowerCase() && tipo.id !== selected?.id,
    );

    if (duplicated) {
      // FIX: Validación en cliente para evitar llamadas redundantes cuando la descripción ya existe.
      setFormError('El tipo de problema ya existe');
      return;
    }

    try {
      if (modalMode === 'create') {
        await createCatalogoTipoProblema({ descripcion: normalized });
        alert('Tipo de problema creado correctamente');
      } else if (selected) {
        await updateCatalogoTipoProblema(selected.id, { descripcion: normalized });
        alert('Tipo de problema actualizado correctamente');
      }
      closeModal();
      loadTipos();
    } catch (error) {
      // FIX: Los mensajes del backend se muestran directamente para facilitar el soporte a los usuarios.
      const message = (error as Error).message || 'Error al guardar tipo de problema';
      setFormError(message);
      alert(message);
    }
  };

  const handleDelete = async (tipo: CatalogoTipoProblema) => {
    const confirmed = window.confirm(
      `¿Deseas eliminar el tipo de problema "${tipo.descripcion}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteCatalogoTipoProblema(tipo.id);
      alert('Tipo de problema eliminado correctamente');
      loadTipos();
    } catch (error) {
      // FIX: Mensajes legibles ante errores de eliminación.
      const message = (error as Error).message || 'Error al eliminar tipo de problema';
      alert(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Catálogo de Tipos de Problema</h1>
          <p className="text-sm text-gray-500">
            Administra los tipos de problema disponibles para clasificar incidencias.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={openCreateModal}>
          Nuevo Tipo de Problema
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#F9E79F]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Descripción
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    Cargando información...
                  </td>
                </tr>
              ) : tipos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay tipos de problema registrados.
                  </td>
                </tr>
              ) : (
                tipos.map((tipo) => (
                  <tr key={tipo.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{tipo.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{tipo.descripcion}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className={secondaryButtonClasses}
                          onClick={() => openEditModal(tipo)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClasses}
                          onClick={() => handleDelete(tipo)}
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
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {modalMode === 'create' ? 'Nuevo Tipo de Problema' : 'Editar Tipo de Problema'}
              </h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <input
                  id="descripcion"
                  type="text"
                  value={descripcion}
                  onChange={(event) => {
                    setDescripcion(event.target.value);
                    setFormError('');
                  }}
                  placeholder="Ingresa la descripción"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
                />
                {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                {modalMode === 'create' ? 'Guardar' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoTipoProblemaScreen;
