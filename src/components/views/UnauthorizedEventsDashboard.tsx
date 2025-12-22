import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import {
  IntrusionConsolidadoFilters,
  getDashboardEventosNoAutorizados,
  EventosNoAutorizadosDashboardResponse,
} from '@/services/intrusionesService';

const colorPalette = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4'];

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
      console.log('[INTRUSIONES][UI][NO_AUTORIZADOS] data:', response);
    } catch (requestError) {
      console.error('Error al cargar el dashboard de eventos no autorizados:', requestError);
      const errorMessage = requestError instanceof Error ? requestError.message : 'No se pudo cargar la información.';
      setError(`Error al cargar dashboard: ${errorMessage}`);
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

  const chartData = useMemo(() => {
    const mapped = (data?.tiempoLlegada ?? []).map((row) => ({
      sitio: row?.sitio_descripcion ?? row?.sitio ?? 'Sin sitio',
      minutos: Number(row?.minutos ?? 0),
    }));

    const sorted = mapped.sort((a, b) => b.minutos - a.minutos).slice(0, 15);

    console.log('[INTRUSIONES][UI][NO_AUTORIZADOS] chartData:', sorted);

    return sorted;
  }, [data?.tiempoLlegada]);

  const tableData = useMemo(() => data?.resumen ?? [], [data?.resumen]);

  const getColor = () => colorPalette[0];

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-bold text-[#1C2E4A]">Eventos no autorizados</h3>

      <IntrusionesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={() => void loadData()}
        onClear={() => void loadData()}
        includeSustraccionPersonal
      />

      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Reporte de eventos no autorizados</p>
            <h4 className="text-2xl font-semibold text-[#1C2E4A]">
              Tiempo de llegada y eventos registrados
            </h4>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-lg font-semibold text-[#1C2E4A]">
                Tiempo de llegada fuerza de reacción (min) por Sitio
              </h5>
              <span className="text-xs text-gray-500">Top 15</span>
            </div>
            <div className="h-[360px]">
              {isLoading ? (
                <p className="text-sm text-gray-600">Cargando gráfico...</p>
              ) : chartData.length === 0 ? (
                <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      label={{
                        value: 'Tiempo de llegada fuerza de reacción (min)',
                        position: 'insideBottomRight',
                        offset: -5,
                      }}
                    />
                    <YAxis
                      dataKey="sitio"
                      type="category"
                      width={240}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: string) =>
                        value?.length > 30 ? `${value.slice(0, 30)}…` : value
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} min`, 'Tiempo de llegada']}
                    />
                    <Bar
                      dataKey="minutos"
                      name="Tiempo de llegada (min)"
                      radius={[0, 4, 4, 0]}
                      fill={getColor()}
                    >
                      <LabelList dataKey="minutos" position="insideRight" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 bg-slate-50 border border-slate-100 rounded-lg p-6 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-sm uppercase tracking-wide text-gray-500">N° eventos no autorizados</p>
              <p className="text-5xl font-extrabold text-[#1C2E4A]">{isLoading ? '...' : data?.total ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xl font-semibold text-[#1C2E4A]">Resumen de protocolo aplicado por evento</h4>
            <p className="text-sm text-gray-500">Últimos 50 eventos no autorizados</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-[#1C2E4A] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Nombre sitio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Fecha intrusión</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Hora intrusión</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Primera comunicación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Resultado enviar fuerza de reacción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">T. de llegada fuerza de reacción (min)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Conclusión del evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-600">
                    Cargando información...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-600">
                    No hay registros disponibles.
                  </td>
                </tr>
              ) : (
                tableData.map((row, index) => (
                  <tr
                    key={`${row.sitio_descripcion ?? row.nombre_sitio}-${row.fecha_intrusion}-${index}`}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{row.sitio_descripcion ?? row.nombre_sitio ?? 'Sin sitio'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.fecha_intrusion ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.hora_intrusion ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.primera_comunicacion ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.resultado_fuerza_reaccion ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.tiempo_llegada_min != null ? row.tiempo_llegada_min.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.conclusion_evento ?? '-'}</td>
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
