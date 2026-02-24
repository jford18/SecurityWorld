import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import {
  CatalogoDepartamento,
  FailureDepartmentTimelineEntry,
  FailureHistory,
  TechnicalFailure,
  TechnicalFailureCatalogs,
} from '../../types';
import {
  deleteFallo,
  fetchCatalogos,
  fetchFallos,
  getFalloHistorial,
  getFalloHistorialDepartamentos,
} from '../../services/fallosService';
import { useSession } from '../context/SessionContext';
import { getAllDepartamentosResponsables } from '../../services/departamentosResponsablesService';
import { EditTechnicalFailureSupervisorModal } from './TechnicalFailuresSupervisor';

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

const TechnicalFailuresAdministrador: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFailure, setCurrentFailure] = useState<TechnicalFailure | null>(null);
  const [history, setHistory] = useState<FailureHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [departmentTimeline, setDepartmentTimeline] = useState<FailureDepartmentTimelineEntry[]>([]);
  const [departmentTimelineError, setDepartmentTimelineError] = useState<string | null>(null);

  const roleContext = useMemo(
    () => ({
      roleId: session.roleId ?? session.activeRoleId ?? null,
      roleName: session.roleName ?? null,
    }),
    [session.activeRoleId, session.roleId, session.roleName],
  );

  const loadFailures = useCallback(async () => {
    setIsLoading(true);
    try {
      const fallos = await fetchFallos();
      setFailures(fallos);
    } catch (error) {
      console.error('Error al cargar los fallos técnicos:', error);
      alert('No se pudo cargar la información de fallos técnicos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadCatalogData = async () => {
      try {
        const departamentosPromise = getAllDepartamentosResponsables().catch((error) => {
          console.error('Error al cargar los departamentos responsables:', error);
          return [] as CatalogoDepartamento[];
        });

        const [catalogData, departamentosData] = await Promise.all([
          fetchCatalogos(),
          departamentosPromise,
        ]);

        const departamentosActualizados =
          departamentosData.length > 0 ? departamentosData : catalogData.departamentos;

        setCatalogos({ ...catalogData, departamentos: departamentosActualizados });
      } catch (error) {
        console.error('Error al cargar catálogos de fallos técnicos:', error);
      }
    };

    loadCatalogData();
  }, []);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const loadHistory = useCallback(async (failureId: string) => {
    setIsHistoryLoading(true);
    setHistory(null);
    setHistoryError(null);
    setDepartmentTimeline([]);
    setDepartmentTimelineError(null);

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
      console.error('Error al cargar el historial por departamento:', departmentResult.reason);
      setDepartmentTimelineError('No se pudo cargar el historial por departamento.');
    }

    setIsHistoryLoading(false);
  }, [roleContext]);

  const handleViewFailure = (failure: TechnicalFailure) => {
    setCurrentFailure(failure);
    setIsModalOpen(true);
    void loadHistory(failure.id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentFailure(null);
    setHistory(null);
    setHistoryError(null);
    setDepartmentTimeline([]);
    setDepartmentTimelineError(null);
  };

  const handleDeleteFailure = async (failureId: string) => {
    const confirmed = window.confirm(
      '¿Está seguro de eliminar este fallo cerrado? Esta acción no se puede deshacer.',
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(failureId);
      await deleteFallo(failureId, roleContext);
      await loadFailures();
      alert('Fallo eliminado correctamente.');
    } catch (error) {
      console.error('Error al eliminar el fallo técnico:', error);
      const message = (error as any)?.response?.data?.mensaje || 'No se pudo eliminar el fallo.';
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <TechnicalFailuresHistory
          failures={failures}
          isLoading={isLoading}
          activeRole={session.roleName ?? undefined}
          withContainer={false}
          renderActions={(failure) => (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleViewFailure(failure)}
                className="text-blue-600 hover:underline text-sm font-semibold"
              >
                Ver
              </button>
              <button
                onClick={() => handleDeleteFailure(failure.id)}
                className="text-red-600 hover:underline text-sm font-semibold"
                disabled={deletingId === failure.id}
              >
                {deletingId === failure.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          )}
        />
      </div>

      {isModalOpen && currentFailure && (
        <EditTechnicalFailureSupervisorModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={catalogos.responsablesVerificacion}
          onSave={() => undefined}
          onCloseFallo={() => undefined}
          onClose={handleCloseModal}
          isSaving={false}
          currentUserName={session.user}
          history={history}
          departmentTimeline={departmentTimeline}
          departmentTimelineError={departmentTimelineError}
          historyError={historyError}
          isHistoryLoading={isHistoryLoading}
          isAdmin
          readOnly
        />
      )}
    </div>
  );
};

export default TechnicalFailuresAdministrador;
