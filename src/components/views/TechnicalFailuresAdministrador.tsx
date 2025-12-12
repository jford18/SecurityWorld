import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';
import { TechnicalFailure } from '../../types';
import { deleteFallo, fetchFallos } from '../../services/fallosService';
import { useSession } from '../context/SessionContext';

const TechnicalFailuresAdministrador: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    loadFailures();
  }, [loadFailures]);

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
          renderActions={(failure) => (
            <button
              onClick={() => handleDeleteFailure(failure.id)}
              className="text-red-600 hover:underline text-sm font-semibold"
              disabled={deletingId === failure.id}
            >
              {deletingId === failure.id ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        />
      </div>
    </div>
  );
};

export default TechnicalFailuresAdministrador;
