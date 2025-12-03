import React from 'react';
import { IntrusionConsolidadoRow } from '@/types';

export const formatIntrusionDateTime = (value: string | null) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace('T', ' ').replace('Z', '');
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
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
