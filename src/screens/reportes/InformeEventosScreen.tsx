import React, { FormEvent, useEffect, useMemo, useState } from 'react';
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
import MapaEventosPorSitio from '../../components/reportes/MapaEventosPorSitio';

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const defaultRange = (() => {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
})();

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

const InformeEventosScreen: React.FC = () => {
  const [fechaInicio, setFechaInicio] = useState(defaultRange.start);
  const [fechaFin, setFechaFin] = useState(defaultRange.end);
  const [data, setData] = useState<InformeEventosResponse | null>(null);
  const [eventosPorSitio, setEventosPorSitio] = useState<EventoPorSitio[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInforme = async (inicio: string, fin: string) => {
    setLoading(true);
    setMapLoading(true);
    setError(null);
    try {
      const [response, eventosSitios] = await Promise.all([
        getInformeMensualEventos(inicio, fin),
        getEventosPorSitio(inicio, fin),
      ]);
      setData(response);
      setEventosPorSitio(eventosSitios ?? []);
    } catch (err) {
      console.error('Error al cargar el informe mensual de eventos:', err);
      setError('No se pudo obtener la información. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
      setMapLoading(false);
    }
  };

  useEffect(() => {
    void fetchInforme(defaultRange.start, defaultRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!fechaInicio || !fechaFin) {
      setError('Selecciona el rango de fechas para consultar.');
      return;
    }
    void fetchInforme(fechaInicio, fechaFin);
  };

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

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-4 flex flex-wrap items-end gap-4"
      >
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="fechaInicio" className="block text-sm font-medium text-[#1C2E4A]">
            Fecha inicio
          </label>
          <input
            id="fechaInicio"
            type="date"
            value={fechaInicio}
            onChange={(event) => setFechaInicio(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="fechaFin" className="block text-sm font-medium text-[#1C2E4A]">
            Fecha fin
          </label>
          <input
            id="fechaFin"
            type="date"
            value={fechaFin}
            onChange={(event) => setFechaFin(event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-[#1C2E4A] text-white rounded-md shadow hover:bg-[#15233A] disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

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
          <h2 className="text-lg font-semibold text-[#1C2E4A] mb-4">Tipos de intrusión</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tipo de intrusión
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Nº eventos
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Nº sitios con eventos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.porTipo?.length ? (
                  data.porTipo.map((row, index) => (
                    <tr key={row.tipo} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.tipo}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-700">
                        {row.n_eventos.toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-700">
                        {row.n_sitios_con_evento.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">
                      Sin datos para el periodo seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Día
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tipo de intrusión
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Nº eventos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.porDiaSemanaTipo?.length ? (
                  data.porDiaSemanaTipo.map((row, index) => (
                    <tr
                      key={`${row.dia_semana}-${row.tipo_intrusion}-${index}`}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {weekdayLabels[row.dia_semana] ?? `Día ${row.dia_semana}`}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.tipo_intrusion}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-700">
                        {row.n_eventos.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">
                      Sin datos para el periodo seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Hora
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tipo de intrusión
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Nº eventos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.porHoraTipo?.length ? (
                  data.porHoraTipo.map((row, index) => (
                    <tr
                      key={`${row.hora}-${row.tipo_intrusion}-${index}`}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-2 text-sm text-gray-700">{formatHourLabel(row.hora)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.tipo_intrusion}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-700">
                        {row.n_eventos.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">
                      Sin datos para el periodo seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <MapaEventosPorSitio data={eventosPorSitio} loading={mapLoading} />
    </div>
  );
};

export default InformeEventosScreen;
