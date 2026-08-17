import React, { useState } from 'react';
import { Cuenta, Persona, RolUsuario } from '../types';
import { CuentaTable } from '../components/cuentas/CuentaTable';
import { CuentaModal } from '../components/cuentas/CuentaModal';
import { CompartirEnlaceAltaModal } from '../components/cuentas/CompartirEnlaceAltaModal';
import { KeyRound, Plus, Shield, Users, AlertCircle, Link2 } from 'lucide-react';

interface CuentasPageProps {
  cuentas: Cuenta[];
  personas: Persona[];
  onCreateCuenta: (data: {
    nombre: string;
    email: string;
    rol: RolUsuario;
    personaId: string | null;
  }) => Promise<void>;
  onToggleActive: (cuenta: Cuenta) => Promise<void>;
}

export const CuentasPage: React.FC<CuentasPageProps> = ({
  cuentas,
  personas,
  onCreateCuenta,
  onToggleActive,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [enlaceModalOpen, setEnlaceModalOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<'TODOS' | RolUsuario>('TODOS');

  const cuentasFiltradas = (cuentas || []).filter((c) => {
    if (filterRole !== 'TODOS' && c.rol !== filterRole) return false;
    return true;
  });

  const adminsCount = (cuentas || []).filter((c) => c.rol === 'ADMIN').length;
  const usuariosCount = (cuentas || []).filter((c) => c.rol === 'USUARIO').length;
  const activasCount = (cuentas || []).filter((c) => c.activo).length;

  return (
    <div id="cuentas-page" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Cuentas y Permisos de Acceso
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {cuentas.length} cuentas registradas ({adminsCount} administradores, {usuariosCount} usuarios de personal, {activasCount} activas)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-enlace-alta"
            onClick={() => setEnlaceModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all shrink-0 cursor-pointer"
          >
            <Link2 className="h-4 w-4" />
            <span>Enlace de Alta de Efectivos</span>
          </button>

          <button
            id="btn-crear-cuenta"
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Cuenta Manual</span>
          </button>
        </div>
      </div>

      {/* Info notice: Decoupling */}
      <div className="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 text-xs text-purple-950 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-200">
        <Shield className="h-5 w-5 shrink-0 text-purple-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Desacoplamiento Persona / Cuenta de Acceso</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            Una persona puede existir en el grupo sin tener cuenta creada. Las credenciales se gestionan exclusivamente en Firebase Auth, garantizando que nunca se almacenen contraseñas en texto plano ni en Firestore.
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500">Filtrar por Rol:</label>
        <select
          id="select-filter-cuentas-rol"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="TODOS">Todos los roles</option>
          <option value="ADMIN">Solo Administradores</option>
          <option value="USUARIO">Solo Usuarios (Personal)</option>
        </select>
      </div>

      {/* Cuentas Table */}
      <CuentaTable
        cuentas={cuentasFiltradas}
        personas={personas}
        onToggleActive={onToggleActive}
      />

      {/* Create Modal */}
      <CuentaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        personas={personas}
        onSave={onCreateCuenta}
      />

      {/* Enlace de Alta Modal */}
      <CompartirEnlaceAltaModal
        isOpen={enlaceModalOpen}
        onClose={() => setEnlaceModalOpen(false)}
      />
    </div>
  );
};
