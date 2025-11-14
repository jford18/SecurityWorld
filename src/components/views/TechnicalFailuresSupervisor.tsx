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
    return failure.horaFallo
      ? `${failure.fecha}T${failure.horaFallo}`
      : failure.fecha;
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
      };
    },
    [departamentos, responsables, currentUserName],
  );

  const [editData, setEditData] = useState<TechnicalFailure>(() =>
    normalizeFailure(failure),
  );

  useEffect(() => {
    setEditData(normalizeFailure(failure));
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
    }));
  };

  const departamentoItems = useMemo(
    () =>
      departamentos.map((departamento) => ({
        id: String(departamento.id),
        label: departamento.nombre,
        value: String(departamento.id),
      })),
    [departamentos],
  );

  const responsableItems = useMemo(
    () =>
      responsables.map((responsable) => ({
        id: String(responsable.id),
        label: responsable.nombre,
        value: String(responsable.id),
      })),
    [responsables],
  );

  const handleDepartamentoSelect = (item?: { label?: string; value?: string }) => {
    setEditData((prev) => ({
      ...prev,
      departamentoResponsableId: item?.value ?? '',
      deptResponsable: item?.label ?? '',
    }));
  };

  const applyResponsableSelection = (
    idKey: 'verificacionAperturaId' | 'verificacionCierreId',
    nameKey: 'verificacionApertura' | 'verificacionCierre',
    item?: { label?: string; value?: string },
  ) => {
    setEditData((prev) => {
      const next: TechnicalFailure = { ...prev };
      next[idKey] = item?.value ?? '';
      next[nameKey] = item?.label ?? '';
      return next;
    });
  };

  const fechaHoraFalloDisplay = useMemo(() => {
    const combined = buildFailureDateTimeValue(editData);
    return (
      formatFechaHoraDisplay(
        combined,
        editData.fecha,
        editData.horaFallo,
      ) || 'Sin información'
    );
  }, [editData.fechaHoraFallo, editData.fecha, editData.horaFallo]);

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-3xl w-full">
        <h4 className="text-[#1C2E4A] text-xl font-semibold mb-6">Editar Reporte de Fallo (Supervisor)</h4>
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha y Hora Resolución</label>
            <input
              type="datetime-local"
              name="fechaHoraResolucion"
              value={editData.fechaHoraResolucion || ''}
              onChange={(e) => handleResolutionChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div>
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
              disabled={departamentos.length === 0}
              emptyMessage={
                departamentos.length === 0
                  ? 'No hay departamentos disponibles'
                  : 'No se encontraron departamentos'
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={editData.descripcion_fallo || ''}
              readOnly
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
            />
          </div>
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Responsable Verificación Apertura"
              value={editData.verificacionAperturaId ?? ''}
              onChange={(value: string) =>
                setEditData((prev) => ({ ...prev, verificacionAperturaId: value }))
              }
              onItemSelect={(item) =>
                applyResponsableSelection('verificacionAperturaId', 'verificacionApertura', item)
              }
              items={responsableItems}
              displayField="label"
              valueField="value"
              placeholder="Seleccione..."
              disabled
              emptyMessage={
                responsables.length === 0
                  ? 'No hay responsables disponibles'
                  : 'No se encontraron responsables'
              }
            />
          </div>
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Responsable Verificación Cierre"
              value={editData.verificacionCierreId ?? ''}
              onChange={(value: string) =>
                setEditData((prev) => ({ ...prev, verificacionCierreId: value }))
              }
              onItemSelect={(item) =>
                applyResponsableSelection('verificacionCierreId', 'verificacionCierre', item)
              }
              items={responsableItems}
              displayField="label"
              valueField="value"
              placeholder="Seleccione..."
              disabled={responsables.length === 0}
              emptyMessage={
                responsables.length === 0
                  ? 'No hay responsables disponibles'
                  : 'No se encontraron responsables'
              }
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

  const handleUpdateFailure = async (updatedFailure: TechnicalFailure) => {
    const { date: resolutionDate, time: resolutionTime } = splitDateTimeLocalValue(
      updatedFailure.fechaHoraResolucion,
    );

    const failureDateTimeValue =
      buildFailureDateTimeValue(updatedFailure) ?? updatedFailure.fecha;

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

    const payload: TechnicalFailurePayload = {
      fecha: updatedFailure.fecha,
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.fecha}</td>
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
        <EditFailureModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={responsables}
          onSave={handleUpdateFailure}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSubmitting}
          currentUserName={session.user}
        />
      )}
    </div>
  );
};

export default TechnicalFailuresSupervisor;
