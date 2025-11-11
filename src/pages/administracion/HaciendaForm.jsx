import React, { useState, useEffect } from 'react';
import type { Hacienda } from '../../types';
import { createHacienda, updateHacienda } from '../../services/haciendaService';

const baseButtonClasses =
  'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
const primaryButtonClasses = `${baseButtonClasses} bg-[#1C2E4A] text-white hover:bg-[#243b55] focus:ring-[#1C2E4A]`;
const secondaryButtonClasses = `${baseButtonClasses} bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-300`;

interface HaciendaFormProps {
  mode: 'create' | 'edit';
  hacienda: Hacienda | null;
  onClose: () => void;
  onSuccess: () => void;
}

const HaciendaForm: React.FC<HaciendaFormProps> = ({ mode, hacienda, onClose, onSuccess }) => {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [activo, setActivo] = useState(true);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && hacienda) {
      setNombre(hacienda.nombre);
      setDireccion(hacienda.direccion);
      setActivo(hacienda.activo);
    } else {
      setNombre('');
      setDireccion('');
      setActivo(true);
    }
  }, [mode, hacienda]);

  const handleSubmit = async () => {
    const normalizedNombre = nombre.trim();

    if (!normalizedNombre) {
      setFormError('El nombre es obligatorio');
      return;
    }

    try {
      const payload = {
        nombre: normalizedNombre,
        direccion: direccion.trim(),
        activo,
      };

      if (mode === 'create') {
        await createHacienda(payload);
        alert('Hacienda creada correctamente');
      } else if (hacienda) {
        await updateHacienda(hacienda.id, payload);
        alert('Hacienda actualizada correctamente');
      }
      onSuccess();
    } catch (error) {
      const message = (error as Error).message || 'Error al guardar la hacienda';
      setFormError(message);
      alert(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            {mode === 'create' ? 'Nueva Hacienda' : 'Editar Hacienda'}
          </h2>
          <button type="button" className="text-gray-500 hover:text-gray-700" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(event) => {
                setNombre(event.target.value);
                setFormError('');
              }}
              placeholder="Ingresa el nombre"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div>
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">
              Dirección
            </label>
            <textarea
              id="direccion"
              value={direccion}
              onChange={(event) => setDireccion(event.target.value)}
              placeholder="Ingresa la dirección"
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1C2E4A] focus:outline-none focus:ring-1 focus:ring-[#1C2E4A]"
            />
          </div>
          <div className="flex items-center">
            <input
              id="activo"
              type="checkbox"
              checked={activo}
              onChange={(event) => setActivo(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#1C2E4A] focus:ring-[#1C2E4A]"
            />
            <label htmlFor="activo" className="ml-2 block text-sm text-gray-900">
              Activo
            </label>
          </div>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={secondaryButtonClasses} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={primaryButtonClasses} onClick={handleSubmit}>
            {mode === 'create' ? 'Guardar' : 'Actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HaciendaForm;
