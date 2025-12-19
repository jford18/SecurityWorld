import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import DateTimeInput, { normalizeDateTimeLocalString } from '../ui/DateTimeInput';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';
import { TechnicalFailure, TechnicalFailureCatalogs, CatalogoNodo } from '../../types';
import { Sitio, getSitios } from '../../services/sitiosService';
import { resolveConsolaIdByName } from '../../services/consolasService';
import { getAllTipoEquipoAfectado } from '../../services/tipoEquipoAfectadoService';
import {
  fetchFallos,
  createFallo,
  fetchCatalogos,
  TechnicalFailurePayload,
  getNodos,
  getNodoSitios,
  SitioAsociado,
  getEncodingDevicesBySite,
  getIpSpeakersBySite,
  CameraCatalogItem,
} from '../../services/fallosService';
import api from '../../services/api';
import TechnicalFailuresHistory from './TechnicalFailuresHistory';

type AffectationType = 'Nodo' | 'Punto' | 'Equipo' | 'Masivo' | '';

type FailureFormData = {
  fechaHoraFallo: string;
  affectationType: AffectationType;
  tipoProblema: string;
  reportadoCliente: boolean;
  nodo: string;
  tipoEquipoAfectadoId: string;
  tipoEquipoAfectadoNombre: string;
  camara: string;
  tipoProblemaEquipo: string;
  sitioId: string;
  encodingDeviceId: string;
  ipSpeakerId: string;
};

const toLocalDateTimeString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getLocalDateTimeValue = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalDateTimeString(now);
};

const buildInitialFormData = (): FailureFormData => ({
  fechaHoraFallo: getLocalDateTimeValue(),
  affectationType: '',
  tipoProblema: '',
  reportadoCliente: false,
  nodo: '',
  tipoEquipoAfectadoId: '',
  tipoEquipoAfectadoNombre: '',
  camara: '',
  tipoProblemaEquipo: '',
  sitioId: '',
  encodingDeviceId: '',
  ipSpeakerId: '',
});

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

const resolveSitioClienteNombre = (sitio: Sitio | null | undefined): string | null =>
  sitio?.clienteNombre ?? sitio?.cliente_nombre ?? null;

const hasHttpStatusResponse = (
  error: unknown
): error is { response?: { status?: number } } => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

const isDeviceFromHC = (dispositivo: unknown): boolean => {
  if (!dispositivo || typeof dispositivo !== 'object') return false;

  const device = dispositivo as {
    origen_equipo?: unknown;
    origen?: unknown;
    origenEquipo?: unknown;
    esHc?: unknown;
    esHC?: unknown;
    provieneDeHc?: unknown;
    provieneDeHC?: unknown;
  };

  const flag =
    device.esHc ?? device.esHC ?? device.provieneDeHc ?? device.provieneDeHC;

  if (typeof flag === 'boolean') {
    return flag;
  }

  const origen = device.origen_equipo ?? device.origen ?? device.origenEquipo;
  if (typeof origen === 'string') {
    return origen.trim().toUpperCase() === 'HC';
  }

  return true;
};

const normalizeText = (text: string) =>
  (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const TechnicalFailuresOperador: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [formData, setFormData] = useState<FailureFormData>(buildInitialFormData());
  const [errors, setErrors] = useState<Partial<FailureFormData>>({});
  const [cliente, setCliente] = useState<string | null>(null);
  const [clienteFromConsole, setClienteFromConsole] = useState<string | null>(null);
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [cameras, setCameras] = useState<CameraCatalogItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isLoadingCamaras, setIsLoadingCamaras] = useState(false);
  const [encodingDevices, setEncodingDevices] = useState<
    { id: number; name: string }[]
  >([]);
  const [ipSpeakers, setIpSpeakers] = useState<Array<{ id: number; name: string }>>([]);
  const [sitiosNodo, setSitiosNodo] = useState<SitioAsociado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nodos, setNodos] = useState<CatalogoNodo[]>([]);
  const [nodosError, setNodosError] = useState<string | null>(null);
  const [isLoadingNodos, setIsLoadingNodos] = useState(false);
  const [tiposEquipoAfectado, setTiposEquipoAfectado] = useState<
    Array<{ id: number; nombre: string }>
  >([]);
  const [nodoSitioError, setNodoSitioError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[GRABADOR] api.baseURL:', api?.defaults?.baseURL);
  }, []);

  const getSelectedDispositivo = (camaraValue: string) => {
    if (!camaraValue) return null;

    return (
      catalogos.dispositivos.find(
        (dispositivo) => String(dispositivo.id ?? '') === String(camaraValue)
      ) || catalogos.dispositivos.find((dispositivo) => dispositivo.nombre === camaraValue) || null
    );
  };

  const selectedDispositivo = useMemo(
    () => getSelectedDispositivo(formData.camara),
    [catalogos.dispositivos, formData.camara]
  );

  const equipoEsHC = useMemo(() => isDeviceFromHC(selectedDispositivo), [selectedDispositivo]);

  const isCameraEquipmentSelected = useMemo(() => {
    const normalizedNombre = normalizeText(tipoEquipoAfectadoNombreValue);

    return (
      isEquipoAfectacion &&
      (normalizedNombre === normalizeText('cámaras') ||
        normalizedNombre === normalizeText('camara') ||
        normalizedNombre === 'camaras')
    );
  }, [isEquipoAfectacion, tipoEquipoAfectadoNombreValue]);

  const showCameraField = isCameraEquipmentSelected;
  const tipoEquipoAfectadoNombreValue = String(formData?.tipoEquipoAfectadoNombre || '');

  const isEquipoAfectacion =
    normalizeText(String(formData?.affectationType || '')) === normalizeText('Equipo');

  const showIpSpeakerField =
    isEquipoAfectacion &&
    (normalizeText(tipoEquipoAfectadoNombreValue) === normalizeText('Megáfono IP') ||
      normalizeText(tipoEquipoAfectadoNombreValue) === normalizeText('Megafono IP'));
  const tipoEquipoAfectadoSel = useMemo(() => {
    const id = formData?.tipoEquipoAfectadoId;
    if (!id) return null;
    return (tiposEquipoAfectado || []).find((x: any) => String(x.id) === String(id)) ?? null;
  }, [formData?.tipoEquipoAfectadoId, tiposEquipoAfectado]);

  const isGrabadorSelected =
    normalizeText(String(formData?.tipoEquipoAfectadoNombre || '')) === normalizeText('Grabador');
  const showEncodingDeviceField = isEquipoAfectacion && isGrabadorSelected;

  const selectedCamera = useMemo(
    () => cameras.find((camera) => String(camera.id) === String(selectedCameraId)) ?? null,
    [cameras, selectedCameraId],
  );

  const sitiosItems = useMemo(
    () => [
      { id: 'empty', nombre: 'Seleccione...', value: '' },
      ...sitios.map((sitioItem) => ({
        id: String(sitioItem.id),
        nombre: sitioItem.nombre,
        value: String(sitioItem.id),
      })),
    ],
    [sitios]
  );

  console.log('[GRABADOR] affectationType:', formData?.affectationType);
  console.log('[GRABADOR] tipoEquipoAfectadoId:', formData?.tipoEquipoAfectadoId);
  console.log('[GRABADOR] tipoEquipoAfectadoNombre:', tipoEquipoAfectadoNombreValue);
  console.log('[GRABADOR] isEquipoAfectacion:', isEquipoAfectacion);
  console.log('[GRABADOR] isGrabadorSelected:', isGrabadorSelected);
  console.log('[GRABADOR] showEncodingDeviceField:', showEncodingDeviceField);
  console.log('[GRABADOR] sitioId:', formData?.sitioId);
  console.log('[GRABADOR] sitiosItems length:', (sitiosItems || []).length);

  const encodingDeviceItems = useMemo(() => {
    return [
      { id: 'empty', nombre: 'Seleccione...', value: '' },
      ...encodingDevices.map((x) => ({
        id: String(x.id),
        nombre: x.name,
        value: String(x.id),
      })),
    ];
  }, [encodingDevices]);

  const selectedSiteName = useMemo(() => {
    const sitioId = String(formData?.sitioId || '');
    if (!sitioId) return '';
    const site = (sitiosItems || []).find((x: any) => String(x.value) === sitioId);
    return String(site?.nombre || '');
  }, [formData?.sitioId, sitiosItems]);

  console.log('[GRABADOR] selectedSiteName:', selectedSiteName);

  useEffect(() => {
    console.log('[GRABADOR] useEffect triggered', {
      showEncodingDeviceField,
      selectedSiteName,
      sitioId: formData?.sitioId,
    });

    if (!showEncodingDeviceField) {
      setEncodingDevices([]);
      setFormData((p: any) => ({ ...p, encodingDeviceId: '' }));
      return;
    }

    if (!selectedSiteName) {
      setEncodingDevices([]);
      setFormData((p: any) => ({ ...p, encodingDeviceId: '' }));
      return;
    }

    console.log('[GRABADOR] calling API getEncodingDevicesBySite with siteName:', selectedSiteName);

    getEncodingDevicesBySite(selectedSiteName)
      .then((data: any) => {
        console.log('[GRABADOR] API response:', data);
        setEncodingDevices(Array.isArray(data) ? data : []);
      })
      .catch((err: any) => {
        console.error('[GRABADOR] API error:', err);
        setEncodingDevices([]);
      });
  }, [showEncodingDeviceField, selectedSiteName]);

  useEffect(() => {
    let isMounted = true;

    const loadSitios = async () => {
      const consoleName = session.console ?? localStorage.getItem('selectedConsole');

      if (!consoleName) {
        if (isMounted) {
          setSitios([]);
          setFormData((prev) => (prev.sitioId ? { ...prev, sitioId: '' } : prev));
        }
        return;
      }

      try {
        const consolaId = await resolveConsolaIdByName(consoleName);

        if (!isMounted) return;

        if (consolaId === null) {
          setSitios([]);
          setFormData((prev) => (prev.sitioId ? { ...prev, sitioId: '' } : prev));
          return;
        }

        const data = await getSitios({ consolaId });
        if (!isMounted) return;

        const lista = Array.isArray(data)
          ? data
          : (data as { data?: Sitio[] } | null | undefined)?.data;

        const sitiosDisponibles = Array.isArray(lista) ? lista : [];
        setSitios(sitiosDisponibles);
        setFormData((prev) => {
          if (!prev.sitioId) {
            return prev;
          }

          const exists = sitiosDisponibles.some(
            (sitioItem) => String(sitioItem.id) === prev.sitioId
          );

          return exists ? prev : { ...prev, sitioId: '' };
        });
      } catch (error) {
        console.error('Error al cargar sitios:', error);
        if (isMounted) {
          setSitios([]);
          setFormData((prev) => (prev.sitioId ? { ...prev, sitioId: '' } : prev));
        }
      }
    };

    loadSitios();

    return () => {
      isMounted = false;
    };
  }, [session.console]);

  const tipoProblemaItems = useMemo(
    () => [
      { id: 'empty', descripcion: 'Seleccione...', value: '' },
      ...catalogos.tiposProblema.map((tp) => ({
        id: String(tp.id ?? tp.descripcion ?? ''),
        descripcion: tp.descripcion,
        value: tp.descripcion ?? '',
      })),
    ],
    [catalogos.tiposProblema]
  );

  const nodoItems = useMemo(
    () => [
      { id: 'empty', nombre: 'Seleccione un nodo', value: '' },
      ...nodos.map((nodoItem) => ({
        id: String(nodoItem.id),
        nombre: nodoItem.nombre,
        value: String(nodoItem.id),
      })),
    ],
    [nodos]
  );

  const tipoEquipoAfectadoItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...tiposEquipoAfectado.map((tipo) => ({
        id: String(tipo.id ?? tipo.nombre ?? ''),
        label: tipo.nombre,
        value: String(tipo.id),
      })),
    ],
    [tiposEquipoAfectado]
  );

  const tipoProblemaEquipoItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...catalogos.tiposProblemaEquipo.map((tipo) => ({ id: tipo, label: tipo, value: tipo })),
    ],
    [catalogos.tiposProblemaEquipo]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogData, fallosData] = await Promise.all([
          fetchCatalogos(),
          fetchFallos(),
        ]);
        setCatalogos(catalogData);
        setFailures(fallosData);
      } catch (error) {
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información inicial de fallos técnicos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const fetchNodos = async () => {
      setIsLoadingNodos(true);
      setNodosError(null);

      try {
        const nodosResponse = await getNodos();
        setNodos(nodosResponse);
      } catch (error) {
        console.error('Error cargando nodos:', error);
        setNodosError('Error al cargar nodos');
        setNodos([]);
      } finally {
        setIsLoadingNodos(false);
      }
    };

    fetchNodos();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTiposEquipoAfectado = async () => {
      try {
        const response = await getAllTipoEquipoAfectado({
          page: 0,
          limit: 1000,
          search: undefined,
        });
        if (!isMounted) return;
        setTiposEquipoAfectado(response.data ?? []);
      } catch (error) {
        console.error('Error cargando tipos de equipo afectado:', error);
        if (isMounted) {
          setTiposEquipoAfectado([]);
        }
      }
    };

    if (formData.affectationType === 'Equipo' && tiposEquipoAfectado.length === 0) {
      loadTiposEquipoAfectado();
    }

    return () => {
      isMounted = false;
    };
  }, [formData.affectationType, tiposEquipoAfectado.length]);

  const selectedNodo = useMemo(
    () => nodos.find((nodoItem) => String(nodoItem.id) === formData.nodo) ?? null,
    [nodos, formData.nodo]
  );

  const selectedSitio = useMemo(
    () => sitios.find((sitioItem) => String(sitioItem.id) === formData.sitioId) ?? null,
    [sitios, formData.sitioId]
  );

  const validate = (fieldValues: FailureFormData = formData) => {
    let tempErrors: Partial<FailureFormData> = { ...errors };

    if ('fechaHoraFallo' in fieldValues) {
      if (!fieldValues.fechaHoraFallo) {
        tempErrors.fechaHoraFallo = 'La fecha y hora son obligatorias.';
      } else {
        const selectedDateTime = new Date(fieldValues.fechaHoraFallo);
        const now = new Date();

        if (Number.isNaN(selectedDateTime.getTime())) {
          tempErrors.fechaHoraFallo = 'Seleccione una fecha y hora válidas.';
        } else if (selectedDateTime > now) {
          tempErrors.fechaHoraFallo = 'La fecha y hora no pueden ser posteriores a la actual.';
        } else {
          delete tempErrors.fechaHoraFallo;
        }
      }
    }

    if (fieldValues.affectationType === 'Nodo') {
      if (!fieldValues.nodo) tempErrors.nodo = 'El nodo es obligatorio.';
      else delete tempErrors.nodo;
    }

    if (fieldValues.affectationType === 'Equipo' || fieldValues.affectationType === 'Masivo') {
      if (!fieldValues.tipoProblema) {
        tempErrors.tipoProblema = 'El tipo de problema es obligatorio.';
      } else {
        delete tempErrors.tipoProblema;
      }
    } else {
      delete tempErrors.tipoProblema;
    }

    if (fieldValues.affectationType === 'Punto' || fieldValues.affectationType === 'Equipo') {
      if (!fieldValues.sitioId) tempErrors.sitioId = 'El sitio es obligatorio.';
      else delete tempErrors.sitioId;
    } else {
      delete tempErrors.sitioId;
    }

    if (fieldValues.affectationType === 'Equipo') {
      if (!fieldValues.tipoEquipoAfectadoId) {
        tempErrors.tipoEquipoAfectadoId = 'El tipo de equipo afectado es obligatorio.';
      } else {
        delete tempErrors.tipoEquipoAfectadoId;
      }

      const equipoHcActual = isDeviceFromHC(getSelectedDispositivo(fieldValues.camara));

      if (showCameraField) {
        if (!selectedCameraId) {
          tempErrors.camara = 'La cámara es obligatoria.';
        } else {
          delete tempErrors.camara;
        }
      } else {
        delete tempErrors.camara;
      }

      if (equipoHcActual) {
        if (!fieldValues.tipoProblemaEquipo) {
          tempErrors.tipoProblemaEquipo = 'El tipo de problema es obligatorio.';
        } else {
          delete tempErrors.tipoProblemaEquipo;
        }
      } else {
        delete tempErrors.tipoProblemaEquipo;
      }
    } else {
      delete tempErrors.tipoEquipoAfectadoId;
      delete tempErrors.camara;
      delete tempErrors.tipoProblemaEquipo;
    }

    setErrors({ ...tempErrors });
    return Object.values(tempErrors).every((x) => x === '' || x === undefined);
  };

  const applyFieldUpdate = (name: keyof FailureFormData, rawValue: string | boolean) => {
    const newValues: FailureFormData = {
      ...formData,
      [name]: rawValue,
    } as FailureFormData;

    if (name === 'tipoEquipoAfectadoId') {
      newValues.camara = '';
      newValues.tipoProblemaEquipo = '';
      newValues.encodingDeviceId = '';
      setEncodingDevices([]);
    }

    setFormData(newValues);
    validate(newValues);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, type } = e.target;
    const fieldName = name as keyof FailureFormData;
    const value = type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value;

    applyFieldUpdate(fieldName, value);
  };

  const handleTipoEquipoAfectadoChange = (item: any) => {
    const tipoEquipoAfectadoId = String(item?.value ?? item?.id ?? '');
    const tipoEquipoAfectadoNombre = String(item?.nombre ?? item?.name ?? item?.label ?? '');

    const newValues: FailureFormData = {
      ...formData,
      tipoEquipoAfectadoId,
      tipoEquipoAfectadoNombre,
      camara: '',
      tipoProblemaEquipo: '',
      encodingDeviceId: '',
    };

    setEncodingDevices([]);
    setCameras([]);
    setSelectedCameraId('');
    setIsLoadingCamaras(false);
    setFormData(newValues);
    validate(newValues);
  };

  const handleNodoChange = async (nodoId: string) => {
    const normalizedId = nodoId ?? '';
    const newValues: FailureFormData = {
      ...formData,
      nodo: normalizedId,
    };

    setFormData(newValues);
    validate(newValues);
    setSitiosNodo([]);
    setNodoSitioError(null);

    if (normalizedId) {
      try {
        const data = await getNodoSitios(normalizedId);
        setSitiosNodo(data);
        setNodoSitioError(
          data.length === 0
            ? "El nodo seleccionado no tiene un sitio asignado. Primero asigne el nodo a un sitio en la opción 'Asignación Nodos-Sitios'."
            : null,
        );
      } catch (error) {
        if (hasHttpStatusResponse(error) && error.response?.status === 404) {
          setSitiosNodo([]);
          setNodoSitioError(
            "El nodo seleccionado no tiene un sitio asignado. Primero asigne el nodo a un sitio en la opción 'Asignación Nodos-Sitios'."
          );
          return;
        }
        console.error('No se pudo obtener el sitio asociado al nodo seleccionado:', error);
        setSitiosNodo([]);
        setNodoSitioError('No se pudo obtener el sitio asociado al nodo seleccionado.');
      }
    } else {
      setSitiosNodo([]);
      setNodoSitioError(null);
    }
  };

  const handleFechaHoraFalloChange = (
    value: string | null,
    helpers: { isoString: string | null; dateValue: Date | null },
  ) => {
    const updatedValue = value ?? '';
    setFormData((prev) => ({ ...prev, fechaHoraFallo: updatedValue }));

    if (!value) {
      setErrors((prev) => ({ ...prev, fechaHoraFallo: 'La fecha y hora son obligatorias.' }));
      return;
    }

    const parsedDateTime = helpers.dateValue ?? new Date(value);

    if (!parsedDateTime || Number.isNaN(parsedDateTime.getTime())) {
      setErrors((prev) => ({ ...prev, fechaHoraFallo: 'Seleccione una fecha y hora válidas.' }));
      return;
    }

    const now = new Date();
    if (parsedDateTime > now) {
      setErrors((prev) => ({ ...prev, fechaHoraFallo: 'La fecha y hora no pueden ser posteriores a la actual.' }));
      return;
    }

    const normalizedValue = normalizeDateTimeLocalString(value) || toLocalDateTimeString(parsedDateTime);

    const newValues: FailureFormData = {
      ...formData,
      fechaHoraFallo: normalizedValue,
    };

    setErrors((prev) => {
      const { fechaHoraFallo: _, ...rest } = prev;
      return rest;
    });
    setFormData(newValues);
    validate(newValues);
  };

  const handleAffectationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as AffectationType;
    const resetForm = buildInitialFormData();
    setFormData({
      ...resetForm,
      fechaHoraFallo: formData.fechaHoraFallo,
      affectationType: newType,
    });
    setErrors({});
    setCliente(null);
    setClienteFromConsole(null);
    setSelectedSite('');
    setCameras([]);
    setSelectedCameraId('');
    setSitiosNodo([]);
    setNodoSitioError(null);
  };

  const handleTipoProblemaChange = (selected: string) => {
    applyFieldUpdate('tipoProblema', selected);
  };

  const handleSitioChange = (selected: string) => {
    applyFieldUpdate('sitioId', selected);

    setIpSpeakers([]);
    setFormData((prev) => ({ ...prev, ipSpeakerId: '', camara: '' }));
    setSelectedCameraId('');
    setCameras([]);
    setIsLoadingCamaras(false);

    if (!selected) {
      setClienteFromConsole(null);
      setSelectedSite('');
      return;
    }

    const sitioSeleccionado = sitios.find(
      (sitioItem) => String(sitioItem.id) === selected
    );
    setSelectedSite(sitioSeleccionado?.nombre ?? '');
    setClienteFromConsole(resolveSitioClienteNombre(sitioSeleccionado));
  };

  useEffect(() => {
    if (formData.affectationType === 'Nodo' && formData.nodo) {
      const nodoNombre = selectedNodo?.nombre ?? '';
      if (nodoNombre) {
        const relation = catalogos.nodoCliente.find((nc) => nc.nodo === nodoNombre);
        setCliente(relation ? relation.cliente : 'Cliente no encontrado');
      } else {
        setCliente('Cliente no encontrado');
      }
    } else {
      setCliente(null);
    }
  }, [formData.nodo, formData.affectationType, catalogos.nodoCliente, selectedNodo]);

  useEffect(() => {
    if (formData.affectationType !== 'Punto' && formData.affectationType !== 'Equipo') {
      setClienteFromConsole(null);
      return;
    }

    if (!selectedSitio) {
      setClienteFromConsole(null);
      return;
    }

    setClienteFromConsole(resolveSitioClienteNombre(selectedSitio));
  }, [formData.affectationType, selectedSitio]);

  useEffect(() => {
    if (formData.affectationType !== 'Equipo' && formData.tipoEquipoAfectadoId) {
      setFormData((prev) => ({ ...prev, tipoEquipoAfectadoId: '', tipoEquipoAfectadoNombre: '' }));
      setErrors((prev) => {
        const { tipoEquipoAfectadoId, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.affectationType, formData.tipoEquipoAfectadoId]);

  useEffect(() => {
    if (formData.affectationType === 'Equipo' && equipoEsHC) {
      return;
    }

    if (formData.tipoProblemaEquipo) {
      setFormData((prev) => ({ ...prev, tipoProblemaEquipo: '' }));
    }

    setErrors((prev) => {
      if (!prev.tipoProblemaEquipo) return prev;
      const { tipoProblemaEquipo, ...rest } = prev;
      return rest;
    });
  }, [equipoEsHC, formData.affectationType, formData.tipoProblemaEquipo]);

  useEffect(() => {
    if (!showCameraField) {
      setCameras([]);
      setSelectedCameraId('');
      setIsLoadingCamaras(false);
      return;
    }

    if (!formData.sitioId) {
      setCameras([]);
      setSelectedCameraId('');
      setIsLoadingCamaras(false);
      return;
    }

    let isMounted = true;
    const loadCamaras = async () => {
      setIsLoadingCamaras(true);

      try {
        const { data } = await api.get<CameraCatalogItem[]>(
          `/catalogos/camaras-por-sitio/${formData.sitioId}`,
        );

        if (!isMounted) return;

        const camaras = Array.isArray(data)
          ? data.map((item) => ({
            ...item,
            id: Number(item.id),
            ip_address: item.ip_address ?? null,
          }))
          : [];

        setCameras(camaras);
        if (camaras.length === 0) {
          setSelectedCameraId('');
        }
      } catch (err) {
        console.error('Error al cargar cámaras:', err);
        if (isMounted) {
          setCameras([]);
          setSelectedCameraId('');
        }
      } finally {
        if (isMounted) {
          setIsLoadingCamaras(false);
        }
      }
    };

    loadCamaras();

    return () => {
      isMounted = false;
    };
  }, [formData.sitioId, showCameraField]);

  useEffect(() => {
    if (!showIpSpeakerField) {
      setIpSpeakers([]);
      setFormData((prev) => ({ ...prev, ipSpeakerId: '' }));
      return;
    }

    if (!selectedSite) {
      setIpSpeakers([]);
      return;
    }

    getIpSpeakersBySite(selectedSite)
      .then((data) => {
        setIpSpeakers(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error al cargar megáfonos IP:', error);
        setIpSpeakers([]);
      });
  }, [selectedSite, showIpSpeakerField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session.user) {
      alert('La sesión no es válida. Vuelva a iniciar sesión.');
      return;
    }

    if (!validate()) {
      return;
    }

    if (formData.affectationType === 'Nodo') {
      if (!formData.nodo) {
        alert('Debe seleccionar un nodo.');
        return;
      }

      if (nodoSitioError || sitiosNodo.length === 0) {
        alert(
          nodoSitioError ??
            "El nodo seleccionado no tiene un sitio asignado. Primero asigne el nodo a un sitio en la opción 'Asignación Nodos-Sitios'."
        );
        return;
      }
    }

    if (formData.affectationType !== 'Nodo') {
      setNodoSitioError(null);
    }

    let equipo_afectado = 'N/A';
    const sitioNombre =
      formData.affectationType === 'Nodo'
        ? sitiosNodo
            .map((s) => {
              const parts = [s.codigo, s.nombre].filter(Boolean);
              return parts.length > 0 ? parts.join(' - ') : String(s.id);
            })
            .join(', ')
        : selectedSitio?.nombre ?? '';
    if (formData.affectationType === 'Nodo') {
      equipo_afectado = selectedNodo?.nombre || 'N/A';
    } else if (formData.affectationType === 'Equipo') {
      const equipo =
        (showCameraField && selectedCamera?.camera_name) ||
        formData.camara ||
        tipoEquipoAfectadoSel?.nombre ||
        'Equipo';
      equipo_afectado = `${equipo} en ${sitioNombre}`;
    } else if (formData.affectationType === 'Punto') {
      equipo_afectado = `Punto en ${sitioNombre}`;
    }

    const equipoDesdeHC = formData.affectationType === 'Equipo' && equipoEsHC;

    let descripcion_fallo = 'N/A';
    if (formData.affectationType === 'Nodo' || formData.affectationType === 'Punto') {
      descripcion_fallo = formData.tipoProblema;
    } else if (formData.affectationType === 'Equipo') {
      descripcion_fallo = equipoDesdeHC ? formData.tipoProblemaEquipo : formData.tipoProblema;
    } else if (formData.affectationType === 'Masivo') {
      descripcion_fallo = 'Fallo masivo reportado.';
    }

    let fechaFalloPayload = '';
    let horaFalloPayload: string | undefined;
    let fechaHoraFalloISO: string | undefined;

    if (formData.fechaHoraFallo) {
      const [fechaParte, horaParte] = formData.fechaHoraFallo.split('T');
      fechaFalloPayload = fechaParte || '';
      if (horaParte) {
        const sanitized = horaParte.replace('Z', '').split('.')[0];
        if (sanitized) {
          horaFalloPayload = sanitized.length === 5 ? `${sanitized}:00` : sanitized;
        }
      }
      const parsedDateTime = new Date(formData.fechaHoraFallo);
      if (!Number.isNaN(parsedDateTime.getTime())) {
        fechaHoraFalloISO = parsedDateTime.toISOString();
      }
    }

    const tipoProblemaPayload = equipoDesdeHC ? formData.tipoProblemaEquipo : formData.tipoProblema;
    const tipoProblemaEquipoPayload = equipoDesdeHC ? formData.tipoProblemaEquipo : undefined;
    const tipoEquipoAfectadoIdPayload = (() => {
      if (formData.affectationType !== 'Equipo' || !formData.tipoEquipoAfectadoId) {
        return null;
      }

      const parsed = Number(formData.tipoEquipoAfectadoId);
      return Number.isNaN(parsed) ? formData.tipoEquipoAfectadoId : parsed;
    })();
    const cameraIdPayload = (() => {
      if (!showCameraField || !selectedCameraId) {
        return null;
      }

      const parsed = Number(selectedCameraId);
      return Number.isNaN(parsed) ? null : parsed;
    })();
    const encodingDeviceIdPayload = (() => {
      if (!showEncodingDeviceField || !formData.encodingDeviceId) {
        return null;
      }

      const parsed = Number(formData.encodingDeviceId);
      return Number.isNaN(parsed) ? formData.encodingDeviceId : parsed;
    })();

    const payload: TechnicalFailurePayload = {
      fecha: fechaFalloPayload,
      hora: horaFalloPayload,
      horaFallo: horaFalloPayload,
      fechaHoraFallo: fechaHoraFalloISO,
      affectationType: formData.affectationType,
      tipo_afectacion: formData.affectationType,
      equipo_afectado: equipo_afectado || 'No especificado',
      descripcion_fallo: descripcion_fallo || 'Sin descripción',
      responsable: session.user,
      tipoProblema: tipoProblemaPayload,
      tipoProblemaEquipo: tipoProblemaEquipoPayload,
      tipo_equipo_afectado_id: tipoEquipoAfectadoIdPayload,
      nodo: formData.nodo,
      sitio: sitioNombre,
      sitio_id:
        formData.affectationType === 'Nodo'
          ? sitiosNodo[0]?.id
          : selectedSitio
            ? selectedSitio.id
            : undefined,
      camera_id: cameraIdPayload,
      encodingDeviceId: encodingDeviceIdPayload,
      ipSpeakerId:
        showIpSpeakerField && formData.ipSpeakerId
          ? Number(formData.ipSpeakerId)
          : null,
      consola: session.console,
      reportadoCliente: formData.reportadoCliente,
      camara: formData.camara,
      cliente: clienteFromConsole || cliente,
    };

    try {
      console.log("[TechnicalFailuresOperador] valores del formulario:", payload);
      setIsSubmitting(true);
      const created = await createFallo(payload);
      setFailures((prev) => [created, ...prev]);
      alert('Registro guardado correctamente.');
      setFormData(buildInitialFormData());
      setErrors({});
      setCliente(null);
      setClienteFromConsole(null);
      setSelectedProblem(null);
      setSelectedSite('');
      setSelectedCameraId('');
      setCameras([]);
      setEncodingDevices([]);
      setIpSpeakers([]);
      setSitiosNodo([]);
      setNodoSitioError(null);
    } catch (error) {
      console.error(
        "[TechnicalFailuresOperador] Error al registrar fallo técnico:",
        (error as any)?.response?.data || error
      );
      alert('No se pudo registrar el fallo técnico. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConditionalFields = () => {
    const sitioSelectField = (
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <AutocompleteComboBox
            label="Sitio *"
            value={formData.sitioId}
            onChange={handleSitioChange}
            items={sitiosItems}
            displayField="nombre"
            valueField="value"
            placeholder="Buscar sitio..."
            disabled={sitios.length === 0}
            error={errors.sitioId}
            emptyMessage={sitios.length === 0 ? 'No hay sitios disponibles' : 'No se encontraron sitios'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cliente asociado</label>
          <input
            type="text"
            value={clienteFromConsole ?? ''}
            readOnly
            placeholder={sitios.length === 0 ? 'No hay sitios disponibles' : 'Seleccione un sitio'}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700 focus:border-[#F9C300] focus:ring-[#F9C300]"
          />
        </div>
        {showCameraField && (
          <div className="md:col-span-2">
            <label htmlFor="camera_id" className="block text-sm font-medium text-gray-700">
              Cámara <span className="text-red-600">*</span>
            </label>
            <select
              id="camera_id"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300]"
              value={selectedCameraId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCameraId(value);

                const cameraSelected = cameras.find((cam) => String(cam.id) === value);
                setFormData((prev) => ({ ...prev, camara: cameraSelected?.camera_name || '' }));
                setErrors((prev) => {
                  const { camara, ...rest } = prev;
                  return rest;
                });
              }}
              disabled={!formData.sitioId || isLoadingCamaras}
              required
            >
              <option value="" disabled>
                {!formData.sitioId
                  ? 'Seleccione un sitio primero'
                  : isLoadingCamaras
                    ? 'Cargando cámaras...'
                    : cameras.length === 0
                      ? 'Sin cámaras para este sitio'
                      : 'Seleccione una cámara'}
              </option>
              {cameras.map((cam) => {
                const label = cam.ip_address
                  ? `${cam.camera_name} - ${cam.ip_address}`
                  : cam.camera_name;
                return (
                  <option key={cam.id} value={cam.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            {errors.camara && (
              <p className="mt-1 text-sm text-red-600">{errors.camara}</p>
            )}
          </div>
        )}
        {showEncodingDeviceField && (
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Grabador"
              items={encodingDeviceItems}
              value={formData.encodingDeviceId}
              onChange={(val: string) =>
                setFormData((p) => ({ ...p, encodingDeviceId: val }))
              }
              displayField="nombre"
              valueField="value"
              placeholder="Buscar grabador..."
              disabled={!formData.sitioId || encodingDevices.length === 0}
            />
          </div>
        )}
        {showIpSpeakerField && (
          <div className="md:col-span-2">
            <AutocompleteComboBox
              label="Megáfono"
              items={ipSpeakers.map((speaker) => ({
                ...speaker,
                value: String(speaker.id),
                nombre: speaker.name,
              }))}
              value={formData.ipSpeakerId}
              onChange={(val: string) =>
                setFormData((prev) => ({ ...prev, ipSpeakerId: val }))
              }
              displayField="nombre"
              valueField="value"
              placeholder="Buscar megáfono..."
              disabled={!formData.sitioId || ipSpeakers.length === 0}
            />
          </div>
        )}
      </div>
    );

    switch (formData.affectationType) {
      case 'Nodo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <AutocompleteComboBox
                  label="Tipo de Problema *"
                  value={formData.tipoProblema}
                  onChange={(selected: string) => handleTipoProblemaChange(selected)}
                  items={tipoProblemaItems}
                  displayField="descripcion"
                  valueField="value"
                  placeholder="Buscar tipo de problema..."
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="reportadoCliente"
                      name="reportadoCliente"
                      type="checkbox"
                      checked={formData.reportadoCliente}
                      onChange={handleInputChange}
                      className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="reportadoCliente" className="font-medium text-gray-700">
                      Reportado al cliente
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <AutocompleteComboBox
                label="Nodo *"
                value={formData.nodo}
                onChange={handleNodoChange}
                items={nodoItems}
                displayField="nombre"
                valueField="value"
                placeholder="Buscar nodo..."
                disabled={isLoadingNodos || nodos.length === 0}
                error={errors.nodo}
                emptyMessage={nodos.length === 0 ? 'No hay nodos registrados.' : 'No se encontraron nodos'}
              />
              {!isLoadingNodos && nodos.length === 0 && !nodosError && (
                <p className="text-sm text-gray-500 mt-1">No hay nodos registrados.</p>
              )}
              {nodosError && (
                <p className="text-red-500 text-xs mt-1">{nodosError}</p>
              )}
              {nodoSitioError && (
                <p className="text-red-500 text-sm mt-2">{nodoSitioError}</p>
              )}
              {sitiosNodo.length > 0 && !nodoSitioError && (
                <div className="mt-2 text-sm text-gray-700">
                  <span className="font-semibold">→ Sitios:</span>
                  <ul className="list-disc list-inside">
                    {sitiosNodo.map((s) => (
                      <li key={s.id}>
                        {s.id} – {s.codigo ? `${s.codigo} – ` : ''}
                        {s.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        );
      case 'Punto':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <AutocompleteComboBox
                  label="Tipo de Problema *"
                  value={formData.tipoProblema}
                  onChange={(selected: string) => handleTipoProblemaChange(selected)}
                  items={tipoProblemaItems}
                  displayField="descripcion"
                  valueField="value"
                  placeholder="Buscar tipo de problema..."
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="reportadoCliente"
                      name="reportadoCliente"
                      type="checkbox"
                      checked={formData.reportadoCliente}
                      onChange={handleInputChange}
                      className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="reportadoCliente" className="font-medium text-gray-700">
                      Reportado al cliente
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {sitioSelectField}
          </>
        );
      case 'Equipo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <AutocompleteComboBox
                  label="Tipo de Equipo Afectado *"
                  value={formData.tipoEquipoAfectadoId}
                  onChange={(selected: string) =>
                    handleTipoEquipoAfectadoChange(
                      tipoEquipoAfectadoItems.find((item) => item.value === selected),
                    )
                  }
                  onItemSelect={handleTipoEquipoAfectadoChange}
                  items={tipoEquipoAfectadoItems}
                  displayField="label"
                  valueField="value"
                  placeholder="Buscar tipo de equipo afectado..."
                  error={errors.tipoEquipoAfectadoId}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="reportadoCliente"
                      name="reportadoCliente"
                      type="checkbox"
                      checked={formData.reportadoCliente}
                      onChange={handleInputChange}
                      className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="reportadoCliente" className="font-medium text-gray-700">
                      Reportado al cliente
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
                <AutocompleteComboBox
                  label="Tipo de Problema *"
                  value={formData.tipoProblema}
                  onChange={(selected: string) => handleTipoProblemaChange(selected)}
                  items={tipoProblemaItems}
                  displayField="descripcion"
                  valueField="value"
                placeholder="Buscar tipo de problema..."
                error={errors.tipoProblema}
              />
            </div>
            {sitioSelectField}
            {equipoEsHC && (
              <div className="md:col-span-2">
                <AutocompleteComboBox
                  label="Tipo de problema en equipo *"
                  value={formData.tipoProblemaEquipo}
                  onChange={(selected: string) => applyFieldUpdate('tipoProblemaEquipo', selected)}
                  items={tipoProblemaEquipoItems}
                  displayField="label"
                  valueField="value"
                  placeholder="Buscar tipo de problema..."
                  error={errors.tipoProblemaEquipo}
                />
              </div>
            )}
          </>
        );
      case 'Masivo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <AutocompleteComboBox
                  label="Tipo de Problema *"
                  value={formData.tipoProblema}
                  onChange={(selected: string) => handleTipoProblemaChange(selected)}
                  items={tipoProblemaItems}
                  displayField="descripcion"
                  valueField="value"
                  placeholder="Buscar tipo de problema..."
                  error={errors.tipoProblema}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="reportadoCliente"
                      name="reportadoCliente"
                      type="checkbox"
                      checked={formData.reportadoCliente}
                      onChange={handleInputChange}
                      className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="reportadoCliente" className="font-medium text-gray-700">
                      Reportado al cliente
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Registrar Nuevo Fallo</h4>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DateTimeInput
            id="fechaHoraFallo"
            name="fechaHoraFallo"
            label="Fecha y hora del fallo *"
            value={formData.fechaHoraFallo}
            onChange={handleFechaHoraFalloChange}
            required
            error={errors.fechaHoraFallo}
            max={getLocalDateTimeValue()}
          />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Tipo de Afectación *</label>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {(['Nodo', 'Punto', 'Equipo', 'Masivo'] as AffectationType[]).map((type) => (
                <div key={type} className="flex items-center">
                  <input
                    id={type}
                    name="affectationType"
                    type="radio"
                    value={type}
                    checked={formData.affectationType === type}
                    onChange={handleAffectationChange}
                    className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300"
                  />
                  <label htmlFor={type} className="ml-2 block text-sm text-gray-900">
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {renderConditionalFields()}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors duration-300 disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Reporte'}
            </button>
          </div>
        </form>
      </div>

      <TechnicalFailuresHistory
        failures={failures}
        isLoading={isLoading}
        activeRole={session.roleName ?? undefined}
        showActions={false}
      />
    </div>
  );
};

export default TechnicalFailuresOperador;
