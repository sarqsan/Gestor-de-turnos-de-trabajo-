import React from 'react';
import { Cuenta, Persona } from '../../types';
import { Badge } from '../common/Badge';
import { formatFecha } from '../../utils/formatters';
import { KeyRound, Shield, User, Power, Link, Unlink } from 'lucide-react';

interface CuentaTableProps {
  cuentas: Cuenta[];
  personas: Persona[];
  onToggleActive: (cuenta: Cuenta) => void;
}

export const CuentaTable: React.FC<CuentaTableProps> = ({
  cuentas,
  personas,
  onToggleActive,
}) => {
  const getPersonaNombre = (personaId: string | null) => {
    if (!personaId) return null;
    const p = personas.find((x) => x.id === personaId);
    return p ? `${p.nombre} (${p.empleo})` : 'Persona no encontrada';
  };

  return (
    <div id="cuentas-table-container" className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Cuenta / Usuario</th>
              <th className="px-4 py-3.5">Rol</th>
              <th className="px-4 py-3.5">Persona Vinculada</th>
              <th className="px-4 py-3.5">Estado Cuenta</th>
              <th className="px-4 py-3.5">Último Acceso</th>
              <th className="px-5 py-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cuentas.map((cuenta) => {
              const personaNombre = getPersonaNombre(cuenta.personaId);
              return (
                <tr
                  key={cuenta.uid}
                  id={`row-cuenta-${cuenta.uid}`}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  {/* Nombre y Email */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {cuenta.rol === 'ADMIN' ? (
                          <Shield className="h-4 w-4 text-purple-600" />
                        ) : (
                          <User className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {cuenta.nombre}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {cuenta.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Rol */}
                  <td className="px-4 py-3.5">
                    <Badge tipo="rol" valor={cuenta.rol} />
                  </td>

                  {/* Persona Vinculada */}
                  <td className="px-4 py-3.5">
                    {personaNombre ? (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                        <Link className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>{personaNombre}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">
                        Cuenta independiente (Admin)
                      </span>
                    )}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3.5">
                    <Badge tipo="estado" valor={cuenta.activo} />
                  </td>

                  {/* Último Acceso */}
                  <td className="px-4 py-3.5 font-mono text-slate-500 text-[11px]">
                    {formatFecha(cuenta.ultimoAcceso)}
                  </td>

                  {/* Acciones */}
                  <td className="px-5 py-3.5 text-right">
                    <button
                      id={`btn-toggle-cuenta-${cuenta.uid}`}
                      onClick={() => onToggleActive(cuenta)}
                      title={cuenta.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        cuenta.activo
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{cuenta.activo ? 'Desactivar' : 'Activar'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {cuentas.map((cuenta) => {
          const personaNombre = getPersonaNombre(cuenta.personaId);
          return (
            <div
              key={cuenta.uid}
              id={`card-cuenta-mobile-${cuenta.uid}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {cuenta.nombre}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">{cuenta.email}</p>
                </div>
                <Badge tipo="rol" valor={cuenta.rol} size="sm" />
              </div>

              <div className="space-y-1 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vinculación:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {personaNombre || 'Admin independiente'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Último acceso:</span>
                  <span className="font-mono text-[11px]">
                    {formatFecha(cuenta.ultimoAcceso)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Badge tipo="estado" valor={cuenta.activo} size="sm" />
                <button
                  onClick={() => onToggleActive(cuenta)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    cuenta.activo
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {cuenta.activo ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
