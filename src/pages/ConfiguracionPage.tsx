import React, { useState } from 'react';
import { useAuth } from '../firebase/context';
import { FIRESTORE_DATABASE_ID } from '../firebase/config';
import { seedDatabaseInitial } from '../services/seedService';
import {
  Settings,
  Database,
  Shield,
  Layers,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Server,
} from 'lucide-react';

interface ConfiguracionPageProps {
  onRefreshAllData: () => Promise<void>;
}

export const ConfiguracionPage: React.FC<ConfiguracionPageProps> = ({ onRefreshAllData }) => {
  const { currentCuenta } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSeedData = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const adminInfo = {
        uid: currentCuenta?.uid || 'admin-config',
        nombre: currentCuenta?.nombre || 'Administrador',
      };
      const res = await seedDatabaseInitial(adminInfo);
      await onRefreshAllData();
      setMessage(
        `✓ Base de datos reinicializada con éxito. Se crearon ${res.personasCount} personas (11 Cabos + 11 Soldados) y cuentas de acceso de prueba.`
      );
    } catch (err: any) {
      setMessage(`Error al inicializar: ${err.message || 'Error desconocido'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div id="configuracion-page" className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Configuración del Sistema
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Parámetros del grupo, ciclos de rotación, estado de Firestore y utilidades de desarrollo.
        </p>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Grid of config modules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Module 1: Ciclos de Personal */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Layers className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ciclos y Promociones de Personal
            </h3>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            La arquitectura está preparada para soportar la rotación del grupo en el futuro (ej. llegada de nuevo personal en aproximadamente 6 meses) sin borrar registros históricos ni relaciones de cuadrantes.
          </p>

          <div className="rounded-2xl bg-slate-50 p-4 space-y-2 dark:bg-slate-800/60 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Ciclo Activo:</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Grupo 2026 (Activo)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Rango permitido por grupo:</span>
              <span className="font-bold text-slate-900 dark:text-white">21 - 23 personas</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Preservación histórica:</span>
              <span className="font-bold text-emerald-600">Garantizada (activo = false)</span>
            </div>
          </div>
        </div>

        {/* Module 2: Firestore & Infraestructura */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Server className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Infraestructura y Base de Datos
            </h3>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 space-y-2.5 dark:bg-slate-800/60 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Motor de Base de Datos:</span>
              <span className="font-bold text-slate-900 dark:text-white">Cloud Firestore</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Database ID:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {FIRESTORE_DATABASE_ID}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Reglas de Seguridad:</span>
              <span className="text-emerald-600 font-bold">Desplegadas en Firebase</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-reseed-database-config"
              onClick={handleSeedData}
              disabled={seeding}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              <Database className="h-4 w-4" />
              <span>{seeding ? 'Restableciendo datos...' : 'Restablecer Datos de Prueba (22 personas + 2 Admins)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
