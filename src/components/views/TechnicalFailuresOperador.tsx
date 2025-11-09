import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import AutocompleteComboBox from '../ui/AutocompleteComboBox';
import { TechnicalFailure, TechnicalFailureCatalogs, CatalogoNodo } from '../../types';
import {
  fetchFallos,
  createFallo,
  fetchCatalogos,
  TechnicalFailurePayload,
} from '../../services/fallosService';

const API_BASE_URL = 'http://localhost:3000/api';

type AffectationType = 'Nodo' | 'Punto' | 'Equipo' | 'Masivo' | '';

type SitioAsociado = {
  id?: number;
  nombre: string;
};

type FailureFormData = {
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

const getLocalDateTimeValue = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

const buildInitialFormData = (): FailureFormData => ({
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
  nodoCliente: [],
  tiposEquipo: [],
  tiposProblemaEquipo: [],
  dispositivos: [],
  sitiosPorConsola: [],
};

const TechnicalFailuresOperador: React.FC = () => {
  const { session } = useSession();
  const [, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [formData, setFormData] = useState<FailureFormData>(buildInitialFormData());
  const [errors, setErrors] = useState<Partial<FailureFormData>>({});
  const [cliente, setCliente] = useState<string | null>(null);
  const [clienteFromConsole, setClienteFromConsole] = useState<string | null>(null);
  const [sitios, setSitios] = useState<string[]>([]);
  const [sitio, setSitio] = useState<SitioAsociado | null>(null);
  const [, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nodos, setNodos] = useState<CatalogoNodo[]>([]);
  const [nodosError, setNodosError] = useState<string | null>(null);
  const [isLoadingNodos, setIsLoadingNodos] = useState(false);

  const sitioItems = useMemo(
    () => [
      { id: 'empty', nombre: 'Seleccione...', value: '' },
      ...sitios.map((nombre) => ({ id: nombre, nombre, value: nombre })),
    ],
    [sitios]
  );

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

  const tipoEquipoItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...catalogos.tiposEquipo.map((tipo) => ({ id: tipo, label: tipo, value: tipo })),
    ],
    [catalogos.tiposEquipo]
  );

  const tipoProblemaEquipoItems = useMemo(
    () => [
      { id: 'empty', label: 'Seleccione...', value: '' },
      ...catalogos.tiposProblemaEquipo.map((tipo) => ({ id: tipo, label: tipo, value: tipo })),
    ],
    [catalogos.tiposProblemaEquipo]
  );

  const camaraItems = useMemo(
    () => [
      { id: 'empty', nombre: 'Seleccione...', value: '' },
      ...catalogos.dispositivos.map((dispositivo) => ({
        id: String(dispositivo.id ?? dispositivo.nombre ?? ''),
        nombre: dispositivo.nombre,
        value: dispositivo.nombre,
      })),
    ],
    [catalogos.dispositivos]
  );

  const extractNodosFromResponse = (payload: unknown): CatalogoNodo[] => {
    const rawArray = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data)
        : [];

    if (!Array.isArray(rawArray)) {
      return [];
    }

    return rawArray
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const idValue = (item as { id?: unknown }).id;
        const nameValue = (item as { nombre?: unknown }).nombre;
        const parsedId = Number(idValue);
        const nombre = typeof nameValue === 'string' ? nameValue : nameValue != null ? String(nameValue) : '';

        if (!Number.isFinite(parsedId) || !nombre) {
          return null;
        }

        return { id: parsedId, nombre };
      })
      .filter((item): item is CatalogoNodo => item !== null);
  };

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
        const response = await fetch(`${API_BASE_URL}/nodos`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const parsedNodos = extractNodosFromResponse(data);
        setNodos(parsedNodos);
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

  const selectedNodo = useMemo(
    () => nodos.find((nodoItem) => String(nodoItem.id) === formData.nodo) ?? null,
    [nodos, formData.nodo]
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

  const applyFieldUpdate = (name: keyof FailureFormData, rawValue: string | boolean) => {
    const newValues: FailureFormData = {
      ...formData,
      [name]: rawValue,
    } as FailureFormData;

    if (name === 'tipoEquipo') {
      newValues.camara = '';
      newValues.tipoProblemaEquipo = '';
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

  const handleNodoChange = async (nodoId: string) => {
    const normalizedId = nodoId ?? '';
    const newValues: FailureFormData = {
      ...formData,
      nodo: normalizedId,
    };

    setFormData(newValues);
    validate(newValues);
    setSitio(null);

    if (normalizedId) {
      try {
        const response = await fetch(`${API_BASE_URL}/nodos/${normalizedId}/sitio`);
        if (response.status === 404) {
          setSitio({ nombre: 'No asignado' });
          return;
        }
        if (!response.ok) {
          throw new Error('Error al obtener sitio');
        }
        const data: SitioAsociado = await response.json();
        setSitio(data);
      } catch (error) {
        console.error('No se pudo obtener el sitio asociado al nodo seleccionado:', error);
        setSitio(null);
      }
    } else {
      setSitio(null);
    }
  };

  const handleFechaHoraFalloChange = (isoValue: string) => {
    const newValues: FailureFormData = {
      ...formData,
      fechaHoraFallo: isoValue,
    };
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
    setSitios([]);
    setSitio(null);
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
    if (formData.affectationType === 'Punto' || formData.affectationType === 'Equipo') {
      const allSites = catalogos.sitiosPorConsola;
      if (allSites.length > 0) {
        const uniqueSites = [...new Set(allSites.map((s) => s.sitio))];
        setSitios(uniqueSites);
        // If you need to set a default client, you can pick the first one
        setClienteFromConsole(allSites[0].cliente);
      } else {
        setClienteFromConsole('No encontrado');
        setSitios([]);
      }
    } else {
      setClienteFromConsole(null);
      setSitios([]);
    }
  }, [formData.affectationType, catalogos.sitiosPorConsola]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session.user) {
      alert('La sesión no es válida. Vuelva a iniciar sesión.');
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
    if (formData.affectationType === 'Nodo') {
      equipo_afectado = selectedNodo?.nombre || 'N/A';
    } else if (formData.affectationType === 'Equipo') {
      const equipo = formData.camara || formData.tipoEquipo;
      equipo_afectado = `${equipo} en ${formData.sitio}`;
    } else if (formData.affectationType === 'Punto') {
      equipo_afectado = `Punto en ${formData.sitio}`;
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

    const payload: TechnicalFailurePayload = {
      fecha: fechaFalloPayload,
      horaFallo: horaFalloPayload,
      fechaHoraFallo: fechaHoraFalloISO,
      affectationType: formData.affectationType,
      equipo_afectado: equipo_afectado || 'No especificado',
      descripcion_fallo: descripcion_fallo || 'Sin descripción',
      responsable: session.user,
      tipoProblema: formData.tipoProblema || formData.tipoProblemaEquipo,
      tipoEquipo: formData.tipoEquipo,
      nodo: formData.nodo,
      sitio: formData.sitio,
      consola: session.console,
      reportadoCliente: formData.reportadoCliente,
      camara: formData.camara,
      cliente: clienteFromConsole || cliente,
    };

    try {
      setIsSubmitting(true);
      const created = await createFallo(payload);
      setFailures((prev) => [created, ...prev]);
      alert('Registro guardado correctamente.');
      setFormData(buildInitialFormData());
      setErrors({});
      setCliente(null);
      setClienteFromConsole(null);
      setSitios([]);
      setSitio(null);
    } catch (error) {
      console.error('Error al registrar el fallo técnico:', error);
      alert('No se pudo registrar el fallo técnico. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConditionalFields = () => {
    const sitioSelectField = (
      <div className="md:col-span-2">
        <AutocompleteComboBox
          label="Sitio *"
          value={formData.sitio}
          onChange={(selected: string) => applyFieldUpdate('sitio', selected)}
          items={sitioItems}
          displayField="nombre"
          valueField="value"
          placeholder="Buscar sitio..."
          disabled={sitios.length === 0}
          error={errors.sitio}
          emptyMessage={sitios.length === 0 ? 'No hay sitios disponibles' : 'No se encontraron sitios'}
        />
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
                  onChange={(selected: string) => applyFieldUpdate('tipoProblema', selected)}
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
              {sitio && (
                <div className="d-flex justify-content-end mt-2">
                  <span
                    className="badge bg-primary-subtle text-primary fw-semibold px-3 py-2 rounded-pill"
                    style={{ fontSize: '0.9rem' }}
                  >
                    → Sitio: {sitio.nombre}
                  </span>
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
                  onChange={(selected: string) => applyFieldUpdate('tipoProblema', selected)}
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
                  value={formData.tipoEquipo}
                  onChange={(selected: string) => applyFieldUpdate('tipoEquipo', selected)}
                  items={tipoEquipoItems}
                  displayField="label"
                  valueField="value"
                  placeholder="Buscar tipo de equipo..."
                  error={errors.tipoEquipo}
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
            {formData.tipoEquipo && formData.tipoEquipo !== 'Cámara' && (
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
            {formData.tipoEquipo === 'Cámara' && (
              <div className="md:col-span-2">
                <AutocompleteComboBox
                  label="Cámara *"
                  value={formData.camara}
                  onChange={(selected: string) => applyFieldUpdate('camara', selected)}
                  items={camaraItems}
                  displayField="nombre"
                  valueField="value"
                  placeholder="Buscar cámara..."
                  error={errors.camara}
                />
              </div>
            )}
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
          <FechaHoraFalloPicker
            id="fechaHoraFallo"
            name="fechaHoraFallo"
            value={formData.fechaHoraFallo}
            onChange={handleFechaHoraFalloChange}
            required
            error={errors.fechaHoraFallo}
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
    </div>
  );
};

export default TechnicalFailuresOperador;
