import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
  CatalogoDepartamento,
  CatalogoResponsable,
} from '../../types';
import DateTimeInput, {
  buildDateTimeLocalValue,
  normalizeDateTimeLocalString,
  splitDateTimeLocalValue,
} from '../ui/DateTimeInput';
import {
  fetchFallos,
  fetchCatalogos,
  getFalloHistorial,
  getFalloHistorialDepartamentos,
  deleteFallo,
  guardarCambiosFallo,
  cerrarFallo,
} from '../../services/fallosService';
import { useSession } from '../context/SessionContext';
import { getAllDepartamentosResponsables } from '../../services/departamentosResponsablesService';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import { calcularEstado } from './TechnicalFailuresUtils';
import {
  FailureDepartmentTimelineEntry,
  FailureHistory,
  FailureHistoryEntry,
} from '../../types';

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

const findDepartamentoIdByName = (
  departamentos: CatalogoDepartamento[],
  nombre?: string,
) => {
  if (!nombre) {
    return undefined;
  }
  const normalized = nombre.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const matched = departamentos.find((departamento) => {
    return departamento.nombre?.trim().toLowerCase() === normalized;
  });
  return matched ? String(matched.id) : undefined;
};

const findResponsableIdByName = (
  responsables: CatalogoResponsable[],
  nombre?: string,
) => {
  if (!nombre) {
    return undefined;
  }
  const normalized = nombre.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const matched = responsables.find((responsable) => {
    return responsable.nombre?.trim().toLowerCase() === normalized;
  });
  return matched ? String(matched.id) : undefined;
};

const toPositiveIntegerOrNull = (value?: string | number | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildFailureDateTimeValue = (failure: TechnicalFailure) => {
  if (failure.fechaHoraFallo) {
    return failure.fechaHoraFallo;
  }
  if (failure.fecha) {
    const horaFallo = failure.hora ?? failure.horaFallo;
    return horaFallo ? `${failure.fecha}T${horaFallo}` : failure.fecha;
  }
  return undefined;
};

const formatFechaHoraDisplay = (
  dateTime?: string,
  fallbackDate?: string,
  fallbackTime?: string,
) => {
  const candidate =
    dateTime ||
    (fallbackDate
      ? `${fallbackDate}${fallbackTime ? `T${fallbackTime}` : ''}`
      : '');

  if (!candidate) {
    return '';
  }

  if (!candidate.includes('T')) {
    return candidate;
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return candidate.replace('T', ' ').replace('Z', '');
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatDurationFromSeconds = (duration?: number | null) => {
  if (!duration || duration <= 0) {
    return '00:00:00';
  }
  const totalSeconds = Math.floor(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`;
};

  const EditFailureModal: React.FC<{
    failure: TechnicalFailure;
    departamentos: CatalogoDepartamento[];
  responsables: CatalogoResponsable[];
  onSave: (updatedFailure: TechnicalFailure) => void;
  onCloseFallo: (updatedFailure: TechnicalFailure) => void;
  onDeleteFallo?: (failureId: string) => void;
  onClose: () => void;
  isSaving: boolean;
  currentUserName?: string | null;
  history?: FailureHistory | null;
  departmentTimeline?: FailureDepartmentTimelineEntry[];
  departmentTimelineError?: string | null;
  historyError?: string | null;
  isHistoryLoading?: boolean;
  isAdmin?: boolean;
}> = ({
  failure,
  departamentos,
  responsables,
  onSave,
  onCloseFallo,
  onDeleteFallo,
  onClose,
  isSaving,
  currentUserName,
  history,
  departmentTimeline = [],
  departmentTimelineError,
  historyError,
  isHistoryLoading,
  isAdmin = false,
}) => {
  const normalizeFailure = useCallback(
    (failureToNormalize: TechnicalFailure) => {
      const fechaHoraResolucionInicial =
        failureToNormalize.fechaHoraResolucion ??
        buildDateTimeLocalValue(
          failureToNormalize.fechaResolucion,
          failureToNormalize.horaResolucion,
        );
      const fechaHoraResolucionNormalizada =
        normalizeDateTimeLocalString(fechaHoraResolucionInicial) ||
        fechaHoraResolucionInicial;

      const departamentoId =
        failureToNormalize.departamentoResponsableId ??
        findDepartamentoIdByName(departamentos, failureToNormalize.deptResponsable);
      const aperturaId =
        failureToNormalize.verificacionAperturaId ??
        findResponsableIdByName(responsables, failureToNormalize.verificacionApertura);
      let cierreId =
        failureToNormalize.verificacionCierreId ??
        findResponsableIdByName(responsables, failureToNormalize.verificacionCierre);
      let cierreNombre = failureToNormalize.verificacionCierre;

      const responsableVerificacionCierreId = toPositiveIntegerOrNull(
        failureToNormalize.responsable_verificacion_cierre_id,
      );

      if (!cierreId && currentUserName) {
        const matched = responsables.find(
          (responsable) =>
            responsable.nombre?.trim().toLowerCase() ===
            currentUserName.trim().toLowerCase(),
        );
        if (matched) {
          cierreId = String(matched.id);
          cierreNombre = matched.nombre;
        }
      }

      return {
        ...failureToNormalize,
        fechaHoraResolucion: fechaHoraResolucionNormalizada,
        fechaHoraFallo:
          failureToNormalize.fechaHoraFallo ??
          buildFailureDateTimeValue(failureToNormalize) ??
          failureToNormalize.fecha,
        departamentoResponsableId: departamentoId ?? '',
        verificacionAperturaId: aperturaId ?? '',
        verificacionCierreId: cierreId ?? '',
        verificacionCierre: cierreNombre,
        responsable_verificacion_cierre_id: responsableVerificacionCierreId,
        responsable_verificacion_cierre_nombre:
          failureToNormalize.responsable_verificacion_cierre_nombre ?? null,
      };
    },
    [departamentos, responsables, currentUserName],
  );

  const [editData, setEditData] = useState<TechnicalFailure>(() =>
    normalizeFailure(failure),
  );
  const [formErrors, setFormErrors] = useState<{
    departamentoResponsableId?: string;
    novedadDetectada?: string;
  }>({});
  const [activeTab, setActiveTab] = useState<
    'general' | 'supervisor' | 'cierre'
  >('general');

  const isClosed = (failure.estado || '').toUpperCase() === 'CERRADO';
  const isReadOnly = isClosed;
  const canDelete = isReadOnly && isAdmin;

  useEffect(() => {
    setEditData(normalizeFailure(failure));
    setFormErrors({});
    setActiveTab('general');
  }, [failure, normalizeFailure]);

  const updateField = (name: keyof TechnicalFailure, value: string | undefined) => {
    setEditData((prev) => ({ ...prev, [name]: value }));
    if (name === 'departamentoResponsableId' || name === 'novedadDetectada') {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    updateField(name as keyof TechnicalFailure, value);
  };

  const handleResolutionChange = (
    value: string | null,
    helpers: { isoString: string | null; dateValue: Date | null },
  ) => {
    if (isReadOnly) return;
    const updatedValue = value ?? '';
    const parsedDateTime = helpers.dateValue ?? (updatedValue ? new Date(updatedValue) : null);
    const normalizedValue =
      normalizeDateTimeLocalString(updatedValue) ||
      (parsedDateTime && !Number.isNaN(parsedDateTime.getTime())
        ? normalizeDateTimeLocalString(parsedDateTime.toISOString())
        : '');
    const { date, time } = splitDateTimeLocalValue(normalizedValue || updatedValue);
    setEditData((prev) => ({
      ...prev,
      fechaHoraResolucion: normalizedValue || updatedValue || undefined,
      fechaResolucion: date,
      horaResolucion: time,
      responsable_verificacion_cierre_nombre:
        updatedValue && currentUserName
          ? currentUserName
          : prev.responsable_verificacion_cierre_nombre,
    }));
  };

  const nowForInput = useMemo(
    () => normalizeDateTimeLocalString(new Date().toISOString()),
    [],
  );

  const fechaHoraReporte = useMemo(() => {
    const combined = buildFailureDateTimeValue(editData);
    return formatFechaHoraDisplay(
      combined,
      editData.fecha,
      editData.hora ?? editData.horaFallo,
    );
  }, [editData.fechaHoraFallo, editData.fecha, editData.hora, editData.horaFallo]);

  const fechaHoraFalloDisplay = fechaHoraReporte || 'Sin información';

  const departamentoResponsableNombre = useMemo(() => {
    return (
      editData.deptResponsable ||
      departamentos.find(
        (departamento) => String(departamento.id) === editData.departamentoResponsableId,
      )?.nombre ||
      ''
    );
  }, [departamentos, editData.deptResponsable, editData.departamentoResponsableId]);

  const tieneDepartamentoResponsable = useMemo(() => {
    if (editData.departamentoResponsableId) return true;
    if (editData.deptResponsable && editData.deptResponsable.trim() !== '') return true;
    return false;
  }, [editData.departamentoResponsableId, editData.deptResponsable]);

  const handleSave = () => {
    onSave(editData);
  };

  const esCierre = Boolean(editData.fechaResolucion && editData.horaResolucion);

  const handlePrimaryAction = () => {
    if (esCierre) {
      handleCloseFallo();
      return;
    }
    handleSave();
  };

  const handleCloseFallo = () => {
    if (isReadOnly) return;
    const errors: {
      departamentoResponsableId?: string;
      novedadDetectada?: string;
    } = {};
    const departamentoId = toPositiveIntegerOrNull(editData.departamentoResponsableId);
    const novedad = editData.novedadDetectada?.trim() ?? '';

    if (!departamentoId) {
      errors.departamentoResponsableId = 'Debe seleccionar el departamento responsable.';
    }

    if (!novedad) {
      errors.novedadDetectada = 'Debe ingresar la novedad detectada.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setActiveTab('supervisor');
      return;
    }

    onCloseFallo(editData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 mb-4">
        <h4 className="text-[#1C2E4A] text-xl font-semibold">
          Editar Reporte de Fallo (Supervisor)
        </h4>
        <p className="text-sm text-gray-500">
          Actualiza la información del reporte seleccionado sin perder de vista el historial.
        </p>
        {isReadOnly && (
          <p className="text-sm text-red-600 font-semibold">
            Este fallo se encuentra cerrado y no puede ser modificado.
          </p>
        )}
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Tabs">
          {[
            { id: 'general' as const, label: 'Datos generales' },
            { id: 'supervisor' as const, label: 'Verificación Supervisor' },
            { id: 'cierre' as const, label: 'Conclusión de caso' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-[#F9C300] text-[#1C2E4A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora de fallo
            </label>
            <input
              type="text"
              value={fechaHoraFalloDisplay}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de afectación
            </label>
            <input
              type="text"
              value={
                editData.tipo_afectacion || editData.tipoAfectacion || 'Sin información'
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Problema</label>
            <input
              type="text"
              value={editData.descripcion_fallo || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio</label>
            <input
              type="text"
              value={editData.sitio_nombre || editData.sitioNombre || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsable inicial
            </label>
            <input
              type="text"
              value={editData.responsable || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Último usuario que editó
            </label>
            <input
              type="text"
              value={editData.ultimo_usuario_edito_nombre || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Novedad detectada
            </label>
            <textarea
              value={editData.novedadDetectada || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              rows={3}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departamento responsable
            </label>
            <input
              type="text"
              value={departamentoResponsableNombre || 'Sin información'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              disabled
            />
          </div>
        </div>
      )}

      {activeTab === 'supervisor' && (
        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departamento responsable
            </label>
            <select
              name="departamentoResponsableId"
              value={editData.departamentoResponsableId ?? ''}
              onChange={(e) => {
                const { value, options, selectedIndex } = e.target;
                const selectedLabel = options[selectedIndex]?.text ?? '';
                setEditData((prev) => ({
                  ...prev,
                  departamentoResponsableId: value,
                  deptResponsable: selectedLabel,
                }));
                setFormErrors((prev) => ({
                  ...prev,
                  departamentoResponsableId: undefined,
                }));
              }}
              disabled={isReadOnly}
              className={`w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 ${
                formErrors.departamentoResponsableId
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            >
              <option value="">Seleccione...</option>
              {departamentos.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.nombre}
                </option>
              ))}
            </select>
            {formErrors.departamentoResponsableId && (
              <p className="mt-1 text-xs text-red-500">
                {formErrors.departamentoResponsableId}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Novedad detectada
            </label>
            <textarea
              name="novedadDetectada"
              value={editData.novedadDetectada || ''}
              onChange={handleChange}
              disabled={isReadOnly}
              className={`w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 ${
                formErrors.novedadDetectada
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
              rows={4}
            />
            {formErrors.novedadDetectada && (
              <p className="mt-1 text-xs text-red-500">{formErrors.novedadDetectada}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cierre' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <DateTimeInput
              label="Fecha y Hora Resolución"
              name="fechaHoraResolucion"
              value={editData.fechaHoraResolucion || ''}
              onChange={handleResolutionChange}
              max={nowForInput}
              disabled={isReadOnly}
              className="disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Responsable Verificación Cierre</label>
            <input
              type="text"
              readOnly
              disabled
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
              value={
                editData.responsable_verificacion_cierre_nombre &&
                editData.responsable_verificacion_cierre_nombre.trim()
                  ? editData.responsable_verificacion_cierre_nombre
                  : 'Sin información'
              }
            />
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h5 className="text-md font-semibold text-[#1C2E4A] mb-2">Historial del fallo</h5>
        {isHistoryLoading && <p className="text-sm text-gray-500">Cargando historial...</p>}
        {historyError && !isHistoryLoading && (
          <p className="text-sm text-red-600">{historyError}</p>
        )}
        {history && !isHistoryLoading && (
          <div className="space-y-2 text-sm text-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold">Departamento responsable: </span>
                {history.departamento_responsable || editData.deptResponsable || 'Sin información'}
              </div>
              <div>
                <span className="font-semibold">Fecha/Hora de creación: </span>
                {formatFechaHoraDisplay(
                  history.fecha ?? undefined,
                  undefined,
                  history.hora ?? undefined,
                ) || 'Sin información'}
              </div>
              <div>
                <span className="font-semibold">Fecha/Hora de resolución: </span>
                {formatFechaHoraDisplay(
                  history.fecha_resolucion ?? undefined,
                  history.fecha_resolucion || editData.fechaResolucion,
                  history.hora_resolucion || editData.horaResolucion,
                ) || 'Sin información'}
              </div>
              <div>
                <span className="font-semibold">Duración total: </span>
                {history.duracionTexto || 'Sin información'}
              </div>
            </div>
            <div className="mt-4">
              <p className="font-semibold mb-2">Tiempo asignado por departamento</p>
              {departmentTimelineError && (
                <p className="text-sm text-red-600">{departmentTimelineError}</p>
              )}
              {!departmentTimelineError && departmentTimeline.length === 0 && (
                <p className="text-sm text-gray-500">Sin información registrada.</p>
              )}
              {!departmentTimelineError && departmentTimeline.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Departamento</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Desde</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Hasta</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Duración</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departmentTimeline.map((entry, index) => (
                        <tr key={`${entry.departamento_id}-${entry.fecha_inicio}-${index}`}>
                          <td className="px-3 py-2 text-gray-700">
                            {entry.departamento_nombre || 'Sin información'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatFechaHoraDisplay(entry.fecha_inicio || undefined) || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatFechaHoraDisplay(entry.fecha_fin || undefined) || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatDurationFromSeconds(entry.duracion_seg)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {Array.isArray(history.acciones) && history.acciones.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold mb-2">Acciones registradas</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Verificación apertura</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Verificación cierre</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Novedad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {history.acciones.map((accion: FailureHistoryEntry) => (
                        <tr key={accion.id}>
                          <td className="px-3 py-2 text-gray-700">
                            {formatFechaHoraDisplay(accion.fecha_creacion || undefined) || 'Sin información'}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{accion.verificacion_apertura || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{accion.verificacion_cierre || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{accion.novedad_detectada || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 md:flex-row md:justify-end">
        <div className="flex gap-4 justify-end flex-wrap">
          {canDelete && onDeleteFallo && (
            <button
              onClick={() => onDeleteFallo(failure.id)}
              disabled={isSaving}
              className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              Eliminar
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          {!isReadOnly && (
            <button
              onClick={handlePrimaryAction}
              disabled={isSaving}
              className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Procesando...' : 'Guardar cambios'}
            </button>
          )}
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
  const [history, setHistory] = useState<FailureHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [departmentTimeline, setDepartmentTimeline] = useState<
    FailureDepartmentTimelineEntry[]
  >([]);
  const [departmentTimelineError, setDepartmentTimelineError] = useState<string | null>(
    null,
  );

  const responsables = useMemo(
    () => catalogos.responsablesVerificacion,
    [catalogos.responsablesVerificacion],
  );

  const roleContext = useMemo(
    () => ({
      roleId: session.roleId ?? session.activeRoleId ?? null,
      roleName: session.roleName ?? null,
    }),
    [session.roleId, session.activeRoleId, session.roleName],
  );

  const isAdmin = useMemo(() => {
    const role = (session.roleName || '').toLowerCase();
    return role.includes('admin') || role.includes('supervisor');
  }, [session.roleName]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const departamentosPromise = getAllDepartamentosResponsables().catch(
          (error) => {
            console.error(
              'Error al cargar los departamentos responsables:',
              error,
            );
            return [] as CatalogoDepartamento[];
          },
        );

        const [catalogData, fallosData, departamentosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
          departamentosPromise,
        ]);

        const departamentosActualizados =
          departamentosData.length > 0
            ? departamentosData
            : catalogData.departamentos;

        setCatalogos({ ...catalogData, departamentos: departamentosActualizados });
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

  const loadHistory = useCallback(
    async (failureId: string) => {
      setIsHistoryLoading(true);
      setHistory(null);
      setHistoryError(null);
      setDepartmentTimeline([]);
      setDepartmentTimelineError(null);
      try {
        const [historyResult, departmentResult] = await Promise.allSettled([
          getFalloHistorial(failureId, roleContext),
          getFalloHistorialDepartamentos(failureId, roleContext),
        ]);

        if (historyResult.status === 'fulfilled') {
          setHistory(historyResult.value);
        } else {
          console.error('Error al cargar el historial del fallo:', historyResult.reason);
          setHistoryError('No se pudo cargar el historial del fallo.');
        }

        if (departmentResult.status === 'fulfilled') {
          setDepartmentTimeline(departmentResult.value);
        } else {
          console.error(
            'Error al cargar el historial por departamento:',
            departmentResult.reason,
          );
          setDepartmentTimelineError(
            'No se pudo cargar el historial por departamento.',
          );
        }
      } catch (error) {
        console.error('Error al cargar el historial del fallo:', error);
        setHistoryError('No se pudo cargar el historial del fallo.');
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [roleContext],
  );

  const handleEdit = (failure: TechnicalFailure) => {
    setCurrentFailure(failure);
    setIsModalOpen(true);
    loadHistory(failure.id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentFailure(null);
  };

  const resolveDepartamentoId = useCallback(
    (updatedFailure: TechnicalFailure) => {
      const idFromState = toPositiveIntegerOrNull(updatedFailure.departamentoResponsableId);
      if (idFromState) return idFromState;

      const resolvedFromName = findDepartamentoIdByName(
        catalogos.departamentos,
        updatedFailure.deptResponsable,
      );

      return toPositiveIntegerOrNull(resolvedFromName);
    },
    [catalogos.departamentos],
  );

  const resolveResolutionDateTime = (updatedFailure: TechnicalFailure) => {
    const resolutionSource =
      updatedFailure.fechaHoraResolucion ||
      (updatedFailure.fechaResolucion && updatedFailure.horaResolucion
        ? `${updatedFailure.fechaResolucion}T${updatedFailure.horaResolucion}`
        : undefined);

    return splitDateTimeLocalValue(resolutionSource);
  };

  const handleUpdateFailure = useCallback(
    async (updatedFailure: TechnicalFailure) => {
      const departamentoId = resolveDepartamentoId(updatedFailure);
      const novedad = updatedFailure.novedadDetectada?.trim() || null;

      try {
        const values = updatedFailure as any;
        console.log(
          "[Supervisor Edit] Guardar cambios - valores del formulario:",
          values,
        );
        console.log(
          "[Supervisor Edit] Guardar cambios - responsableVerificacionCierreId:",
          values.responsableVerificacionCierreId,
        );
        console.log(
          "[Supervisor Edit] Guardar cambios - usuario en localStorage['user']:",
          localStorage.getItem("user"),
        );
        setIsSubmitting(true);
        console.log("[Supervisor] Guardar cambios, payload enviado:", {
          departamento_id: departamentoId,
          novedad_detectada: novedad,
        });
        const saved = await guardarCambiosFallo(
          updatedFailure.id,
          {
            departamento_id: departamentoId,
            novedad_detectada: novedad,
          },
          roleContext,
        );
        setFailures((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
        setCurrentFailure(saved);
        await loadHistory(saved.id);
        alert('Reporte actualizado correctamente.');
      } catch (error) {
        console.error('Error al actualizar el fallo técnico:', error);
        const message = (error as any)?.response?.data?.mensaje || 'No se pudo actualizar el reporte.';
        alert(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadHistory, resolveDepartamentoId, roleContext],
  );

  const handleCloseFailure = useCallback(
    async (updatedFailure: TechnicalFailure) => {
      const { date: resolutionDate, time: resolutionTime } =
        resolveResolutionDateTime(updatedFailure);

      if (!resolutionDate || !resolutionTime) {
        alert('Debe ingresar la fecha y hora de resolución antes de cerrar el fallo.');
        return;
      }

      const departamentoId = resolveDepartamentoId(updatedFailure);
      const novedad = updatedFailure.novedadDetectada?.trim() || null;
      const responsableVerificacionCierreId =
        updatedFailure.responsable_verificacion_cierre_id ??
        (updatedFailure as any).responsableVerificacionCierreId ??
        null;

      try {
        const values = updatedFailure as any;
        console.log(
          "[Supervisor Edit] Cerrar fallo - valores del formulario:",
          values,
        );
        console.log(
          "[Supervisor Edit] Cerrar fallo - responsableVerificacionCierreId:",
          values.responsableVerificacionCierreId,
        );
        console.log(
          "[Supervisor Edit] Cerrar fallo - usuario en localStorage['user']:",
          localStorage.getItem("user"),
        );
        setIsSubmitting(true);
        console.log("[Supervisor] Payload cerrar fallo:", {
          fecha_resolucion: resolutionDate,
          hora_resolucion: resolutionTime,
          departamento_id: departamentoId,
          novedad_detectada: novedad,
          responsable_verificacion_cierre_id: responsableVerificacionCierreId,
        });
        const saved = await cerrarFallo(
          updatedFailure.id,
          {
            fecha_resolucion: resolutionDate,
            hora_resolucion: resolutionTime,
            departamento_id: departamentoId,
            novedad_detectada: novedad,
            responsable_verificacion_cierre_id: responsableVerificacionCierreId,
          },
          roleContext,
        );
        setFailures((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
        setCurrentFailure(saved);
        await loadHistory(saved.id);
        alert('Fallo cerrado correctamente.');
      } catch (error) {
        console.error('Error al cerrar el fallo técnico:', error);
        const message = (error as any)?.response?.data?.mensaje || 'No se pudo cerrar el reporte.';
        alert(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadHistory, resolveResolutionDateTime, roleContext],
  );

  const handleDeleteFailure = async (failureId: string) => {
    const confirmed = window.confirm(
      '¿Está seguro de eliminar este fallo cerrado? Esta acción no se puede deshacer.',
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);
      await deleteFallo(failureId, roleContext);
      setFailures((prev) => prev.filter((f) => f.id !== failureId));
      setIsModalOpen(false);
      setCurrentFailure(null);
      alert('Fallo eliminado correctamente.');
    } catch (error) {
      console.error('Error al eliminar el fallo técnico:', error);
      const message = (error as any)?.response?.data?.mensaje || 'No se pudo eliminar el fallo.';
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolvedFailure = (failure: TechnicalFailure) => {
    const estadoBase =
      failure.estado
      ?? failure.estado_texto
      ?? calcularEstado(failure).texto
      ?? '';
    const estadoNorm = String(estadoBase).trim().toUpperCase();
    return estadoNorm === 'RESUELTO' || estadoNorm.startsWith('RESUELT');
  };


  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <TechnicalFailuresHistory
          failures={failures}
          isLoading={isLoading}
          activeRole={session.roleName ?? undefined}
          renderActions={(failure) => {
            if (isResolvedFailure(failure)) {
              return null;
            }

            return (
              <button
                onClick={() => handleEdit(failure)}
                className="text-blue-600 hover:underline text-sm font-semibold"
              >
                Editar
              </button>
            );
          }}
        />
      </div>

      {isModalOpen && currentFailure && (
        <EditTechnicalFailureSupervisorModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={responsables}
          onSave={handleUpdateFailure}
          onCloseFallo={handleCloseFailure}
          onDeleteFallo={handleDeleteFailure}
          onClose={handleCloseModal}
          isSaving={isSubmitting}
          currentUserName={session.user}
          history={history}
          departmentTimeline={departmentTimeline}
          departmentTimelineError={departmentTimelineError}
          historyError={historyError}
          isHistoryLoading={isHistoryLoading}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

const EditTechnicalFailureSupervisorModal: React.FC<{
  failure: TechnicalFailure;
  departamentos: CatalogoDepartamento[];
  responsables: CatalogoResponsable[];
  onSave: (updatedFailure: TechnicalFailure) => void;
  onCloseFallo: (updatedFailure: TechnicalFailure) => void;
  onDeleteFallo?: (failureId: string) => void;
  onClose: () => void;
  isSaving: boolean;
  currentUserName?: string | null;
  history?: FailureHistory | null;
  departmentTimeline?: FailureDepartmentTimelineEntry[];
  departmentTimelineError?: string | null;
  historyError?: string | null;
  isHistoryLoading?: boolean;
  isAdmin?: boolean;
}> = ({
  failure,
  departamentos,
  responsables,
  onSave,
  onCloseFallo,
  onDeleteFallo,
  onClose,
  isSaving,
  currentUserName,
  history,
  departmentTimeline,
  departmentTimelineError,
  historyError,
  isHistoryLoading,
  isAdmin,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
        <EditFailureModal
          failure={failure}
          departamentos={departamentos}
          responsables={responsables}
          onSave={onSave}
          onCloseFallo={onCloseFallo}
          onDeleteFallo={onDeleteFallo}
          onClose={onClose}
          isSaving={isSaving}
          currentUserName={currentUserName}
          history={history}
          departmentTimeline={departmentTimeline}
          departmentTimelineError={departmentTimelineError}
          historyError={historyError}
          isHistoryLoading={isHistoryLoading}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
};

export default TechnicalFailuresSupervisor;
