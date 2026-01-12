import React, { useEffect, useState } from 'react';
import {
  CatalogoDepartamento,
  TechnicalFailure,
  TechnicalFailureCatalogs,
} from '../../types';
import {
  fetchCatalogos,
  fetchFallos,
} from '../../services/fallosService';
import { getAllDepartamentosResponsables } from '../../services/departamentosResponsablesService';
import { useSession } from '../context/SessionContext';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import FallosFiltersHeader, { FallosHeaderFilters } from './FallosFiltersHeader';

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
  const [, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FallosHeaderFilters>({
    clienteId: '',
    reportadoCliente: '',
    consolaId: '',
    haciendaId: '',
  });
  const [page, setPage] = useState(0);

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
          showActions={false}
          enableExport
          exportFilters={filters}
          withContainer={false}
        />
      </div>
    </div>
  );
};

export default TechnicalFailuresConsultas;
