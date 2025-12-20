import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import {
  EventosAutorizadosDashboardResponse,
  IntrusionConsolidadoFilters,
  getDashboardEventosAutorizados,
} from '@/services/intrusionesService';

const colorPalette = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4'];

const formatDate = (value: string | null) => {
  if (!value) return 'Sin información';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin información' : date.toLocaleDateString('es-ES');
};

const AuthorizedEventsDashboard: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({ haciendaId: '' });
  const [data, setData] = useState<EventosAutorizadosDashboardResponse>({
    total: 0,
    barHaciendas: [],
    donutPersonal: [],
    tablaDiaSemana: [],
    lineaPorFecha: [],
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

  const barData = useMemo(() => data?.barHaciendas ?? [], [data]);
  const donutData = useMemo(() => data?.donutPersonal ?? [], [data]);
  const tablaData = useMemo(() => data?.tablaDiaSemana ?? [], [data]);
  const lineaData = useMemo(() => data?.lineaPorFecha ?? [], [data]);
  const totalEventos = useMemo(() => data?.total ?? 0, [data]);

  const tablaConTotal = useMemo(() => {
    const totalEventos = tablaData.reduce((acc, row) => acc + (row?.total_eventos ?? 0), 0);
    const totalSitios = tablaData.reduce((acc, row) => acc + (row?.total_sitios ?? 0), 0);

    if (tablaData.length === 0) {
      return [];
    }

    return [...tablaData, { dia_semana: 'Total', total_eventos: totalEventos, total_sitios: totalSitios }];
  }, [tablaData]);

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
            <h4 className="text-lg font-semibold text-[#1C2E4A]">N° eventos por Hacienda</h4>
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
                    dataKey="hacienda_nombre"
                    type="category"
                    width={200}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value) => `${value as number} eventos`} />
                  <Bar dataKey="total_eventos" name="N° eventos" radius={[0, 4, 4, 0]}>
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
          <h4 className="text-lg font-semibold text-[#1C2E4A] mb-4">
            N° eventos por Personal identificado RBP
          </h4>
          <div className="h-96">
            {isLoading ? (
              <p className="text-sm text-gray-600">Cargando gráfico...</p>
            ) : donutData.length === 0 ? (
              <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="total_eventos"
                    nameKey="personal_identificado"
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {donutData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={getColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value as number} eventos`}
                    labelFormatter={(label) => label}
                  />
                  <Legend verticalAlign="bottom" height={50} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold text-[#1C2E4A] mb-4">
            Día semana | N° eventos | N° sitios
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Día semana
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° eventos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° sitios
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-600">
                      Cargando información...
                    </td>
                  </tr>
                ) : tablaConTotal.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-600">
                      No hay registros disponibles.
                    </td>
                  </tr>
                ) : (
                  tablaConTotal.map((row) => (
                    <tr key={row.dia_semana} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 capitalize">{row.dia_semana}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.total_eventos}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.total_sitios}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold text-[#1C2E4A] mb-4">N° eventos por Fecha intrusión</h4>
          <div className="h-96">
            {isLoading ? (
              <p className="text-sm text-gray-600">Cargando gráfico...</p>
            ) : lineaData.length === 0 ? (
              <p className="text-sm text-gray-600">No hay datos para los filtros seleccionados.</p>
            ) : (
              <ResponsiveContainer>
                <LineChart data={lineaData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tickFormatter={formatDate} />
                  <YAxis allowDecimals={false} label={{ value: 'N° eventos', angle: -90, position: 'insideLeft' }} />
                  <Tooltip labelFormatter={(label) => formatDate(label as string)} formatter={(value) => `${value as number} eventos`} />
                  <Line type="monotone" dataKey="total_eventos" stroke="#1C2E4A" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorizedEventsDashboard;
