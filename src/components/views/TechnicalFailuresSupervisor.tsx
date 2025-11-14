import React, { useEffect, useMemo, useState } from 'react';
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
  CatalogoDepartamento,
  CatalogoResponsable,
} from '../../types';
import {
  fetchFallos,
  updateFallo,
  fetchCatalogos,
  TechnicalFailurePayload,
} from '../../services/fallosService';
import { calcularEstado } from './TechnicalFailuresUtils';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';

const emptyCatalogos: TechnicalFailureCatalogs = {
  departamentos: [],
  tiposProblema: [],
  responsablesVerificacion: [],
  nodos: [],
  nodoCliente: [],
  tiposEquipo: [],
  tiposProblemaEquipo: [],
  dispositivos: [],
  sitiosPorConsola: [],
};

const EditFailureModal: React.FC<{
  failure: TechnicalFailure;
  departamentos: CatalogoDepartamento[];
  responsables: CatalogoResponsable[];
  onSave: (updatedFailure: TechnicalFailure) => void;
  onClose: () => void;
  isSaving: boolean;
}> = ({ failure, departamentos, responsables, onSave, onClose, isSaving }) => {
  const [editData, setEditData] = useState<TechnicalFailure>(failure);

  useEffect(() => {
    setEditData(failure);
  }, [failure]);

  const updateField = (name: keyof TechnicalFailure, value: string) => {
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    updateField(name as keyof TechnicalFailure, value);
  };

  const departamentoItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...departamentos.map((departamento) => ({
        id: String(departamento.id),
        label: departamento.nombre,
        value: departamento.nombre,
      })),
    ],
    [departamentos]
  );

  const responsableItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...responsables.map((responsable) => ({
        id: String(responsable.id),
        label: responsable.nombre,
        value: responsable.nombre,
      })),
    ],
    [responsables]
  );

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h4 className="text-[#1C2E4A] text-xl font-semibold mb-6">Editar Reporte de Fallo (Supervisor)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <AutocompleteComboBox
              label="Dpto. Responsable"
              value={editData.deptResponsable ?? ''}
              onChange={(value: string) => updateField('deptResponsable', value)}
              items={departamentoItems}
              displayField="label"
              valueField="value"
              placeholder="Buscar departamento..."
              disabled={departamentos.length === 0}
              emptyMessage={departamentos.length === 0 ? 'No hay departamentos disponibles' : 'No se encontraron departamentos'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha Resolución</label>
            <input
              type="date"
              name="fechaResolucion"
              value={editData.fechaResolucion || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hora Resolución</label>
            <input
              type="time"
              name="horaResolucion"
              value={editData.horaResolucion || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Responsable Verificación Apertura"
              value={editData.verificacionApertura ?? ''}
              onChange={(value: string) => updateField('verificacionApertura', value)}
              items={responsableItems}
              displayField="label"
              valueField="value"
              placeholder="Buscar responsable..."
              disabled={responsables.length === 0}
              emptyMessage={responsables.length === 0 ? 'No hay responsables disponibles' : 'No se encontraron responsables'}
            />
          </div>
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Responsable Verificación Cierre"
              value={editData.verificacionCierre ?? ''}
              onChange={(value: string) => updateField('verificacionCierre', value)}
              items={responsableItems}
              displayField="label"
              valueField="value"
              placeholder="Buscar responsable..."
              disabled={responsables.length === 0}
              emptyMessage={responsables.length === 0 ? 'No hay responsables disponibles' : 'No se encontraron responsables'}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Novedad Detectada</label>
            <textarea
              name="novedadDetectada"
              value={editData.novedadDetectada || ''}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            ></textarea>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TechnicalFailuresSupervisor: React.FC = () => {
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFailure, setCurrentFailure] = useState<TechnicalFailure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogData, fallosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
        ]);
        setCatalogos(catalogData);
        setFailures(fallosData);
      } catch (error) {
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información inicial de fallos técnicos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleEdit = (failure: TechnicalFailure) => {
    setCurrentFailure(failure);
    setIsModalOpen(true);
  };

  const handleUpdateFailure = async (updatedFailure: TechnicalFailure) => {
    if (
      updatedFailure.fechaResolucion &&
      new Date(updatedFailure.fechaResolucion) < new Date(updatedFailure.fecha)
    ) {
      alert('La fecha de resolución debe ser igual o posterior a la fecha de fallo.');
      return;
    }

    const payload: TechnicalFailurePayload = {
      fecha: updatedFailure.fecha,
      equipo_afectado: updatedFailure.equipo_afectado,
      descripcion_fallo: updatedFailure.descripcion_fallo,
      responsable: updatedFailure.responsable,
      deptResponsable: updatedFailure.deptResponsable,
      fechaResolucion: updatedFailure.fechaResolucion,
      horaResolucion: updatedFailure.horaResolucion,
      verificacionApertura: updatedFailure.verificacionApertura,
      verificacionCierre: updatedFailure.verificacionCierre,
      novedadDetectada: updatedFailure.novedadDetectada,
    };

    try {
      setIsSubmitting(true);
      const saved = await updateFallo(updatedFailure.id, payload);
      setFailures((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
      setIsModalOpen(false);
      setCurrentFailure(null);
      alert('Reporte actualizado correctamente.');
    } catch (error) {
      console.error('Error al actualizar el fallo técnico:', error);
      alert('No se pudo actualizar el reporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const responsables = useMemo(
    () => catalogos.responsablesVerificacion,
    [catalogos.responsablesVerificacion]
  );

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

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
                  Equipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sitio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo afectación
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    {isLoading ? 'Cargando fallos técnicos...' : 'No hay registros disponibles.'}
                  </td>
                </tr>
              ) : (
                failures.map((fallo) => (
                  <tr key={fallo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.fecha}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {fallo.equipo_afectado}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.sitio_nombre || 'Sin sitio asignado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.tipo_afectacion || 'Sin tipo'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(fallo)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && currentFailure && (
        <EditFailureModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={responsables}
          onSave={handleUpdateFailure}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSubmitting}
        />
      )}
    </div>
  );
};

export default TechnicalFailuresSupervisor;
