import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
// NEW: Selector visual personalizado para la fecha y hora del fallo.
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
  CatalogoDepartamento,
  CatalogoResponsable,
  CatalogoSitio,
  CatalogoCliente,
  CatalogoTipoProblema,
  CatalogoNodo,
  CatalogoTipoEquipo,
  SitioPorConsola,
} from '@/types';
import { getFallos, createFallo, updateFallo } from '@/services/fallosService';
import { getCatalogos as fetchCatalogos } from '@/services/catalogosService';

type AffectationType = 'Nodo' | 'Punto' | 'Equipo' | 'Masivo' | '';

type FailureFormData = {
  // FIX: Se unifican fecha y hora del fallo en un único campo controlado.
  fechaHoraFallo: string;
  affectationType: AffectationType;
  tipoProblema: string;
  reportadoCliente: boolean;
  nodo: string;
  tipoEquipo: string;
  camara: string;
  tipoProblemaEquipo: string;
  sitio: string;
};

type TechnicalFailurePayload = Record<string, unknown>;

const FUTURE_DATE_ERROR_MESSAGE =
  'La fecha y hora del fallo no pueden ser posteriores al momento actual.';

const getLocalDateTimeValue = () => {
  // FIX: Genera un valor ISO completo preservando la zona horaria original del operador.
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

const buildInitialFormData = (): FailureFormData => ({
  // NEW: Valor inicial local para la fecha y hora combinadas del fallo.
  fechaHoraFallo: getLocalDateTimeValue(),
  affectationType: '',
  tipoProblema: '',
  reportadoCliente: false,
  nodo: '',
  tipoEquipo: '',
  camara: '',
  tipoProblemaEquipo: '',
  sitio: '',
});

const emptyCatalogos: TechnicalFailureCatalogs = {
  departamentos: [],
  tiposProblema: [],
  responsablesVerificacion: [],
  nodos: [],
  clientes: [],
  sitios: [],
  nodoCliente: [],
  tiposEquipo: [],
  tiposEquipoCatalog: [],
  tiposProblemaEquipo: [],
  dispositivos: [],
  sitiosPorConsola: [],
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toStringValue = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const transformCatalogos = (data: any): TechnicalFailureCatalogs => {
  const nodos = Array.isArray(data?.nodos)
    ? data.nodos
        .map((item: any) => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre).trim(),
        }))
        .filter((item: any) => Boolean(item.nombre))
    : [];

  const clientes: CatalogoCliente[] = Array.isArray(data?.clientes)
    ? data.clientes
        .map((item: any): CatalogoCliente => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre).trim(),
          nodo_id: toNumber(item?.nodo_id),
        }))
        .filter((item: CatalogoCliente) => Boolean(item.nombre) && item.nodo_id)
    : [];

  const nodoCliente = clientes.reduce<{ nodo: string; cliente: string }[]>(
    (acc, clienteItem) => {
      const nodo = nodos.find(
        (nodoItem: CatalogoNodo) => nodoItem.id === clienteItem.nodo_id
      );
      if (nodo) {
        acc.push({ nodo: nodo.nombre, cliente: clienteItem.nombre });
      }
      return acc;
    },
    []
  );

  const departamentos = Array.isArray(data?.departamentos)
    ? data.departamentos
        .map((item: any) => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre).trim(),
        }))
        .filter((item: any) => Boolean(item.nombre))
    : [];

  const tiposProblema: CatalogoTipoProblema[] = Array.isArray(data?.tiposProblema)
    ? data.tiposProblema
        .map((item: any): CatalogoTipoProblema => ({
          id: toNumber(item?.id),
          descripcion: toStringValue(item?.descripcion ?? item?.nombre).trim(),
        }))
        .filter((item: CatalogoTipoProblema) => Boolean(item.descripcion))
    : [];

  const responsablesVerificacion = Array.isArray(data?.responsables)
    ? data.responsables
        .map((item: any) => ({
          id: toNumber(item?.id),
          nombre: toStringValue(
            item?.nombre ?? item?.nombre_usuario ?? item?.nombre_completo
          ).trim(),
        }))
        .filter((item: any) => Boolean(item.nombre))
    : [];

  const tiposEquipoCatalog: CatalogoTipoEquipo[] = Array.isArray(
    data?.tiposEquipo
  )
    ? data.tiposEquipo
        .map((item: any): CatalogoTipoEquipo => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre ?? item).trim(),
        }))
        .filter(
          (item: CatalogoTipoEquipo) => Boolean(item.id) && Boolean(item.nombre)
        )
    : [];

  const tiposEquipo = tiposEquipoCatalog.map(
    (item: CatalogoTipoEquipo) => item.nombre
  );

  const dispositivos = Array.isArray(data?.dispositivos)
    ? data.dispositivos
        .map((item: any) => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre).trim(),
          estado: toStringValue(item?.estado).trim() || undefined,
        }))
        .filter((item: any) => Boolean(item.nombre))
    : [];

  const sitios = Array.isArray(data?.sitios)
    ? data.sitios
        .map((item: any): CatalogoSitio => ({
          id: toNumber(item?.id),
          nombre: toStringValue(item?.nombre).trim(),
          cliente_id: toNumber(item?.cliente_id),
          consola_id: toNumber(item?.consola_id),
          cliente_nombre:
            toStringValue(item?.cliente_nombre).trim() || undefined,
          consola_nombre:
            toStringValue(item?.consola_nombre).trim() || undefined,
        }))
        .filter((item: CatalogoSitio) => Boolean(item.nombre))
    : [];

  const sitiosPorConsola = sitios
    .map((item: CatalogoSitio) => {
      const sitio = item.nombre;
      const cliente =
        item.cliente_nombre ??
        clientes.find(
          (clienteItem: CatalogoCliente) => clienteItem.id === item.cliente_id
        )?.nombre ??
          "";
      const consola = item.consola_nombre ?? "";

      if (!sitio || !consola) {
        return null;
      }

      return { sitio, cliente, consola };
    })
    .filter(
      (item: SitioPorConsola | null): item is SitioPorConsola => Boolean(item)
    );

  const tiposProblemaEquipo = tiposProblema.map(
    (item: CatalogoTipoProblema) => item.descripcion
  );

  return {
    departamentos,
    tiposProblema,
    responsablesVerificacion,
    nodos,
    clientes,
    sitios,
    nodoCliente,
    tiposEquipo,
    tiposEquipoCatalog,
    tiposProblemaEquipo,
    dispositivos,
    sitiosPorConsola,
  };
};

const transformFallo = (raw: any): TechnicalFailure => ({
  id: toStringValue(raw?.id),
  fecha: toStringValue(raw?.fecha ?? raw?.fecha_fallo),
  equipo_afectado: toStringValue(
    raw?.equipo_afectado ?? raw?.dispositivo ?? raw?.nodo
  ),
  descripcion_fallo: toStringValue(
    raw?.descripcion_fallo ?? raw?.descripcion
  ),
  responsable: toStringValue(raw?.responsable ?? raw?.usuario),
  estado: toStringValue(raw?.estado) || undefined,
  deptResponsable: toStringValue(raw?.departamento) || undefined,
  fechaResolucion: toStringValue(raw?.fecha_resolucion) || undefined,
  horaResolucion: toStringValue(raw?.hora_resolucion) || undefined,
  verificacionApertura:
    toStringValue(raw?.verificacion_apertura) || undefined,
  verificacionCierre:
    toStringValue(raw?.verificacion_cierre) || undefined,
  novedadDetectada: toStringValue(raw?.novedad_detectada) || undefined,
  nodo_id: raw?.nodo_id ? Number(raw.nodo_id) : undefined,
  cliente_id: raw?.cliente_id ? Number(raw.cliente_id) : undefined,
  sitio_id: raw?.sitio_id ? Number(raw.sitio_id) : undefined,
  tipo_problema_id: raw?.tipo_problema_id
    ? Number(raw.tipo_problema_id)
    : undefined,
  tipo_equipo_id: raw?.tipo_equipo_id ? Number(raw.tipo_equipo_id) : undefined,
  dispositivo_id: raw?.dispositivo_id
    ? Number(raw.dispositivo_id)
    : undefined,
  usuario_id: raw?.usuario_id ? Number(raw.usuario_id) : undefined,
});

const EditFailureModal: React.FC<{
  failure: TechnicalFailure;
  departamentos: CatalogoDepartamento[];
  responsables: CatalogoResponsable[];
  onSave: (updatedFailure: TechnicalFailure) => void;
  onClose: () => void;
  isSaving: boolean;
}> = ({ failure, departamentos, responsables, onSave, onClose, isSaving }) => {
  const [editData, setEditData] = useState<TechnicalFailure>(failure);

  useEffect(() => {
    setEditData(failure);
  }, [failure]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h4 className="text-[#1C2E4A] text-xl font-semibold mb-6">Editar Reporte de Fallo (Supervisor)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Dpto. Responsable</label>
            <select
              name="deptResponsable"
              value={editData.deptResponsable || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha Resolución</label>
            <input
              type="date"
              name="fechaResolucion"
              value={editData.fechaResolucion || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hora Resolución</label>
            <input
              type="time"
              name="horaResolucion"
              value={editData.horaResolucion || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Responsable Verificación Apertura
            </label>
            <select
              name="verificacionApertura"
              value={editData.verificacionApertura || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Responsable Verificación Cierre
            </label>
            <select
              name="verificacionCierre"
              value={editData.verificacionCierre || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            >
              <option value="">Seleccione...</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Novedad Detectada</label>
            <textarea
              name="novedadDetectada"
              value={editData.novedadDetectada || ''}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
            ></textarea>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

const calcularEstado = (reporte: TechnicalFailure): { texto: string; color: string } => {
  const {
    fecha,
    deptResponsable,
    fechaResolucion,
    horaResolucion,
    verificacionApertura,
    verificacionCierre,
    novedadDetectada,
  } = reporte;

  const camposCompletos =
    deptResponsable &&
    fechaResolucion &&
    horaResolucion &&
    verificacionApertura &&
    verificacionCierre &&
    novedadDetectada;

  if (camposCompletos || fechaResolucion) {
    return { texto: 'RESUELTO', color: '#4CAF50' };
  }

  const fechaFallo = new Date(fecha);
  const hoy = new Date();
  const dias = Math.floor((hoy.getTime() - fechaFallo.getTime()) / (1000 * 60 * 60 * 24));

  return {
    texto: `${dias <= 0 ? 0 : dias} días pendientes`,
    color: '#F44336',
  };
};

const TechnicalFailures: React.FC = () => {
  const { session } = useSession();
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFailure, setCurrentFailure] = useState<TechnicalFailure | null>(null);
  // FIX: El estado del formulario utiliza el nuevo constructor con fecha y hora unificadas.
  const [formData, setFormData] = useState<FailureFormData>(buildInitialFormData());
  const [errors, setErrors] = useState<Partial<FailureFormData>>({});
  const [cliente, setCliente] = useState<string | null>(null);
  const [clienteFromConsole, setClienteFromConsole] = useState<string | null>(null);
  const [sitiosDisponibles, setSitiosDisponibles] = useState<CatalogoSitio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFechaHoraInvalid, setIsFechaHoraInvalid] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catalogData, fallosData] = await Promise.all([
          fetchCatalogos(),
          getFallos(),
        ]);
        setCatalogos(transformCatalogos(catalogData));
        const parsedFallos = Array.isArray(fallosData)
          ? fallosData.map(transformFallo)
          : [];
        setFailures(parsedFallos);
      } catch (error) {
        console.error('Error al cargar los datos de fallos técnicos:', error);
        alert('No se pudo cargar la información inicial de fallos técnicos.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const displayedFailures = useMemo(() => {
    if (!failures.length) {
      return [];
    }

    const role = session.role?.toLowerCase();

    if (role === 'operador') {
      return failures.filter((failure) => {
        const estado = failure.estado ?? calcularEstado(failure).texto;
        return estado.toUpperCase() !== 'RESUELTO';
      });
    }

    return failures;
  }, [failures, session.role]);

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
          tempErrors.fechaHoraFallo = FUTURE_DATE_ERROR_MESSAGE;
        } else {
          delete tempErrors.fechaHoraFallo;
        }
      }
    }

    if (fieldValues.affectationType === 'Nodo') {
      if (!fieldValues.nodo) tempErrors.nodo = 'El nodo es obligatorio.';
      else delete tempErrors.nodo;
    }

    if (fieldValues.affectationType === 'Punto' || fieldValues.affectationType === 'Equipo') {
      if (!fieldValues.sitio) tempErrors.sitio = 'El sitio es obligatorio.';
      else delete tempErrors.sitio;
    } else {
      delete tempErrors.sitio;
    }

    if (fieldValues.affectationType === 'Equipo') {
      if (!fieldValues.tipoEquipo) {
        tempErrors.tipoEquipo = 'El tipo de equipo es obligatorio.';
      } else {
        delete tempErrors.tipoEquipo;
      }

      if (fieldValues.tipoEquipo === 'Cámara') {
        if (!fieldValues.camara) {
          tempErrors.camara = 'La cámara es obligatoria.';
        } else {
          delete tempErrors.camara;
        }
        delete tempErrors.tipoProblemaEquipo;
      } else if (fieldValues.tipoEquipo && fieldValues.tipoEquipo !== 'Cámara') {
        if (!fieldValues.tipoProblemaEquipo) {
          tempErrors.tipoProblemaEquipo = 'El tipo de problema es obligatorio.';
        } else {
          delete tempErrors.tipoProblemaEquipo;
        }
        delete tempErrors.camara;
      }
    } else {
      delete tempErrors.tipoEquipo;
      delete tempErrors.camara;
      delete tempErrors.tipoProblemaEquipo;
    }

    setErrors({ ...tempErrors });
    return Object.values(tempErrors).every((x) => x === '' || x === undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    const newValues: FailureFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    } as FailureFormData;

    if (name === 'tipoEquipo') {
      newValues.camara = '';
      newValues.tipoProblemaEquipo = '';
    }

    if (name === 'affectationType') {
      newValues.sitio = '';
    }

    setFormData(newValues);
    validate(newValues);
  };

  const handleFechaHoraFalloChange = (isoValue: string) => {
    // NEW: Controla el valor ISO emitido por el selector visual de fecha y hora.
    const newValues: FailureFormData = {
      ...formData,
      fechaHoraFallo: isoValue,
    };
    setFormData(newValues);
    validate(newValues);
  };

  const handleFechaHoraInvalid = useCallback(
    (isInvalid: boolean) => {
      setIsFechaHoraInvalid(isInvalid);
      setErrors((prevErrors) => {
        if (isInvalid) {
          if (prevErrors.fechaHoraFallo === FUTURE_DATE_ERROR_MESSAGE) {
            return prevErrors;
          }
          return {
            ...prevErrors,
            fechaHoraFallo: FUTURE_DATE_ERROR_MESSAGE,
          };
        }

        if (prevErrors.fechaHoraFallo !== FUTURE_DATE_ERROR_MESSAGE) {
          return prevErrors;
        }

        const { fechaHoraFallo, ...rest } = prevErrors;
        return rest;
      });
    },
    []
  );

  const handleAffectationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as AffectationType;
    const resetForm = buildInitialFormData();
    setFormData({
      ...resetForm,
      // FIX: Se conserva la selección combinada de fecha y hora al cambiar la afectación.
      fechaHoraFallo: formData.fechaHoraFallo,
      affectationType: newType,
    });
    setErrors({});
    setCliente(null);
    setClienteFromConsole(null);
    setSitiosDisponibles([]);
  };

  useEffect(() => {
    if (formData.affectationType === 'Nodo' && formData.nodo) {
      const nodeId = Number(formData.nodo);
      const clienteAsociado = catalogos.clientes.find(
        (clienteItem) => clienteItem.nodo_id === nodeId
      );
      setCliente(
        clienteAsociado ? clienteAsociado.nombre : 'Cliente no encontrado'
      );
    } else {
      setCliente(null);
    }
  }, [formData.nodo, formData.affectationType, catalogos.clientes]);

  const normalizeConsoleName = (name: string | null): string => {
    if (!name) return '';
    let processed = name.replace('_new', '').toUpperCase();
    if (processed.startsWith('OPERADOR_')) {
      const rest = processed.substring('OPERADOR_'.length);
      if (/^\d+$/.test(rest)) {
        return 'OPERADOR ' + rest;
      }
      return rest;
    }
    return processed;
  };

  useEffect(() => {
    if (
      session.console &&
      (formData.affectationType === 'Punto' || formData.affectationType === 'Equipo')
    ) {
      const normalizedConsole = normalizeConsoleName(session.console).toUpperCase();
      const sitiosFiltrados = catalogos.sitios.filter((sitio) => {
        const consolaNombre = normalizeConsoleName(
          sitio.consola_nombre ?? ''
        ).toUpperCase();
        return consolaNombre === normalizedConsole;
      });

      if (sitiosFiltrados.length > 0) {
        const clienteNombre =
          sitiosFiltrados[0].cliente_nombre ??
          catalogos.clientes.find(
            (clienteItem) => clienteItem.id === sitiosFiltrados[0].cliente_id
          )?.nombre ?? 'Cliente no encontrado';
        setClienteFromConsole(clienteNombre);
        setSitiosDisponibles(sitiosFiltrados);
      } else {
        setClienteFromConsole('No encontrado');
        setSitiosDisponibles([]);
      }
    } else {
      setClienteFromConsole(null);
      setSitiosDisponibles([]);
    }
  }, [
    session.console,
    formData.affectationType,
    catalogos.sitios,
    catalogos.clientes,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session.user) {
      alert('La sesión no es válida. Vuelva a iniciar sesión.');
      return;
    }

    if (isFechaHoraInvalid) {
      setErrors((prev) => {
        if (prev.fechaHoraFallo === FUTURE_DATE_ERROR_MESSAGE) {
          return prev;
        }
        return { ...prev, fechaHoraFallo: FUTURE_DATE_ERROR_MESSAGE };
      });
      return;
    }

    if (!validate()) {
      return;
    }

    if (formData.affectationType === 'Nodo' && (!cliente || cliente === 'Cliente no encontrado')) {
      alert('Debe seleccionar un nodo válido vinculado a un cliente.');
      return;
    }

    let equipo_afectado = 'N/A';
    const sitioNombre = formData.sitio
      ? catalogos.sitios.find((sitio) => sitio.id === Number(formData.sitio))
          ?.nombre ?? formData.sitio
      : formData.sitio;

    if (formData.affectationType === 'Nodo') {
      const nodoSeleccionado = catalogos.nodos.find(
        (nodoItem) => nodoItem.id === Number(formData.nodo)
      );
      equipo_afectado = nodoSeleccionado?.nombre ?? formData.nodo;
    } else if (formData.affectationType === 'Equipo') {
      const equipo = formData.camara || formData.tipoEquipo;
      equipo_afectado = `${equipo} en ${sitioNombre}`;
    } else if (formData.affectationType === 'Punto') {
      equipo_afectado = `Punto en ${sitioNombre}`;
    }

    let descripcion_fallo = 'N/A';
    if (formData.affectationType === 'Nodo' || formData.affectationType === 'Punto') {
      descripcion_fallo = formData.tipoProblema;
    } else if (formData.affectationType === 'Equipo') {
      descripcion_fallo = formData.tipoProblemaEquipo;
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
        // FIX: Se normaliza la hora para mantener el formato HH:mm:ss sin sufijos de zona.
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

    const nodoIdFromForm = formData.nodo ? Number(formData.nodo) : null;
    const sitioSeleccionado = formData.sitio
      ? catalogos.sitios.find((sitio) => sitio.id === Number(formData.sitio))
      : undefined;

    let clienteId: number | null = null;
    if (sitioSeleccionado?.cliente_id) {
      clienteId = sitioSeleccionado.cliente_id;
    } else if (nodoIdFromForm) {
      clienteId =
        catalogos.clientes.find(
          (clienteItem) => clienteItem.nodo_id === nodoIdFromForm
        )?.id ?? null;
    }

    let nodoId = nodoIdFromForm;
    if (!nodoId && clienteId) {
      nodoId =
        catalogos.clientes.find((clienteItem) => clienteItem.id === clienteId)
          ?.nodo_id ?? null;
    }

    if (!clienteId || !nodoId) {
      alert('Debe seleccionar un nodo y cliente válidos.');
      return;
    }

    const tipoProblemaSeleccionado =
      formData.tipoProblemaEquipo || formData.tipoProblema;
    const tipoProblemaId = catalogos.tiposProblema.find(
      (tipo) => tipo.descripcion === tipoProblemaSeleccionado
    )?.id;

    const tipoEquipoId = catalogos.tiposEquipoCatalog?.find(
      (tipo) => tipo.nombre === formData.tipoEquipo
    )?.id;

    const dispositivoSeleccionado = catalogos.dispositivos.find(
      (dispositivo) => dispositivo.nombre === formData.camara
    );

    const payload: TechnicalFailurePayload = {
      descripcion: descripcion_fallo || 'Sin descripción',
      descripcion_fallo: descripcion_fallo || 'Sin descripción',
      equipo_afectado: equipo_afectado || 'No especificado',
      fecha: fechaFalloPayload,
      fecha_fallo: fechaFalloPayload,
      horaFallo: horaFalloPayload,
      fechaHoraFallo: fechaHoraFalloISO,
      affectationType: formData.affectationType,
      nodo_id: nodoId,
      cliente_id: clienteId,
      sitio_id: sitioSeleccionado?.id ?? null,
      tipo_problema_id: tipoProblemaId ?? null,
      tipo_equipo_id: tipoEquipoId ?? null,
      dispositivo_id: dispositivoSeleccionado?.id ?? null,
      responsable: session.user,
      usuario: session.user,
      consola: session.console,
      reportadoCliente: formData.reportadoCliente,
      camara: formData.camara,
      cliente: clienteFromConsole || cliente,
      tipoProblema: tipoProblemaSeleccionado,
      tipoEquipo: formData.tipoEquipo,
      nodo: nodoId,
      sitio: sitioSeleccionado?.nombre ?? formData.sitio,
    };

    try {
      setIsSubmitting(true);
      const created = await createFallo(payload);
      setFailures((prev) => [transformFallo(created), ...prev]);
      alert('Registro guardado correctamente.');
      // FIX: Se restablece el formulario generando una nueva marca de fecha y hora combinada.
      setFormData(buildInitialFormData());
      setErrors({});
      setCliente(null);
      setClienteFromConsole(null);
      setSitiosDisponibles([]);
    } catch (error) {
      console.error('Error al registrar el fallo técnico:', error);
      alert('No se pudo registrar el fallo técnico. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (failure: TechnicalFailure) => {
    setCurrentFailure(failure);
    setIsModalOpen(true);
  };

  const handleUpdateFailure = async (updatedFailure: TechnicalFailure) => {
    if (
      updatedFailure.fechaResolucion &&
      new Date(updatedFailure.fechaResolucion) < new Date(updatedFailure.fecha)
    ) {
      alert('La fecha de resolución debe ser igual o posterior a la fecha de fallo.');
      return;
    }

    const payload: TechnicalFailurePayload = {
      fecha: updatedFailure.fecha,
      equipo_afectado: updatedFailure.equipo_afectado,
      descripcion_fallo: updatedFailure.descripcion_fallo,
      responsable: updatedFailure.responsable,
      deptResponsable: updatedFailure.deptResponsable,
      fechaResolucion: updatedFailure.fechaResolucion,
      horaResolucion: updatedFailure.horaResolucion,
      verificacionApertura: updatedFailure.verificacionApertura,
      verificacionCierre: updatedFailure.verificacionCierre,
      novedadDetectada: updatedFailure.novedadDetectada,
      nodo_id: updatedFailure.nodo_id ?? null,
      cliente_id: updatedFailure.cliente_id ?? null,
      sitio_id: updatedFailure.sitio_id ?? null,
      tipo_problema_id: updatedFailure.tipo_problema_id ?? null,
      tipo_equipo_id: updatedFailure.tipo_equipo_id ?? null,
      dispositivo_id: updatedFailure.dispositivo_id ?? null,
      usuario_id: updatedFailure.usuario_id ?? null,
    };

    try {
      setIsSubmitting(true);
      const saved = await updateFallo(updatedFailure.id, payload);
      const transformed = transformFallo(saved);
      setFailures((prev) =>
        prev.map((f) => (f.id === transformed.id ? transformed : f))
      );
      setIsModalOpen(false);
      setCurrentFailure(null);
      alert('Reporte actualizado correctamente.');
    } catch (error) {
      console.error('Error al actualizar el fallo técnico:', error);
      alert('No se pudo actualizar el reporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConditionalFields = () => {
    const consoleInfoBox = (
      <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border">
        <h5 className="text-md font-semibold text-[#1C2E4A] mb-2">Información de la Consola</h5>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-gray-600">Consola Activa:</span> {session.console}
          </p>
          <p>
            <span className="font-medium text-gray-600">Cliente Asociado:</span>{' '}
            {clienteFromConsole || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-gray-600">Sitio(s) Asociado(s):</span>{' '}
            {sitiosDisponibles.length > 0
              ? sitiosDisponibles.map((sitio) => sitio.nombre).join(', ')
              : 'N/A'}
          </p>
        </div>
      </div>
    );

    const sitioSelectField = (
      <div className="md:col-span-2">
        <label htmlFor="sitio" className="block text-sm font-medium text-gray-700">
          Sitio *
        </label>
        <select
          id="sitio"
          name="sitio"
          value={formData.sitio}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
        >
          <option value="">Seleccione...</option>
          {sitiosDisponibles.map((sitio) => (
            <option key={sitio.id} value={sitio.id}>
              {sitio.nombre}
            </option>
          ))}
        </select>
        {errors.sitio && <p className="text-red-500 text-xs mt-1">{errors.sitio}</p>}
      </div>
    );

    switch (formData.affectationType) {
      case 'Nodo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tipoProblema" className="block text-sm font-medium text-gray-700">
                  Tipo de Problema *
                </label>
                <select
                  id="tipoProblema"
                  name="tipoProblema"
                  value={formData.tipoProblema}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                >
                  <option value="">Seleccione...</option>
                  {catalogos.tiposProblema.map((tp) => (
                    <option key={tp.id} value={tp.descripcion}>
                      {tp.descripcion}
                    </option>
                  ))}
                </select>
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
              <div className="flex items-center gap-4">
                <div className="flex-grow">
                  <label htmlFor="nodo" className="block text-sm font-medium text-gray-700">
                    Nodo *
                  </label>
                  <select
                    id="nodo"
                    name="nodo"
                    value={formData.nodo}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {catalogos.nodos.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.nodo && <p className="text-red-500 text-xs mt-1">{errors.nodo}</p>}
                </div>
                {cliente && (
                  <div className="mt-6 p-2 bg-blue-100 text-blue-800 rounded-md text-sm font-semibold">
                    → Cliente: {cliente}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      case 'Punto':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tipoProblema" className="block text-sm font-medium text-gray-700">
                  Tipo de Problema *
                </label>
                <select
                  id="tipoProblema"
                  name="tipoProblema"
                  value={formData.tipoProblema}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                >
                  <option value="">Seleccione...</option>
                  {catalogos.tiposProblema.map((tp) => (
                    <option key={tp.id} value={tp.descripcion}>
                      {tp.descripcion}
                    </option>
                  ))}
                </select>
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
            {consoleInfoBox}
          </>
        );
      case 'Equipo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tipoEquipo" className="block text-sm font-medium text-gray-700">
                  Tipo de Equipo Afectado *
                </label>
                <select
                  id="tipoEquipo"
                  name="tipoEquipo"
                  value={formData.tipoEquipo}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                >
                  <option value="">Seleccione...</option>
                  {catalogos.tiposEquipo.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.tipoEquipo && <p className="text-red-500 text-xs mt-1">{errors.tipoEquipo}</p>}
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
            {formData.tipoEquipo && formData.tipoEquipo !== 'Cámara' && (
              <div className="md:col-span-2">
                <label
                  htmlFor="tipoProblemaEquipo"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tipo de problema en equipo *
                </label>
                <select
                  id="tipoProblemaEquipo"
                  name="tipoProblemaEquipo"
                  value={formData.tipoProblemaEquipo}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                >
                  <option value="">Seleccione...</option>
                  {catalogos.tiposProblemaEquipo.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.tipoProblemaEquipo && (
                  <p className="text-red-500 text-xs mt-1">{errors.tipoProblemaEquipo}</p>
                )}
              </div>
            )}
            {formData.tipoEquipo === 'Cámara' && (
              <div className="md:col-span-2">
                <label htmlFor="camara" className="block text-sm font-medium text-gray-700">
                  Cámara *
                </label>
                <select
                  id="camara"
                  name="camara"
                  value={formData.camara}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm"
                >
                  <option value="">Seleccione...</option>
                  {catalogos.dispositivos.map((d) => (
                    <option key={d.id} value={d.nombre}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
                {errors.camara && <p className="text-red-500 text-xs mt-1">{errors.camara}</p>}
              </div>
            )}
            {consoleInfoBox}
          </>
        );
      default:
        return null;
    }
  };

  const responsables = useMemo(
    () => catalogos.responsablesVerificacion,
    [catalogos.responsablesVerificacion]
  );

  return (
    <div>
      <h3 className="text-3xl font-medium text-[#1C2E4A]">Gestión de Fallos Técnicos</h3>

      {session.role === 'operador' && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Registrar Nuevo Fallo</h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label
                htmlFor="fechaHoraFallo"
                className="block text-sm font-medium text-gray-700"
              >
                Fecha y Hora del Fallo *
              </label>
              <FechaHoraFalloPicker
                id="fechaHoraFallo"
                name="fechaHoraFallo"
                value={formData.fechaHoraFallo}
                onChange={handleFechaHoraFalloChange}
                onInvalidDate={handleFechaHoraInvalid}
                required
                error={errors.fechaHoraFallo}
              />
            </div>
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
                disabled={isSubmitting || isFechaHoraInvalid}
                className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Reporte'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[#1C2E4A] text-lg font-semibold">Historial de Fallos Recientes</h4>
          {isLoading && <span className="text-sm text-gray-500">Cargando información...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Responsable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                {session.role === 'supervisor' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedFailures.length === 0 ? (
                <tr>
                  <td colSpan={session.role === 'supervisor' ? 6 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                    {isLoading ? 'Cargando fallos técnicos...' : 'No hay registros disponibles.'}
                  </td>
                </tr>
              ) : (
                displayedFailures.map((fallo) => (
                  <tr key={fallo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.fecha}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {fallo.equipo_afectado}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.descripcion_fallo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fallo.responsable}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const estado = calcularEstado(fallo);
                        return (
                          <span
                            style={{
                              backgroundColor: estado.color,
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.9em',
                              fontWeight: 'bold',
                              display: 'inline-block',
                              minWidth: '110px',
                              textAlign: 'center',
                            }}
                          >
                            {estado.texto}
                          </span>
                        );
                      })()}
                    </td>
                    {session.role === 'supervisor' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(fallo)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && currentFailure && (
        <EditFailureModal
          failure={currentFailure}
          departamentos={catalogos.departamentos}
          responsables={responsables}
          onSave={handleUpdateFailure}
          onClose={() => setIsModalOpen(false)}
          isSaving={isSubmitting}
        />
      )}
    </div>
  );
};

export default TechnicalFailures;
