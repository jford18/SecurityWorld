import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import {
  EventosNoAutorizadosDashboardResponse,
  IntrusionConsolidadoFilters,
  getDashboardEventosNoAutorizados,
} from '@/services/intrusionesService';

const colorPalette = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4'];

const formatDate = (value: string | null) => {
  if (!value) return 'Sin información';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin información' : date.toLocaleDateString('es-ES');
};

const formatTime = (value: string | null) => {
  if (!value) return 'Sin información';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin información'
    : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatMinutes = (value: number | null) => {
  if (value === null || value === undefined) return 'N/A';
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
};

const UnauthorizedEventsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({ haciendaId: '' });
  const [data, setData] = useState<EventosNoAutorizadosDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getDashboardEventosNoAutorizados(filters);
      setData(response);
    } catch (requestError) {
      console.error('Error al cargar el dashboard de eventos no autorizados:', requestError);
      setError('No se pudo cargar la información.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFiltersChange = (updatedFilters: IntrusionConsolidadoFilters) => {
    setFilters(updatedFilters);
  };

  const chartData = useMemo(() => data?.chart ?? [], [data?.chart]);
  const tableData = useMemo(() => data?.tabla ?? [], [data?.tabla]);

  const getColorForZone = (zona: string) => {
    const safeZona = zona || 'Zona';
    let hash = 0;
    for (let i = 0; i < safeZona.length; i += 1) {
      hash = safeZona.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index];
  };

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Eventos no autorizados</h3>

      <IntrusionesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={() => void loadData()}
        onClear={() => void loadData()}
        includeSustraccionPersonal
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-1">
          <p className="text-sm text-gray-600">N° eventos no autorizados</p>
          <p className="text-4xl font-bold text-[#1C2E4A] mt-2">
            {data?.kpis?.total_no_autorizados ?? 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-[#1C2E4A]">
              Tiempo de llegada fuerza de reacción (min) por Sitio y Zona
            </h4>
            <span className="text-sm text-gray-500">Top 15</span>
          </div>
          <div className="h-96">
            {isLoading ? (
              <p className="text-sm text-gray-600">Cargando gráfico...</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'Minutos', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis
                    dataKey="sitio_descripcion"
                    type="category"
                    width={200}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value) => formatMinutes(Number(value))} />
                  <Legend />
                  <Bar dataKey="promedio_min" name="Promedio (min)" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${entry.sitio_id ?? index}`} fill={getColorForZone(entry.zona)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-[#1C2E4A]">
            Resumen de protocolo aplicado por evento
          </h4>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre sitio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha intrusión
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hora intrusión
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medio de comunicación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha reacción enviada
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo llegada fuerza reacción (min)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conclusión del evento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sustracción personal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-600">
                    Cargando información...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-600">
                    No hay registros disponibles.
                  </td>
                </tr>
              ) : (
                tableData.map((row) => (
                  <tr key={row.id ?? `${row.sitio_descripcion}-${row.fecha_evento ?? 'sin-fecha'}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.sitio_descripcion || 'Sin información'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.fecha_evento)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatTime(row.fecha_evento)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.medio_comunicacion || 'Sin información'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.fecha_reaccion_enviada ? new Date(row.fecha_reaccion_enviada).toLocaleString('es-ES') : 'Sin información'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatMinutes(row.tiempo_llegada_min)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.conclusion_evento || 'Sin información'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.sustraccion_personal ? 'Sí' : 'No'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedEventsDashboard;
