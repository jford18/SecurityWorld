import React from 'react';
import { TechnicalFailure } from '../../types';
import { calcularEstado } from './TechnicalFailuresUtils';

interface TechnicalFailuresHistoryProps {
  failures: TechnicalFailure[];
  isLoading: boolean;
  activeRole: string | undefined;
  handleEdit: (failure: TechnicalFailure) => void;
  selectedId?: string | null;
  actionLabel?: string;
}

const TechnicalFailuresHistory: React.FC<TechnicalFailuresHistoryProps> = ({
  failures,
  isLoading,
  activeRole,
  handleEdit,
  selectedId,
  actionLabel = 'Editar',
}) => {
  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Fallos Recientes</h4>
        {isLoading && <span className="text-sm text-gray-500">Cargando información...</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sitio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsable
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              {activeRole === 'supervisor' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {failures.length === 0 ? (
              <tr>
                <td colSpan={activeRole === 'supervisor' ? 6 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {isLoading ? 'Cargando fallos técnicos...' : 'No hay registros disponibles.'}
                </td>
              </tr>
            ) : (
              failures.map((fallo) => (
                <tr
                  key={fallo.id}
                  className={`hover:bg-gray-50 ${
                    selectedId && selectedId === fallo.id ? 'bg-yellow-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.fecha}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {fallo.descripcion_fallo || 'Sin descripción'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.sitio_nombre || 'Sin sitio asignado'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.responsable}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(() => {
                      const estado = calcularEstado(fallo);
                      return (
                        <span
                          style={{
                            backgroundColor: estado.color,
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.9em',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            minWidth: '110px',
                            textAlign: 'center',
                          }}
                        >
                          {estado.texto}
                        </span>
                      );
                    })()}
                  </td>
                  {activeRole === 'supervisor' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(fallo)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {actionLabel}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TechnicalFailuresHistory;
