import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import {
  EventosDashboardResponse,
  IntrusionConsolidadoFilters,
  getDashboardEventosAutorizados,
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

const AuthorizedEventsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({ haciendaId: '' });
  const [data, setData] = useState<EventosDashboardResponse>({
    total: 0,
    porDia: [],
    porSitio: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[INTRUSIONES][UI] cargando dashboard autorizados');
      const response = await getDashboardEventosAutorizados(filters);
      console.log('[INTRUSIONES][UI] dashboard autorizados OK:', response);
      setData(response);
    } catch (requestError) {
      console.error('[INTRUSIONES][UI] dashboard autorizados ERROR:', requestError);
      const errorMessage = requestError instanceof Error ? requestError.message : 'Error al cargar dashboard autorizados';
      setError(errorMessage);
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

  const barData = useMemo(
    () => (data?.porSitio ?? []).slice(0, 15).map((row) => ({
      sitio_nombre: row.sitio_descripcion ?? row.sitio_nombre ?? 'Sin sitio',
      total: row.total ?? 0,
    })),
    [data?.porSitio]
  );

  const lineaData = useMemo(() => data?.porDia ?? [], [data?.porDia]);
  const tablaData = useMemo(() => data?.porSitio ?? [], [data?.porSitio]);
  const totalEventos = useMemo(() => data?.total ?? 0, [data]);

  const getColor = (index: number) => colorPalette[index % colorPalette.length];

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Visitas de personal de seguridad</h3>

      <IntrusionesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={() => void loadData()}
        onClear={() => void loadData()}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !isLoading && totalEventos === 0 && (
        <p className="text-sm text-gray-600">Sin datos</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-[#1C2E4A]">N° eventos por sitio</h4>
            <span className="text-sm text-gray-500">Top 15</span>
          </div>
          <div className="h-96">
            {isLoading ? (
              <p className="text-sm text-gray-600">Cargando gráfico...</p>
            ) : barData.length === 0 ? (
              <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'N° eventos', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis
                    dataKey="sitio_nombre"
                    type="category"
                    width={220}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value) => `${value as number} eventos`} />
                  <Bar dataKey="total" name="N° eventos" radius={[0, 4, 4, 0]}>
                    {barData.map((_, index) => (
                      <Cell key={`bar-${index}`} fill={getColor(index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold text-[#1C2E4A] mb-4">N° eventos por fecha</h4>
          <div className="h-96">
            {isLoading ? (
              <p className="text-sm text-gray-600">Cargando gráfico...</p>
            ) : lineaData.length === 0 ? (
              <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer>
                <LineChart data={lineaData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" tickFormatter={formatPeriodo} />
                  <YAxis allowDecimals={false} label={{ value: 'N° eventos', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    labelFormatter={(label) => formatPeriodo(label as number)}
                    formatter={(value) => `${value as number} eventos`}
                  />
                  <Line type="monotone" dataKey="total" stroke="#1C2E4A" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-lg font-semibold text-[#1C2E4A] mb-4">Detalle por sitio</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sitio
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
              ) : tablaData.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-sm text-gray-600">
                    No hay registros disponibles.
                  </td>
                </tr>
              ) : (
                tablaData.map((row, index) => (
                  <tr key={`${row.sitio_id ?? 'sin-sitio'}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.sitio_descripcion ?? row.sitio_nombre ?? 'Sin sitio'}</td>
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

export default AuthorizedEventsDashboard;
