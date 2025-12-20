import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EventoPorSitio,
  InformeEventosResponse,
  getEventosPorSitio,
  getInformeMensualEventos,
} from '../../services/reportesEventosService';
import {
  EventoPorHaciendaSitioRow,
  IntrusionConsolidadoFilters,
  getEventosPorHaciendaSitio,
} from '@/services/intrusionesService';
import IntrusionesFilters from '@/components/intrusiones/IntrusionesFilters';
import MapaEventosPorSitio from '../../components/reportes/MapaEventosPorSitio';

const weekdayLabels: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const formatNumber = (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
  if (value === null || value === undefined) {
    return 'N/D';
  }
  return value.toLocaleString('es-MX', options);
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return 'N/D';
  }
  return `${value.toFixed(2)}%`;
};

const formatHourLabel = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

const colorPalette = [
  '#1E40AF',
  '#0EA5E9',
  '#9333EA',
  '#F97316',
  '#22C55E',
  '#EF4444',
  '#F59E0B',
];

interface HaciendaTreeNode {
  key: string;
  haciendaId: number | null;
  haciendaNombre: string;
  totalEventos: number;
  sitios: Array<{
    sitioId: number | null;
    sitioNombre: string;
    totalEventos: number;
  }>;
}

const InformeEventosScreen: React.FC = () => {
  const [filters, setFilters] = useState<IntrusionConsolidadoFilters>({ haciendaId: '' });
  const [data, setData] = useState<InformeEventosResponse | null>(null);
  const [eventosPorSitio, setEventosPorSitio] = useState<EventoPorSitio[]>([]);
  const [eventosPorHaciendaSitio, setEventosPorHaciendaSitio] = useState<HaciendaTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHaciendas, setExpandedHaciendas] = useState<Set<string>>(new Set());

  const buildTreeData = useCallback((rows: EventoPorHaciendaSitioRow[]): HaciendaTreeNode[] => {
    const haciendaMap = new Map<string, HaciendaTreeNode>();

    rows.forEach((row) => {
      const haciendaId = row.hacienda_id ?? null;
      const haciendaNombre = (row.hacienda_nombre ?? 'Sin hacienda').trim() || 'Sin hacienda';
      const sitioId = row.sitio_id ?? null;
      const sitioNombre = (row.sitio_nombre ?? 'Sin sitio').trim() || 'Sin sitio';
      const key = `hacienda-${haciendaId ?? 'sin'}-${haciendaNombre}`;

      const existing = haciendaMap.get(key);
      const totalEventos = Number(row.total_eventos) || 0;

      if (existing) {
        existing.totalEventos += totalEventos;
        const sitioIndex = existing.sitios.findIndex((sitio) => sitio.sitioId === sitioId);
        if (sitioIndex >= 0) {
          existing.sitios[sitioIndex].totalEventos += totalEventos;
        } else {
          existing.sitios.push({ sitioId, sitioNombre, totalEventos });
        }
      } else {
        haciendaMap.set(key, {
          key,
          haciendaId,
          haciendaNombre,
          totalEventos,
          sitios: [{ sitioId, sitioNombre, totalEventos }],
        });
      }
    });

    return Array.from(haciendaMap.values())
      .map((hacienda) => ({
        ...hacienda,
        sitios: hacienda.sitios.sort((a, b) => {
          if (b.totalEventos !== a.totalEventos) {
            return b.totalEventos - a.totalEventos;
          }
          return a.sitioNombre.localeCompare(b.sitioNombre, 'es');
        }),
      }))
      .sort((a, b) => {
        if (b.totalEventos !== a.totalEventos) {
          return b.totalEventos - a.totalEventos;
        }
        return a.haciendaNombre.localeCompare(b.haciendaNombre, 'es');
      });
  }, []);

  const fetchInforme = useCallback(
    async (activeFilters: IntrusionConsolidadoFilters) => {
      setLoading(true);
      setMapLoading(true);
      setError(null);
      try {
        const [response, eventosSitios, eventosHaciendasSitios] = await Promise.all([
          getInformeMensualEventos(activeFilters),
          getEventosPorSitio(activeFilters),
          getEventosPorHaciendaSitio(activeFilters),
        ]);
        setData(response);
        setEventosPorSitio(eventosSitios ?? []);
        const treeData = buildTreeData(eventosHaciendasSitios ?? []);
        setEventosPorHaciendaSitio(treeData);
        setExpandedHaciendas((prev) => {
          if (!treeData.length) {
            return new Set();
          }

          const validKeys = new Set(treeData.map((item) => item.key));
          const next = new Set<string>();

          treeData.forEach((item, index) => {
            if (prev.has(item.key) || (prev.size === 0 && index === 0)) {
              next.add(item.key);
            }
          });

          Array.from(prev).forEach((key) => {
            if (validKeys.has(key)) {
              next.add(key);
            }
          });

          return next;
        });
      } catch (err) {
        console.error('Error al cargar el informe mensual de eventos:', err);
        setError('No se pudo obtener la información. Inténtalo nuevamente.');
      } finally {
        setLoading(false);
        setMapLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchInforme(filters);
  }, [fetchInforme, filters]);

  const resumen = data?.resumen;

  const eventosPorDiaChartData = useMemo(
    () =>
      (data?.porDia ?? []).map((row) => ({
        ...row,
        fechaLabel: row.fecha
          ? new Date(row.fecha).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
            })
          : 'Sin fecha',
      })),
    [data?.porDia],
  );

  const eventosPorDiaSemana = data?.porDiaSemanaTipo ?? [];
  const tiposIntrusionSemana = useMemo(
    () => Array.from(new Set(eventosPorDiaSemana.map((row) => row.tipo_intrusion))),
    [eventosPorDiaSemana],
  );

  const eventosPorDiaSemanaChartData = useMemo(() => {
    const orderedWeekdays = [1, 2, 3, 4, 5, 6, 7];
    return orderedWeekdays.map((day) => {
      const label = weekdayLabels[day] ?? `Día ${day}`;
      const base: Record<string, string | number> = { diaSemana: label };

      tiposIntrusionSemana.forEach((tipo) => {
        base[tipo] = 0;
      });

      eventosPorDiaSemana
        .filter((row) => row.dia_semana === day)
        .forEach((row) => {
          base[row.tipo_intrusion] = (base[row.tipo_intrusion] as number) + row.n_eventos;
        });

      return base;
    });
  }, [eventosPorDiaSemana, tiposIntrusionSemana]);

  const eventosPorHora = data?.porHoraTipo ?? [];
  const tiposIntrusionHora = useMemo(
    () => Array.from(new Set(eventosPorHora.map((row) => row.tipo_intrusion))),
    [eventosPorHora],
  );

  const eventosPorHoraChartData = useMemo(() => {
    const horasOrdenadas = Array.from(new Set(eventosPorHora.map((row) => row.hora))).sort(
      (a, b) => a - b,
    );

    return horasOrdenadas.map((hora) => {
      const base: Record<string, string | number> = { horaLabel: formatHourLabel(hora) };

      tiposIntrusionHora.forEach((tipo) => {
        base[tipo] = 0;
      });

      eventosPorHora
        .filter((row) => row.hora === hora)
        .forEach((row) => {
          base[row.tipo_intrusion] = (base[row.tipo_intrusion] as number) + row.n_eventos;
        });

      return base;
    });
  }, [eventosPorHora, tiposIntrusionHora]);

  const resumenCards = [
    {
      label: 'Total eventos',
      value: resumen ? formatNumber(resumen.total_eventos) : '0',
    },
    {
      label: '% eventos autorizados',
      value: resumen ? formatPercent(resumen.porcentaje_autorizados) : 'N/D',
    },
    {
      label: '% eventos no autorizados',
      value: resumen ? formatPercent(resumen.porcentaje_no_autorizados) : 'N/D',
    },
    {
      label: 'N.º sitios con eventos',
      value: resumen ? formatNumber(resumen.sitios_con_eventos) : '0',
    },
    {
      label: 'T. prom. reacción (min)',
      value: resumen ? formatNumber(resumen.t_prom_reaccion_min, { minimumFractionDigits: 2 }) : 'N/D',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1C2E4A]">Informe mensual de eventos</h1>
        <p className="text-sm text-gray-600 mt-1">
          Consulta el comportamiento de las intrusiones registradas por periodo.
        </p>
      </div>

      <IntrusionesFilters
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => void fetchInforme(filters)}
      />

      {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg">{error}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {resumenCards.map((card) => (
          <article
            key={card.label}
            className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 flex flex-col gap-1"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="text-3xl font-semibold text-[#1C2E4A]">{card.value}</p>
            <p className="text-xs text-gray-500">Eventos en el periodo</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">Eventos por Hacienda y Sitio</h2>
          <div className="space-y-2">
            {eventosPorHaciendaSitio.length ? (
              eventosPorHaciendaSitio.map((hacienda) => {
                const isExpanded = expandedHaciendas.has(hacienda.key);
                return (
                  <div key={hacienda.key} className="border border-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedHaciendas((prev) => {
                          const next = new Set(prev);
                          if (next.has(hacienda.key)) {
                            next.delete(hacienda.key);
                          } else {
                            next.add(hacienda.key);
                          }
                          return next;
                        });
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{isExpanded ? '▼' : '▶'}</span>
                        <span className="font-medium text-[#1C2E4A]">{hacienda.haciendaNombre}</span>
                      </div>
                      <span className="text-sm text-gray-700">{formatNumber(hacienda.totalEventos)}</span>
                    </button>
                    {isExpanded && (
                      <ul className="px-6 pb-3 space-y-1">
                        {hacienda.sitios.length ? (
                          hacienda.sitios.map((sitio) => (
                            <li
                              key={`${hacienda.key}-${sitio.sitioId ?? sitio.sitioNombre}`}
                              className="flex items-center justify-between text-sm text-gray-700"
                            >
                              <span>{sitio.sitioNombre}</span>
                              <span>{formatNumber(sitio.totalEventos)}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-gray-500">Sin sitios registrados.</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 text-center py-6">
                Sin datos para el periodo seleccionado.
              </div>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1C2E4A]">Nº eventos por día</h2>
              <p className="text-sm text-gray-500">Tendencia diaria de eventos registrados.</p>
            </div>
          </div>
          {eventosPorDiaChartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eventosPorDiaChartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="fechaLabel" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('es-MX')} labelFormatter={(label) => `Fecha: ${label}`} />
                  <Legend />
                  <Line type="monotone" dataKey="n_eventos" name="Eventos" stroke="#1E40AF" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-gray-500">
              No hay datos para el periodo seleccionado.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">
            Eventos por día de semana y tipo
          </h2>
          <div className="h-80 mb-4">
            {eventosPorDiaSemanaChartData.length && tiposIntrusionSemana.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventosPorDiaSemanaChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="diaSemana" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name) => [value.toLocaleString('es-MX'), name]}
                    labelFormatter={(label) => `Día: ${label}`}
                  />
                  <Legend />
                  {tiposIntrusionSemana.map((tipo, index) => (
                    <Area
                      key={tipo}
                      type="monotone"
                      dataKey={tipo}
                      name={tipo}
                      stackId="1"
                      stroke={colorPalette[index % colorPalette.length]}
                      fill={colorPalette[index % colorPalette.length]}
                      fillOpacity={0.6}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No hay datos para el periodo seleccionado.
              </div>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">Eventos por hora y tipo</h2>
          <div className="h-80 mb-4">
            {eventosPorHoraChartData.length && tiposIntrusionHora.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eventosPorHoraChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="horaLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name) => [value.toLocaleString('es-MX'), name]}
                    labelFormatter={(label) => `Hora: ${label}`}
                  />
                  <Legend />
                  {tiposIntrusionHora.map((tipo, index) => (
                    <Line
                      key={tipo}
                      type="monotone"
                      dataKey={tipo}
                      name={tipo}
                      stroke={colorPalette[index % colorPalette.length]}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No hay datos para el periodo seleccionado.
              </div>
            )}
          </div>
        </div>
      </section>

      <MapaEventosPorSitio data={eventosPorSitio} loading={mapLoading} />
    </div>
  );
};

export default InformeEventosScreen;
