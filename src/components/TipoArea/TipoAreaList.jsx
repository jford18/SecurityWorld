import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTiposArea, deleteTipoArea } from '../../services/tipoAreaService';

const TipoAreaList = () => {
  const [tiposArea, setTiposArea] = useState([]);
  const [error, setError] = useState(null);

  const fetchTiposArea = async () => {
    try {
      const data = await getTiposArea();
      setTiposArea(data);
    } catch (err) {
      setError('No se pudieron cargar los tipos de área.');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTiposArea();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteTipoArea(id);
      fetchTiposArea();
    } catch (err) {
      setError('No se pudo eliminar el tipo de área.');
      console.error(err);
    }
  };

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="container mt-4">
      <h2>Gestión de Tipos de Área</h2>
      <Link to="/administracion/tipo-area/nuevo" className="btn btn-primary mb-3">
        Añadir Nuevo Tipo de Área
      </Link>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tiposArea.map((tipo) => (
            <tr key={tipo.id}>
              <td>{tipo.id}</td>
              <td>{tipo.nombre}</td>
              <td>{tipo.descripcion}</td>
              <td>{tipo.activo ? 'Sí' : 'No'}</td>
              <td>
                <Link
                  to={`/administracion/tipo-area/editar/${tipo.id}`}
                  className="btn btn-sm btn-warning me-2"
                >
                  Editar
                </Link>
                <button
                  onClick={() => handleDelete(tipo.id)}
                  className="btn btn-sm btn-danger"
                >
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
