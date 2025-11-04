import TechnicalFailuresOperador from './TechnicalFailuresOperador';
import TechnicalFailuresSupervisor from './TechnicalFailuresSupervisor';
import { useSession } from '../context/SessionContext';

export default function TechnicalFailures() {
  const { activeRole } = useSession();

  if (activeRole === 'operador') return <TechnicalFailuresOperador />;
  if (activeRole === 'supervisor') return <TechnicalFailuresSupervisor />;
  return <div>No autorizado</div>;
}
