import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TablaDepartamentosArbolRow,
  fetchDashboardFallosTecnicosResumen,
} from '../../services/dashboardFallosTecnicosService';
import DashboardFiltersHeader, { DashboardHeaderFilters } from './DashboardFiltersHeader';

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

const CHART_CARD_STYLE = { contain: 'layout paint', transform: 'translateZ(0)' };
const STACKED_CHART_MARGIN = { top: 10, right: 30, left: 20, bottom: 10 };
const TENDENCIA_CHART_MARGIN = { top: 10, right: 30, left: 0, bottom: 10 };
const STACKED_Y_AXIS_LABEL = {
  value: 'Tipo de afectación y problema',
  angle: -90,
  position: 'insideLeft',
  style: { textAnchor: 'middle' as const },
};

type DonutDatum = {
  name: string;
  value: number;
};

type StackedDatum = Record<string, number | string> & {
  problema_label: string;
  total?: number;
};

type TendenciaDatum = {
  mes: string;
  mes_label: string;
  num_fallos: number;
  t_prom_solucion_dias: number;
};

type DepartamentosArbolTipo = 'DEPARTAMENTO' | 'CLIENTE' | 'HACIENDA' | 'SITIO';

type DepartamentosArbolNode = {
  key: string;
  tipo: DepartamentosArbolTipo;
  nombre: string;
  pendientes: number;
  resueltos: number;
  sumDiasSolucion: number;
  countResueltos: number;
  children: DepartamentosArbolNode[];
};

type DepartamentosArbolRow = {
  key: string;
  tipo: DepartamentosArbolTipo;
  nombre: string;
  pendientes: number;
  resueltos: number;
  pctResueltos: number;
  tprom: number | null;
  level: number;
  hasChildren: boolean;
};

const INDENT_SIZE = 16;

const DonutChart = React.memo(({ data }: { data: DonutDatum[] }) => {
  if (!data.length) {
    return <p className="mt-8 text-center text-sm text-gray-400">Sin datos de pendientes.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%" debounce={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            isAnimationActive={false}
            // @ts-ignore - recharts label callback params inferred as any in this context
            label={({ percent }: { percent: number }) => formatPercent(percent * 100)}
          >
            {data.map((entry, index) => {
              void entry;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              );
            })}
          </Pie>
          <Tooltip formatter={(value: number) => formatInteger(Number(value))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});

DonutChart.displayName = 'DonutChart';

const StackedBarChartCard = React.memo(
  ({ data, haciendaKeys }: { data: StackedDatum[]; haciendaKeys: string[] }) => {
    if (!data.length) {
      return <p className="mt-8 text-center text-sm text-gray-400">Sin datos de pendientes.</p>;
    }

    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%" debounce={250}>
          <BarChart data={data} layout="vertical" margin={STACKED_CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => formatInteger(Number(value))} />
            <YAxis
              type="category"
              dataKey="problema_label"
              width={160}
              label={STACKED_Y_AXIS_LABEL}
            />
            <Tooltip formatter={(value: number) => formatInteger(Number(value))} />
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
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={hacienda}
                    position="center"
                    formatter={(value: number) => (value ? formatInteger(Number(value)) : '')}
                    fill="#fff"
                  />
                  {isLast && (
                    <LabelList
                      dataKey="total"
                      position="right"
                      formatter={(value: number) => (value ? formatInteger(Number(value)) : '')}
                    />
                  )}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

StackedBarChartCard.displayName = 'StackedBarChartCard';

const TendenciaChart = React.memo(({ data }: { data: TendenciaDatum[] }) => {
  if (!data.length) {
    return <p className="mt-8 text-center text-sm text-gray-400">Sin datos de tendencia.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%" debounce={250}>
        <ComposedChart data={data} margin={TENDENCIA_CHART_MARGIN}>
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
            tickFormatter={(value) => formatDecimal(Number(value))}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'T. prom solución (días)') {
                return formatDecimal(Number(value));
              }
              return formatInteger(Number(value));
            }}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="num_fallos"
            name="N° fallos"
            fill="#E15759"
            isAnimationActive={false}
          >
            <LabelList
              dataKey="num_fallos"
              position="top"
              formatter={(value: number) => (value ? formatInteger(Number(value)) : '')}
            />
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="t_prom_solucion_dias"
            name="T. prom solución (días)"
            stroke="#4C6FFF"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

TendenciaChart.displayName = 'TendenciaChart';

const DashboardHome: React.FC = () => {
  if (import.meta.env.DEV) {
    console.count('[DASHBOARD_RENDER]');
  }
  const { session } = useSession();
  const [dashboard, setDashboard] = useState<DashboardFallosTecnicosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerFilters, setHeaderFilters] = useState<DashboardHeaderFilters>({
    clienteId: '',
    reportadoCliente: '',
    consolaId: '',
    haciendaId: '',
    tipoProblemaId: '',
    tipoAfectacion: '',
  });
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string>('');
  const didInitFiltersRef = useRef(false);

  const filtersKey = useMemo(() => {
    return [
      headerFilters.consolaId ?? '',
      headerFilters.clienteId ?? '',
      headerFilters.reportadoCliente ?? '',
      headerFilters.haciendaId ?? '',
      headerFilters.tipoProblemaId ?? '',
      headerFilters.tipoAfectacion ?? '',
      fechaDesde ?? '',
      fechaHasta ?? '',
    ].join('|');
  }, [fechaDesde, fechaHasta, headerFilters]);

  useEffect(() => {
    let isMounted = true;

    const loadConsola = async () => {
      const consoleName = session.console ?? localStorage.getItem('selectedConsole');
      if (!consoleName) {
        return;
      }

      try {
        const resolvedId = await resolveConsolaIdByName(consoleName);
        if (!isMounted) return;
        if (resolvedId) {
          setHeaderFilters((prev) =>
            prev.consolaId ? prev : { ...prev, consolaId: String(resolvedId) },
          );
        }
      } catch (err) {
        console.error('Error resolviendo consola:', err);
      }
    };

    loadConsola();

    return () => {
      isMounted = false;
    };
  }, [session.console]);

  useEffect(() => {
    if (lastFetchKeyRef.current === filtersKey) return;

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setDateRangeError('La fecha "DESDE" no puede ser mayor que la fecha "HASTA".');
      setIsLoading(false);
      return;
    }

    setDateRangeError(null);
    lastFetchKeyRef.current = filtersKey;

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    const consolaIdValue = headerFilters.consolaId ? Number(headerFilters.consolaId) : null;
    const clienteIdValue = headerFilters.clienteId ? Number(headerFilters.clienteId) : null;
    const haciendaIdValue = headerFilters.haciendaId ? Number(headerFilters.haciendaId) : null;

    fetchDashboardFallosTecnicosResumen({
      clienteId: clienteIdValue,
      reportadoCliente: headerFilters.reportadoCliente || null,
      haciendaId: haciendaIdValue,
      fechaDesde: fechaDesde || null,
      fechaHasta: fechaHasta || null,
      tipoProblemaId: headerFilters.tipoProblemaId
        ? Number(headerFilters.tipoProblemaId)
        : null,
      tipoAfectacion: headerFilters.tipoAfectacion || null,
      consolaId: consolaIdValue,
      signal: controller.signal,
    })
      .then((response) => setDashboard(response))
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.name === 'CanceledError') {
          return;
        }
        console.error('Error al cargar dashboard de fallos técnicos:', err);
        setError('No se pudo cargar el dashboard de fallos técnicos.');
        setDashboard(null);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [fechaDesde, fechaHasta, filtersKey, headerFilters]);

  useEffect(() => {
    if (!dashboard?.filtros) return;

    setHeaderFilters((prev) => {
      const next = { ...prev };
      if (
        prev.clienteId &&
        !dashboard.filtros.clientes.some((cliente) => String(cliente.id) === prev.clienteId)
      ) {
        next.clienteId = '';
      }

      if (
        prev.haciendaId &&
        !dashboard.filtros.haciendas.some((hacienda) => String(hacienda.id) === prev.haciendaId)
      ) {
        next.haciendaId = '';
      }

      if (
        prev.tipoProblemaId &&
        !dashboard.filtros.problemas.some(
          (problema) => String(problema.id) === prev.tipoProblemaId,
        )
      ) {
        next.tipoProblemaId = '';
      }

      return next;
    });
  }, [dashboard]);

  useEffect(() => {
    if (didInitFiltersRef.current) return;
    if (!dashboard) return;

    didInitFiltersRef.current = true;
  }, [dashboard]);

  const problemas = dashboard?.filtros?.problemas ?? [];
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

  const departamentosArbol = useMemo<DepartamentosArbolNode[]>(() => {
    const rows: TablaDepartamentosArbolRow[] = dashboard?.tabla_departamentos_arbol ?? [];

    if (!rows.length) {
      return [];
    }

    const nodes = new Map<string, DepartamentosArbolNode>();
    const roots: DepartamentosArbolNode[] = [];

    const makeKey = (
      tipo: DepartamentosArbolTipo,
      id: number | null,
      parentKey: string | null,
      nombre: string,
    ) => `${tipo}:${parentKey ?? 'root'}:${id ?? 'null'}:${nombre}`;

    const getNode = (
      key: string,
      create: () => DepartamentosArbolNode,
      parent: DepartamentosArbolNode | null,
    ) => {
      const existing = nodes.get(key);
      if (existing) {
        return existing;
      }
      const node = create();
      nodes.set(key, node);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
      return node;
    };

    rows.forEach((row) => {
      const departamentoNombre = row.departamento_nombre?.trim() || 'Sin departamento';
      const clienteNombre = row.cliente_nombre?.trim() || 'Sin cliente';
      const haciendaNombre = row.hacienda_nombre?.trim() || 'Sin hacienda';
      const sitioNombre = row.sitio_nombre?.trim() || 'Sin sitio';

      const departamentoKey = makeKey(
        'DEPARTAMENTO',
        row.departamento_id,
        null,
        departamentoNombre,
      );
      const departamentoNode = getNode(
        departamentoKey,
        () => ({
          key: departamentoKey,
          tipo: 'DEPARTAMENTO',
          nombre: departamentoNombre,
          pendientes: 0,
          resueltos: 0,
          sumDiasSolucion: 0,
          countResueltos: 0,
          children: [],
        }),
        null,
      );

      const clienteKey = makeKey(
        'CLIENTE',
        row.cliente_id,
        departamentoKey,
        clienteNombre,
      );
      const clienteNode = getNode(
        clienteKey,
        () => ({
          key: clienteKey,
          tipo: 'CLIENTE',
          nombre: clienteNombre,
          pendientes: 0,
          resueltos: 0,
          sumDiasSolucion: 0,
          countResueltos: 0,
          children: [],
        }),
        departamentoNode,
      );

      const haciendaKey = makeKey(
        'HACIENDA',
        row.hacienda_id,
        clienteKey,
        haciendaNombre,
      );
      const haciendaNode = getNode(
        haciendaKey,
        () => ({
          key: haciendaKey,
          tipo: 'HACIENDA',
          nombre: haciendaNombre,
          pendientes: 0,
          resueltos: 0,
          sumDiasSolucion: 0,
          countResueltos: 0,
          children: [],
        }),
        clienteNode,
      );

      const sitioKey = makeKey('SITIO', row.sitio_id, haciendaKey, sitioNombre);
      const sitioNode = getNode(
        sitioKey,
        () => ({
          key: sitioKey,
          tipo: 'SITIO',
          nombre: sitioNombre,
          pendientes: 0,
          resueltos: 0,
          sumDiasSolucion: 0,
          countResueltos: 0,
          children: [],
        }),
        haciendaNode,
      );

      sitioNode.pendientes = Number(row.fallos_pendientes ?? 0);
      sitioNode.resueltos = Number(row.fallos_resueltos ?? 0);
      sitioNode.sumDiasSolucion = Number(row.sum_dias_solucion ?? 0);
      sitioNode.countResueltos = Number(row.count_resueltos ?? 0);
    });

    const aggregateNode = (node: DepartamentosArbolNode) => {
      if (!node.children.length) {
        return {
          pendientes: node.pendientes,
          resueltos: node.resueltos,
          sumDiasSolucion: node.sumDiasSolucion,
          countResueltos: node.countResueltos,
        };
      }

      const totals = node.children.reduce(
        (acc, child) => {
          const childTotals = aggregateNode(child);
          return {
            pendientes: acc.pendientes + childTotals.pendientes,
            resueltos: acc.resueltos + childTotals.resueltos,
            sumDiasSolucion: acc.sumDiasSolucion + childTotals.sumDiasSolucion,
            countResueltos: acc.countResueltos + childTotals.countResueltos,
          };
        },
        { pendientes: 0, resueltos: 0, sumDiasSolucion: 0, countResueltos: 0 },
      );

      node.pendientes = totals.pendientes;
      node.resueltos = totals.resueltos;
      node.sumDiasSolucion = totals.sumDiasSolucion;
      node.countResueltos = totals.countResueltos;

      return totals;
    };

    roots.forEach((root) => aggregateNode(root));

    const sortNodes = (node: DepartamentosArbolNode) => {
      node.children.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      node.children.forEach((child) => sortNodes(child));
    };

    roots.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    roots.forEach((root) => sortNodes(root));

    return roots;
  }, [dashboard]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [dashboard?.tabla_departamentos_arbol]);

  const handleToggleNode = useCallback((key: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const departamentosArbolRows = useMemo<DepartamentosArbolRow[]>(() => {
    const rows: DepartamentosArbolRow[] = [];

    const walk = (node: DepartamentosArbolNode, level: number) => {
      const total = node.pendientes + node.resueltos;
      const pctResueltos = total > 0 ? (node.resueltos / total) * 100 : 0;
      const tprom =
        node.countResueltos > 0 ? node.sumDiasSolucion / node.countResueltos : null;
      const hasChildren = node.children.length > 0;

      rows.push({
        key: node.key,
        tipo: node.tipo,
        nombre: node.nombre,
        pendientes: node.pendientes,
        resueltos: node.resueltos,
        pctResueltos,
        tprom,
        level,
        hasChildren,
      });

      if (hasChildren && expandedNodes.has(node.key)) {
        node.children.forEach((child) => walk(child, level + 1));
      }
    };

    departamentosArbol.forEach((node) => walk(node, 0));

    return rows;
  }, [departamentosArbol, expandedNodes]);

  const totalsTablaDepartamentosArbol = useMemo(() => {
    return departamentosArbol.reduce(
      (acc, node) => {
        return {
          pendientes: acc.pendientes + node.pendientes,
          resueltos: acc.resueltos + node.resueltos,
          sumDiasSolucion: acc.sumDiasSolucion + node.sumDiasSolucion,
          countResueltos: acc.countResueltos + node.countResueltos,
        };
      },
      { pendientes: 0, resueltos: 0, sumDiasSolucion: 0, countResueltos: 0 },
    );
  }, [departamentosArbol]);

  const totalPctResueltos =
    totalsTablaDepartamentosArbol.pendientes + totalsTablaDepartamentosArbol.resueltos > 0
      ? (totalsTablaDepartamentosArbol.resueltos /
          (totalsTablaDepartamentosArbol.pendientes +
            totalsTablaDepartamentosArbol.resueltos)) *
        100
      : 0;

  const totalTpromArbol =
    totalsTablaDepartamentosArbol.countResueltos > 0
      ? totalsTablaDepartamentosArbol.sumDiasSolucion /
        totalsTablaDepartamentosArbol.countResueltos
      : null;

  const isEmpty =
    !dashboard ||
    (!dashboard.pendientes_por_departamento.length &&
      !dashboard.pendientes_por_problema_hacienda.length &&
      !dashboard.tabla_departamentos.length &&
      !dashboard.tabla_departamentos_arbol.length &&
      !dashboard.tendencia_pendientes_mes.length);

  const handleHeaderFilterChange = useCallback(
    (field: keyof DashboardHeaderFilters, value: string) => {
      setHeaderFilters((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleClearHeaderFilters = useCallback(() => {
    setHeaderFilters({
      clienteId: '',
      reportadoCliente: '',
      consolaId: '',
      haciendaId: '',
      tipoProblemaId: '',
      tipoAfectacion: '',
    });
    setFechaDesde('');
    setFechaHasta('');
  }, []);

  const kpis = dashboard?.kpis ?? {
    fallos_reportados: 0,
    t_prom_solucion_dias: 0,
    pct_pendientes: 0,
    pct_resueltos: 0,
  };

  return (
    <div className="space-y-6">
      <DashboardFiltersHeader
        filters={headerFilters}
        onFilterChange={handleHeaderFilterChange}
        onClear={handleClearHeaderFilters}
        problemas={problemas}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">
        <div className="flex items-start justify-center border border-gray-300 bg-white px-6 py-4">
          <h2 className="text-center text-xl font-semibold text-[#1C2E4A] md:text-2xl">
            Reporte de fallos técnicos - SW Security World
          </h2>
        </div>

        <div className="border border-gray-300 bg-white p-4">
          <div className="space-y-4">
            <div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  <span className="block text-xs font-semibold uppercase text-gray-500">
                    Desde
                  </span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={fechaDesde}
                    onChange={(event) => setFechaDesde(event.target.value)}
                  />
                </label>
                <label className="text-sm text-gray-700">
                  <span className="block text-xs font-semibold uppercase text-gray-500">
                    Hasta
                  </span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={fechaHasta}
                    onChange={(event) => setFechaHasta(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {dateRangeError && (
        <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          {dateRangeError}
        </div>
      )}
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
              style={CHART_CARD_STYLE}
            >
              <p className="text-2xl font-semibold text-gray-800">{displayValue}</p>
              <p className="text-xs font-semibold text-gray-500">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-gray-300 bg-white p-4" style={CHART_CARD_STYLE}>
          <h4 className="text-sm font-semibold text-gray-600">
            Fallos pendientes por Departamento
          </h4>
          <DonutChart data={donutData} />
        </div>

        <div className="border border-gray-300 bg-white p-4" style={CHART_CARD_STYLE}>
          <h4 className="text-sm font-semibold text-gray-600">
            Fallos pendientes por Problema y HACIENDA
          </h4>
          <StackedBarChartCard data={stackedData} haciendaKeys={haciendaKeys} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="border border-gray-300 bg-white p-4" style={CHART_CARD_STYLE}>
          <h4 className="text-sm font-semibold text-gray-600">Fallos por Departamento</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-right">Fallos pendientes</th>
                  <th className="px-3 py-2 text-right">Fallos resueltos</th>
                  <th className="px-3 py-2 text-right">% Fallos resueltos</th>
                  <th className="px-3 py-2 text-right">T.prom solución (días)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departamentosArbolRows.map((row) => {
                  const arrow = row.hasChildren
                    ? expandedNodes.has(row.key)
                      ? '▾'
                      : '▸'
                    : '';
                  return (
                    <tr key={row.key}>
                      <td className="px-3 py-2 text-left">
                        <div
                          className="flex items-center"
                          style={{ paddingLeft: row.level * INDENT_SIZE }}
                        >
                          {row.hasChildren ? (
                            <button
                              type="button"
                              onClick={() => handleToggleNode(row.key)}
                              className="mr-2 inline-flex h-5 w-5 items-center justify-center text-gray-600 hover:text-gray-900"
                              aria-label={`${
                                expandedNodes.has(row.key) ? 'Colapsar' : 'Expandir'
                              } ${row.nombre}`}
                            >
                              {arrow}
                            </button>
                          ) : (
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center text-gray-300">
                              ▸
                            </span>
                          )}
                          <span>{row.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatInteger(Number(row.pendientes ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatInteger(Number(row.resueltos ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {Number(row.pctResueltos ?? 0).toFixed(2)} %
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.tprom !== null && row.tprom !== undefined
                          ? Number(row.tprom).toFixed(2)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-gray-600">
                <tr>
                  <td className="px-3 py-2 text-left">Total</td>
                  <td className="px-3 py-2 text-right">
                    {formatInteger(totalsTablaDepartamentosArbol.pendientes)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatInteger(totalsTablaDepartamentosArbol.resueltos)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {totalPctResueltos.toFixed(2)} %
                  </td>
                  <td className="px-3 py-2 text-right">
                    {totalTpromArbol !== null ? Number(totalTpromArbol).toFixed(2) : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="border border-gray-300 bg-white p-4" style={CHART_CARD_STYLE}>
          <h4 className="text-sm font-semibold text-gray-600">
            T. prom solución (días) y N° fallos por mes y estatus final
          </h4>
          <p className="text-xs text-gray-500">Estatus final: PENDIENTE</p>
          <TendenciaChart data={tendenciaData} />
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
