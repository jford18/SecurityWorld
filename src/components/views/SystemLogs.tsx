import React, { useMemo, useState } from 'react';
import { alertsData } from '../../data/mockData';
import { Alert } from '../../types';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';

type Tab = 'creadas' | 'aceptadas' | 'ignoradas';

const AlertTable: React.FC<{ alerts: Alert[] }> = ({ alerts }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipo</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo de Alerta</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {alerts.map((alert) => (
          <tr key={alert.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{alert.equipo}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.tipo}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(alert.fecha).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SystemLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('creadas');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'creadas', label: 'Alertas Creadas' },
    { id: 'aceptadas', label: 'Alertas Aceptadas' },
    { id: 'ignoradas', label: 'Alertas Ignoradas' },
  ];

  const tabItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione una pestaña', value: '' },
      ...tabs.map((tab) => ({ id: tab.id, label: tab.label, value: tab.id })),
    ],
    [tabs]
  );

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Logs del Sistema y Alertas</h3>
      
      <div className="mt-8">
        <div className="sm:hidden">
          <AutocompleteComboBox
            label="Selecciona una pestaña"
            value={activeTab}
            onChange={(value: string) => {
              if (value) {
                setActiveTab(value as Tab);
              }
            }}
            items={tabItems}
            displayField="label"
            valueField="value"
            placeholder="Buscar pestaña..."
          />
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-[#F9C300] text-[#1C2E4A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
        {activeTab === 'creadas' && <AlertTable alerts={alertsData.creadas} />}
        {activeTab === 'aceptadas' && <AlertTable alerts={alertsData.aceptadas} />}
        {activeTab === 'ignoradas' && <AlertTable alerts={alertsData.ignoradas} />}
      </div>
    </div>
  );
};

export default SystemLogs;