import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import FechaHoraFalloPicker from '../ui/FechaHoraFalloPicker';
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
  CatalogoDepartamento,
  CatalogoResponsable,
} from '../../types';
import {
  fetchFallos,
  createFallo,
  updateFallo,
  fetchCatalogos,
  TechnicalFailurePayload,
} from '../../services/fallosService';

type AffectationType = 'Nodo' | 'Punto' | 'Equipo' | 'Masivo' | '';

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
  const [failures, setFailures] = useState<TechnicalFailure[]>([]);
  const [catalogos, setCatalogos] = useState<TechnicalFailureCatalogs>(emptyCatalogos);
  const [formData, setFormData] = useState<FailureFormData>(buildInitialFormData());
  const [errors, setErrors] = useState<Partial<FailureFormData>>({});
  const [cliente, setCliente] = useState<string | null>(null);
  const [clienteFromConsole, setClienteFromConsole] = useState<string | null>(null);
  const [sitios, setSitios] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  };

  useEffect(() => {
    if (formData.affectationType === 'Nodo' && formData.nodo) {
      const relation = catalogos.nodoCliente.find((nc) => nc.nodo === formData.nodo);
      setCliente(relation ? relation.cliente : 'Cliente no encontrado');
    } else {
      setCliente(null);
    }
  }, [formData.nodo, formData.affectationType, catalogos.nodoCliente]);

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
      equipo_afectado = formData.nodo;
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
    } catch (error) {
      console.error('Error al registrar el fallo técnico:', error);
      alert('No se pudo registrar el fallo técnico. Intente nuevamente.');
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
            {sitios.length > 0 ? sitios.join(', ') : 'N/A'}
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
          {sitios.map((s) => (
            <option key={s} value={s}>
              {s}
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
                      <option key={n.id} value={n.nombre}>
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
