import React, { useEffect, useState } from 'react';
import { ClienteResumen, getClientesActivos } from '../../services/clientes.service';
import { Consola, getConsolas } from '../../services/consolasService';
import { HaciendaResumen, getHaciendasActivas } from '../../services/haciendas.service';

export type FallosHeaderFilters = {
  clienteId: string;
  reportadoCliente: string;
  consolaId: string;
  haciendaId: string;
};

interface FallosFiltersHeaderProps {
  filters: FallosHeaderFilters;
  onFilterChange: (field: keyof FallosHeaderFilters, value: string) => void;
  onClear: () => void;
}

const FallosFiltersHeader: React.FC<FallosFiltersHeaderProps> = ({
  filters,
  onFilterChange,
  onClear,
}) => {
  const [clientes, setClientes] = useState<ClienteResumen[]>([]);
  const [consolas, setConsolas] = useState<Consola[]>([]);
  const [haciendas, setHaciendas] = useState<HaciendaResumen[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadOptions = async () => {
      try {
        const [clientesData, consolasData, haciendasData] = await Promise.all([
          getClientesActivos().catch((error) => {
            console.error('Error al cargar clientes activos:', error);
            return [] as ClienteResumen[];
          }),
          getConsolas().catch((error) => {
            console.error('Error al cargar consolas:', error);
            return [] as Consola[];
          }),
          getHaciendasActivas().catch((error) => {
            console.error('Error al cargar haciendas activas:', error);
            return [] as HaciendaResumen[];
          }),
        ]);

        if (!isMounted) return;
        setClientes(clientesData ?? []);
        setConsolas(consolasData ?? []);
        setHaciendas(haciendasData ?? []);
      } catch (error) {
        console.error('Error al cargar opciones de filtros de fallos:', error);
      }
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-600">Filtros</h4>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Limpiar filtros
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm text-gray-700">
          <span className="block text-xs font-semibold uppercase text-gray-500">Cliente</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={filters.clienteId}
            onChange={(event) => onFilterChange('clienteId', event.target.value)}
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="block text-xs font-semibold uppercase text-gray-500">
            Reportado al cliente
          </span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={filters.reportadoCliente}
            onChange={(event) => onFilterChange('reportadoCliente', event.target.value)}
          >
            <option value="">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="block text-xs font-semibold uppercase text-gray-500">Consola</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={filters.consolaId}
            onChange={(event) => onFilterChange('consolaId', event.target.value)}
          >
            <option value="">Todas</option>
            {consolas.map((consola) => (
              <option key={consola.id} value={consola.id}>
                {consola.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="block text-xs font-semibold uppercase text-gray-500">Hacienda</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={filters.haciendaId}
            onChange={(event) => onFilterChange('haciendaId', event.target.value)}
          >
            <option value="">Todas</option>
            {haciendas.map((hacienda) => (
              <option key={hacienda.id} value={hacienda.id}>
                {hacienda.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};

export default FallosFiltersHeader;
