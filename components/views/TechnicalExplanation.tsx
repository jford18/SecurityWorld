
import React from 'react';

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-gray-800 text-green-400 p-4 rounded-lg my-2 text-sm overflow-x-auto">
        <code>
            {children}
        </code>
    </pre>
);

const TechnicalExplanation: React.FC = () => {
  return (
    <div>
      <h3 className="text-3xl font-medium text-gray-700">Arquitectura del Sistema</h3>
      <p className="mt-2 text-gray-600">Explicación técnica de la transición del demo a producción.</p>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold text-[#1C2E4A] mb-4">Fase 1: Demo Actual (Entorno Local)</h4>
            <div className="flex items-start space-x-4">
                <div className="text-blue-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <div>
                    <p className="font-medium text-gray-700">Fuente de Datos</p>
                    <p className="text-gray-600">Los datos que se visualizan en este portal son simulados (mock) y provienen de archivos locales <span className="font-mono bg-gray-200 px-1 rounded">.ts</span>.</p>
                    <p className="mt-2 text-gray-600">Esto permite una demostración completa de la interfaz y la experiencia de usuario sin necesidad de una conexión real al backend.</p>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold text-[#1C2E4A] mb-4">Fase 2: Sistema en Producción</h4>
            <div className="flex items-start space-x-4">
                 <div className="text-green-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
                <div>
                    <p className="font-medium text-gray-700">Conexión a HikCentral OpenAPI</p>
                    <p className="text-gray-600">En la versión de producción, los datos mock serán reemplazados por llamadas reales a la API de HikCentral (Artemis).</p>
                    <p className="mt-2 text-gray-600">Los endpoints principales a consumir serán:</p>
                    <CodeBlock>
                        /api/device/inventory{'\n'}
                        /api/event/alerts{'\n'}
                        /api/resource/status
                    </CodeBlock>
                </div>
            </div>
        </div>
      </div>
       <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold text-[#1C2E4A] mb-4">Motor de Automatización</h4>
            <div className="flex items-start space-x-4">
                <div className="text-yellow-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                     <p className="font-medium text-gray-700">Sincronización Periódica</p>
                    <p className="text-gray-600">Un motor desarrollado en <span className="font-mono bg-gray-200 px-1 rounded">Python</span> se ejecutará como un servicio en segundo plano.</p>
                    <p className="mt-2 text-gray-600">Este servicio se encargará de consultar la OpenAPI de HikCentral cada 15 minutos para sincronizar, procesar y actualizar los datos, asegurando que los reportes y el estado de los dispositivos estén siempre al día.</p>
                </div>
            </div>
       </div>

    </div>
  );
};

export default TechnicalExplanation;
