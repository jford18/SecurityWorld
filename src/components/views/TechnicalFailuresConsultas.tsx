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

  useEffect(() => {
    const loadData = async () => {
      try {
        const departamentosPromise = getAllDepartamentosResponsables().catch((error) => {
          console.error('Error al cargar los departamentos responsables:', error);
          return [] as CatalogoDepartamento[];
        });

        const [catalogData, fallosData, departamentosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
          departamentosPromise,
        ]);

        const departamentosActualizados =
          departamentosData.length > 0 ? departamentosData : catalogData.departamentos;

        setCatalogos({ ...catalogData, departamentos: departamentosActualizados });
        setFailures(fallosData);
      } catch (error) {
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información de fallos técnicos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Fallos Técnicos - Consultas</h3>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <TechnicalFailuresHistory
          failures={failures}
          isLoading={isLoading}
          activeRole={session.roleName ?? undefined}
          showActions={false}
          enableExport
          withContainer={false}
        />
      </div>
    </div>
  );
};

export default TechnicalFailuresConsultas;
