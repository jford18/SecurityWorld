import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import {
  EventosDashboardResponse,
  IntrusionConsolidadoFilters,
  getDashboardEventosNoAutorizados,
} from '@/services/intrusionesService';

const colorPalette = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4'];

const formatPeriodo = (value: number | null | undefined) => {
  if (!value) return 'Sin información';
  const asString = String(value);
  if (asString.length !== 8) return asString;
  const year = asString.slice(0, 4);
  const month = asString.slice(4, 6);
  const day = asString.slice(6, 8);
  const parsed = new Date(`${year}-${month}-${day}`);
  return Number.isNaN(parsed.getTime()) ? asString : parsed.toLocaleDateString('es-ES');
};

const UnauthorizedEventsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({ haciendaId: '' });
  const [data, setData] = useState<EventosDashboardResponse | null>(null);
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

  const chartData = useMemo(
    () => (data?.porSitio ?? []).slice(0, 15).map((row) => ({
      sitio_nombre: row.sitio_nombre ?? 'Sin sitio',
      total: row.total ?? 0,
    })),
    [data?.porSitio]
  );

  const tableData = useMemo(() => data?.porDia ?? [], [data?.porDia]);

  const getColorForIndex = (index: number) => colorPalette[index % colorPalette.length];

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
            {data?.total ?? 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-[#1C2E4A]">
              N° eventos no autorizados por sitio
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
                  margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'N° eventos', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis
                    dataKey="sitio_nombre"
                    type="category"
                    width={240}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value) => `${value as number} eventos`} />
                  <Bar dataKey="total" name="N° eventos" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={getColorForIndex(index)} />
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
            Distribución por día
          </h4>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° eventos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-sm text-gray-600">
                    Cargando información...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-sm text-gray-600">
                    No hay registros disponibles.
                  </td>
                </tr>
              ) : (
                tableData.map((row) => (
                  <tr
                    key={row.periodo}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{formatPeriodo(row.periodo)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.total ?? 0}</td>
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
