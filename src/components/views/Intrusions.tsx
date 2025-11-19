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

const estadoItems = [
  { id: 'empty', label: 'Seleccione...', value: '' },
  { id: 'pendiente', label: 'Pendiente', value: 'Pendiente' },
  { id: 'atendido', label: 'Atendido', value: 'Atendido' },
];

type IntrusionFormData = Required<Pick<IntrusionPayload, 'fecha_evento'>> &
  Required<Pick<IntrusionPayload, 'ubicacion' | 'tipo' | 'estado'>> &
  Pick<IntrusionPayload, 'descripcion'>;

const getInitialDateTimeValue = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

const buildInitialFormData = (): IntrusionFormData => ({
  fecha_evento: getInitialDateTimeValue(),
  ubicacion: '',
  tipo: '',
  estado: '',
  descripcion: '',
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

  const isSubmitDisabled = useMemo(() => {
    return (
      !formData.fecha_evento ||
      !formData.ubicacion.trim() ||
      !formData.tipo.trim() ||
      !formData.estado ||
      isSubmitting
    );
  }, [formData, isSubmitting]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    const descripcionValue = formData.descripcion?.trim();

    const payload: IntrusionPayload = {
      fecha_evento: formData.fecha_evento,
      ubicacion: formData.ubicacion.trim(),
      tipo: formData.tipo.trim(),
      estado: formData.estado,
      descripcion: descripcionValue ? descripcionValue : undefined,
    };

    try {
      const created = await createIntrusion(payload);
      setIntrusions((prev) => [created, ...prev]);
      setFormData(buildInitialFormData());
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
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">
              Tipo de Intrusión
            </label>
            <input
              type="text"
              name="tipo"
              id="tipo"
              value={formData.tipo}
              onChange={handleInputChange}
              placeholder="Ej: Movimiento no autorizado"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {intrusions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
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