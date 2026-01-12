import React from 'react';
import { IntrusionConsolidadoRow } from '@/types';
import { formatLocalDateTime } from '@/utils/datetime';

export const formatIntrusionDateTime = (value: string | null) => {
  return formatLocalDateTime(value);
};

export type IntrusionesColumn = {
  key: keyof IntrusionConsolidadoRow | string;
  header: string;
  render: (row: IntrusionConsolidadoRow) => React.ReactNode;
};

export const intrusionesColumns: IntrusionesColumn[] = [
  {
    key: 'fechaHoraIntrusion',
    header: 'Fecha y hora de intrusión',
    render: (row) => formatIntrusionDateTime(row.fechaHoraIntrusion) || 'Sin información',
  },
  {
    key: 'sitio',
    header: 'Sitio',
    render: (row) => row.sitio || 'Sin información',
  },
  {
    key: 'tipoIntrusion',
    header: 'Tipo intrusión',
    render: (row) => row.tipoIntrusion || 'Sin información',
  },
  {
    key: 'llegoAlerta',
    header: 'Llegó alerta',
    render: (row) => (row.llegoAlerta ? 'Sí' : 'No'),
  },
  {
    key: 'personalIdentificado',
    header: 'Personal identificado (Cargo – Persona)',
    render: (row) => row.personalIdentificado?.trim() || 'N/A',
  },
];
