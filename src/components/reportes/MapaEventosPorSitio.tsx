import React, { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { EventoPorSitio } from '../../services/reportesEventosService';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  data: EventoPorSitio[];
  loading: boolean;
}

const ECUADOR_CENTER: [number, number] = [-1.831239, -78.183406];

const MapaEventosPorSitio: React.FC<Props> = ({ data, loading }) => {
  const sitiosConCoordenadas = useMemo(
    () => data.filter((sitio) => sitio.latitud !== null && sitio.longitud !== null),
    [data],
  );

  const center: [number, number] = useMemo(() => {
    if (!sitiosConCoordenadas.length) {
      return ECUADOR_CENTER;
    }

    const { latSum, lonSum } = sitiosConCoordenadas.reduce(
      (acc, sitio) => ({
        latSum: acc.latSum + (sitio.latitud ?? 0),
        lonSum: acc.lonSum + (sitio.longitud ?? 0),
      }),
      { latSum: 0, lonSum: 0 },
    );

    return [latSum / sitiosConCoordenadas.length, lonSum / sitiosConCoordenadas.length];
  }, [sitiosConCoordenadas]);

  return (
    <section className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#1C2E4A]">Mapa de eventos por sitio</h2>
          <p className="text-sm text-gray-500">Marcadores según los filtros aplicados.</p>
        </div>
        <p className="text-sm text-gray-600">
          Mostrando <span className="font-semibold text-[#1C2E4A]">{sitiosConCoordenadas.length}</span> sitios con
          coordenadas
        </p>
      </div>

      {loading ? (
        <div className="h-[450px] flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-md">
          Cargando mapa…
        </div>
      ) : sitiosConCoordenadas.length ? (
        <MapContainer center={center} zoom={6} className="h-[450px] w-full rounded-md z-0">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {sitiosConCoordenadas.map((sitio) => (
            <Marker key={`${sitio.sitio_id}-${sitio.sitio_nombre}`} position={[sitio.latitud!, sitio.longitud!]}> 
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold text-[#1C2E4A]">{sitio.sitio_nombre}</p>
                  <p className="text-sm text-gray-700">
                    Total de eventos:{' '}
                    <span className="font-semibold">{sitio.total_eventos.toLocaleString('es-MX')}</span>
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <div className="h-[450px] flex items-center justify-center text-sm text-gray-500 bg-gray-50 rounded-md">
          No hay sitios con coordenadas para el periodo seleccionado.
        </div>
      )}
    </section>
  );
};

export default MapaEventosPorSitio;
