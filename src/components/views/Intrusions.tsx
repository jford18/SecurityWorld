import React, { useEffect, useMemo, useState } from 'react';
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';
import { intrusionsData as mockIntrusions } from '../../data/mockData';
import { Intrusion } from '../../types';
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

const estadoItems = [
  { id: 'empty', label: 'Seleccione...', value: '' },
  { id: 'pendiente', label: 'Pendiente', value: 'Pendiente' },
  { id: 'atendido', label: 'Atendido', value: 'Atendido' },
];

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
  ubicacion: string;
  estado: string;
  descripcion: string;
  llego_alerta: boolean;
  medio_comunicacion_id: string;
  conclusion_evento_id: string;
  sustraccion_material: boolean;
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
  ubicacion: '',
  estado: '',
  descripcion: '',
  llego_alerta: false,
  medio_comunicacion_id: '',
  conclusion_evento_id: '',
  sustraccion_material: false,
});

const formatFechaEvento = (value: string) => {
  if (!value) {
    return 'Sin registro';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin registro';
  }
  return parsed.toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

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

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEstadoChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      estado: value,
    }));
  };

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

  const medioDescripcionMap = useMemo(() => {
    const map = new Map<number, string>();
    mediosComunicacion.forEach((medio) => {
      if (typeof medio?.id === 'number') {
        map.set(medio.id, medio.descripcion ?? '');
      }
    });
    return map;
  }, [mediosComunicacion]);

  const isSubmitDisabled = useMemo(() => {
    const tipoValue = tipoDescripcion.trim();
    const baseDisabled =
      !formData.fecha_evento ||
      !formData.ubicacion.trim() ||
      !tipoValue ||
      !formData.estado ||
      isSubmitting;

    if (!requiereProtocolo) {
      return baseDisabled;
    }

    return (
      baseDisabled ||
      !formData.fecha_reaccion ||
      !formData.fecha_reaccion_fuera ||
      !formData.conclusion_evento_id
    );
  }, [
    formData.conclusion_evento_id,
    formData.estado,
    formData.fecha_evento,
    formData.fecha_reaccion,
    formData.fecha_reaccion_fuera,
    formData.ubicacion,
    isSubmitting,
    requiereProtocolo,
    tipoDescripcion,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);

    const tipoValue = tipoDescripcion.trim();
    if (!tipoValue) {
      setError('Debe seleccionar un tipo de intrusión.');
      return;
    }

    const descripcionValue = formData.descripcion?.trim();

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
        alert('Debe ingresar la fecha y hora de reacción antes de la reacción de fuera.');
        return;
      }

      if (!formData.fecha_reaccion_fuera) {
        alert('Debe ingresar la fecha y hora de reacción de fuera.');
        return;
      }

      const fechaReaccionDate = new Date(formData.fecha_reaccion);
      const fechaReaccionFueraDate = new Date(formData.fecha_reaccion_fuera);

      if (Number.isNaN(fechaReaccionDate.getTime())) {
        alert('La fecha y hora de reacción no es válida.');
        return;
      }

      if (Number.isNaN(fechaReaccionFueraDate.getTime())) {
        alert('La fecha y hora de reacción de fuera no es válida.');
        return;
      }

      if (fechaReaccionFueraDate <= fechaReaccionDate) {
        alert('La fecha y hora de reacción de fuera debe ser posterior a la fecha y hora de reacción.');
        return;
      }

      if (!formData.conclusion_evento_id) {
        alert('Debe seleccionar la conclusión del evento.');
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

    const payload: IntrusionPayload = {
      fecha_evento: formData.fecha_evento,
      fecha_reaccion: formData.fecha_reaccion || null,
      fecha_reaccion_fuera:
        requiereProtocolo && formData.fecha_reaccion_fuera
          ? formData.fecha_reaccion_fuera
          : null,
      ubicacion: formData.ubicacion.trim(),
      tipo: tipoValue,
      estado: formData.estado,
      descripcion: descripcionValue ? descripcionValue : undefined,
      llego_alerta: formData.llego_alerta,
      medio_comunicacion_id: medioComunicacionValue,
      conclusion_evento_id: requiereProtocolo ? conclusionEventoValue : null,
      sustraccion_material: requiereProtocolo ? formData.sustraccion_material : false,
    };

    try {
      const created = await createIntrusion(payload);
      setIntrusions((prev) => [created, ...prev]);
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
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <FechaHoraFalloPicker
              id="fecha_evento"
              name="fecha_evento"
              label="Fecha y hora del evento"
              value={formData.fecha_evento}
              onChange={handleFechaEventoChange}
              required
            />
          </div>
            <div className="flex flex-col">
              <FechaHoraFalloPicker
                id="fecha_reaccion"
                name="fecha_reaccion"
                label="Fecha hora reacción"
                value={formData.fecha_reaccion}
                onChange={handleFechaReaccionChange}
              />
            </div>
            {requiereProtocolo && (
              <div className="flex flex-col">
                <FechaHoraFalloPicker
                  id="fecha_reaccion_fuera"
                  name="fecha_reaccion_fuera"
                  label="Fecha y hora de reacción de fuera"
                  value={formData.fecha_reaccion_fuera}
                  onChange={handleFechaReaccionFueraChange}
                />
              </div>
            )}
          <div>
            <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700">
              Ubicación
            </label>
            <input
              type="text"
              name="ubicacion"
              id="ubicacion"
              value={formData.ubicacion}
              onChange={handleInputChange}
              placeholder="Ej: Bodega 3"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
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
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
                Tipo de Intrusión
              </label>
              <select
                name="tipo"
                id="tipo"
                value={tipoIntrusionId === '' ? '' : String(tipoIntrusionId)}
                onChange={handleTipoIntrusionChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Seleccione...</option>
                {tiposIntrusion.map((tipoIntrusion) => (
                  <option key={tipoIntrusion.id} value={tipoIntrusion.id}>
                    {tipoIntrusion.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <AutocompleteComboBox
                label="Estado"
                value={formData.estado}
                onChange={handleEstadoChange}
                items={estadoItems}
                displayField="label"
                valueField="value"
                placeholder="Seleccione el estado"
              />
            </div>
            {requiereProtocolo && (
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
            )}
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
            {requiereProtocolo && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sustraccion_material"
                  name="sustraccion_material"
                  checked={formData.sustraccion_material}
                  onChange={handleSustraccionMaterialChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
                />
                <label
                  htmlFor="sustraccion_material"
                  className="text-sm font-medium text-gray-700"
                >
                  Sustracción de material
                </label>
              </div>
            )}
          <div className="md:col-span-2">
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="descripcion"
              id="descripcion"
              rows={3}
              value={formData.descripcion}
              onChange={handleInputChange}
              placeholder="Ej: Detectado por sensor PIR"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            ></textarea>
          </div>
          <div className="md:col-span-2 flex flex-col items-end space-y-2">
            {error && (
              <p className="w-full text-right text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`px-6 py-2 font-semibold rounded-md transition-colors ${
                isSubmitDisabled
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medio de comunicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Llegó alerta</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {intrusions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay intrusiones registradas.
                  </td>
                </tr>
              ) : (
                intrusions.map((intrusion) => (
                  <tr key={intrusion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFechaEvento(intrusion.fecha_evento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {intrusion.ubicacion || 'Sin ubicación'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {intrusion.tipo || 'Sin tipo'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(
                        intrusion.medio_comunicacion_descripcion ??
                        (intrusion.medio_comunicacion_id != null
                          ? medioDescripcionMap.get(intrusion.medio_comunicacion_id) || 'No especificado'
                          : 'No especificado')
                      ) || 'No especificado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          intrusion.estado?.toLowerCase() === 'atendido'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {intrusion.estado || 'Sin estado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          intrusion.llego_alerta
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {intrusion.llego_alerta ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {intrusion.descripcion || 'Sin descripción'}
                    </td>
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