import React from 'react';

const Unauthorized: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-[#1C2E4A]">
      <h2 className="text-3xl font-bold mb-4">Acceso restringido</h2>
      <p className="text-lg max-w-lg text-gray-600">
        No tienes permisos para acceder a esta sección. Selecciona un menú válido desde la
        barra lateral o comunícate con un administrador para solicitar acceso.
      </p>
    </div>
  );
};

export default Unauthorized;
