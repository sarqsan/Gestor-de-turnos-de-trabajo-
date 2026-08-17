import React, { useState } from 'react';
import { Empleo, Persona, Unidad } from '../../types';
import { ShieldCheck, User, Phone, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { actualizarPersona, crearPersona } from '../../services/personasService';
import { actualizarPersonaCuenta } from '../../services/cuentasService';

interface CompletarPerfilModalProps {
  isOpen: boolean;
  uid: string;
  userEmail?: string;
  currentPersona?: Persona | null;
  initialUnidad?: Unidad;
  onSuccess: () => void;
}

export const CompletarPerfilModal: React.FC<CompletarPerfilModalProps> = ({
  isOpen,
  uid,
  userEmail,
  currentPersona,
  initialUnidad = 'GUARDIA',
  onSuccess,
}) => {
  const [nombre, setNombre] = useState(currentPersona?.nombre || '');
  const [empleo, setEmpleo] = useState<Empleo>(currentPersona?.empleo || 'CABO');
  const [unidad, setUnidad] = useState<Unidad>(currentPersona?.unidad || initialUnidad);
  const [dni, setDni] = useState(currentPersona?.dni || '');
  const [telefono, setTelefono] = useState(currentPersona?.telefono || '');
  const [notas, setNotas] = useState(currentPersona?.notas || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre y apellidos son obligatorios');
      return;
    }
    if (!dni.trim()) {
      setError('El DNI o documento militar TIM es obligatorio');
      return;
    }
    if (!telefono.trim()) {
      setError('El teléfono de localización de guardia es obligatorio');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (currentPersona?.id) {
        // Actualizar ficha existente
        await actualizarPersona(
          currentPersona.id,
          {
            nombre: nombre.trim(),
            empleo,
            unidad,
            dni: dni.trim(),
            telefono: telefono.trim(),
            notas: notas.trim(),
          },
          { uid, nombre: nombre.trim() }
        );
      } else {
        // Crear nueva ficha de persona
        const nuevaPersona = await crearPersona(
          {
            nombre: nombre.trim(),
            empleo,
            unidad,
            dni: dni.trim(),
            telefono: telefono.trim(),
            notas: notas.trim(),
            activo: true,
          },
          { uid, nombre: 'Autoregistro de Efectivo' }
        );

        // Vincular a la cuenta de usuario
        await actualizarPersonaCuenta(uid, nuevaPersona.id, {
          uid,
          nombre: nuevaPersona.nombre,
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error al guardar perfil militar:', err);
      setError(err.message || 'Error al guardar los datos obligatorios del perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center gap-3.5">
          <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight">Completar Perfil Militar</h3>
            <p className="text-xs text-slate-300">
              Datos reglamentarios requeridos para asignación de guardias e imaginarias
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">⚠️ Primer acceso al sistema: </span>
            Es obligatorio registrar tus datos de contacto y empleo militar para habilitar la
            gestión de tus servicios de guardia y notificaciones de imaginaria.
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre y Apellidos <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez García"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Empleo Militar <span className="text-rose-500">*</span>
              </label>
              <select
                value={empleo}
                onChange={(e) => setEmpleo(e.target.value as Empleo)}
                className="w-full py-2.5 px-3 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="CABO">Cabo (Titular/Imaginaria)</option>
                <option value="SOLDADO">Soldado (Titular/Imaginaria)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unidad Asignada <span className="text-rose-500">*</span>
              </label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value as Unidad)}
                className="w-full py-2.5 px-3 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="GUARDIA">Unidad de Guardia</option>
                <option value="SEGURIDAD">Unidad de Seguridad</option>
                <option value="GOE III">GOE III</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                DNI / TIM Militar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="12345678Z"
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono de Contacto <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="600 000 000"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones / Preferencias (Opcional)
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Alergias, restricciones o preferencias de servicio..."
              className="w-full p-3 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando Ficha...' : 'Guardar y Acceder al Portal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
