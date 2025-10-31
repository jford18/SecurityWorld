// NEW: Pantalla de mantenimiento para CRUD de consolas con validaciones de frontend.
import React, { useEffect, useRef, useState } from 'react';
import {
  ConsolaPayload,
  createConsola,
  deleteConsola,
  getConsolas,
  updateConsola,
} from '../../services/consolasService';

export type Consola = {
  id: number;
  nombre: string;
  fecha_creacion: string;
};

type ModalMode = 'create' | 'edit';

const primaryButtonClasses =
  'inline-flex justify-center rounded-md bg-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';
const secondaryButtonClasses =
  'inline-flex justify-center rounded-md border border-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';

const ConsolasScreen: React.FC = () => {
  const [consolas, setConsolas] = useState<Consola[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedConsola, setSelectedConsola] = useState<Consola | null>(null);
  const [nombre, setNombre] = useState<string>('');

  // NEW: Recupera consolas desde el backend garantizando manejo de errores coherente.
  const loadConsolas = async () => {
    try {
      setLoading(true);
      const data = await getConsolas();
      const lista = Array.isArray(data)
        ? data
        : (data as { data?: Consola[] } | null | undefined)?.data;

      if (!Array.isArray(lista)) {
        throw new Error('Respuesta inválida del servidor');
      }

      setConsolas(lista);
      setError(null);
    } catch (err) {
      console.error('Error cargando consolas:', err);
      setError((err as Error).message || 'Error al cargar las consolas');
    } finally {
      setLoading(false);
    }
  };

  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) {
      return;
    }
    hasLoaded.current = true;

    loadConsolas();
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedConsola(null);
    setNombre('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (consola: Consola) => {
    setModalMode('edit');
    setSelectedConsola(consola);
    setNombre(consola.nombre);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const trimmedName = nombre.trim();
    if (!trimmedName) {
      // FIX: Validación del campo obligatorio antes de enviar al backend.
      setFormError('El nombre es obligatorio');
      return;
    }

    const duplicated = consolas.some(
      (consola) =>
        consola.nombre.toLowerCase() === trimmedName.toLowerCase() &&
        consola.id !== selectedConsola?.id
    );

    if (duplicated) {
      // FIX: Prevenimos duplicados desde el frontend para mejorar la UX.
      setFormError('La consola ya existe');
      return;
    }

    const payload: ConsolaPayload = { nombre: trimmedName };

    try {
      if (modalMode === 'create') {
        await createConsola(payload);
        alert('Consola creada correctamente');
      } else if (selectedConsola) {
        await updateConsola(selectedConsola.id, payload);
        alert('Consola actualizada correctamente');
      }
      await loadConsolas();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError((err as Error).message || 'Error al guardar la consola');
    }
  };

  const handleDelete = async (consola: Consola) => {
    const confirmation = window.confirm(
      `¿Deseas eliminar la consola "${consola.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmation) {
      return;
    }

    try {
      await deleteConsola(consola.id);
      alert('Consola eliminada correctamente');
      await loadConsolas();
    } catch (err) {
      console.error(err);
      alert((err as Error).message || 'Error al eliminar la consola');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Consolas</h1>
          <p className="text-sm text-gray-500">
            Gestiona las consolas disponibles para asignación en los distintos módulos del sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={handleOpenCreateModal}>
          Nueva Consola
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando consolas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : consolas.length === 0 ? (
          <p className="text-sm text-gray-500">No se registran consolas actualmente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1C2E4A]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {consolas.map((consola) => (
                  <tr key={consola.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{consola.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{consola.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(consola.fecha_creacion).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 space-x-2">
                      <button
                        type="button"
                        className={secondaryButtonClasses}
                        onClick={() => handleOpenEditModal(consola)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={primaryButtonClasses}
                        onClick={() => handleDelete(consola)}
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1C2E4A]">
                {modalMode === 'create' ? 'Nueva Consola' : 'Editar Consola'}
              </h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="nombre" className="block text-sm font-medium text-[#1C2E4A]">
                Nombre de la consola
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="Ingresa el nombre"
              />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                {modalMode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsolasScreen;
