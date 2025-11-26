import React from 'react';
import { TechnicalFailure } from '../../types';
import { calcularEstado } from './TechnicalFailuresUtils';

const formatFechaHoraFallo = (failure: TechnicalFailure) => {
  const horaFallo = failure.hora ?? failure.horaFallo;
  const dateTimeCandidate = failure.fechaHoraFallo
    || (failure.fecha
      ? `${failure.fecha}${horaFallo ? `T${horaFallo}` : ''}`
      : '');

  if (!dateTimeCandidate) {
    return '';
  }

  if (!dateTimeCandidate.includes('T')) {
    return dateTimeCandidate;
  }

  const parsed = new Date(dateTimeCandidate);

  if (Number.isNaN(parsed.getTime())) {
    return dateTimeCandidate.replace('T', ' ').replace('Z', '');
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

interface TechnicalFailuresHistoryProps {
  failures: TechnicalFailure[];
  isLoading: boolean;
  activeRole: string | undefined;
  handleEdit: (failure: TechnicalFailure) => void;
}

const TechnicalFailuresHistory: React.FC<TechnicalFailuresHistoryProps> = ({
  failures,
  isLoading,
  activeRole,
  handleEdit,
}) => {
  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Fallos Recientes</h4>
        {isLoading && <span className="text-sm text-gray-500">Cargando información...</span>}
      </div>
      <div className="overflow-x-auto relative">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Equipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsable
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              {activeRole === 'supervisor' && (
                <th
                  scope="col"
                  className="sticky right-0 bg-white z-20 px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ACCIONES
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
                <tr key={fallo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFechaHoraFallo(fallo) || 'Sin información'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {fallo.equipo_afectado}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fallo.descripcion_fallo}
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
                    <td className="sticky right-0 bg-white z-10 px-4 py-2 text-right">
                      <button
                        onClick={() => handleEdit(fallo)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Editar
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
