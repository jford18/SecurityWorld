import React, { useState, useEffect } from 'react';
import { technicalFailuresData, technicalFailureMocks } from '../../data/mockData';

type AffectationType = 'Nodo' | 'Punto' | 'Equipo' | 'Masivo' | '';

const initialFormData = {
  fechaFallo: '',
  horaFallo: '',
  affectationType: '' as AffectationType,
  tipoProblema: '',
  reportadoCliente: false,
  nodo: '',
  consola: '',
  tipoEquipo: '',
  camara: '',
};

const TechnicalFailures: React.FC = () => {
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Partial<typeof initialFormData>>({});
  const [proyecto, setProyecto] = useState<string | null>(null);
  const [sitio, setSitio] = useState<string | null>(null);

  const validate = (fieldValues = formData) => {
    let tempErrors: Partial<typeof initialFormData> = { ...errors };

    if ('fechaFallo' in fieldValues) {
        if (!fieldValues.fechaFallo) {
            tempErrors.fechaFallo = 'La fecha es obligatoria.';
        } else {
            const today = new Date();
            const inputDate = new Date(fieldValues.fechaFallo);
            today.setHours(0, 0, 0, 0); 
            inputDate.setHours(0,0,0,0);
            inputDate.setDate(inputDate.getDate() + 1);
            if (inputDate >= today) {
                tempErrors.fechaFallo = 'La fecha no puede ser igual o posterior a la actual.';
            } else {
                delete tempErrors.fechaFallo;
            }
        }
    }
    
    if (fieldValues.affectationType === 'Nodo') {
        if (!fieldValues.nodo) tempErrors.nodo = "El nodo es obligatorio.";
        else delete tempErrors.nodo;
    }
    if (fieldValues.affectationType === 'Punto') {
        if (!fieldValues.consola) tempErrors.consola = "La consola es obligatoria.";
        else delete tempErrors.consola;
    }
    if (fieldValues.affectationType === 'Equipo') {
        if (!fieldValues.tipoEquipo) tempErrors.tipoEquipo = "El tipo de equipo es obligatorio.";
        else delete tempErrors.tipoEquipo;
        if(fieldValues.tipoEquipo === 'Cámara' && !fieldValues.camara) {
            tempErrors.camara = "La cámara es obligatoria.";
        } else {
            delete tempErrors.camara;
        }
        if(fieldValues.tipoEquipo !== 'Cámara' && !fieldValues.consola) {
             tempErrors.consola = "La consola es obligatoria.";
        } else {
            if(fieldValues.tipoEquipo !== 'Cámara') delete tempErrors.consola;
        }
    }


    setErrors({ ...tempErrors });

    // Return true if form is valid
    return Object.values(tempErrors).every(x => x === "" || x === undefined);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    validate({ [name]: value });
  };

  const handleAffectationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value as AffectationType;
    setFormData({
        ...initialFormData,
        fechaFallo: formData.fechaFallo,
        horaFallo: formData.horaFallo,
        affectationType: newType,
    });
    setErrors({});
    setProyecto(null);
    setSitio(null);
  };

  useEffect(() => {
    if (formData.affectationType === 'Nodo' && formData.nodo) {
      const relation = technicalFailureMocks.nodo_proyecto.find(np => np.nodo === formData.nodo);
      setProyecto(relation ? relation.proyecto : 'Proyecto no encontrado');
    } else {
      setProyecto(null);
    }
  }, [formData.nodo, formData.affectationType]);

  useEffect(() => {
    if ((formData.affectationType === 'Punto' || (formData.affectationType === 'Equipo' && formData.tipoEquipo !== 'Cámara')) && formData.consola) {
        const relation = technicalFailureMocks.consola_sitio.find(cs => cs.consola === formData.consola);
        setSitio(relation ? relation.sitio : 'Sitio no encontrado');
    } else {
      setSitio(null);
    }
  }, [formData.consola, formData.affectationType, formData.tipoEquipo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
       if(formData.affectationType === 'Nodo' && (!proyecto || proyecto === 'Proyecto no encontrado')) {
         alert('Debe seleccionar un nodo válido vinculado a un proyecto.');
         return;
       }
       if((formData.affectationType === 'Punto' || (formData.affectationType === 'Equipo' && formData.tipoEquipo !== 'Cámara')) && (!sitio || sitio === 'Sitio no encontrado')) {
         alert('Debe seleccionar una consola válida vinculada a un sitio.');
         return;
       }
       alert('Registro guardado correctamente.');
       setFormData(initialFormData);
       setErrors({});
       setProyecto(null);
       setSitio(null);
    }
  };
  
  const renderConditionalFields = () => {
    switch (formData.affectationType) {
      case 'Nodo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label htmlFor="tipoProblema" className="block text-sm font-medium text-gray-700">Tipo de Problema *</label>
                    <select id="tipoProblema" name="tipoProblema" value={formData.tipoProblema} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                        <option value="">Seleccione...</option>
                        <option>Intermitencia</option>
                        <option>Pérdida de visual</option>
                        <option>Tiempos altos</option>
                        <option>Caídas recurrentes</option>
                    </select>
                </div>
                 <div className="flex items-end">
                    <div className="flex items-start">
                        <div className="flex items-center h-5">
                        <input id="reportadoCliente" name="reportadoCliente" type="checkbox" checked={formData.reportadoCliente} onChange={handleInputChange} className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded" />
                        </div>
                        <div className="ml-3 text-sm">
                        <label htmlFor="reportadoCliente" className="font-medium text-gray-700">Reportado al cliente</label>
                        </div>
                    </div>
                </div>
            </div>
            <div className="md:col-span-2">
                <div className="flex items-center gap-4">
                    <div className="flex-grow">
                        <label htmlFor="nodo" className="block text-sm font-medium text-gray-700">Nodo *</label>
                        <select id="nodo" name="nodo" value={formData.nodo} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                        <option value="">Seleccione...</option>
                        {technicalFailureMocks.nodos.map(n => <option key={n.id} value={n.nombre}>{n.nombre}</option>)}
                        </select>
                        {errors.nodo && <p className="text-red-500 text-xs mt-1">{errors.nodo}</p>}
                    </div>
                    {proyecto && (
                        <div className="mt-6 p-2 bg-blue-100 text-blue-800 rounded-md text-sm font-semibold">
                            → Proyecto: {proyecto}
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
                    <label htmlFor="tipoProblema" className="block text-sm font-medium text-gray-700">Tipo de Problema *</label>
                    <select id="tipoProblema" name="tipoProblema" value={formData.tipoProblema} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                        <option value="">Seleccione...</option>
                        <option>Desenganche</option>
                        <option>Falta grabaciones en HikCentral</option>
                        <option>Intermitencia</option>
                        <option>Pérdida de visual</option>
                        <option>Tiempos altos</option>
                        <option>Caídas recurrentes</option>
                    </select>
                </div>
                 <div className="flex items-end">
                     <div className="flex items-start">
                        <div className="flex items-center h-5">
                            <input id="reportadoCliente" name="reportadoCliente" type="checkbox" checked={formData.reportadoCliente} onChange={handleInputChange} className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded" />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="reportadoCliente" className="font-medium text-gray-700">Reportado al cliente</label>
                        </div>
                    </div>
                </div>
            </div>
            <div className="md:col-span-2">
                 <div className="flex items-center gap-4">
                    <div className="flex-grow">
                        <label htmlFor="consola" className="block text-sm font-medium text-gray-700">Consola *</label>
                        <select id="consola" name="consola" value={formData.consola} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                            <option value="">Seleccione...</option>
                            {technicalFailureMocks.consolas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                        {errors.consola && <p className="text-red-500 text-xs mt-1">{errors.consola}</p>}
                    </div>
                    {sitio && (
                         <div className="mt-6 p-2 bg-blue-100 text-blue-800 rounded-md text-sm font-semibold">
                            → Sitio: {sitio}
                        </div>
                    )}
                 </div>
            </div>
          </>
        );
      case 'Equipo':
        return (
          <>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="tipoEquipo" className="block text-sm font-medium text-gray-700">Tipo de Equipo Afectado *</label>
                    <select id="tipoEquipo" name="tipoEquipo" value={formData.tipoEquipo} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                        <option value="">Seleccione...</option>
                        {technicalFailureMocks.tipos_equipo.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {errors.tipoEquipo && <p className="text-red-500 text-xs mt-1">{errors.tipoEquipo}</p>}
                </div>
                 <div className="flex items-end">
                    <div className="flex items-start">
                        <div className="flex items-center h-5">
                            <input id="reportadoCliente" name="reportadoCliente" type="checkbox" checked={formData.reportadoCliente} onChange={handleInputChange} className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300 rounded" />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="reportadoCliente" className="font-medium text-gray-700">Reportado al cliente</label>
                        </div>
                    </div>
                </div>
            </div>
            {formData.tipoEquipo === 'Cámara' && (
                <div className="md:col-span-2">
                    <label htmlFor="camara" className="block text-sm font-medium text-gray-700">Cámara *</label>
                    <select id="camara" name="camara" value={formData.camara} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                        <option value="">Seleccione...</option>
                        {technicalFailureMocks.dispositivos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                    </select>
                    {errors.camara && <p className="text-red-500 text-xs mt-1">{errors.camara}</p>}
                </div>
            )}
            {formData.tipoEquipo && formData.tipoEquipo !== 'Cámara' && (
                 <div className="md:col-span-2">
                    <div className="flex items-center gap-4">
                        <div className="flex-grow">
                            <label htmlFor="consola" className="block text-sm font-medium text-gray-700">Consola *</label>
                            <select id="consola" name="consola" value={formData.consola} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm">
                                <option value="">Seleccione...</option>
                                {technicalFailureMocks.consolas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                            </select>
                            {errors.consola && <p className="text-red-500 text-xs mt-1">{errors.consola}</p>}
                        </div>
                        {sitio && (
                            <div className="mt-6 p-2 bg-blue-100 text-blue-800 rounded-md text-sm font-semibold">
                                → Sitio: {sitio}
                            </div>
                        )}
                    </div>
                </div>
            )}
          </>
        );
      case 'Masivo':
        return null; // No additional fields
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
            <div>
                <label htmlFor="fechaFallo" className="block text-sm font-medium text-gray-700">Fecha de Fallo *</label>
                <input type="date" name="fechaFallo" id="fechaFallo" value={formData.fechaFallo} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm" />
                {errors.fechaFallo && <p className="text-red-500 text-xs mt-1">{errors.fechaFallo}</p>}
            </div>
            <div>
                <label htmlFor="horaFallo" className="block text-sm font-medium text-gray-700">Hora de Fallo</label>
                <input type="time" name="horaFallo" id="horaFallo" value={formData.horaFallo} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#F9C300] focus:ring-[#F9C300] sm:text-sm" />
            </div>

            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Tipo de Afectación *</label>
                 <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {(['Nodo', 'Punto', 'Equipo', 'Masivo'] as AffectationType[]).map(type => (
                        <div key={type} className="flex items-center">
                            <input id={type} name="affectationType" type="radio" value={type} checked={formData.affectationType === type} onChange={handleAffectationChange} className="focus:ring-[#F9C300] h-4 w-4 text-[#F9C300] border-gray-300" />
                            <label htmlFor={type} className="ml-2 block text-sm text-gray-900">{type}</label>
                        </div>
                    ))}
                 </div>
            </div>

            {renderConditionalFields()}

            <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="px-6 py-2 bg-[#F9C300] text-[#1C2E4A] font-semibold rounded-md hover:bg-yellow-400 transition-colors duration-300">
                Guardar Reporte
                </button>
            </div>
        </form>
      </div>

       <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h4 className="text-[#1C2E4A] text-lg font-semibold mb-4">Historial de Fallos Recientes</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {technicalFailuresData.map((fallo, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.fecha}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fallo.equipo_afectado}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.descripcion_fallo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fallo.responsable}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      fallo.estado === 'Resuelto' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {fallo.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TechnicalFailures;
