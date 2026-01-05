import React, { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { EventoPorSitio } from '../../services/reportesEventosService';

interface Props {
  data: EventoPorSitio[];
  loading: boolean;
}

const ECUADOR_CENTER: [number, number] = [-1.831239, -78.183406];
const MIN_RADIUS = 3;
const MAX_RADIUS = 14;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const calculateRadius = (count: number, maxCount: number) => {
  const safeCount = Math.max(0, Number(count) || 0);
  const safeMax = Math.max(1, Number(maxCount) || 1);
  const ratio = Math.log1p(safeCount) / Math.log1p(safeMax);

  return clamp(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio, MIN_RADIUS, MAX_RADIUS);
};

const MapaEventosPorSitio: React.FC<Props> = ({ data, loading }) => {
  const sitiosConCoordenadas = useMemo(
    () => data.filter((sitio) => sitio.latitud !== null && sitio.longitud !== null),
    [data],
  );

  const maxEventos = useMemo(() => {
    const valores = sitiosConCoordenadas.map((sitio) => Number(sitio.total_eventos ?? 0));

    return Math.max(1, ...valores.filter((v) => Number.isFinite(v)));
  }, [sitiosConCoordenadas]);

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
          {sitiosConCoordenadas.map((sitio) => {
            const lat = Number(sitio.latitud);
            const lng = Number(sitio.longitud);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            const radius = calculateRadius(sitio.total_eventos, maxEventos);

            return (
              <CircleMarker
                key={`${sitio.sitio_id}-${sitio.sitio_nombre}`}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{ weight: 1, fillOpacity: 0.3 }}
              >
                <Tooltip direction="top" offset={[0, -2]} opacity={1} sticky>
                  {`${sitio.sitio_nombre} - ${sitio.total_eventos.toLocaleString('es-MX')} eventos`}
                </Tooltip>
              </CircleMarker>
            );
          })}
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
