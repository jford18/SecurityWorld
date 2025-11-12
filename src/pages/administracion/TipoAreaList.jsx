import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Link, useNavigate } from 'react-router-dom';

const TipoAreaList = () => {
  const navigate = useNavigate();
  const [tiposArea, setTiposArea] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTiposArea();
  }, []);

  const fetchTiposArea = async () => {
    try {
      const response = await api.get('/api/tipo_area');
      setTiposArea(response.data.data);
    } catch (err) {
      setError('Error al obtener los tipos de área');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este tipo de área?')) {
      try {
        await api.delete(`/api/tipo_area/${id}`);
        fetchTiposArea();
      } catch (err) {
        setError('Error al eliminar el tipo de área');
        console.error(err);
      }
    }
  };

  const handleCreate = () => {
    navigate('/administracion/tipo-area/nuevo');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tipos de Área</h1>
      {error && <p className="text-red-500">{error}</p>}
      <button
        onClick={handleCreate}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 inline-block"
      >
        Crear Nuevo Tipo de Área
      </button>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Nombre</th>
            <th className="py-2 px-4 border-b">Descripción</th>
            <th className="py-2 px-4 border-b">Activo</th>
            <th className="py-2 px-4 border-b">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tiposArea.map((tipo) => (
            <tr key={tipo.id}>
              <td className="py-2 px-4 border-b">{tipo.nombre}</td>
              <td className="py-2 px-4 border-b">{tipo.descripcion}</td>
              <td className="py-2 px-4 border-b">{tipo.activo ? 'Sí' : 'No'}</td>
              <td className="py-2 px-4 border-b">
                <Link to={`/administracion/tipo-area/editar/${tipo.id}`} className="text-blue-500 hover:underline mr-2">
                  Editar
                </Link>
                <button onClick={() => handleDelete(tipo.id)} className="text-red-500 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TipoAreaList;
