import React, { useEffect, useMemo, useState } from 'react';
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
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
import { useSession } from '../context/SessionContext';
import {
  DepartamentoResponsable,
  getAllDepartamentosResponsables,
} from '../../services/departamentosResponsablesService';

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

const toInputDateTimeValue = (value?: string, fallback?: string) => {
  const source = value ?? fallback;
  if (!source) {
    return '';
  }
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - tzOffset);
  return localDate.toISOString().slice(0, 16);
};

const toIsoString = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const getDatePart = (value?: string) => {
  if (!value) return undefined;
  const [datePart] = value.split('T');
  return datePart;
};

const formatDateTimeDisplay = (value?: string, fallback?: string) => {
  const source = value ?? fallback;
  if (!source) return '';
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const normalizeFailureForEdit = (failure: TechnicalFailure): TechnicalFailure => {
  let normalizedFechaHora = failure.fechaHoraFallo;
  if (!normalizedFechaHora && failure.fecha) {
    const fallbackDate = new Date(failure.fecha);
    if (!Number.isNaN(fallbackDate.getTime())) {
      normalizedFechaHora = fallbackDate.toISOString();
    }
  }
  return {
    ...failure,
    fechaHoraFallo: normalizedFechaHora,
    responsableVerificacionApertura:
      failure.responsableVerificacionApertura ?? failure.verificacionApertura,
    responsableVerificacionCierre:
      failure.responsableVerificacionCierre ?? failure.verificacionCierre,
  };
};

const EditFailureModal: React.FC<{
  failure: TechnicalFailure;
  departamentos: DepartamentoResponsable[];
  responsables: CatalogoResponsable[];
  currentUserName?: string | null;
  onSave: (updatedFailure: TechnicalFailure) => void;
  onClose: () => void;
  isSaving: boolean;
}> = ({ failure, departamentos, responsables, currentUserName, onSave, onClose, isSaving }) => {
  const [editData, setEditData] = useState<TechnicalFailure>(normalizeFailureForEdit(failure));

  useEffect(() => {
    setEditData(normalizeFailureForEdit(failure));
  }, [failure]);

  useEffect(() => {
    if (
      editData.fechaResolucion &&
      currentUserName &&
      !(editData.responsableVerificacionCierre || editData.verificacionCierre)
    ) {
      setEditData((prev) => ({
        ...prev,
        responsableVerificacionCierre: currentUserName,
        verificacionCierre: currentUserName,
      }));
    }
  }, [editData.fechaResolucion, editData.responsableVerificacionCierre, editData.verificacionCierre, currentUserName]);

  const updateField = (
    name: keyof TechnicalFailure,
    value: string | number | null | undefined,
  ) => {
    setEditData((prev) => ({ ...prev, [name]: value ?? undefined }));
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
        value: String(departamento.id),
        nombre: departamento.nombre,
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

  const handleFechaHoraFalloChange = (value: string) => {
    const isoValue = toIsoString(value);
    setEditData((prev) => ({
      ...prev,
      fechaHoraFallo: isoValue,
      fecha: isoValue ? getDatePart(isoValue) ?? prev.fecha : prev.fecha,
    }));
  };

  const handleDepartamentoChange = (value: string) => {
    updateField(
      'departamentoResponsableId',
      value ? Number(value) : null,
    );
  };

  const handleDepartamentoSelect = (item: { nombre?: string; label?: string } | undefined) => {
    updateField('deptResponsable', item?.nombre ?? item?.label ?? '');
  };

  const handleResponsableAperturaChange = (value: string) => {
    setEditData((prev) => ({
      ...prev,
      responsableVerificacionApertura: value || undefined,
      verificacionApertura: value || undefined,
    }));
  };

  const handleResponsableCierreChange = (value: string) => {
    setEditData((prev) => ({
      ...prev,
      responsableVerificacionCierre: value || undefined,
      verificacionCierre: value || undefined,
    }));
  };

  const handleSave = () => {
    const normalized: TechnicalFailure = {
      ...editData,
      fecha: editData.fechaHoraFallo ? getDatePart(editData.fechaHoraFallo) ?? editData.fecha : editData.fecha,
    };
    onSave(normalized);
  };

  const fechaHoraFalloInputValue = useMemo(
    () => toInputDateTimeValue(editData.fechaHoraFallo, editData.fecha),
    [editData.fechaHoraFallo, editData.fecha]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h4 className="text-[#1C2E4A] text-xl font-semibold mb-6">Editar Reporte de Fallo (Supervisor)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Fecha hora de fallo</label>
            <input
              type="datetime-local"
              name="fechaHoraFallo"
              value={fechaHoraFalloInputValue}
              onChange={(event) => handleFechaHoraFalloChange(event.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div>
            <AutocompleteComboBox
              label="Departamento Responsable"
              value={
                editData.departamentoResponsableId != null
                  ? String(editData.departamentoResponsableId)
                  : ''
              }
              onChange={handleDepartamentoChange}
              onItemSelect={handleDepartamentoSelect}
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
              value={
                editData.responsableVerificacionApertura ?? editData.verificacionApertura ?? ''
              }
              onChange={handleResponsableAperturaChange}
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
              value={
                editData.responsableVerificacionCierre ?? editData.verificacionCierre ?? ''
              }
              onChange={handleResponsableCierreChange}
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
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [departamentosResponsables, setDepartamentosResponsables] = useState<DepartamentoResponsable[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFailure, setCurrentFailure] = useState<TechnicalFailure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogData, fallosData, departamentosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
          getAllDepartamentosResponsables(),
        ]);
        setCatalogos(catalogData);
        setFailures(fallosData);
        setDepartamentosResponsables(departamentosData);
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
    const fechaResolucionDate = updatedFailure.fechaResolucion
      ? new Date(updatedFailure.fechaResolucion)
      : null;
    const fechaFalloDate = updatedFailure.fechaHoraFallo
      ? new Date(updatedFailure.fechaHoraFallo)
      : updatedFailure.fecha
      ? new Date(updatedFailure.fecha)
      : null;

    if (
      fechaResolucionDate &&
      fechaFalloDate &&
      fechaResolucionDate < fechaFalloDate
    ) {
      alert('La fecha de resolución debe ser igual o posterior a la fecha de fallo.');
      return;
    }

    const fechaPayload =
      updatedFailure.fechaHoraFallo
        ? getDatePart(updatedFailure.fechaHoraFallo) ?? updatedFailure.fecha
        : updatedFailure.fecha;
    const responsableApertura =
      updatedFailure.responsableVerificacionApertura ?? updatedFailure.verificacionApertura;
    const responsableCierre =
      updatedFailure.responsableVerificacionCierre ?? updatedFailure.verificacionCierre;

    const payload: TechnicalFailurePayload = {
      fecha: fechaPayload || updatedFailure.fecha || '',
      fechaHoraFallo: updatedFailure.fechaHoraFallo,
      equipo_afectado:
        updatedFailure.descripcionEquipo || updatedFailure.equipo_afectado || 'Sin descripción',
      descripcionEquipo:
        updatedFailure.descripcionEquipo || updatedFailure.descripcion_fallo || undefined,
      descripcion_fallo: updatedFailure.descripcion_fallo,
      responsable: updatedFailure.responsable,
      deptResponsable: updatedFailure.deptResponsable,
      departamentoResponsableId: updatedFailure.departamentoResponsableId ?? null,
      fechaResolucion: updatedFailure.fechaResolucion,
      horaResolucion: updatedFailure.horaResolucion,
      verificacionApertura: responsableApertura,
      verificacionCierre: responsableCierre,
      responsableVerificacionApertura: responsableApertura,
      responsableVerificacionCierre: responsableCierre,
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
                  Fecha hora de fallo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTimeDisplay(fallo.fechaHoraFallo, fallo.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {fallo.descripcionEquipo || fallo.descripcion_fallo || fallo.equipo_afectado}
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
          departamentos={departamentosResponsables}
          responsables={responsables}
          currentUserName={session.user}
          onSave={handleUpdateFailure}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSubmitting}
        />
      )}
    </div>
  );
};

export default TechnicalFailuresSupervisor;
