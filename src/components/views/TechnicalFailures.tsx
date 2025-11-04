import TechnicalFailuresOperador from './TechnicalFailuresOperador';
import TechnicalFailuresSupervisor from './TechnicalFailuresSupervisor';
import { useSession } from '@/components/context/SessionContext';

export default function TechnicalFailures() {
  const { session } = useSession();
  const activeRole = session.roleName?.toLowerCase();

  if (activeRole === 'operador') return <TechnicalFailuresOperador />;
  if (activeRole === 'supervisor') return <TechnicalFailuresSupervisor />;
  return <div>No autorizado</div>;
}
