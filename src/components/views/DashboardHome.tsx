import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { deviceInventoryData, alertsData, technicalFailuresData } from '../../data/mockData';

// Recharts is loaded from a CDN, so we need to handle its asynchronous loading.

const DashboardHome: React.FC = () => {
  const [recharts, setRecharts] = useState<any>(null);

  useEffect(() => {
    // Poll for the Recharts library on the window object.
    const intervalId = setInterval(() => {
      if ((window as any).Recharts) {
        setRecharts((window as any).Recharts);
        clearInterval(intervalId);
      }
    }, 100);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  const onlineDevices = deviceInventoryData.filter(d => d.estado === 'online').length;
  const offlineDevices = deviceInventoryData.length - onlineDevices;
  const activeAlerts = alertsData.creadas.length + alertsData.aceptadas.length;
  const resolvedFailures = technicalFailuresData.filter(
    f =>
      f.deptResponsable &&
      f.fechaResolucion &&
      f.horaResolucion &&
      f.verificacionApertura &&
      f.verificacionCierre &&
      f.novedadDetectada,
  ).length;

  const pieData = [
    { name: 'Online', value: onlineDevices },
    { name: 'Offline', value: offlineDevices },
  ];
  const PIE_COLORS = ['#34D399', '#EF4444'];

  const barData = [
    { name: 'Pérdida de señal', count: alertsData.creadas.filter(a => a.tipo === 'Pérdida de señal').length },
    { name: 'Intrusión', count: alertsData.aceptadas.filter(a => a.tipo === 'Intrusión').length },
    { name: 'Batería baja', count: alertsData.creadas.filter(a => a.tipo === 'Batería baja').length },
    { name: 'Obstrucción', count: alertsData.aceptadas.filter(a => a.tipo.includes('Obstrucción')).length },
  ];

  const recentLogs = [
    ...alertsData.creadas,
    ...alertsData.aceptadas,
    ...alertsData.ignoradas
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 5);

  // Destructure components from the recharts state object once it's loaded
  const { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = recharts || {};

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Resumen del Sistema</h3>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Dispositivos Online" value={onlineDevices} color="bg-blue-100 text-blue-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7l4-4m0 0l4 4m-4-4v18" /></svg>} />
        <Card title="Dispositivos Offline" value={offlineDevices} color="bg-red-100 text-red-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>} />
        <Card title="Alertas Activas" value={activeAlerts} color="bg-yellow-100 text-yellow-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} />
        <Card title="Fallos Resueltos" value={resolvedFailures} color="bg-green-100 text-green-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Estado de Dispositivos</h4>
          <div className="h-80">
            {recharts ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    // @ts-ignore - recharts label callback params inferred as any in this context
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => {
                      void entry; // eslint-disable-line @typescript-eslint/no-unused-expressions
                      return <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
                <div className="flex justify-center items-center h-full text-gray-500">Cargando gráfico...</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
           <h4 className="text-[#1C2E4A] text-lg font-semibold">Alertas por Tipo</h4>
           <div className="h-80">
            {recharts ? (
             <ResponsiveContainer>
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#F9C300" name="Cantidad" />
                </BarChart>
             </ResponsiveContainer>
             ) : (
                <div className="flex justify-center items-center h-full text-gray-500">Cargando gráfico...</div>
            )}
           </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Últimos Registros</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Evento</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.equipo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.tipo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.fecha).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

    </div>
  );
};

export default DashboardHome;