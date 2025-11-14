import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTipoAreaById, createTipoArea, updateTipoArea } from '../../services/tipoAreaService';

type TipoAreaEntity = {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean | null;
};


const TipoAreaForm = () => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  useEffect(() => {
    if (id) {
      fetchTipoArea(id);
    }
  }, [id]);

  const fetchTipoArea = async (tipoAreaId: string) => {
    try {
      const data = (await getTipoAreaById(tipoAreaId)) as TipoAreaEntity | null;
      const { nombre, descripcion, activo } = data ?? {};
      setNombre(nombre ?? '');
      setDescripcion(descripcion ?? '');
      setActivo(typeof activo === 'boolean' ? activo : true);
    } catch (err) {
      setError('Error al obtener el tipo de área');
      console.error(err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tipoAreaData = { nombre, descripcion, activo };

    try {
      if (id) {
        await updateTipoArea(id, tipoAreaData);
      } else {
        await createTipoArea(tipoAreaData);
      }
      navigate('/administracion/tipo-area');
    } catch (err) {
      setError('Error al guardar el tipo de área');
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{id ? 'Editar' : 'Crear'} Tipo de Área</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        <div className="mb-4">
          <label htmlFor="nombre" className="block text-gray-700 text-sm font-bold mb-2">Nombre</label>
          <input
            type="text"
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="descripcion" className="block text-gray-700 text-sm font-bold mb-2">Descripción</label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        {id && (
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2 text-gray-700">Activo</span>
            </label>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Guardar
          </button>
          <button type="button" onClick={() => navigate('/administracion/tipo-area')} className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default TipoAreaForm;
