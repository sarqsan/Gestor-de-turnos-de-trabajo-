import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Persona, RolUsuario } from '../../types';

interface CuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: Persona[];
  onSave: (data: {
    nombre: string;
    email: string;
    rol: RolUsuario;
    personaId: string | null;
  }) => Promise<void>;
}

export const CuentaModal: React.FC<CuentaModalProps> = ({
  isOpen,
  onClose,
  personas,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolUsuario>('USUARIO');
  const [personaId, setPersonaId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePersonaSelect = (pId: string) => {
    setPersonaId(pId);
    if (pId) {
      const p = personas.find((x) => x.id === pId);
      if (p) {
        if (!nombre) setNombre(p.nombre);
        if (!email) {
          const cleanName = p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
          setEmail(`${cleanName}@grupo.local`);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) {
      setError('Por favor completa el nombre y el correo electrónico.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol,
        personaId: personaId || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta de acceso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="modal-cuenta-form"
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Nueva Cuenta de Acceso"
      subtitle="Firebase Auth gestionará las credenciales y Firestore la vinculación con la persona."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Vincular a Persona existente */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Vincular a Persona del Grupo <span className="text-slate-400 font-normal">(Opcional para Administradores)</span>
          </label>
          <select
            id="select-vincular-persona"
            value={personaId}
            onChange={(e) => handlePersonaSelect(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          >
            <option value="">-- Sin persona vinculada (Cuenta administrativa independiente) --</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.empleo}) {p.dni ? `- DNI: ${p.dni}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nombre Visible <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-cuenta-nombre"
            type="text"
            required
            placeholder="Ej: Administrador 1 o Juan Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Correo Electrónico / Identificador <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-cuenta-email"
            type="email"
            required
            placeholder="usuario@grupo.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Rol */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Rol de Acceso <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              id="btn-rol-usuario"
              onClick={() => setRol('USUARIO')}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-bold transition-all ${
                rol === 'USUARIO'
                  ? 'border-slate-900 bg-slate-100 text-slate-900 dark:border-slate-100 dark:bg-slate-800 dark:text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span>USUARIO</span>
              <span className="text-[10px] font-normal text-slate-500">
                Personal del grupo
              </span>
            </button>

            <button
              type="button"
              id="btn-rol-admin"
              onClick={() => setRol('ADMIN')}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-bold transition-all ${
                rol === 'ADMIN'
                  ? 'border-purple-500 bg-purple-50 text-purple-950 dark:border-purple-400 dark:bg-purple-950/50 dark:text-purple-200'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span>ADMINISTRADOR</span>
              <span className="text-[10px] font-normal text-slate-500">
                Gestión total y auditoría
              </span>
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            id="btn-cancel-cuenta-form"
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            id="btn-submit-cuenta-form"
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {saving ? 'Creando...' : 'Crear Cuenta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
