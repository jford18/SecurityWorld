import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sitio,
  SitioPayload,
  createSitio,
  deleteSitio,
  getSitios,
  updateSitio,
} from '../../services/sitiosService';

type MapStatus = 'idle' | 'loading' | 'ready' | 'error';

const coordinatePatterns: RegExp[] = [
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/,
  /q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\/|\?|$)/,
];

const sanitizeCoordinate = (value: string, isLatitude: boolean): number | null => {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const limit = isLatitude ? 90 : 180;

  if (Math.abs(parsed) > limit) {
    return null;
  }

  return Math.round(parsed * 1e6) / 1e6;
};

const extractCoordinatesFromLink = (
  link: string
): { latitud: number; longitud: number } | null => {
  const trimmed = link.trim();

  if (!trimmed) {
    return null;
  }

  for (const pattern of coordinatePatterns) {
    const match = trimmed.match(pattern);

    if (match) {
      const latitud = sanitizeCoordinate(match[1], true);
      const longitud = sanitizeCoordinate(match[2], false);

      if (latitud !== null && longitud !== null) {
        return { latitud, longitud };
      }
    }
  }

  const fallback = trimmed.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);

  if (fallback) {
    const latitud = sanitizeCoordinate(fallback[1], true);
    const longitud = sanitizeCoordinate(fallback[2], false);

    if (latitud !== null && longitud !== null) {
      return { latitud, longitud };
    }
  }

  return null;
};

interface MapPreviewProps {
  latitud: number;
  longitud: number;
  onStatusChange?: (status: MapStatus) => void;
}

const MapPreview: React.FC<MapPreviewProps> = ({ latitud, longitud, onStatusChange }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const mapSrc = useMemo(() => {
    const lat = latitud.toFixed(6);
    const lng = longitud.toFixed(6);

    if (apiKey) {
      const params = new URLSearchParams({
        key: apiKey,
        center: `${lat},${lng}`,
        zoom: '15',
        maptype: 'roadmap',
      });
      return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
    }

    const params = new URLSearchParams({ q: `${lat},${lng}`, z: '15', output: 'embed' });
    return `https://www.google.com/maps?${params.toString()}`;
  }, [apiKey, latitud, longitud]);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    onStatusChange?.('loading');
  }, [mapSrc, onStatusChange]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onStatusChange?.('ready');
  }, [onStatusChange]);

  const handleError = useCallback(() => {
    setHasError(true);
    onStatusChange?.('error');
  }, [onStatusChange]);

  return (
    <div className="w-full">
      <div className="w-full h-[300px] rounded-xl shadow mt-3 overflow-hidden border border-gray-200">
        <iframe
          key={mapSrc}
          src={mapSrc}
          title="Vista previa de Google Maps"
          loading="lazy"
          className="w-full h-full"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
      {!apiKey && (
        <p className="mt-2 text-xs text-gray-500">
          Vista previa generada con el visor público de Google Maps. Para un mejor rendimiento puedes definir
          la clave en <code>VITE_GOOGLE_MAPS_API_KEY</code>.
        </p>
      )}
      {hasError && !isLoaded && (
        <p className="mt-2 text-sm text-red-600">No se pudo cargar el mapa de Google Maps.</p>
      )}
    </div>
  );
};

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
  const [linkMapa, setLinkMapa] = useState<string>('');
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [linkError, setLinkError] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle');

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
    setLinkMapa('');
    setLatitud(null);
    setLongitud(null);
    setLinkError('');
    setMapError('');
    setMapStatus('idle');
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
    const latValue =
      typeof sitio.latitud === 'number'
        ? Math.round(sitio.latitud * 1e6) / 1e6
        : sitio.latitud !== null && sitio.latitud !== undefined
        ? Math.round(Number.parseFloat(String(sitio.latitud)) * 1e6) / 1e6
        : null;
    const lngValue =
      typeof sitio.longitud === 'number'
        ? Math.round(sitio.longitud * 1e6) / 1e6
        : sitio.longitud !== null && sitio.longitud !== undefined
        ? Math.round(Number.parseFloat(String(sitio.longitud)) * 1e6) / 1e6
        : null;
    setLinkMapa(sitio.link_mapa ?? '');
    setLatitud(Number.isFinite(latValue) ? latValue : null);
    setLongitud(Number.isFinite(lngValue) ? lngValue : null);
    setLinkError('');
    setMapError('');
    setMapStatus(latValue !== null && lngValue !== null ? 'loading' : 'idle');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSitio(null);
    resetForm();
  };

  useEffect(() => {
    if (latitud !== null && longitud !== null) {
      setMapStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    } else {
      setMapStatus('idle');
      setMapError('');
    }
  }, [latitud, longitud]);

  useEffect(() => {
    if (mapStatus === 'error') {
      setMapError(
        'No se pudo cargar la vista previa del mapa. Verifica el enlace o tu conexión e inténtalo de nuevo.'
      );
    } else if (mapStatus === 'ready' || mapStatus === 'loading') {
      setMapError('');
    }
  }, [mapStatus]);

  const handleLinkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const link = event.target.value;
    setLinkMapa(link);
    setLinkError('');
    setMapError('');
    setFormError('');

    if (!link.trim()) {
      setLatitud(null);
      setLongitud(null);
      return;
    }

    const coords = extractCoordinatesFromLink(link);

    if (coords) {
      setLatitud(coords.latitud);
      setLongitud(coords.longitud);
    } else {
      setLatitud(null);
      setLongitud(null);
      setLinkError('El enlace no contiene coordenadas válidas de Google Maps.');
    }
  };

  const handleMapStatusChange = useCallback((status: MapStatus) => {
    setMapStatus(status);
  }, []);

  const handleSubmit = async () => {
    const trimmedName = nombre.trim();
    const trimmedDescripcion = descripcion.trim();
    const trimmedUbicacion = ubicacion.trim();
    const trimmedLinkMapa = linkMapa.trim();

    setFormError('');
    setLinkError('');
    setMapError('');

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

    if (!trimmedLinkMapa) {
      setLinkError('El enlace de Google Maps es obligatorio.');
      return;
    }

    if (latitud === null || longitud === null) {
      setLinkError('Debes proporcionar un enlace válido de Google Maps.');
      return;
    }

    if (mapStatus !== 'ready') {
      if (mapStatus === 'error') {
        setMapError('No se pudo cargar la vista previa del mapa. Verifica el enlace de Google Maps e inténtalo nuevamente.');
      } else {
        setMapError('Espera a que la vista previa del mapa se muestre correctamente antes de guardar.');
      }
      return;
    }

    const payload: SitioPayload = {
      nombre: trimmedName,
      descripcion: trimmedDescripcion || null,
      ubicacion: trimmedUbicacion || null,
      activo,
      link_mapa: trimmedLinkMapa,
      latitud,
      longitud,
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex max-h-[75vh] flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#1C2E4A]">
                  {modalMode === 'create' ? 'Nuevo Sitio' : 'Editar Sitio'}
                </h2>
                <button type="button" className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                  ×
                </button>
              </div>
              <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2 min-h-0">
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
              <div className="space-y-2">
                <label htmlFor="sitio-link-mapa" className="block text-sm font-medium text-[#1C2E4A]">
                  Link de Google Maps
                </label>
                <input
                  id="sitio-link-mapa"
                  type="url"
                  value={linkMapa}
                  onChange={handleLinkChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="Pega aquí el enlace de Google Maps"
                  required
                />
                {linkError && <p className="text-sm text-red-600">{linkError}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="sitio-latitud" className="block text-sm font-medium text-[#1C2E4A]">
                    Latitud
                  </label>
                  <input
                    id="sitio-latitud"
                    type="text"
                    value={latitud !== null ? latitud.toFixed(6) : ''}
                    readOnly
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700 focus:outline-none"
                    placeholder="Latitud detectada"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sitio-longitud" className="block text-sm font-medium text-[#1C2E4A]">
                    Longitud
                  </label>
                  <input
                    id="sitio-longitud"
                    type="text"
                    value={longitud !== null ? longitud.toFixed(6) : ''}
                    readOnly
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700 focus:outline-none"
                    placeholder="Longitud detectada"
                  />
                </div>
              </div>
              {latitud !== null && longitud !== null && (
                <div className="animate-fadeIn">
                  <MapPreview
                    latitud={latitud}
                    longitud={longitud}
                    onStatusChange={handleMapStatusChange}
                  />
                  {mapStatus === 'loading' && (
                    <p className="mt-2 text-sm text-gray-500">Cargando vista previa del mapa...</p>
                  )}
                </div>
              )}
              {mapError && <p className="text-sm text-red-600">{mapError}</p>}
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
            <div className="mt-4 flex justify-end space-x-3">
              <button type="button" className={secondaryButtonClasses} onClick={closeModal}>
                Cancelar
              </button>
              <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
                {modalMode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default Sitios;
