import React, { useEffect, useState } from 'react';
import {
  Sitio,
  SitioPayload,
  createSitio,
  deleteSitio,
  getSitios,
  updateSitio,
} from '../../services/sitiosService';

type ModalMode = 'create' | 'edit';

const primaryButtonClasses =
  'inline-flex justify-center rounded-md bg-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] shadow-sm hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';
const secondaryButtonClasses =
  'inline-flex justify-center rounded-md border border-yellow-400 px-4 py-2 font-semibold text-[#1C2E4A] hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400';

const Sitios: React.FC = () => {
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedSitio, setSelectedSitio] = useState<Sitio | null>(null);

  const [nombre, setNombre] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [ubicacion, setUbicacion] = useState<string>('');
  const [activo, setActivo] = useState<boolean>(true);

  const loadSitios = async () => {
    try {
      setLoading(true);
      const data = await getSitios();
      const lista = Array.isArray(data)
        ? data
        : (data as { data?: Sitio[] } | null | undefined)?.data;

      if (!Array.isArray(lista)) {
        throw new Error('Respuesta inválida del servidor');
      }

      setSitios(lista);
      setError(null);
    } catch (err) {
      console.error('Error al cargar sitios:', err);
      setError((err as Error).message || 'Error al cargar los sitios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSitios();
  }, []);

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setUbicacion('');
    setActivo(true);
    setFormError('');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setModalMode('create');
    setSelectedSitio(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sitio: Sitio) => {
    setModalMode('edit');
    setSelectedSitio(sitio);
    setNombre(sitio.nombre ?? '');
    setDescripcion(sitio.descripcion ?? '');
    setUbicacion(sitio.ubicacion ?? '');
    setActivo(Boolean(sitio.activo));
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const trimmedName = nombre.trim();
    const trimmedDescripcion = descripcion.trim();
    const trimmedUbicacion = ubicacion.trim();

    if (!trimmedName) {
      setFormError('El nombre es obligatorio');
      return;
    }

    const duplicated = sitios.some(
      (sitio) =>
        sitio.nombre.toLowerCase() === trimmedName.toLowerCase() &&
        sitio.id !== selectedSitio?.id
    );

    if (duplicated) {
      setFormError('Ya existe un sitio con ese nombre');
      return;
    }

    const payload: SitioPayload = {
      nombre: trimmedName,
      descripcion: trimmedDescripcion || null,
      ubicacion: trimmedUbicacion || null,
      activo,
    };

    try {
      if (modalMode === 'create') {
        await createSitio(payload);
        alert('Sitio creado correctamente');
      } else if (selectedSitio) {
        await updateSitio(selectedSitio.id, payload);
        alert('Sitio actualizado correctamente');
      }
      await loadSitios();
      closeModal();
    } catch (err) {
      console.error(err);
      setFormError((err as Error).message || 'Error al guardar el sitio');
    }
  };

  const handleDelete = async (sitio: Sitio) => {
    const confirmation = window.confirm(
      `¿Deseas eliminar el sitio "${sitio.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmation) {
      return;
    }

    try {
      await deleteSitio(sitio.id);
      alert('Sitio eliminado correctamente');
      await loadSitios();
    } catch (err) {
      console.error(err);
      alert((err as Error).message || 'Error al eliminar el sitio');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2E4A]">Mantenimiento de Sitios</h1>
          <p className="text-sm text-gray-500">
            Gestiona los sitios disponibles para monitoreo y asignación dentro del sistema.
          </p>
        </div>
        <button type="button" className={primaryButtonClasses} onClick={handleOpenCreateModal}>
          Nuevo Sitio
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando sitios...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : sitios.length === 0 ? (
          <p className="text-sm text-gray-500">No se registran sitios actualmente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1C2E4A]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Activo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sitios.map((sitio) => (
                  <tr key={sitio.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{sitio.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{sitio.nombre}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {sitio.descripcion && sitio.descripcion.trim() ? sitio.descripcion : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {sitio.ubicacion && sitio.ubicacion.trim() ? sitio.ubicacion : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{sitio.activo ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 space-x-2">
                      <button
                        type="button"
                        className={secondaryButtonClasses}
                        onClick={() => handleOpenEditModal(sitio)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={primaryButtonClasses}
                        onClick={() => handleDelete(sitio)}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1C2E4A]">
                {modalMode === 'create' ? 'Nuevo Sitio' : 'Editar Sitio'}
              </h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="sitio-nombre" className="block text-sm font-medium text-[#1C2E4A]">
                  Nombre del sitio
                </label>
                <input
                  id="sitio-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Ingresa el nombre"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="sitio-descripcion" className="block text-sm font-medium text-[#1C2E4A]">
                  Descripción
                </label>
                <textarea
                  id="sitio-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Descripción del sitio"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="sitio-ubicacion" className="block text-sm font-medium text-[#1C2E4A]">
                  Ubicación
                </label>
                <input
                  id="sitio-ubicacion"
                  type="text"
                  value={ubicacion}
                  onChange={(event) => setUbicacion(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Ubicación física o referencia"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  id="sitio-activo"
                  type="checkbox"
                  checked={activo}
                  onChange={(event) => setActivo(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                <label htmlFor="sitio-activo" className="text-sm font-medium text-[#1C2E4A]">
                  Sitio activo
                </label>
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

export default Sitios;
