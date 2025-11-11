import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const TipoAreaForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: true,
  });
  const [error, setError] = useState(null);
  const isEditing = !!id;

  useEffect(() => {
    if (isEditing) {
      const fetchTipoArea = async () => {
        try {
          const response = await axios.get(`/api/tipo-area/${id}`);
          setFormData(response.data);
        } catch (err) {
          setError('No se pudo cargar el tipo de área para edición.');
          console.error(err);
        }
      };
      fetchTipoArea();
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`/api/tipo-area/${id}`, formData);
      } else {
        await axios.post('/api/tipo-area', formData);
      }
      navigate('/administracion/tipo-area');
    } catch (err) {
      setError('No se pudo guardar el tipo de área.');
      console.error(err);
    }
  };

  return (
    <div className="container mt-4">
      <h2>{isEditing ? 'Editar' : 'Crear'} Tipo de Área</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="nombre" className="form-label">
            Nombre
          </label>
          <input
            type="text"
            className="form-control"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="descripcion" className="form-label">
            Descripción
          </label>
          <textarea
            className="form-control"
            id="descripcion"
            name="descripcion"
            rows="3"
            value={formData.descripcion}
            onChange={handleChange}
          ></textarea>
        </div>
        {isEditing && (
          <div className="form-check mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="activo"
              name="activo"
              checked={formData.activo}
              onChange={handleChange}
            />
            <label className="form-check-label" htmlFor="activo">
              Activo
            </label>
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          Guardar
        </button>
        <button
          type="button"
          className="btn btn-secondary ms-2"
          onClick={() => navigate('/administracion/tipo-area')}
        >
          Cancelar
        </button>
      </form>
    </div>
  );
};

export default TipoAreaForm;
