import React, { useState, useMemo, useEffect } from 'react';
import Card from '../ui/Card';
import { getEvents, getControlledEvents, getCameras } from '../../services/hikcentralService';
import { HikEvent, HikCamera } from '../../types';

interface ShiftMetrics {
  total: number;
  falseAlerts: number;
  trueAlerts: number;
  uncategorized: number;
  alertsPerMinute: string;
  avgAttentionTime: string;
  activeCameras: number;
  events: HikEvent[];
}

const SHIFT_DURATION_MINUTES = 480; // 8 hours * 60 minutes

const calculateDurationInMinutes = (start: string, end: string): number => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) {
    return 0;
  }
  return (endTime - startTime) / (1000 * 60);
};

const AlertsReportByShift: React.FC = () => {
  const [activeShift, setActiveShift] = useState<number>(1);

  // State for handling async data
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<HikEvent[]>([]);
  const [controlledEventIds, setControlledEventIds] = useState<string[]>([]);
  const [cameras, setCameras] = useState<HikCamera[]>([]);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [eventList, controlList, camList] = await Promise.all([
          getEvents(),
          getControlledEvents(),
          getCameras(),
        ]);

        setAllEvents(eventList);
        setControlledEventIds(controlList);
        setCameras(camList);
      } catch (e) {
        console.error(e);
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError("Ocurrió un error inesperado al cargar los datos.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array ensures this runs once on component mount

  const shiftMetrics = useMemo<ShiftMetrics>(() => {
    const activeCameras = cameras.filter(cam => cam.status === 1).length;
    const processedEventIds = new Set(controlledEventIds);

    const shiftEvents = allEvents.filter(event => {
      const eventHour = new Date(event.startTime).getUTCHours();
      switch (activeShift) {
        case 1: return eventHour >= 7 && eventHour < 15;
        case 2: return eventHour >= 15 && eventHour < 23;
        case 3: return eventHour >= 23 || eventHour < 7;
        default: return false;
      }
    });

    const total = shiftEvents.length;
    const falseAlerts = shiftEvents.filter(e => e.eventType === "131329").length;
    const trueAlerts = shiftEvents.filter(e => e.eventType === "131330").length;
    const uncategorized = total - (falseAlerts + trueAlerts);
    const alertsPerMinute = total > 0 ? (total / SHIFT_DURATION_MINUTES).toFixed(3) : '0.000';
    
    const processedEventsInShift = shiftEvents.filter(event => 
      processedEventIds.has(event.eventIndexCode)
    );
    
    const totalAttentionTime = processedEventsInShift.reduce((acc, event) => {
        return acc + calculateDurationInMinutes(event.startTime, event.stopTime);
    }, 0);

    const avgAttentionTime = processedEventsInShift.length > 0 
      ? (totalAttentionTime / processedEventsInShift.length).toFixed(2) 
      : '0.00';

    return {
      total,
      falseAlerts,
      trueAlerts,
      uncategorized,
      alertsPerMinute,
      avgAttentionTime,
      activeCameras,
      events: shiftEvents,
    };
  }, [activeShift, allEvents, cameras, controlledEventIds]);

  const kpiData = [
    { title: "Alertas Categorizadas", value: shiftMetrics.total, color: "bg-blue-100 text-blue-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
    { title: "Alertas Falsas", value: shiftMetrics.falseAlerts, color: "bg-yellow-100 text-yellow-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg> },
    { title: "Alertas Verdaderas", value: shiftMetrics.trueAlerts, color: "bg-green-100 text-green-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { title: "Alertas no Categorizadas", value: shiftMetrics.uncategorized, color: "bg-gray-100 text-gray-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { title: "Alertas por Minuto", value: shiftMetrics.alertsPerMinute, color: "bg-indigo-100 text-indigo-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { title: "TPA (minutos)", value: shiftMetrics.avgAttentionTime, color: "bg-purple-100 text-purple-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { title: "Cámaras Activas", value: shiftMetrics.activeCameras, color: "bg-pink-100 text-pink-600", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
  ];

  const shifts = [
    { id: 1, label: 'Turno 1 (07:00 - 15:00)' },
    { id: 2, label: 'Turno 2 (15:00 - 23:00)' },
    { id: 3, label: 'Turno 3 (23:00 - 07:00)' },
  ];
  
  const renderContent = () => {
    if (loading) {
      return <p className="mt-8 text-center text-gray-500">Cargando datos del Mock Server...</p>;
    }
    if (error) {
      return <p className="mt-8 text-center text-red-600 font-semibold p-4 bg-red-100 rounded-md">Error: {error}</p>;
    }
    return (
      <>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
            {kpiData.map(kpi => <Card key={kpi.title} {...kpi} />)}
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Detalle de Eventos del Turno</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Evento</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fin</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración (min)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidencia</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shiftMetrics.events.map((event) => (
                    <tr key={event.eventIndexCode} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.eventType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span>{event.description}</span>
                          {controlledEventIds.includes(event.eventIndexCode) && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <title>Procesado</title>
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.srcIndex}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(event.startTime).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(event.stopTime).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{calculateDurationInMinutes(event.startTime, event.stopTime).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={event.eventPicUri}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </>
    );
  };

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Reporte de Alertas por Turno</h3>

      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {shifts.map((shift) => (
            <button
              key={shift.id}
              onClick={() => setActiveShift(shift.id)}
              className={`${
                activeShift === shift.id
                  ? 'border-[#F9C300] text-[#1C2E4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
            >
              {shift.label}
            </button>
          ))}
        </nav>
      </div>
      
      {renderContent()}

    </div>
  );
};

export default AlertsReportByShift;