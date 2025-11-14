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
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';
import { useSession } from '../context/SessionContext';

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

type SupervisorFormState = {
  fechaHoraFallo: string;
  fechaResolucion: string;
  horaResolucion: string;
  deptResponsableId: string;
  verificacionAperturaId: string;
  verificacionCierreId: string;
  novedadDetectada: string;
};

const normalizeIsoDate = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  // Intentar con formato YYYY-MM-DD
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    const fallback = new Date(year, month - 1, day);
    return Number.isNaN(fallback.getTime()) ? '' : fallback.toISOString();
  }

  return '';
};

const normalizeText = (value?: string | null) => String(value ?? '').trim().toLowerCase();

const findDeptIdForFailure = (
  failure: TechnicalFailure,
  departamentos: CatalogoDepartamento[],
): string => {
  if (failure.deptResponsableId) {
    return String(failure.deptResponsableId);
  }

  if (!failure.deptResponsable) {
    return '';
  }

  const normalized = normalizeText(failure.deptResponsable);
  const matched = departamentos.find(
    (dept) => normalizeText(dept.nombre) === normalized,
  );
  return matched ? String(matched.id) : '';
};

const findResponsibleIdByName = (
  name: string | undefined,
  responsables: CatalogoResponsable[],
): string => {
  if (!name) {
    return '';
  }
  const normalized = normalizeText(name);
  const matched = responsables.find(
    (responsable) => normalizeText(responsable.nombre) === normalized,
  );
  return matched ? String(matched.id) : '';
};

const buildSupervisorFormState = (
  failure: TechnicalFailure,
  departamentos: CatalogoDepartamento[],
  responsables: CatalogoResponsable[],
  sessionUserName?: string | null,
): SupervisorFormState => {
  const fallbackCierreId = sessionUserName
    ? findResponsibleIdByName(sessionUserName, responsables)
    : '';

  return {
    fechaHoraFallo:
      failure.fechaHoraFallo || normalizeIsoDate(failure.fecha) || '',
    fechaResolucion: failure.fechaResolucion || '',
    horaResolucion: failure.horaResolucion || '',
    deptResponsableId: findDeptIdForFailure(failure, departamentos),
    verificacionAperturaId: findResponsibleIdByName(
      failure.verificacionApertura,
      responsables,
    ),
    verificacionCierreId:
      findResponsibleIdByName(failure.verificacionCierre, responsables) ||
      fallbackCierreId,
    novedadDetectada: failure.novedadDetectada || '',
  };
};

const TechnicalFailuresSupervisor: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null);
  const [formState, setFormState] = useState<SupervisorFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const selectedFailure = useMemo(
    () => failures.find((failure) => failure.id === selectedFailureId) ?? null,
    [failures, selectedFailureId],
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogData, fallosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
        ]);
        setCatalogos(catalogData);
        setFailures(fallosData);
        if (fallosData.length > 0) {
          setSelectedFailureId((prev) => prev ?? fallosData[0]?.id ?? null);
        }
      } catch (error) {
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información inicial de fallos técnicos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!selectedFailure) {
      setFormState(null);
      return;
    }

    setFormState(
      buildSupervisorFormState(
        selectedFailure,
        catalogos.departamentos,
        catalogos.responsablesVerificacion,
        session.user,
      ),
    );
  }, [selectedFailure, catalogos.departamentos, catalogos.responsablesVerificacion, session.user]);

  const departamentoItems = useMemo(
    () =>
      catalogos.departamentos.map((departamento) => ({
        id: String(departamento.id),
        label: departamento.nombre,
        value: String(departamento.id),
      })),
    [catalogos.departamentos],
  );

  const responsableItems = useMemo(
    () =>
      catalogos.responsablesVerificacion.map((responsable) => ({
        id: String(responsable.id),
        label: responsable.nombre,
        value: String(responsable.id),
      })),
    [catalogos.responsablesVerificacion],
  );

  const updateFormState = (updates: Partial<SupervisorFormState>) => {
    setFormState((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const resolveDepartmentName = (id: string) => {
    if (!id) {
      return undefined;
    }
    const match = catalogos.departamentos.find(
      (departamento) => String(departamento.id) === String(id),
    );
    return match?.nombre;
  };

  const resolveResponsibleName = (id: string) => {
    if (!id) {
      return undefined;
    }
    const match = catalogos.responsablesVerificacion.find(
      (responsable) => String(responsable.id) === String(id),
    );
    return match?.nombre;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFailure || !formState) {
      return;
    }

    if (
      formState.fechaResolucion &&
      selectedFailure.fecha &&
      new Date(formState.fechaResolucion) < new Date(selectedFailure.fecha)
    ) {
      alert('La fecha de resolución debe ser igual o posterior a la fecha de fallo.');
      return;
    }

    const deptName = resolveDepartmentName(formState.deptResponsableId);
    const aperturaName =
      resolveResponsibleName(formState.verificacionAperturaId) ||
      selectedFailure.verificacionApertura;
    const cierreName =
      resolveResponsibleName(formState.verificacionCierreId) ||
      selectedFailure.verificacionCierre ||
      session.user ||
      undefined;

    const payload: TechnicalFailurePayload = {
      fecha: selectedFailure.fecha,
      equipo_afectado: selectedFailure.equipo_afectado,
      descripcion_fallo: selectedFailure.descripcion_fallo,
      responsable: selectedFailure.responsable,
      deptResponsable: deptName || selectedFailure.deptResponsable,
      fechaResolucion: formState.fechaResolucion || undefined,
      horaResolucion: formState.horaResolucion || undefined,
      verificacionApertura: aperturaName || undefined,
      verificacionCierre: cierreName || undefined,
      novedadDetectada: formState.novedadDetectada || undefined,
      fechaHoraFallo: formState.fechaHoraFallo || undefined,
    };

    try {
      setIsSubmitting(true);
      setFeedback(null);
      const saved = await updateFallo(selectedFailure.id, payload);
      setFailures((prev) => prev.map((fallo) => (fallo.id === saved.id ? saved : fallo)));
      setSelectedFailureId(saved.id);
      setFeedback({ type: 'success', message: 'Reporte actualizado correctamente.' });
    } catch (error) {
      console.error('Error al actualizar el fallo técnico:', error);
      setFeedback({ type: 'error', message: 'No se pudo actualizar el reporte.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectFailure = (failure: TechnicalFailure) => {
    setSelectedFailureId(failure.id);
    setFeedback(null);
  };

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col gap-2 mb-6">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Revisión del fallo seleccionado</h4>
          <p className="text-sm text-gray-500">
            Selecciona un registro del historial para validar la información, completar los responsables y confirmar la resolución.
          </p>
        </div>

        {!selectedFailure || !formState ? (
          <p className="text-sm text-gray-500">No hay un fallo seleccionado. Elige uno del historial.</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl p-4">
              <div>
                <p className="text-xs uppercase text-gray-500">Descripción</p>
                <p className="text-sm font-semibold text-[#1C2E4A]">
                  {selectedFailure.descripcion_fallo || 'Sin descripción registrada'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Equipo</p>
                <p className="text-sm font-semibold text-[#1C2E4A]">
                  {selectedFailure.equipo_afectado || 'Sin equipo asignado'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Sitio</p>
                <p className="text-sm font-semibold text-[#1C2E4A]">
                  {selectedFailure.sitio_nombre || 'Sin sitio asignado'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Responsable</p>
                <p className="text-sm font-semibold text-[#1C2E4A]">
                  {selectedFailure.responsable}
                </p>
              </div>
            </div>

            <div className="md:col-span-2">
              <FechaHoraFalloPicker
                id="fechaHoraFallo"
                name="fechaHoraFallo"
                label="Fecha hora de fallo"
                value={formState.fechaHoraFallo}
                onChange={(value) => updateFormState({ fechaHoraFallo: value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha Resolución</label>
              <input
                type="date"
                name="fechaResolucion"
                value={formState.fechaResolucion}
                onChange={(event) => updateFormState({ fechaResolucion: event.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora Resolución</label>
              <input
                type="time"
                name="horaResolucion"
                value={formState.horaResolucion}
                onChange={(event) => updateFormState({ horaResolucion: event.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <AutocompleteComboBox
                label="Departamento Responsable"
                value={formState.deptResponsableId}
                onChange={(value: string) => updateFormState({ deptResponsableId: value })}
                items={departamentoItems}
                displayField="label"
                valueField="value"
                placeholder="Seleccione..."
                disabled={departamentoItems.length === 0}
                emptyMessage={
                  departamentoItems.length === 0
                    ? 'No hay departamentos disponibles'
                    : 'No se encontraron coincidencias'
                }
              />
            </div>

            <div className="md:col-span-2">
              <AutocompleteComboBox
                label="Responsable Verificación Apertura"
                value={formState.verificacionAperturaId}
                onChange={(value: string) => updateFormState({ verificacionAperturaId: value })}
                items={responsableItems}
                displayField="label"
                valueField="value"
                placeholder="Seleccione..."
                disabled={responsableItems.length === 0}
                emptyMessage={
                  responsableItems.length === 0
                    ? 'No hay responsables disponibles'
                    : 'No se encontraron responsables'
                }
              />
            </div>

            <div className="md:col-span-2">
              <AutocompleteComboBox
                label="Responsable Verificación Cierre"
                value={formState.verificacionCierreId}
                onChange={(value: string) => updateFormState({ verificacionCierreId: value })}
                items={responsableItems}
                displayField="label"
                valueField="value"
                placeholder="Seleccione..."
                disabled={responsableItems.length === 0}
                emptyMessage={
                  responsableItems.length === 0
                    ? 'No hay responsables disponibles'
                    : 'No se encontraron responsables'
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Novedad Detectada</label>
              <textarea
                name="novedadDetectada"
                value={formState.novedadDetectada}
                onChange={(event) => updateFormState({ novedadDetectada: event.target.value })}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
              ></textarea>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            {feedback && (
              <div
                className={`md:col-span-2 rounded-md px-4 py-2 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </form>
        )}
      </div>

      <TechnicalFailuresHistory
        failures={failures}
        isLoading={isLoading}
        activeRole="supervisor"
        handleEdit={handleSelectFailure}
        selectedId={selectedFailureId}
        actionLabel="Revisar"
      />
    </div>
  );
};

export default TechnicalFailuresSupervisor;
