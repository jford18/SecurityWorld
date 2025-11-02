import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-[#1C2E4A]">
      <h2 className="text-4xl font-bold mb-4">404</h2>
      <p className="text-lg text-gray-600 mb-6">La página que buscas no existe.</p>
      <Link
        to="/"
        className="inline-flex items-center px-4 py-2 rounded-md bg-[#F9C300] text-[#1C2E4A] font-semibold hover:bg-[#f7d13e]"
      >
        Volver al inicio
      </Link>
    </div>
  );
};

export default NotFound;
