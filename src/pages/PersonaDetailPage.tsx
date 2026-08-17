import React, { useState, useEffect } from 'react';
import { Persona, Cuenta, AuditLog, EstadoAcceso } from '../types';
import { Badge } from '../components/common/Badge';
import { formatFecha, formatAccionAudit } from '../utils/formatters';
import { determinarEstadoAcceso } from '../services/cuentasService';
import { WhatsAppModal } from '../components/personal/WhatsAppModal';
import { PersonaFormModal } from '../components/personal/PersonaFormModal';
import {
  ArrowLeft,
  Edit2,
  Power,
  MessageSquare,
  KeyRound,
  Shield,
  Clock,
  User,
  CreditCard,
  Phone,
  Calendar,
  History,
  AlertCircle,
  PlusCircle,
  UserCheck,
} from 'lucide-react';

interface PersonaDetailPageProps {
  persona: Persona;
  cuentas: Cuenta[];
  auditLogs: AuditLog[];
  onBack: () => void;
  onUpdatePersona: (id: string, data: Partial<Persona>) => Promise<void>;
  onTogglePersonaActive: (persona: Persona) => Promise<void>;
  onToggleCuentaActive: (cuenta: Cuenta) => Promise<void>;
  onCreateCuentaForPersona: (persona: Persona) => Promise<void>;
  onImpersonate?: (persona: Persona) => void;
}

export const PersonaDetailPage: React.FC<PersonaDetailPageProps> = ({
  persona,
  cuentas,
  auditLogs,
  onBack,
  onUpdatePersona,
  onTogglePersonaActive,
  onToggleCuentaActive,
  onCreateCuentaForPersona,
  onImpersonate,
}) => {
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const cuentaVinculada = cuentas.find((c) => c.personaId === persona.id);
  const estadoAcceso: EstadoAcceso = determinarEstadoAcceso(persona.id, cuentas);

  // Filtrar logs de auditoría específicos de esta persona
  const logsPersona = auditLogs.filter(
    (l) => l.personaId === persona.id || (l.personaNombre && l.personaNombre === persona.nombre)
  );

  return (
    <div id="persona-detail-page" className="space-y-6">
      {/* Top Bar: Back & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          id="btn-back-to-personal"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Directorio</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {onImpersonate && (
            <button
              id="btn-detail-impersonate"
              onClick={() => onImpersonate(persona)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xs transition-all"
              title="Visualizar la aplicación exactamente como la ve este usuario"
            >
              <UserCheck className="h-4 w-4" />
              <span>Ver como usuario (Simulación)</span>
            </button>
          )}

          <button
            id="btn-detail-whatsapp"
            onClick={() => setWaModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Enviar acceso por WhatsApp</span>
          </button>

          <button
            id="btn-detail-edit"
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Edit2 className="h-4 w-4" />
            <span>Editar Datos</span>
          </button>

          <button
            id="btn-detail-toggle-active"
            onClick={() => onTogglePersonaActive(persona)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs ${
              persona.activo
                ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            <Power className="h-4 w-4" />
            <span>{persona.activo ? 'Desactivar (Histórico)' : 'Reactivar en Grupo'}</span>
          </button>
        </div>
      </div>

      {/* Main Header Profile Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black shadow-inner ${
                persona.empleo === 'CABO'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {persona.nombre.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                  {persona.nombre}
                </h1>
                <Badge tipo="empleo" valor={persona.empleo} />
                <Badge tipo="unidad" valor={persona.unidad} />
                <Badge tipo="estado" valor={persona.activo} />
              </div>
              <p className="text-xs font-mono text-slate-400">
                ID Permanente del Sistema: <span className="font-semibold text-slate-600 dark:text-slate-300">{persona.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge tipo="acceso" valor={estadoAcceso} />
          </div>
        </div>
      </div>

      {/* Two Column Grid: Personal Data & Account Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Card: Datos Personales */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" />
              Datos Personales
            </h3>
            <span className="text-[11px] text-slate-400">
              Registrado: {formatFecha(persona.fechaCreacion)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Empleo
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {persona.empleo}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Unidad
              </span>
              <div className="mt-0.5">
                <Badge tipo="unidad" valor={persona.unidad} />
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" /> DNI / NIE
              </span>
              <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {persona.dni || <span className="text-slate-400 font-normal italic">Sin DNI</span>}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Teléfono
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {persona.telefono || <span className="text-slate-400 font-normal italic">Sin teléfono</span>}
              </p>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Power className="h-3.5 w-3.5" /> Estado Operativo
              </span>
              <div className="mt-0.5">
                <Badge tipo="estado" valor={persona.activo} />
              </div>
            </div>

            <div className="space-y-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Ciclo / Promoción
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {persona.cicloId || 'Ciclo 2026'}
              </p>
            </div>
          </div>

          {persona.notas && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Observaciones:</span>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{persona.notas}</p>
            </div>
          )}
        </div>

        {/* Right Card: Cuenta de Acceso */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-purple-600" />
              Cuenta de Acceso (Firebase Auth)
            </h3>
            <Badge tipo="acceso" valor={estadoAcceso} size="sm" />
          </div>

          {cuentaVinculada ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3.5 space-y-2 dark:bg-slate-800/60">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Correo / Identificador:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {cuentaVinculada.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Rol Asignado:</span>
                  <Badge tipo="rol" valor={cuentaVinculada.rol} size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Último Inicio de Sesión:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {formatFecha(cuentaVinculada.ultimoAcceso)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Estado de Credenciales:</span>
                  <Badge tipo="estado" valor={cuentaVinculada.activo} size="sm" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  id="btn-detail-toggle-cuenta"
                  onClick={() => onToggleCuentaActive(cuentaVinculada)}
                  className={`rounded-xl px-4 py-2 font-bold text-xs shadow-xs transition-all ${
                    cuentaVinculada.activo
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {cuentaVinculada.activo ? 'Desactivar Cuenta de Acceso' : 'Activar Cuenta de Acceso'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Esta persona todavía no tiene una cuenta de acceso vinculada.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                  Puedes generar la cuenta para que el usuario pueda iniciar sesión en el portal personal.
                </p>
              </div>
              <button
                id="btn-detail-create-cuenta"
                onClick={() => onCreateCuentaForPersona(persona)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs dark:bg-slate-100 dark:text-slate-900"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Generar Cuenta de Acceso</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Historial Específico de la Persona */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              Historial de Acciones y Auditoría de la Persona
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Eventos auditados registrados para {persona.nombre} con indicación del administrador responsable.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {logsPersona.length} eventos
          </span>
        </div>

        {logsPersona.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No se han registrado modificaciones para esta persona aún.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {logsPersona.map((log) => {
              const accionInfo = formatAccionAudit(log.accion);
              return (
                <div
                  key={log.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${accionInfo.badgeColor}`}>
                        {accionInfo.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Por: {log.adminNombre}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{log.detalles}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                    {formatFecha(log.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        persona={persona}
        cuenta={cuentaVinculada}
      />

      {/* Edit Form Modal */}
      <PersonaFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={async (data) => {
          await onUpdatePersona(persona.id, data);
        }}
        personaEditar={persona}
      />
    </div>
  );
};
