import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSession } from '../context/SessionContext';
import { getAllDepartamentosResponsables } from '../../services/departamentosResponsablesService';

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

const toDateTimeLocalValue = (date?: string, time?: string) => {
  if (!date) {
    return '';
  }
  const sanitizedTime = (time ?? '00:00').slice(0, 5);
  return `${date}T${sanitizedTime}`;
};

const splitDateTimeLocalValue = (value?: string) => {
  if (!value) {
    return { date: undefined, time: undefined };
  }
  const [datePart, timePartRaw] = value.split('T');
  const timePart = timePartRaw ? timePartRaw.slice(0, 5) : undefined;
  return {
    date: datePart || undefined,
    time: timePart || undefined,
  };
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

const toComparableDate = (value?: string) => {
  if (!value) {
    return null;
  }
  const normalized = value.includes('T') ? value : `${value}T00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const EditFailureModal: React.FC<{
  failure: TechnicalFailure;
  departamentos: CatalogoDepartamento[];
  responsables: CatalogoResponsable[];
  onSave: (updatedFailure: TechnicalFailure) => void;
  onClose: () => void;
  isSaving: boolean;
  currentUserName?: string | null;
}> = ({
  failure,
  departamentos,
  responsables,
  onSave,
  onClose,
  isSaving,
  currentUserName,
}) => {
  const normalizeFailure = useCallback(
    (failureToNormalize: TechnicalFailure) => {
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
        fechaHoraResolucion:
          failureToNormalize.fechaHoraResolucion ??
          toDateTimeLocalValue(
            failureToNormalize.fechaResolucion,
            failureToNormalize.horaResolucion,
          ),
        fechaHoraFallo:
          failureToNormalize.fechaHoraFallo ??
          buildFailureDateTimeValue(failureToNormalize) ??
          failureToNormalize.fecha,
        departamentoResponsableId: departamentoId ?? '',
        verificacionAperturaId: aperturaId ?? '',
        verificacionCierreId: cierreId ?? '',
        verificacionCierre: cierreNombre,
        responsable_verificacion_cierre_id:
          failureToNormalize.responsable_verificacion_cierre_id ?? null,
        responsable_verificacion_cierre_nombre:
          failureToNormalize.responsable_verificacion_cierre_nombre ?? null,
      };
    },
    [departamentos, responsables, currentUserName],
  );

  const [editData, setEditData] = useState<TechnicalFailure>(() =>
    normalizeFailure(failure),
  );
  const [activeTab, setActiveTab] = useState<
    'general' | 'supervisor' | 'cierre'
  >('general');

  useEffect(() => {
    setEditData(normalizeFailure(failure));
    setActiveTab('general');
  }, [failure, normalizeFailure]);

  const updateField = (name: keyof TechnicalFailure, value: string | undefined) => {
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    updateField(name as keyof TechnicalFailure, value);
  };

  const handleResolutionChange = (value: string) => {
    const { date, time } = splitDateTimeLocalValue(value);
    setEditData((prev) => ({
      ...prev,
      fechaHoraResolucion: value,
      fechaResolucion: date,
      horaResolucion: time,
      responsable_verificacion_cierre_nombre:
        value && currentUserName ? currentUserName : prev.responsable_verificacion_cierre_nombre,
    }));
  };

  const nowForInput = useMemo(
    () => new Date().toISOString().slice(0, 16),
    [],
  );

  const departamentoItems = useMemo(
    () =>
      departamentos.map((departamento) => ({
        id: String(departamento.id),
        label: departamento.nombre,
        value: String(departamento.id),
      })),
    [departamentos],
  );

  const handleDepartamentoSelect = (item?: { label?: string; value?: string }) => {
    setEditData((prev) => ({
      ...prev,
      departamentoResponsableId: item?.value ?? '',
      deptResponsable: item?.label ?? '',
    }));
  };

  const fechaHoraReporte = useMemo(() => {
    const combined = buildFailureDateTimeValue(editData);
    return formatFechaHoraDisplay(
      combined,
      editData.fecha,
      editData.hora ?? editData.horaFallo,
    );
  }, [editData.fechaHoraFallo, editData.fecha, editData.hora, editData.horaFallo]);

  const fechaHoraFalloDisplay = fechaHoraReporte || 'Sin información';

  const handleSave = () => {
    let cierre: Date | null = null;

    // 1) Si el picker devuelve fecha/hora completa en editData.fechaHoraResolucion
    if (editData.fechaHoraResolucion) {
      const value = editData.fechaHoraResolucion as any;

      // Si es dayjs/moment, usar toDate()
      if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        cierre = value.toDate();
      }
      // Si ya es un Date nativo
      else if (value instanceof Date) {
        cierre = value;
      }
      // Si es string (por ejemplo "2025-11-28 07:48")
      else if (typeof value === 'string') {
        // Normalizar a formato ISO para el constructor de Date
        const normalized = value.replace(' ', 'T').slice(0, 16); // "YYYY-MM-DDTHH:mm"
        cierre = new Date(normalized);
      }
    }
    // 2) Si no hay fechaHoraResolucion, construir con fecha + hora separadas
    else if (editData.fechaResolucion && editData.horaResolucion) {
      const isoString = `${editData.fechaResolucion}T${editData.horaResolucion}`;
      cierre = new Date(isoString);
    }

    // 3) Validar que no sea futura
    if (cierre && !Number.isNaN(cierre.getTime()) && cierre.getTime() > Date.now()) {
      alert('La fecha y hora de resolución no puede ser futura.');
      return;
    }

    const novedad = editData.novedadDetectada?.trim() || '';
    const departamentoId =
      editData.departamentoResponsableId?.trim() || editData.deptResponsable?.trim() || '';

    if (novedad.length > 0 && !departamentoId) {
      alert(
        'Debe seleccionar un Departamento Responsable cuando ingresa una Novedad Detectada.',
      );
      return;
    }

    onSave(editData);
  };

  const renderReadOnlyInfo = (label: string, value?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value && value.trim() ? value : 'Sin información'}
        readOnly
        className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 mb-4">
        <h4 className="text-[#1C2E4A] text-xl font-semibold">
          Editar Reporte de Fallo (Supervisor)
        </h4>
        <p className="text-sm text-gray-500">
          Actualiza la información del reporte seleccionado sin perder de vista el historial.
        </p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Tabs">
          {[
            { id: 'general' as const, label: 'Datos generales' },
            { id: 'supervisor' as const, label: 'Verificación Supervisor' },
            { id: 'cierre' as const, label: 'Verificación de cierre' },
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderReadOnlyInfo('Fecha de reporte', fechaHoraReporte)}
          {renderReadOnlyInfo('Sitio', editData.sitio_nombre)}
          {renderReadOnlyInfo('Tipo de afectación', editData.tipo_afectacion)}
          {renderReadOnlyInfo('Equipo afectado', editData.equipo_afectado)}
          {renderReadOnlyInfo('Responsable inicial', editData.responsable)}
          {renderReadOnlyInfo(
            'Departamento Responsable',
            editData.deptResponsable ||
              departamentos.find(
                (departamento) => String(departamento.id) === editData.departamentoResponsableId,
              )?.nombre,
          )}
        </div>
      )}

      {activeTab === 'supervisor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha hora de fallo</label>
            <input
              type="text"
              value={fechaHoraFalloDisplay}
              readOnly
              disabled
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
            />
          </div>
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Departamento Responsable"
              value={editData.departamentoResponsableId ?? ''}
              onChange={(value: string) =>
                setEditData((prev) => ({ ...prev, departamentoResponsableId: value }))
              }
              onItemSelect={handleDepartamentoSelect}
              items={departamentoItems}
              displayField="label"
              valueField="value"
              placeholder="Seleccione..."
              searchPlaceholder="Escriba para filtrar"
              disabled={departamentos.length === 0}
              emptyMessage={
                departamentos.length === 0
                  ? 'No hay departamentos disponibles'
                  : 'No se encontraron departamentos'
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={editData.descripcion_fallo || ''}
              readOnly
              disabled
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Último usuario que editó
            </label>
            <input
              type="text"
              value={
                editData.ultimo_usuario_edito_nombre &&
                editData.ultimo_usuario_edito_nombre.trim()
                  ? editData.ultimo_usuario_edito_nombre
                  : 'Sin información'
              }
              readOnly
              disabled
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
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
      )}

      {activeTab === 'cierre' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha y Hora Resolución</label>
            <input
              type="datetime-local"
              name="fechaHoraResolucion"
              value={editData.fechaHoraResolucion || ''}
              onChange={(e) => handleResolutionChange(e.target.value)}
              max={nowForInput}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
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

      <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 md:flex-row md:justify-end">
        <div className="flex gap-4 justify-end">
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

  const responsables = useMemo(
    () => catalogos.responsablesVerificacion,
    [catalogos.responsablesVerificacion],
  );

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

  const handleEdit = (failure: TechnicalFailure) => {
    setCurrentFailure(failure);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentFailure(null);
  };

  const handleUpdateFailure = async (updatedFailure: TechnicalFailure) => {
    const { date: resolutionDate, time: resolutionTime } = splitDateTimeLocalValue(
      updatedFailure.fechaHoraResolucion,
    );

    const failureDateTimeValue =
      buildFailureDateTimeValue(updatedFailure) ?? updatedFailure.fecha;

    const { date: failureDateFromDateTime, time: failureTimeFromDateTime } =
      splitDateTimeLocalValue(failureDateTimeValue);

    const fechaFalloPayload = failureDateFromDateTime || updatedFailure.fecha;
    const horaFalloPayload =
      failureTimeFromDateTime ||
      updatedFailure.hora ||
      updatedFailure.horaFallo ||
      undefined;

    const resolutionComparable = toComparableDate(
      updatedFailure.fechaHoraResolucion ||
        (resolutionDate
          ? `${resolutionDate}${resolutionTime ? `T${resolutionTime}` : ''}`
          : undefined),
    );
    const failureComparable = toComparableDate(failureDateTimeValue);

    if (resolutionComparable && failureComparable && resolutionComparable < failureComparable) {
      alert('La fecha de resolución debe ser igual o posterior a la fecha de fallo.');
      return;
    }

    let verificacionCierreNombre = updatedFailure.verificacionCierre?.trim();
    let verificacionCierreId = updatedFailure.verificacionCierreId;

    if ((!verificacionCierreNombre || !verificacionCierreId) && session.user) {
      const matched = responsables.find(
        (responsable) =>
          responsable.nombre?.trim().toLowerCase() ===
          session.user?.trim().toLowerCase(),
      );
      if (matched) {
        verificacionCierreNombre = matched.nombre;
        verificacionCierreId = String(matched.id);
      }
    }

    const loggedUserId =
      session.userId != null && !Number.isNaN(Number(session.userId))
        ? Number(session.userId)
        : null;

    const existingResponsableCierreId =
      updatedFailure.responsable_verificacion_cierre_id != null &&
      !Number.isNaN(Number(updatedFailure.responsable_verificacion_cierre_id))
        ? Number(updatedFailure.responsable_verificacion_cierre_id)
        : null;

    const hasResolutionInfo = Boolean(resolutionDate || updatedFailure.fechaResolucion);
    const responsableVerificacionCierreId = hasResolutionInfo
      ? existingResponsableCierreId ?? loggedUserId ?? null
      : null;

    const payload: TechnicalFailurePayload = {
      fecha: fechaFalloPayload,
      hora: horaFalloPayload,
      horaFallo: horaFalloPayload,
      equipo_afectado: updatedFailure.equipo_afectado,
      descripcion_fallo: updatedFailure.descripcion_fallo,
      responsable: updatedFailure.responsable,
      deptResponsable: updatedFailure.deptResponsable,
      departamentoResponsableId: updatedFailure.departamentoResponsableId,
      fechaResolucion: resolutionDate,
      horaResolucion: resolutionTime,
      fechaHoraResolucion: updatedFailure.fechaHoraResolucion || undefined,
      verificacionApertura: updatedFailure.verificacionApertura,
      verificacionAperturaId: updatedFailure.verificacionAperturaId,
      verificacionCierre: verificacionCierreNombre,
      verificacionCierreId,
      novedadDetectada: updatedFailure.novedadDetectada,
      fechaHoraFallo: failureDateTimeValue,
      ultimoUsuarioEditoId:
        session.userId != null && !Number.isNaN(Number(session.userId))
          ? Number(session.userId)
          : undefined,
      responsable_verificacion_cierre_id: responsableVerificacionCierreId,
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


  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      <div className="bg-white p-6 rounded-lg shadow-md">
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
                  Tipo afectación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipo
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
                      {formatFechaHoraDisplay(
                        buildFailureDateTimeValue(fallo),
                        fallo.fecha,
                        fallo.hora ?? fallo.horaFallo,
                      ) || 'Sin información'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.descripcion_fallo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.sitio_nombre || 'Sin sitio asignado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.tipo_afectacion || 'Sin tipo'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {fallo.equipo_afectado || 'Sin equipo'}
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
        <EditTechnicalFailureSupervisorModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={responsables}
          onSave={handleUpdateFailure}
          onClose={handleCloseModal}
          isSaving={isSubmitting}
          currentUserName={session.user}
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
  onClose: () => void;
  isSaving: boolean;
  currentUserName?: string | null;
}> = ({
  failure,
  departamentos,
  responsables,
  onSave,
  onClose,
  isSaving,
  currentUserName,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
        <EditFailureModal
          failure={failure}
          departamentos={departamentos}
          responsables={responsables}
          onSave={onSave}
          onClose={onClose}
          isSaving={isSaving}
          currentUserName={currentUserName}
        />
      </div>
    </div>
  );
};

export default TechnicalFailuresSupervisor;
