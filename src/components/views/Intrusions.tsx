import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DateTimeInput, { normalizeDateTimeLocalString, toIsoString } from '../ui/DateTimeInput';
import { intrusionsData as mockIntrusions } from '../../data/mockData';
import { Intrusion, IntrusionConsolidadoRow, IntrusionHcQueueRow } from '../../types';
import {
  createIntrusion,
  fetchIntrusiones,
  IntrusionPayload,
  fetchIntrusionesEncoladasHc,
  updateIntrusion,
} from '../../services/intrusionesService';
import {
  getAllMediosComunicacion,
  type MedioComunicacionDTO,
} from '../../services/medioComunicacionService';
import { getAll as getAllTiposIntrusion } from '../../services/tipoIntrusion.service.js';
import {
  ConclusionEventoDTO,
  getAll as getAllConclusionesEvento,
} from '../../services/conclusionEventoService';
import { Sitio, getSitios, getSitio } from '../../services/sitiosService';
import { resolveConsolaIdByName } from '../../services/consolasService';
import { useSession } from '../context/SessionContext';
import { getAll as getFuerzasReaccion } from '../../services/fuerzaReaccion.service';
import { getPersonasByCliente } from '../../services/clientePersona.service';
import { intrusionesColumns } from '@/components/intrusiones/intrusionesColumns';

const toBoolean = (value: unknown, defaultValue = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (value == null) {
    return defaultValue;
  }
  return Boolean(value);
};

const NO_DEFINIDO_VALUE = 'NO_DEFINIDO';
const NO_DEFINIDO_OPTION_LABEL = 'Tipo de evento no definido';

type TipoIntrusionCatalogItem = {
  id: number | string;
  descripcion: string;
  necesita_protocolo: boolean;
};

type FuerzaReaccionCatalogItem = {
  id: number;
  descripcion: string;
  activo?: boolean | null;
};

const normalizeTiposIntrusion = (
  payload: unknown
): TipoIntrusionCatalogItem[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const base = item as {
          id?: unknown;
          descripcion?: unknown;
          activo?: unknown;
          necesita_protocolo?: unknown;
        };
        const id = Number(base.id);
        const descripcion =
          base.descripcion == null ? '' : String(base.descripcion).trim();
        const activo =
          base.activo === undefined ? true : toBoolean(base.activo, true);

        if (!Number.isFinite(id) || !descripcion || !activo) {
          return null;
        }

        const necesitaProtocolo = toBoolean(base.necesita_protocolo, false);

        return {
          id,
          descripcion,
          necesita_protocolo: necesitaProtocolo,
        };
      })
      .filter((item): item is TipoIntrusionCatalogItem => item !== null);
  }

  if (payload && typeof payload === 'object') {
    const maybeData = (payload as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      return normalizeTiposIntrusion(maybeData);
    }
  }

  return [];
};

type IntrusionFormData = {
  origen: string;
  hik_alarm_evento_id: string | null;
  fecha_evento: string;
  fecha_reaccion: string;
  fecha_reaccion_enviada: string;
  fecha_reaccion_fuera: string;
  fecha_llegada_fuerza_reaccion: string;
  sitioId: string;
  estado: string;
  descripcion: string;
  no_llego_alerta: boolean;
  medio_comunicacion_id: string;
  conclusion_evento_id: string;
  sustraccion_material: boolean;
  fuerza_reaccion_id: string;
  completado: boolean;
  necesita_protocolo: boolean;
};

type PersonaOption = {
  id: number;
  nombre: string;
  apellido: string;
  cargo?: string | null;
};

const getInitialDateTimeValue = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return normalizeDateTimeLocalString(now.toISOString());
};

const getDateTimeInputLimit = () => normalizeDateTimeLocalString(new Date().toISOString());

const formatDateTimeForDisplay = (value?: string | null) => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const buildInitialFormData = (): IntrusionFormData => ({
  origen: 'MANUAL',
  hik_alarm_evento_id: null,
  fecha_evento: getInitialDateTimeValue(),
  fecha_reaccion: '',
  fecha_reaccion_enviada: '',
  fecha_reaccion_fuera: '',
  fecha_llegada_fuerza_reaccion: '',
  sitioId: '',
  estado: '',
  descripcion: '',
  no_llego_alerta: false,
  medio_comunicacion_id: '',
  conclusion_evento_id: '',
  sustraccion_material: false,
  fuerza_reaccion_id: '',
  completado: false,
  necesita_protocolo: false,
});

const Intrusions: React.FC = () => {
  const [formData, setFormData] = useState<IntrusionFormData>(buildInitialFormData());
  const [intrusions, setIntrusions] = useState<Intrusion[]>([]);
  const [mediosComunicacion, setMediosComunicacion] = useState<MedioComunicacionDTO[]>([]);
  const [tiposIntrusion, setTiposIntrusion] = useState<TipoIntrusionCatalogItem[]>([]);
  const [conclusionesEvento, setConclusionesEvento] = useState<ConclusionEventoDTO[]>([]);
  const [tipoIntrusionId, setTipoIntrusionId] = useState<number | string | ''>('');
  const [tipoDescripcion, setTipoDescripcion] = useState('');
  const [requiereProtocolo, setRequiereProtocolo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fechaReaccionError, setFechaReaccionError] = useState('');
  const [fechaReaccionFueraError, setFechaReaccionFueraError] = useState('');
  const [disableSave, setDisableSave] = useState(false);
  const [editingIntrusionId, setEditingIntrusionId] = useState<number | null>(null);
  const [hcQueue, setHcQueue] = useState<IntrusionHcQueueRow[]>([]);
  const [hcTotal, setHcTotal] = useState(0);
  const [hcLoading, setHcLoading] = useState(false);
  const [hcSearch, setHcSearch] = useState('');
  const [hcOrderBy, setHcOrderBy] = useState<
    'fecha_evento_hc' | 'region' | 'name' | 'trigger_event' | 'status' | 'alarm_category'
  >('fecha_evento_hc');
  const [hcOrderDir, setHcOrderDir] = useState<'asc' | 'desc'>('desc');
  const [hcSeleccionado, setHcSeleccionado] = useState<IntrusionHcQueueRow | null>(null);
  const { session } = useSession();
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [fuerzasReaccion, setFuerzasReaccion] = useState<FuerzaReaccionCatalogItem[]>([]);
  const [sitioId, setSitioId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [personasCliente, setPersonasCliente] = useState<PersonaOption[]>([]);
  const [sortField, setSortField] = useState<keyof IntrusionConsolidadoRow | null>(
    'fechaHoraIntrusion'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const tiposIntrusionConFallback = useMemo(() => {
    const hasNoDefinidoOption = tiposIntrusion.some(
      (item) =>
        String(item.id) === NO_DEFINIDO_VALUE ||
        item.descripcion.trim().toLowerCase() === NO_DEFINIDO_OPTION_LABEL.trim().toLowerCase()
    );

    const normalizedList = tiposIntrusion.map((item) => ({
      ...item,
      id: item.id,
    }));

    if (hasNoDefinidoOption) {
      return normalizedList;
    }

    return [
      ...normalizedList,
      { id: NO_DEFINIDO_VALUE, descripcion: NO_DEFINIDO_OPTION_LABEL, necesita_protocolo: false },
    ];
  }, [tiposIntrusion]);

  const isNoLlegoDisabled = (intrusion?: Partial<IntrusionFormData> | null) =>
    String(intrusion?.origen || '').toUpperCase() === 'HC' ||
    intrusion?.hik_alarm_evento_id != null;

  const resetClientePersonaSelection = () => {
    setSitioId(null);
    setClienteId(null);
    setClienteNombre('');
    setPersonasCliente([]);
    setPersonaId(null);
  };

  const clearSitioSeleccion = () => {
    resetClientePersonaSelection();
    setFormData((prev) => (prev.sitioId ? { ...prev, sitioId: '' } : prev));
  };

  const handleChangeSitio = async (value: number | null) => {
    setSitioId(value);
    setClienteId(null);
    setClienteNombre('');
    setPersonasCliente([]);
    setPersonaId(null);

    if (!value) return;

    try {
      const sitio = await getSitio(value);

      const clienteDelSitio =
        sitio?.cliente_id ?? sitio?.clienteId ?? null;

      if (clienteDelSitio) {
        setClienteId(clienteDelSitio);
        setClienteNombre(sitio?.cliente_nombre ?? sitio?.clienteNombre ?? '');

        try {
          const personasResp = await getPersonasByCliente(clienteDelSitio);
          const personas = Array.isArray(personasResp)
            ? personasResp
            : ((personasResp as { data?: unknown })?.data as unknown[] | undefined) ?? [];

          setPersonasCliente(
            personas
              .map((p: any) => {
                if (!p || typeof p !== 'object') return null;
                const id = p.persona_id ?? p.id;
                if (id == null) return null;

                return {
                  id: Number(id),
                  nombre: p.nombre ?? '',
                  apellido: p.apellido ?? '',
                  cargo: p.cargo ?? null,
                };
              })
              .filter(
                (p): p is PersonaOption =>
                  p !== null && Number.isFinite(p.id)
              )
          );
        } catch (err) {
          console.error('Error al obtener personas del cliente:', err);
        }
      }
    } catch (err) {
      console.error('Error al obtener datos del sitio:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadIntrusiones = async () => {
      try {
        const data = await fetchIntrusiones();
        if (!isMounted) return;
        setIntrusions(data);
        setError(null);
      } catch (err) {
        console.error('Error al cargar intrusiones:', err);
        if (!isMounted) return;
        setIntrusions(mockIntrusions);
        setError('No se pudo cargar el historial de intrusiones.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadIntrusiones();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEncoladosHc = async () => {
      setHcLoading(true);
      try {
        const response = await fetchIntrusionesEncoladasHc({
          search: hcSearch || undefined,
          orderBy: hcOrderBy,
          orderDir: hcOrderDir,
        });
        if (!isMounted) return;
        setHcQueue(response.data || []);
        setHcTotal(response.total || 0);
      } catch (err) {
        console.error('Error al cargar encolados HC:', err);
      } finally {
        if (isMounted) {
          setHcLoading(false);
        }
      }
    };

    loadEncoladosHc();

    return () => {
      isMounted = false;
    };
  }, [hcSearch, hcOrderBy, hcOrderDir]);

  useEffect(() => {
    let isMounted = true;

    const fetchFuerzas = async () => {
      try {
        const data = await getFuerzasReaccion();
        if (!isMounted) return;
        const lista = Array.isArray(data) ? data : [];
        setFuerzasReaccion(lista.filter((item) => item?.activo !== false));
      } catch (err) {
        console.error('Error al cargar fuerzas de reacción:', err);
      }
    };

    fetchFuerzas();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchSitiosPorConsola = async () => {
      const consoleName = session.console ?? localStorage.getItem('selectedConsole');
      if (!consoleName) {
        if (isMounted) {
          setSitios([]);
          clearSitioSeleccion();
        }
        return;
      }

      try {
        const consolaId = await resolveConsolaIdByName(consoleName);

        if (!isMounted) return;

        if (consolaId === null) {
          setSitios([]);
          clearSitioSeleccion();
          return;
        }

        const data = await getSitios({ consolaId });
        if (!isMounted) return;

        const lista = Array.isArray(data)
          ? data
          : ((data as { data?: Sitio[] } | null | undefined)?.data ?? []);

        setSitios(lista);
        setFormData((prev) => {
          if (!prev.sitioId) {
            return prev;
          }
          const exists = lista.some((sitio) => String(sitio.id) === prev.sitioId);
          if (exists) {
            return prev;
          }
          resetClientePersonaSelection();
          return { ...prev, sitioId: '' };
        });
      } catch (err) {
        console.error('Error cargando sitios por consola', err);
        if (isMounted) {
          setSitios([]);
          clearSitioSeleccion();
        }
      }
    };

    fetchSitiosPorConsola();

    return () => {
      isMounted = false;
    };
  }, [session.console]);

  useEffect(() => {
    let isMounted = true;

    const fetchTiposIntrusion = async () => {
      try {
        const data = await getAllTiposIntrusion();
        if (!isMounted) return;
        setTiposIntrusion(normalizeTiposIntrusion(data));
      } catch (err) {
        console.error('Error al cargar tipos de intrusión:', err);
        if (isMounted) {
          setTiposIntrusion([]);
        }
      }
    };

    fetchTiposIntrusion();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchMedios = async () => {
      try {
        const data = await getAllMediosComunicacion();
        if (!isMounted) return;
        setMediosComunicacion(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error al cargar medios de comunicación:', err);
      }
    };

    fetchMedios();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchConclusiones = async () => {
      try {
        const data = await getAllConclusionesEvento();
        if (!isMounted) return;
        const lista = Array.isArray(data) ? data : [];
        setConclusionesEvento(lista.filter((item) => item?.activo !== false));
      } catch (err) {
        console.error('Error al cargar conclusiones de evento:', err);
        if (isMounted) {
          setConclusionesEvento([]);
        }
      }
    };

    fetchConclusiones();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFechaEventoChange = (value: string | null) => {
    setFormData((prev) => ({
      ...prev,
      fecha_evento: value ?? '',
    }));
  };

  const handleFechaReaccionChange = (value: string | null) => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion: value ?? '',
    }));
  };

  const handleFechaReaccionFueraChange = (value: string | null) => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion_fuera: value ?? '',
      fecha_llegada_fuerza_reaccion: value ?? '',
    }));
  };

  const handleFechaReaccionEnviadaChange = (value: string | null) => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion_enviada: value ?? '',
    }));
  };

  const handleNoLlegoAlertaChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      no_llego_alerta: checked,
    }));
  };

  const handleMedioComunicacionChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      medio_comunicacion_id: value,
    }));
  };

  const resetProtocoloFields = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion_enviada: '',
      fecha_reaccion_fuera: '',
      fecha_llegada_fuerza_reaccion: '',
      conclusion_evento_id: '',
      sustraccion_material: false,
      fuerza_reaccion_id: '',
      necesita_protocolo: false,
    }));
  }, []);

  const findTipoIntrusionByLabel = useCallback(
    (
      label: string | null,
      options: TipoIntrusionCatalogItem[]
    ): TipoIntrusionCatalogItem | null => {
      const normalizedLabel = (label || '').trim().toLowerCase();
      if (!normalizedLabel) return null;

      return (
        options.find(
          (tipo) => tipo.descripcion.trim().toLowerCase() === normalizedLabel
        ) || null
      );
    },
    []
  );

  const applyTipoIntrusionSelection = useCallback(
    (option: TipoIntrusionCatalogItem | null) => {
      if (!option) {
        setTipoIntrusionId(NO_DEFINIDO_VALUE);
        setTipoDescripcion(NO_DEFINIDO_OPTION_LABEL);
        setRequiereProtocolo(false);
        setFormData((prev) => ({ ...prev, necesita_protocolo: false }));
        resetProtocoloFields();
        return;
      }

      setTipoIntrusionId(option.id);
      setTipoDescripcion(option.descripcion);
      const requiresProtocol = option.necesita_protocolo === true;
      setRequiereProtocolo(requiresProtocol);
      setFormData((prev) => ({
        ...prev,
        necesita_protocolo: requiresProtocol,
      }));

      if (!requiresProtocol) {
        resetProtocoloFields();
      }
    },
    [resetProtocoloFields]
  );

  useEffect(() => {
    if (!hcSeleccionado) return;

    const hcCategory = (hcSeleccionado.alarm_category || '').trim().toLowerCase();
    const map: Record<string, string> = {
      'no autorizado': 'No autorizado',
      'evento de robo': 'Evento de robo',
      verdadera: 'Autorizado',
      'recurrente verdadera': 'Autorizado',
    };

    const targetLabel = map[hcCategory] || hcSeleccionado.alarm_category || '';
    const matchedOption = findTipoIntrusionByLabel(targetLabel, tiposIntrusionConFallback);

    if (matchedOption) {
      applyTipoIntrusionSelection(matchedOption);
      return;
    }

    applyTipoIntrusionSelection(null);
  }, [
    applyTipoIntrusionSelection,
    findTipoIntrusionByLabel,
    hcSeleccionado,
    tiposIntrusionConFallback,
  ]);

  const handleTipoIntrusionChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { value } = event.target;
    if (!value) {
      setTipoIntrusionId('');
      setTipoDescripcion('');
      setRequiereProtocolo(false);
      resetProtocoloFields();
      return;
    }

    const selected = tiposIntrusionConFallback.find(
      (tipo) => String(tipo.id) === String(value)
    );
    applyTipoIntrusionSelection(selected ?? null);
  };

  const handleConclusionEventoChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      conclusion_evento_id: value,
    }));
  };

  const populateFormFromIntrusion = (intrusion: Intrusion) => {
    setEditingIntrusionId(intrusion.id);
    setFormData({
      origen: intrusion.origen ?? 'HC',
      hik_alarm_evento_id: intrusion.hik_alarm_evento_id
        ? String(intrusion.hik_alarm_evento_id)
        : null,
      fecha_evento: normalizeDateTimeLocalString(intrusion.fecha_evento),
      fecha_reaccion: intrusion.fecha_reaccion
        ? normalizeDateTimeLocalString(intrusion.fecha_reaccion)
        : '',
      fecha_reaccion_enviada: intrusion.fecha_reaccion_enviada
        ? normalizeDateTimeLocalString(intrusion.fecha_reaccion_enviada)
        : '',
      fecha_reaccion_fuera: intrusion.fecha_reaccion_fuera
        ? normalizeDateTimeLocalString(intrusion.fecha_reaccion_fuera)
        : '',
      fecha_llegada_fuerza_reaccion: intrusion.fecha_llegada_fuerza_reaccion
        ? normalizeDateTimeLocalString(intrusion.fecha_llegada_fuerza_reaccion)
        : intrusion.fecha_reaccion_fuera
        ? normalizeDateTimeLocalString(intrusion.fecha_reaccion_fuera)
        : '',
      sitioId: intrusion.sitio_id ? String(intrusion.sitio_id) : '',
      estado: intrusion.estado ?? '',
      descripcion: intrusion.descripcion ?? '',
      no_llego_alerta: intrusion.no_llego_alerta ?? false,
      medio_comunicacion_id: intrusion.medio_comunicacion_id
        ? String(intrusion.medio_comunicacion_id)
        : '',
      conclusion_evento_id: intrusion.conclusion_evento_id
        ? String(intrusion.conclusion_evento_id)
        : '',
      sustraccion_material: intrusion.sustraccion_material ?? false,
      fuerza_reaccion_id: intrusion.fuerza_reaccion_id
        ? String(intrusion.fuerza_reaccion_id)
        : '',
      completado: intrusion.completado ?? false,
      necesita_protocolo: intrusion.necesita_protocolo ?? false,
    });
    setRequiereProtocolo(Boolean(intrusion.necesita_protocolo));
    setTipoDescripcion(intrusion.tipo ?? '');
    setPersonaId(intrusion.persona_id ?? null);
    setSitioId(intrusion.sitio_id ?? null);
  };

  const handleAbrirEncolado = (row: IntrusionHcQueueRow) => {
    console.log('[ENCOLADOS HC] ABRIR -> NUEVA INTRUSION', row);
    setHcSeleccionado(row);

    setEditingIntrusionId(null);
    setFormData((prev) => ({
      ...prev,
      origen: 'HC',
      hik_alarm_evento_id:
        row?.hik_alarm_evento_id !== undefined && row?.hik_alarm_evento_id !== null
          ? String(row.hik_alarm_evento_id)
          : null,
      fecha_evento: normalizeDateTimeLocalString(row?.fecha_evento_hc || '') || prev.fecha_evento,
      no_llego_alerta: false,
    }));

    document
      .getElementById('nueva-intrusion-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleHcSort = (
    column: 'fecha_evento_hc' | 'region' | 'name' | 'trigger_event' | 'status' | 'alarm_category'
  ) => {
    setHcOrderBy((prev) => {
      if (prev === column) {
        setHcOrderDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setHcOrderDir('desc');
      return column;
    });
  };

  const handleSustraccionMaterialChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      sustraccion_material: checked,
    }));
  };

  const handleFuerzaReaccionChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      fuerza_reaccion_id: value,
    }));
  };

  const intrusionesTableData = useMemo<IntrusionConsolidadoRow[]>(
    () =>
      intrusions.map((intrusion) => ({
        id: intrusion.id ?? null,
        fechaHoraIntrusion: intrusion.fecha_evento ?? null,
        sitio: intrusion.sitio_nombre || intrusion.ubicacion || '',
        tipoIntrusion: intrusion.tipo ?? '',
        llegoAlerta: !(intrusion.no_llego_alerta ?? false),
        personalIdentificado: intrusion.personal_identificado?.trim() || '',
      })),
    [intrusions]
  );

  const handleSort = (field: keyof IntrusionConsolidadoRow) => {
    setSortField((prevField) => {
      if (prevField !== field) {
        setSortDirection('asc');
        return field;
      }
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
      return field;
    });
  };

  const sortedIntrusiones = useMemo(() => {
    if (!sortField) return intrusionesTableData;

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    return [...intrusionesTableData].sort((a, b) => {
      if (sortField === 'fechaHoraIntrusion') {
        const aDate = a.fechaHoraIntrusion ? new Date(a.fechaHoraIntrusion).getTime() : 0;
        const bDate = b.fechaHoraIntrusion ? new Date(b.fechaHoraIntrusion).getTime() : 0;
        return (aDate - bDate) * directionMultiplier;
      }

      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'boolean' || typeof bValue === 'boolean') {
        const aBool = aValue ? 1 : 0;
        const bBool = bValue ? 1 : 0;
        return (aBool - bBool) * directionMultiplier;
      }

      const aText = (aValue ?? '').toString().toLowerCase();
      const bText = (bValue ?? '').toString().toLowerCase();

      return aText.localeCompare(bText) * directionMultiplier;
    });
  }, [intrusionesTableData, sortDirection, sortField]);

  const validateCompletionBeforeSubmit = () => {
    if (!formData.completado) return [] as string[];

    const needsProtocol = requiereProtocolo || formData.necesita_protocolo;
    const missingFields: string[] = [];

    if (!formData.fecha_reaccion) missingFields.push('Fecha hora reacción');
    if (!formData.medio_comunicacion_id) missingFields.push('Medio de comunicación');
    if (!personaId) missingFields.push('Persona');

    if (needsProtocol) {
      if (!formData.fecha_reaccion_enviada) {
        missingFields.push('Fecha y hora reacción enviada');
      }
      if (!formData.fecha_llegada_fuerza_reaccion && !formData.fecha_reaccion_fuera) {
        missingFields.push('Fecha llegada fuerza reacción');
      }
      if (!formData.conclusion_evento_id) missingFields.push('Conclusión del evento');
    }

    return missingFields;
  };

  const renderSortIndicator = (field: keyof IntrusionConsolidadoRow) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const isSubmitDisabled = useMemo(() => {
    const tipoValue = tipoDescripcion.trim();
    const baseDisabled =
      !formData.fecha_evento ||
      !formData.sitioId ||
      !tipoValue ||
      isSubmitting;

    if (!requiereProtocolo) {
      return baseDisabled;
    }

    return (
      baseDisabled ||
      !formData.fecha_reaccion ||
      !formData.fecha_reaccion_fuera ||
      !formData.conclusion_evento_id ||
      !formData.fuerza_reaccion_id
    );
  }, [
    formData.conclusion_evento_id,
    formData.fecha_evento,
    formData.fecha_reaccion,
    formData.fecha_reaccion_fuera,
    formData.fuerza_reaccion_id,
    formData.sitioId,
    isSubmitting,
    requiereProtocolo,
    tipoDescripcion,
  ]);

  const noLlegoDisabled = useMemo(
    () => isNoLlegoDisabled(formData),
    [formData.hik_alarm_evento_id, formData.origen]
  );

  useEffect(() => {
    if (noLlegoDisabled && formData.no_llego_alerta) {
      setFormData((prev) => ({ ...prev, no_llego_alerta: false }));
    }
  }, [formData.no_llego_alerta, noLlegoDisabled]);

  useEffect(() => {
    if (formData.fecha_evento && formData.fecha_reaccion) {
      const intrusion = new Date(formData.fecha_evento);
      const reaccion = new Date(formData.fecha_reaccion);

      const intrusionTime = intrusion.getTime();
      const reaccionTime = reaccion.getTime();

      if (
        !Number.isNaN(intrusionTime) &&
        !Number.isNaN(reaccionTime) &&
        reaccionTime < intrusionTime
      ) {
        setFechaReaccionError(
          'La fecha y hora de reacción debe ser mayor o igual a la fecha y hora de intrusión.'
        );
        return;
      }
    }

    setFechaReaccionError('');
  }, [formData.fecha_evento, formData.fecha_reaccion]);

  useEffect(() => {
    if (!requiereProtocolo) {
      setFechaReaccionFueraError('');
      return;
    }

    if (!formData.fecha_reaccion_fuera) {
      setFechaReaccionFueraError('');
      return;
    }

    if (!formData.fecha_reaccion) {
      setFechaReaccionFueraError(
        'Debe ingresar la fecha y hora de reacción antes de la llegada de la fuerza de reacción.'
      );
      return;
    }

    const fechaReaccionDate = new Date(formData.fecha_reaccion);
    const fechaReaccionFueraDate = new Date(formData.fecha_reaccion_fuera);

    if (Number.isNaN(fechaReaccionDate.getTime())) {
      setFechaReaccionFueraError('La fecha y hora de reacción no es válida.');
      return;
    }

    if (Number.isNaN(fechaReaccionFueraDate.getTime())) {
      setFechaReaccionFueraError(
        'La fecha y hora de llegada de la fuerza de reacción no es válida.'
      );
      return;
    }

    if (fechaReaccionFueraDate <= fechaReaccionDate) {
      setFechaReaccionFueraError(
        'La fecha y hora de llegada de la fuerza de reacción debe ser posterior a la fecha y hora de reacción.'
      );
      return;
    }

    setFechaReaccionFueraError('');
  }, [
    formData.fecha_reaccion,
    formData.fecha_reaccion_fuera,
    requiereProtocolo,
  ]);

  useEffect(() => {
    setDisableSave(Boolean(fechaReaccionError || fechaReaccionFueraError));
  }, [fechaReaccionError, fechaReaccionFueraError]);

  const isButtonDisabled = isSubmitDisabled || disableSave;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);

    const completionMissing = validateCompletionBeforeSubmit();
    if (completionMissing.length) {
      setError(`Complete los campos requeridos: ${completionMissing.join(', ')}`);
      return;
    }

    if (fechaReaccionError || fechaReaccionFueraError) {
      return;
    }

    const tipoValue = tipoDescripcion.trim();
    if (!tipoValue) {
      setError('Debe seleccionar un tipo de intrusión.');
      return;
    }

    if (!formData.sitioId) {
      alert('Debe seleccionar un sitio.');
      return;
    }

    const sitioIdNumber = sitioId ?? Number(formData.sitioId);
    if (!Number.isInteger(sitioIdNumber)) {
      alert('El sitio seleccionado no es válido.');
      return;
    }

    const sitioSeleccionado =
      sitios.find((sitio) => sitio.id === sitioIdNumber) ??
      sitios.find((sitio) => String(sitio.id) === formData.sitioId) ??
      null;

    if (formData.fecha_evento && formData.fecha_reaccion) {
      const fechaEventoDate = new Date(formData.fecha_evento);
      const fechaReaccionDate = new Date(formData.fecha_reaccion);

      if (
        !Number.isNaN(fechaEventoDate.getTime()) &&
        !Number.isNaN(fechaReaccionDate.getTime())
      ) {
        const diffMs = fechaReaccionDate.getTime() - fechaEventoDate.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        if (diffMinutes > 5) {
          const confirmationMessage =
            'La diferencia entre la fecha/hora de intrusión y la fecha/hora de reacción es mayor a 5 minutos. ¿Confirma que los datos son correctos?';
          const continuar =
            typeof window === 'undefined' ? true : window.confirm(confirmationMessage);
          if (!continuar) {
            return;
          }
        }
      }
    }

    if (requiereProtocolo) {
      if (!formData.fecha_reaccion) {
        alert(
          'Debe ingresar la fecha y hora de reacción antes de la llegada de la fuerza de reacción.'
        );
        return;
      }

      if (!formData.fecha_reaccion_fuera) {
        alert('Debe ingresar la fecha y hora de llegada de la fuerza de reacción.');
        return;
      }

      const fechaReaccionDate = new Date(formData.fecha_reaccion);
      const fechaReaccionFueraDate = new Date(formData.fecha_reaccion_fuera);

      if (Number.isNaN(fechaReaccionDate.getTime())) {
        alert('La fecha y hora de reacción no es válida.');
        return;
      }

      if (Number.isNaN(fechaReaccionFueraDate.getTime())) {
        alert('La fecha y hora de llegada de la fuerza de reacción no es válida.');
        return;
      }

      if (fechaReaccionFueraDate <= fechaReaccionDate) {
        alert(
          'La fecha y hora de llegada de la fuerza de reacción debe ser posterior a la fecha y hora de reacción.'
        );
        return;
      }

      if (!formData.conclusion_evento_id) {
        alert('Debe seleccionar la conclusión del evento.');
        return;
      }

      if (!formData.fuerza_reaccion_id) {
        alert('Debe seleccionar la fuerza de reacción enviada.');
        return;
      }
    }

    const medioId = formData.medio_comunicacion_id
      ? Number(formData.medio_comunicacion_id)
      : null;
    const medioComunicacionValue =
      medioId !== null && Number.isNaN(medioId) ? null : medioId;

    const conclusionId = formData.conclusion_evento_id
      ? Number(formData.conclusion_evento_id)
      : null;
    const conclusionEventoValue =
      conclusionId !== null && Number.isNaN(conclusionId) ? null : conclusionId;
    const fuerzaReaccionId = formData.fuerza_reaccion_id
      ? Number(formData.fuerza_reaccion_id)
      : null;
    const fuerzaReaccionValue =
      fuerzaReaccionId !== null && Number.isNaN(fuerzaReaccionId)
        ? null
        : fuerzaReaccionId;

    const fechaEventoIso = toIsoString(formData.fecha_evento);
    const fechaReaccionIso = toIsoString(formData.fecha_reaccion);
    const fechaReaccionEnviadaIso = toIsoString(formData.fecha_reaccion_enviada);
    const fechaLlegadaIso =
      toIsoString(formData.fecha_llegada_fuerza_reaccion || formData.fecha_reaccion_fuera) ||
      formData.fecha_llegada_fuerza_reaccion ||
      formData.fecha_reaccion_fuera;

    const ubicacionValue = sitioSeleccionado?.nombre?.trim() || '';
    const necesitaProtocolo = requiereProtocolo || formData.necesita_protocolo;

    if (formData.completado) {
      const missing: string[] = [];
      if (!formData.fecha_reaccion) missing.push('fecha_reaccion');
      if (!medioComunicacionValue) missing.push('medio_comunicacion_id');
      if (!personaId) missing.push('persona_id');
      if (necesitaProtocolo) {
        if (!formData.fecha_reaccion_enviada) missing.push('fecha_reaccion_enviada');
        if (!fechaLlegadaIso) missing.push('fecha_llegada_fuerza_reaccion');
        if (!conclusionEventoValue) missing.push('conclusion_evento_id');
        if (formData.sustraccion_material === undefined) missing.push('sustraccion_material');
      }

      if (missing.length) {
        setError(`Faltan campos obligatorios: ${missing.join(', ')}`);
        return;
      }
    }

    setIsSubmitting(true);

    const payload: IntrusionPayload = {
      origen: formData.origen,
      hik_alarm_evento_id: formData.hik_alarm_evento_id
        ? Number(formData.hik_alarm_evento_id)
        : null,
      fecha_evento: fechaEventoIso || formData.fecha_evento,
      fecha_reaccion: fechaReaccionIso || null,
      fecha_reaccion_enviada: necesitaProtocolo && formData.fecha_reaccion_enviada
        ? fechaReaccionEnviadaIso || formData.fecha_reaccion_enviada
        : null,
      fecha_llegada_fuerza_reaccion:
        necesitaProtocolo && fechaLlegadaIso ? fechaLlegadaIso : null,
      fecha_reaccion_fuera:
        necesitaProtocolo && formData.fecha_reaccion_fuera ? fechaLlegadaIso : null,
      ubicacion: ubicacionValue,
      tipo: tipoValue,
      estado: formData.estado || '',
      descripcion: formData.descripcion?.trim() || '',
      no_llego_alerta:
        formData.origen === 'HC' || formData.hik_alarm_evento_id ? false : formData.no_llego_alerta,
      medio_comunicacion_id: medioComunicacionValue,
      conclusion_evento_id: necesitaProtocolo ? conclusionEventoValue : null,
      sustraccion_material: necesitaProtocolo ? formData.sustraccion_material : false,
      sitio_id: sitioIdNumber,
      fuerza_reaccion_id:
        necesitaProtocolo && fuerzaReaccionValue !== null ? fuerzaReaccionValue : null,
      persona_id: personaId,
      completado: formData.completado,
      necesita_protocolo: necesitaProtocolo,
    };

    try {
      console.log('[INTRUSIONES][UI] payload:', payload);
      const saved = editingIntrusionId
        ? await updateIntrusion(editingIntrusionId, payload)
        : await createIntrusion(payload);

      const enriched =
        saved.sitio_nombre || !sitioSeleccionado
          ? saved
          : { ...saved, sitio_nombre: sitioSeleccionado.nombre };

      setIntrusions((prev) =>
        editingIntrusionId
          ? prev.map((item) => (item.id === enriched.id ? enriched : item))
          : [enriched, ...prev]
      );
      resetClientePersonaSelection();
      setFormData(buildInitialFormData());
      setTipoIntrusionId('');
      setTipoDescripcion('');
      setRequiereProtocolo(false);
      setEditingIntrusionId(null);
    } catch (err) {
      console.error('Error al registrar intrusión:', err);
      const backendMessage = err instanceof Error && err.message ? err.message : null;
      setError(
        backendMessage
          ? `No se pudo registrar la intrusión. ${backendMessage}`
          : 'No se pudo registrar la intrusión. Intente nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Registro de Intrusiones</h3>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-[#1C2E4A] text-lg font-semibold">Encolados HC</h4>
            <p className="text-xs text-gray-500">Abrir eventos provenientes de HikCentral.</p>
          </div>
          <input
            type="text"
            value={hcSearch}
            onChange={(e) => setHcSearch(e.target.value)}
            placeholder="Buscar por región, nombre o evento"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'fecha_evento_hc', label: 'Fecha evento HC' },
                  { key: 'region', label: 'Región' },
                  { key: 'name', label: 'Nombre' },
                  { key: 'trigger_event', label: 'Evento' },
                  { key: 'status', label: 'Estado' },
                  { key: 'alarm_category', label: 'Categoría' },
                  { key: 'intrusion_id', label: 'Intrusión vinculada' },
                  { key: 'completado', label: 'Completado' },
                  { key: 'acciones', label: 'Acciones' },
                ].map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.key === 'acciones' ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() =>
                          handleHcSort(
                            column.key as
                              | 'fecha_evento_hc'
                              | 'region'
                              | 'name'
                              | 'trigger_event'
                              | 'status'
                              | 'alarm_category'
                          )
                        }
                      >
                        <span>{column.label}</span>
                        {hcOrderBy === column.key && (
                          <span className="text-[10px] text-gray-500">{hcOrderDir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hcLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-3 text-center text-gray-500">
                    Cargando eventos de HC...
                  </td>
                </tr>
              ) : hcQueue.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-3 text-center text-gray-500">
                    No hay eventos encolados.
                  </td>
                </tr>
              ) : (
                hcQueue.map((row) => {
                  const categoria = (row.alarm_category
                    ?? (row as Record<string, unknown>).ALARM_CATEGORY
                    ?? (row as Record<string, unknown>).alarmCategory
                    ?? (row as Record<string, unknown>).category
                    ?? ""
                  )
                    .toString()
                    .trim();

                  return (
                    <tr
                      key={`${row.hik_alarm_evento_id}-${row.fecha_evento_hc || ''}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-gray-700">
                        {row.fecha_evento_hc ? new Date(row.fecha_evento_hc).toLocaleString() : 'Sin fecha'}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{row.region || 'Sin región'}</td>
                      <td className="px-4 py-2 text-gray-700">{row.name || 'Sin nombre'}</td>
                      <td className="px-4 py-2 text-gray-700">{row.trigger_event || 'Sin evento'}</td>
                      <td className="px-4 py-2 text-gray-700">{row.status || 'Sin estado'}</td>
                      <td className="px-4 py-2 text-gray-700">{categoria ? categoria : 'Sin categoría'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {row.intrusion_id ? `#${row.intrusion_id}` : 'Sin intrusión'}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{row.completado ? 'Sí' : 'No'}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-semibold bg-[#F9C300] text-[#1C2E4A] rounded hover:bg-yellow-400"
                          onClick={() => handleAbrirEncolado(row)}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Total: {hcTotal}</p>
      </div>

      <div id="nueva-intrusion-form" className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Reportar Nuevo Evento</h4>
          {hcSeleccionado && (
            <span className="text-xs text-gray-600">
              Evento HC seleccionado #{hcSeleccionado.hik_alarm_evento_id}
            </span>
          )}
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-[#1C2E4A] text-base font-semibold mb-4">
              Datos del evento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <DateTimeInput
                  id="fecha_evento"
                  name="fecha_evento"
                  label="Fecha y hora del evento"
                  value={formData.fecha_evento}
                  onChange={handleFechaEventoChange}
                  required
                  max={getDateTimeInputLimit() || undefined}
                />
                <DateTimeInput
                  id="fecha_reaccion"
                  name="fecha_reaccion"
                  label="Fecha hora reacción"
                  value={formData.fecha_reaccion}
                  onChange={handleFechaReaccionChange}
                  error={fechaReaccionError}
                  max={getDateTimeInputLimit() || undefined}
                />
                <div>
                  <label htmlFor="medio_comunicacion_id" className="block text-sm font-medium text-gray-700">
                    Medio de comunicación
                  </label>
                  <select
                    id="medio_comunicacion_id"
                    name="medio_comunicacion_id"
                    value={formData.medio_comunicacion_id}
                    onChange={handleMedioComunicacionChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {mediosComunicacion.map((medio) => (
                      <option key={medio.id} value={medio.id}>
                        {medio.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
                    Tipo de Evento
                  </label>
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <select
                        name="tipo"
                        id="tipo"
                        value={tipoIntrusionId === '' ? '' : String(tipoIntrusionId)}
                        onChange={handleTipoIntrusionChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Seleccione...</option>
                        {tiposIntrusionConFallback.map((tipoIntrusion) => (
                          <option key={tipoIntrusion.id} value={tipoIntrusion.id}>
                            {tipoIntrusion.descripcion}
                          </option>
                        ))}
                      </select>
                      {requiereProtocolo && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 uppercase tracking-wide">
                          Con protocolo
                        </span>
                      )}
                    </div>
                    {String(tipoIntrusionId) === NO_DEFINIDO_VALUE && (
                      <p className="text-xs text-gray-500">
                        No se encontró coincidencia con el evento de HC. Seleccione manualmente.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Sitio
                  </label>
                  <select
                    value={formData.sitioId}
                    onChange={(event) => {
                      const { value } = event.target;
                      setFormData((prev) => ({ ...prev, sitioId: value }));
                      const parsedValue = value ? Number(value) : null;
                      handleChangeSitio(
                        parsedValue !== null && !Number.isNaN(parsedValue) ? parsedValue : null
                      );
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {sitios.map((sitio) => (
                      <option key={sitio.id} value={sitio.id}>
                        {sitio.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={clienteNombre}
                    disabled
                    placeholder="Cliente asociado al sitio"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Persona
                  </label>
                  <select
                    value={personaId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPersonaId(value ? Number(value) : null);
                    }}
                    disabled={!clienteId || personasCliente.length === 0}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">
                      {clienteId ? 'Seleccione una persona' : 'Seleccione primero un sitio'}
                    </option>
                    {personasCliente.map((p) => {
                      const nombreCompleto = `${p.nombre} ${p.apellido}`.trim();
                      const etiqueta = p.cargo
                        ? `${nombreCompleto} - ${p.cargo}`
                        : nombreCompleto;

                      return (
                        <option key={p.id} value={p.id}>
                          {etiqueta}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="no_llego_alerta"
                    name="no_llego_alerta"
                    checked={noLlegoDisabled ? false : formData.no_llego_alerta}
                    onChange={handleNoLlegoAlertaChange}
                    disabled={noLlegoDisabled}
                    className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="no_llego_alerta" className="text-sm font-medium text-gray-700">
                    No llegó alerta
                  </label>
                </div>
              </div>
              {hcSeleccionado && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <input
                      type="text"
                      value={hcSeleccionado.source || '—'}
                      readOnly
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Alarm Acknowledgment Time
                    </label>
                    <input
                      type="text"
                      value={formatDateTimeForDisplay(hcSeleccionado.alarm_acknowledgment_time)}
                      readOnly
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {requiereProtocolo && (
              <div className="mt-6 border-l-4 border-yellow-400 bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[#1C2E4A] text-base font-semibold">Protocolo de reacción</h3>
                    <p className="text-xs text-gray-600">
                      Campos requeridos para tipos de evento que activan protocolo.
                    </p>
                  </div>
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-full bg-yellow-200 text-yellow-800 uppercase tracking-wide">
                    Requiere protocolo
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <DateTimeInput
                      id="fecha_reaccion_enviada"
                      name="fecha_reaccion_enviada"
                      label="Fecha y hora de reacción enviada"
                      value={formData.fecha_reaccion_enviada}
                      onChange={handleFechaReaccionEnviadaChange}
                      max={getDateTimeInputLimit() || undefined}
                    />
                    <DateTimeInput
                      id="fecha_reaccion_fuera"
                      name="fecha_reaccion_fuera"
                      label="FECHA Y HORA DE LLEGADA FUERZA DE REACCION"
                      value={formData.fecha_reaccion_fuera}
                      onChange={handleFechaReaccionFueraChange}
                      error={fechaReaccionFueraError}
                      max={getDateTimeInputLimit() || undefined}
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="sustraccion_material"
                        name="sustraccion_material"
                        checked={formData.sustraccion_material}
                        onChange={handleSustraccionMaterialChange}
                        className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                      />
                      <label htmlFor="sustraccion_material" className="text-sm font-medium text-gray-700">
                        Sustracción de material
                      </label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="conclusion_evento_id"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Conclusión del evento
                      </label>
                      <select
                        id="conclusion_evento_id"
                        name="conclusion_evento_id"
                        value={formData.conclusion_evento_id}
                        onChange={handleConclusionEventoChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Seleccione...</option>
                        {conclusionesEvento.map((conclusion) => (
                          <option key={conclusion.id} value={conclusion.id}>
                            {conclusion.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Fuerza de reacción enviada
                      </label>
                      <select
                        value={formData.fuerza_reaccion_id}
                        onChange={handleFuerzaReaccionChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="">Seleccione...</option>
                        {fuerzasReaccion.map((fuerza) => (
                          <option key={fuerza.id} value={fuerza.id}>
                            {fuerza.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="completado"
              name="completado"
              checked={formData.completado}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, completado: event.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
            />
            <label htmlFor="completado" className="text-sm font-medium text-gray-700">
              Marcar como completado
            </label>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {error && (
              <p className="w-full text-right text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={isButtonDisabled}
              className={`px-6 py-2 font-semibold rounded-md transition-colors ${
                isButtonDisabled
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-[#F9C300] text-[#1C2E4A] hover:bg-yellow-400'
              }`}
            >
              {isSubmitting
                ? 'Guardando...'
                : editingIntrusionId
                ? 'Actualizar Evento'
                : 'Registrar Evento'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Intrusiones</h4>
          {loading && <span className="text-sm text-gray-500">Cargando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {intrusionesColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort(column.key as keyof IntrusionConsolidadoRow)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{column.header}</span>
                      <span className="text-xs">{renderSortIndicator(column.key as keyof IntrusionConsolidadoRow)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedIntrusiones.length === 0 ? (
                <tr>
                  <td
                    colSpan={intrusionesColumns.length}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No hay intrusiones registradas.
                  </td>
                </tr>
              ) : (
                sortedIntrusiones.map((row) => (
                  <tr key={row.id ?? `${row.sitio}-${row.fechaHoraIntrusion}`} className="hover:bg-gray-50">
                    {intrusionesColumns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Intrusions;
