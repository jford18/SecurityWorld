import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CatalogoDepartamento,
  FailureDepartmentTimelineEntry,
  FailureHistory,
  TechnicalFailure,
  TechnicalFailureCatalogs,
} from '../../types';
import {
  fetchCatalogos,
  fetchFallos,
  getFalloHistorial,
  getFalloHistorialDepartamentos,
} from '../../services/fallosService';
import { getAllDepartamentosResponsables } from '../../services/departamentosResponsablesService';
import { useSession } from '../context/SessionContext';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import FallosFiltersHeader, { FallosHeaderFilters } from './FallosFiltersHeader';
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

const TechnicalFailuresConsultas: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FallosHeaderFilters>({
    clienteId: '',
    reportadoCliente: '',
    consolaId: '',
    haciendaId: '',
  });
  const [page, setPage] = useState(0);
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

  useEffect(() => {
    const loadData = async () => {
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
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información de fallos técnicos.');
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchFallos({
      clienteId: filters.clienteId || null,
      reportadoCliente: filters.reportadoCliente || null,
      consolaId: filters.consolaId || null,
      haciendaId: filters.haciendaId || null,
      page,
    })
      .then((fallosData) => {
        if (!isMounted) return;
        setFailures(fallosData);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Error al cargar los fallos técnicos:', error);
        alert('No se pudo cargar la información de fallos técnicos.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filters, page]);

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

  const handleFilterChange = (field: keyof FallosHeaderFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      clienteId: '',
      reportadoCliente: '',
      consolaId: '',
      haciendaId: '',
    });
    setPage(0);
  };

  const renderViewAction = (failure: TechnicalFailure) => (
    <button
      onClick={() => handleViewFailure(failure)}
      className="text-blue-600 hover:underline text-sm font-semibold"
    >
      Ver
    </button>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Fallos Técnicos - Consultas</h3>

      <FallosFiltersHeader
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <div className="bg-white p-6 rounded-lg shadow-md">
        <TechnicalFailuresHistory
          failures={failures}
          isLoading={isLoading}
          activeRole={session.roleName ?? undefined}
          showActions
          enableExport
          exportFilters={filters}
          withContainer={false}
          renderActions={renderViewAction}
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
          isAdmin={false}
          readOnly
        />
      )}
    </div>
  );
};

export default TechnicalFailuresConsultas;
