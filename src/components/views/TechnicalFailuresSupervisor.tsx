import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/components/context/SessionContext';
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
import TechnicalFailuresHistory from './TechnicalFailuresHistory';

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h4 className="text-[#1C2E4A] text-xl font-semibold mb-6">Editar Reporte de Fallo (Supervisor)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dpto. Responsable</label>
            <select
              name="deptResponsable"
              value={editData.deptResponsable || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>
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
            <label className="block text-sm font-medium text-gray-700">
              Responsable Verificación Apertura
            </label>
            <select
              name="verificacionApertura"
              value={editData.verificacionApertura || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Responsable Verificación Cierre
            </label>
            <select
              name="verificacionCierre"
              value={editData.verificacionCierre || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
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
  const { session } = useSession();
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

      <TechnicalFailuresHistory
        failures={failures}
        isLoading={isLoading}
        activeRole={session.roleName?.toLowerCase()}
        handleEdit={handleEdit}
      />

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
