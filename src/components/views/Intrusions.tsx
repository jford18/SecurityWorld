import React, { useEffect, useMemo, useState } from 'react';
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import { intrusionsData as mockIntrusions } from '../../data/mockData';
import { Intrusion, IntrusionConsolidadoRow } from '../../types';
import {
  createIntrusion,
  fetchIntrusiones,
  IntrusionPayload,
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

type TipoIntrusionCatalogItem = {
  id: number;
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
  fecha_evento: string;
  fecha_reaccion: string;
  fecha_reaccion_fuera: string;
  sitioId: string;
  estado: string;
  descripcion: string;
  llego_alerta: boolean;
  medio_comunicacion_id: string;
  conclusion_evento_id: string;
  sustraccion_material: boolean;
  fuerza_reaccion_id: string;
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
  return now.toISOString();
};

const buildInitialFormData = (): IntrusionFormData => ({
  fecha_evento: getInitialDateTimeValue(),
  fecha_reaccion: '',
  fecha_reaccion_fuera: '',
  sitioId: '',
  estado: '',
  descripcion: '',
  llego_alerta: false,
  medio_comunicacion_id: '',
  conclusion_evento_id: '',
  sustraccion_material: false,
  fuerza_reaccion_id: '',
});

const Intrusions: React.FC = () => {
  const [formData, setFormData] = useState<IntrusionFormData>(buildInitialFormData());
  const [intrusions, setIntrusions] = useState<Intrusion[]>([]);
  const [mediosComunicacion, setMediosComunicacion] = useState<MedioComunicacionDTO[]>([]);
  const [tiposIntrusion, setTiposIntrusion] = useState<TipoIntrusionCatalogItem[]>([]);
  const [conclusionesEvento, setConclusionesEvento] = useState<ConclusionEventoDTO[]>([]);
  const [tipoIntrusionId, setTipoIntrusionId] = useState<number | ''>('');
  const [tipoDescripcion, setTipoDescripcion] = useState('');
  const [requiereProtocolo, setRequiereProtocolo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fechaReaccionError, setFechaReaccionError] = useState('');
  const [fechaReaccionFueraError, setFechaReaccionFueraError] = useState('');
  const [disableSave, setDisableSave] = useState(false);
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

  const handleFechaEventoChange = (isoValue: string) => {
    setFormData((prev) => ({
      ...prev,
      fecha_evento: isoValue,
    }));
  };

  const handleFechaReaccionChange = (isoValue: string) => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion: isoValue,
    }));
  };

  const handleFechaReaccionFueraChange = (isoValue: string) => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion_fuera: isoValue,
    }));
  };

  const handleLlegoAlertaChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      llego_alerta: checked,
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

  const resetProtocoloFields = () => {
    setFormData((prev) => ({
      ...prev,
      fecha_reaccion_fuera: '',
      conclusion_evento_id: '',
      sustraccion_material: false,
      fuerza_reaccion_id: '',
    }));
  };

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

    const parsedId = Number(value);
    setTipoIntrusionId(Number.isNaN(parsedId) ? '' : parsedId);

    const selected = tiposIntrusion.find((tipo) => tipo.id === parsedId);
    if (!selected) {
      setTipoDescripcion('');
      setRequiereProtocolo(false);
      resetProtocoloFields();
      return;
    }

    setTipoDescripcion(selected.descripcion);
    const requiresProtocol = selected.necesita_protocolo === true;
    setRequiereProtocolo(requiresProtocol);

    if (!requiresProtocol) {
      resetProtocoloFields();
    }
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
        llegoAlerta: intrusion.llego_alerta ?? false,
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

  useEffect(() => {
    if (formData.fecha_evento && formData.fecha_reaccion) {
      const intrusion = new Date(formData.fecha_evento);
      const reaccion = new Date(formData.fecha_reaccion);

      if (
        !Number.isNaN(intrusion.getTime()) &&
        !Number.isNaN(reaccion.getTime()) &&
        reaccion <= intrusion
      ) {
        setFechaReaccionError(
          'La fecha y hora de reacción debe ser mayor que la fecha y hora de intrusión.'
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

    setIsSubmitting(true);

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

    const payload: IntrusionPayload = {
      fecha_evento: formData.fecha_evento,
      fecha_reaccion: formData.fecha_reaccion || null,
      fecha_reaccion_fuera:
        requiereProtocolo && formData.fecha_reaccion_fuera
          ? formData.fecha_reaccion_fuera
          : null,
      ubicacion: '',
      tipo: tipoValue,
      estado: formData.estado || '',
      descripcion: formData.descripcion?.trim() || '',
      llego_alerta: formData.llego_alerta,
      medio_comunicacion_id: medioComunicacionValue,
      conclusion_evento_id: requiereProtocolo ? conclusionEventoValue : null,
      sustraccion_material: requiereProtocolo ? formData.sustraccion_material : false,
      sitio_id: sitioIdNumber,
      fuerza_reaccion_id:
        requiereProtocolo && fuerzaReaccionValue !== null
          ? fuerzaReaccionValue
          : null,
      persona_id: personaId,
    };

    try {
      const created = await createIntrusion(payload);
      const enriched =
        created.sitio_nombre || !sitioSeleccionado
          ? created
          : { ...created, sitio_nombre: sitioSeleccionado.nombre };
      setIntrusions((prev) => [enriched, ...prev]);
      resetClientePersonaSelection();
      setFormData(buildInitialFormData());
      setTipoIntrusionId('');
      setTipoDescripcion('');
      setRequiereProtocolo(false);
    } catch (err) {
      console.error('Error al registrar intrusión:', err);
      setError('No se pudo registrar la intrusión. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Registro de Intrusiones</h3>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Reportar Nueva Intrusión</h4>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-[#1C2E4A] text-base font-semibold mb-4">
              Datos de la intrusión
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <FechaHoraFalloPicker
                  id="fecha_evento"
                  name="fecha_evento"
                  label="Fecha y hora del evento"
                  value={formData.fecha_evento}
                  onChange={handleFechaEventoChange}
                  timeIntervalMinutes={1} /* Intervalo de minutos a 1 para Intrusiones */
                  required
                />
                <FechaHoraFalloPicker
                  id="fecha_reaccion"
                  name="fecha_reaccion"
                  label="Fecha hora reacción"
                  value={formData.fecha_reaccion}
                  onChange={handleFechaReaccionChange}
                  timeIntervalMinutes={1} /* Intervalo de minutos a 1 para Intrusiones */
                  error={fechaReaccionError}
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
                    Tipo de Intrusión
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      name="tipo"
                      id="tipo"
                      value={tipoIntrusionId === '' ? '' : String(tipoIntrusionId)}
                      onChange={handleTipoIntrusionChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Seleccione...</option>
                      {tiposIntrusion.map((tipoIntrusion) => (
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
                    id="llego_alerta"
                    name="llego_alerta"
                    checked={formData.llego_alerta}
                    onChange={handleLlegoAlertaChange}
                    className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                  />
                  <label htmlFor="llego_alerta" className="text-sm font-medium text-gray-700">
                    Llegó alerta
                  </label>
                </div>
              </div>
            </div>

            {requiereProtocolo && (
              <div className="mt-6 border-l-4 border-yellow-400 bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[#1C2E4A] text-base font-semibold">Protocolo de reacción</h3>
                    <p className="text-xs text-gray-600">
                      Campos requeridos para tipos de intrusión que activan protocolo.
                    </p>
                  </div>
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-full bg-yellow-200 text-yellow-800 uppercase tracking-wide">
                    Requiere protocolo
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <FechaHoraFalloPicker
                      id="fecha_reaccion_fuera"
                      name="fecha_reaccion_fuera"
                      label="FECHA Y HORA DE LLEGADA FUERZA DE REACCION"
                      value={formData.fecha_reaccion_fuera}
                      onChange={handleFechaReaccionFueraChange}
                      timeIntervalMinutes={1}
                      error={fechaReaccionFueraError}
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
              {isSubmitting ? 'Registrando...' : 'Registrar Intrusión'}
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