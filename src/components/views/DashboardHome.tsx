import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ComposedChart,
  Line,
} from 'recharts';
import { useSession } from '../context/SessionContext';
import { resolveConsolaIdByName } from '../../services/consolasService';
import {
  DashboardFallosTecnicosResponse,
  fetchDashboardFallosTecnicosResumen,
} from '../../services/dashboardFallosTecnicosService';

const KPI_LABELS = [
  {
    key: 'fallos_reportados',
    label: 'Fallos reportados',
  },
  {
    key: 't_prom_solucion_dias',
    label: 'T.prom solución (días)',
  },
  {
    key: 'pct_pendientes',
    label: '%Pendientes',
  },
  {
    key: 'pct_resueltos',
    label: '%Resueltos',
  },
];

const CHART_COLORS = [
  '#4C6FFF',
  '#FF7A59',
  '#2ED3B7',
  '#F9C300',
  '#7D4CDB',
  '#FFB84C',
  '#1F9D55',
  '#EC4899',
];

const formatDecimal = (value: number, decimals = 2) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const formatCompactNumber = (value: number) => {
  if (value >= 1000) {
    return `${formatDecimal(value / 1000, 2)} mil`;
  }
  return formatDecimal(value, 2);
};

const formatPercent = (value: number) => `${formatDecimal(value, 2)} %`;

const formatInteger = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(value);

const formatMonthLabel = (mes: string) => {
  const [year, month] = mes.split('-').map(Number);
  if (!year || !month) {
    return mes;
  }
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const DashboardHome: React.FC = () => {
  const { session } = useSession();
  const [dashboard, setDashboard] = useState<DashboardFallosTecnicosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consolaId, setConsolaId] = useState<number | null>(null);
  const [selectedClienteIds, setSelectedClienteIds] = useState<number[]>([]);
  const [selectedHaciendaId, setSelectedHaciendaId] = useState('');
  const [selectedMes, setSelectedMes] = useState('');
  const [selectedProblemaId, setSelectedProblemaId] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadConsola = async () => {
      const consoleName = session.console ?? localStorage.getItem('selectedConsole');
      if (!consoleName) {
        if (isMounted) {
          setConsolaId(null);
        }
        return;
      }

      try {
        const resolvedId = await resolveConsolaIdByName(consoleName);
        if (isMounted) {
          setConsolaId(resolvedId);
        }
      } catch (err) {
        console.error('Error resolviendo consola:', err);
        if (isMounted) {
          setConsolaId(null);
        }
      }
    };

    loadConsola();

    return () => {
      isMounted = false;
    };
  }, [session.console]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchDashboard = async () => {
      try {
        const response = await fetchDashboardFallosTecnicosResumen({
          clienteIds: selectedClienteIds.length > 0 ? selectedClienteIds : undefined,
          haciendaId: selectedHaciendaId ? Number(selectedHaciendaId) : null,
          mes: selectedMes || null,
          problemaId: selectedProblemaId ? Number(selectedProblemaId) : null,
          consolaId,
        });

        if (!isMounted) return;
        setDashboard(response);
      } catch (err) {
        console.error('Error al cargar dashboard de fallos técnicos:', err);
        if (isMounted) {
          setError('No se pudo cargar el dashboard de fallos técnicos.');
          setDashboard(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      isMounted = false;
    };
  }, [consolaId, selectedClienteIds, selectedHaciendaId, selectedMes, selectedProblemaId]);

  useEffect(() => {
    if (!dashboard?.filtros) return;

    setSelectedClienteIds((prev) =>
      prev.filter((id) => dashboard.filtros.clientes.some((cliente) => cliente.id === id)),
    );

    if (
      selectedHaciendaId &&
      !dashboard.filtros.haciendas.some((hacienda) => String(hacienda.id) === selectedHaciendaId)
    ) {
      setSelectedHaciendaId('');
    }

    if (
      selectedProblemaId &&
      !dashboard.filtros.problemas.some((problema) => String(problema.id) === selectedProblemaId)
    ) {
      setSelectedProblemaId('');
    }

    if (selectedMes && !dashboard.filtros.meses.includes(selectedMes)) {
      setSelectedMes('');
    }
  }, [dashboard, selectedHaciendaId, selectedMes, selectedProblemaId]);

  const clientes = dashboard?.filtros?.clientes ?? [];
  const haciendas = dashboard?.filtros?.haciendas ?? [];
  const problemas = dashboard?.filtros?.problemas ?? [];
  const meses = dashboard?.filtros?.meses ?? [];

  const donutData = useMemo(
    () =>
      (dashboard?.pendientes_por_departamento ?? []).map((item) => ({
        name: item.departamento,
        value: Number(item.total ?? 0),
      })),
    [dashboard],
  );

  const stackedData = useMemo(() => {
    const rows = dashboard?.pendientes_por_problema_hacienda ?? [];
    const map = new Map<string, Record<string, number | string>>();

    rows.forEach((row) => {
      const label = row.problema_label?.trim() || 'Sin problema';
      const hacienda = row.hacienda?.trim() || 'Sin hacienda';
      const total = Number(row.total ?? 0);

      if (!map.has(label)) {
        map.set(label, { problema_label: label, total: 0 });
      }

      const entry = map.get(label);
      if (entry) {
        const previous = Number(entry[hacienda] ?? 0);
        entry[hacienda] = previous + total;
        entry.total = Number(entry.total ?? 0) + total;
      }
    });

    return Array.from(map.values());
  }, [dashboard]);

  const haciendaKeys = useMemo(() => {
    const rows = dashboard?.pendientes_por_problema_hacienda ?? [];
    return Array.from(
      new Set(rows.map((row) => row.hacienda?.trim() || 'Sin hacienda')),
    );
  }, [dashboard]);

  const tendenciaData = useMemo(
    () =>
      (dashboard?.tendencia_pendientes_mes ?? []).map((row) => ({
        ...row,
        mes_label: formatMonthLabel(row.mes),
      })),
    [dashboard],
  );

  const totalTablaFallos = useMemo(() => {
    return (dashboard?.tabla_clientes ?? []).reduce(
      (acc, row) => acc + Number(row.num_fallos ?? 0),
      0,
    );
  }, [dashboard]);

  const totalPctFallos = totalTablaFallos > 0 ? 100 : 0;

  const isEmpty =
    !dashboard ||
    (!dashboard.pendientes_por_departamento.length &&
      !dashboard.pendientes_por_problema_hacienda.length &&
      !dashboard.tabla_clientes.length &&
      !dashboard.tendencia_pendientes_mes.length);

  const handleToggleCliente = (id: number) => {
    setSelectedClienteIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length === 0) {
        return [id];
      }
      return [...prev, id];
    });
  };

  const handleToggleTodosClientes = () => {
    setSelectedClienteIds([]);
  };

  const kpis = dashboard?.kpis ?? {
    fallos_reportados: 0,
    t_prom_solucion_dias: 0,
    pct_pendientes: 0,
    pct_resueltos: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_260px]">
        <div className="border border-gray-300 bg-white p-4">
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase text-gray-500">Hacienda</label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={selectedHaciendaId}
              onChange={(event) => setSelectedHaciendaId(event.target.value)}
            >
              <option value="">Todas</option>
              {haciendas.map((hacienda) => (
                <option key={hacienda.id} value={hacienda.id}>
                  {hacienda.nombre}
                </option>
              ))}
            </select>
          </div>
          <h4 className="text-sm font-semibold text-gray-600">CLIENTE</h4>
          <div className="mt-2 space-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedClienteIds.length === 0}
                onChange={handleToggleTodosClientes}
              />
              <span>Todos</span>
            </label>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {clientes.map((cliente) => (
                <label key={cliente.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedClienteIds.includes(cliente.id)}
                    onChange={() => handleToggleCliente(cliente.id)}
                  />
                  <span>{cliente.nombre}</span>
                </label>
              ))}
              {!clientes.length && (
                <p className="text-xs text-gray-400">Sin clientes disponibles.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center border border-gray-300 bg-white px-6 py-4">
          <h2 className="text-center text-xl font-semibold text-[#1C2E4A] md:text-2xl">
            Reporte de fallos técnicos - SW Security World
          </h2>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500">Mes</label>
              <select
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                value={selectedMes}
                onChange={(event) => setSelectedMes(event.target.value)}
              >
                <option value="">Todos</option>
                {meses.map((mes) => (
                  <option key={mes} value={mes}>
                    {formatMonthLabel(mes)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500">
                Problema
              </label>
              <select
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                value={selectedProblemaId}
                onChange={(event) => setSelectedProblemaId(event.target.value)}
              >
                <option value="">Todas</option>
                {problemas.map((problema) => (
                  <option key={problema.id} value={problema.id}>
                    {problema.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Cargando dashboard...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!isLoading && !error && isEmpty && (
        <p className="text-sm text-gray-500">No hay datos disponibles para los filtros.</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {KPI_LABELS.map((kpi) => {
          const value = kpis[kpi.key as keyof typeof kpis] ?? 0;
          let displayValue = formatCompactNumber(Number(value));

          if (kpi.key === 'pct_pendientes' || kpi.key === 'pct_resueltos') {
            displayValue = formatPercent(Number(value));
          }

          if (kpi.key === 't_prom_solucion_dias') {
            displayValue = formatDecimal(Number(value), 2);
          }

          return (
            <div
              key={kpi.key}
              className="border border-gray-300 bg-white px-4 py-3 text-center"
            >
              <p className="text-2xl font-semibold text-gray-800">{displayValue}</p>
              <p className="text-xs font-semibold text-gray-500">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-gray-300 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-600">
            Fallos pendientes por Departamento
          </h4>
          <div className="h-72">
            {donutData.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    // @ts-ignore - recharts label callback params inferred as any in this context
                    label={({ percent }: { percent: number }) => formatPercent(percent * 100)}
                  >
                    {donutData.map((entry, index) => {
                      void entry;
                      return <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatInteger(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="mt-8 text-center text-sm text-gray-400">Sin datos de pendientes.</p>
            )}
          </div>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-600">
            Fallos pendientes por Problema y HACIENDA
          </h4>
          <div className="h-72">
            {stackedData.length ? (
              <ResponsiveContainer>
                <BarChart
                  data={stackedData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatInteger(Number(value))} />
                  <YAxis
                    type="category"
                    dataKey="problema_label"
                    width={160}
                    label={{
                      value: 'Tipo de afectación y problema',
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' },
                    }}
                  />
                  <Tooltip formatter={(value: number) => formatInteger(value)} />
                  <Legend />
                  {haciendaKeys.map((hacienda, index) => {
                    const isLast = index === haciendaKeys.length - 1;
                    return (
                      <Bar
                        key={hacienda}
                        dataKey={hacienda}
                        stackId="pendientes"
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        name={hacienda}
                      >
                        <LabelList
                          dataKey={hacienda}
                          position="center"
                          formatter={(value: number) =>
                            value ? formatInteger(Number(value)) : ''
                          }
                          fill="#fff"
                        />
                        {isLast && (
                          <LabelList
                            dataKey="total"
                            position="right"
                            formatter={(value: number) =>
                              value ? formatInteger(Number(value)) : ''
                            }
                          />
                        )}
                      </Bar>
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="mt-8 text-center text-sm text-gray-400">Sin datos de pendientes.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-gray-300 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-600">Fallos pendientes por Cliente</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-right">T.prom solución (días)</th>
                  <th className="px-3 py-2 text-right">N° fallos</th>
                  <th className="px-3 py-2 text-right">%Fallos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(dashboard?.tabla_clientes ?? []).map((row) => (
                  <tr key={row.cliente}>
                    <td className="px-3 py-2 text-left">{row.cliente}</td>
                    <td className="px-3 py-2 text-right">
                      {row.t_prom_solucion_dias !== null &&
                      row.t_prom_solucion_dias !== undefined
                        ? formatDecimal(Number(row.t_prom_solucion_dias), 2)
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">{formatInteger(row.num_fallos)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(Number(row.pct_fallos))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-gray-600">
                <tr>
                  <td className="px-3 py-2 text-left">Total</td>
                  <td className="px-3 py-2 text-right">
                    {formatDecimal(Number(kpis.t_prom_solucion_dias ?? 0), 2)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatInteger(totalTablaFallos)}</td>
                  <td className="px-3 py-2 text-right">{formatPercent(totalPctFallos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-600">
            %TG Recuento de ID y N° fallos por Mes y Estatus final
          </h4>
          <p className="text-xs text-gray-500">Estatus final: PENDIENTE</p>
          <div className="h-72">
            {tendenciaData.length ? (
              <ResponsiveContainer>
                <ComposedChart data={tendenciaData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes_label" />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => formatInteger(Number(value))}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => formatPercent(Number(value))}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === '%TG' ? formatPercent(Number(value)) : formatInteger(Number(value))
                    }
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="num_fallos"
                    name="N° fallos"
                    fill="#E15759"
                  >
                    <LabelList
                      dataKey="num_fallos"
                      position="top"
                      formatter={(value: number) =>
                        value ? formatInteger(Number(value)) : ''
                      }
                    />
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pct_tg"
                    name="%TG"
                    stroke="#4C6FFF"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="mt-8 text-center text-sm text-gray-400">Sin datos de tendencia.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
