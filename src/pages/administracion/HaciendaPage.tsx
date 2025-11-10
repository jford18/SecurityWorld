import React, { useEffect, useRef, useState } from 'react';
import {
  createHacienda,
  deleteHacienda,
  getHaciendas,
  updateHacienda,
  type HaciendaPayload,
  type HaciendaRecord as Hacienda,
} from '../../services/haciendaService';

type ModalMode = 'create' | 'edit';

const primaryButtonClasses =
  'inline-flex justify-center rounded-md bg-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';
const secondaryButtonClasses =
  'inline-flex justify-center rounded-md border border-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';

const HaciendaPage: React.FC = () => {
  const [haciendas, setHaciendas] = useState<Hacienda[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedHacienda, setSelectedHacienda] = useState<Hacienda | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');

  const loadHaciendas = async () => {
    try {
      setLoading(true);
      const response = await getHaciendas();
      const lista = response?.data?.data;

      if (!Array.isArray(lista)) {
        throw new Error('Respuesta inválida del servidor');
      }

      setHaciendas(lista);
      setError(null);
    } catch (err) {
      console.error('Error cargando haciendas:', err);
      setError((err as Error).message || 'Error al cargar las haciendas');
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
    loadHaciendas();
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedHacienda(null);
    setNombre('');
    setDireccion('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (hacienda: Hacienda) => {
    setModalMode('edit');
    setSelectedHacienda(hacienda);
    setNombre(hacienda.nombre);
    setDireccion(hacienda.direccion || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const trimmedName = nombre.trim();
    if (!trimmedName) {
      setFormError('El nombre es obligatorio');
      return;
    }

    const duplicated = haciendas.some(
      (hacienda) =>
        hacienda.nombre.toLowerCase() === trimmedName.toLowerCase() &&
        hacienda.id !== selectedHacienda?.id
    );

    if (duplicated) {
      setFormError('La hacienda ya existe');
      return;
    }

    const payload: HaciendaPayload = { nombre: trimmedName, direccion: direccion.trim() };

    try {
      if (modalMode === 'create') {
        await createHacienda(payload);
        alert('Hacienda creada correctamente');
      } else if (selectedHacienda) {
        await updateHacienda(selectedHacienda.id, payload);
        alert('Hacienda actualizada correctamente');
      }
      await loadHaciendas();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError((err as Error).message || 'Error al guardar la hacienda');
    }
  };

  const handleDelete = async (hacienda: Hacienda) => {
    const confirmation = window.confirm(
      `¿Deseas eliminar la hacienda "${hacienda.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmation) {
      return;
    }

    try {
      await deleteHacienda(hacienda.id);
      alert('Hacienda eliminada correctamente');
      await loadHaciendas();
    } catch (err) {
      console.error(err);
      alert((err as Error).message || 'Error al eliminar la hacienda');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Haciendas</h1>
          <p className="text-sm text-gray-500">
            Gestiona las haciendas disponibles en el sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={handleOpenCreateModal}>
          Nueva Hacienda
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando haciendas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : haciendas.length === 0 ? (
          <p className="text-sm text-gray-500">No se registran haciendas actualmente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1C2E4A]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {haciendas.map((hacienda) => (
                  <tr key={hacienda.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{hacienda.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{hacienda.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{hacienda.direccion || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(hacienda.fecha_creacion).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 space-x-2">
                      <button
                        type="button"
                        className={secondaryButtonClasses}
                        onClick={() => handleOpenEditModal(hacienda)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={primaryButtonClasses}
                        onClick={() => handleDelete(hacienda)}
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
                {modalMode === 'create' ? 'Nueva Hacienda' : 'Editar Hacienda'}
              </h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-[#1C2E4A]">
                  Nombre de la hacienda
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Ingresa el nombre"
                />
              </div>
              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-[#1C2E4A]">
                  Dirección
                </label>
                <input
                  id="direccion"
                  type="text"
                  value={direccion}
                  onChange={(event) => setDireccion(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Ingresa la dirección"
                />
              </div>
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

export default HaciendaPage;
