import React, { useState, useEffect } from 'react';
import { Header } from '../common/Header';
import { Sidebar, AdminTab } from '../common/Sidebar';
import { MobileNav } from '../common/MobileNav';
import { Persona, Cuenta, AuditLog, StatsPersonal, RolUsuario, TipoUnidad } from '../../types';
import {
  getPersonas,
  crearPersona,
  actualizarPersona,
  toggleEstadoPersona,
  calcularStats,
} from '../../services/personasService';
import {
  getCuentas,
  crearCuenta,
  toggleEstadoCuenta,
} from '../../services/cuentasService';
import { getAuditLogs, registrarAccionAudit } from '../../services/auditService';
import { useAuth } from '../../firebase/context';
import { PersonaFormModal } from '../personal/PersonaFormModal';
import { Shield } from 'lucide-react';

// Pages
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';
import { PersonalPage } from '../../pages/PersonalPage';
import { PersonaDetailPage } from '../../pages/PersonaDetailPage';
import { CuadrantesPage } from '../../pages/CuadrantesPage';
import { CuentasPage } from '../../pages/CuentasPage';
import { HistorialPage } from '../../pages/HistorialPage';
import { ImportarExcelPage } from '../../pages/ImportarExcelPage';
import { ConfiguracionPage } from '../../pages/ConfiguracionPage';
import { ChatPage } from '../../pages/ChatPage';
import { ProximamentePage } from '../../pages/ProximamentePage';

export const AdminLayout: React.FC = () => {
  const { currentCuenta, loginAsSimulatedUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('inicio');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [unidadActiva, setUnidadActiva] = useState<TipoUnidad>('GUARDIA');
  const [pendingSolicitudIdToOpen, setPendingSolicitudIdToOpen] = useState<string | null>(null);

  // Data states
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for new persona from top action
  const [isNewPersonaModalOpen, setIsNewPersonaModalOpen] = useState(false);

  const fetchAllData = async () => {
    try {
      const [fetchedPersonas, fetchedCuentas, fetchedLogs] = await Promise.all([
        getPersonas(),
        getCuentas(),
        getAuditLogs({ maxResults: 100 }),
      ]);
      setPersonas(fetchedPersonas);
      setCuentas(fetchedCuentas);
      setAuditLogs(fetchedLogs);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const adminInfo = {
    uid: currentCuenta?.uid || 'admin-system',
    nombre: currentCuenta?.nombre || 'Administrador',
  };

  // Filtrar según unidad activa
  const personasFiltradas = personas.filter(
    (p) => (p.tipoUnidad || (p.unidad === 'US_SEGURIDAD' ? 'US' : 'GUARDIA')) === unidadActiva
  );
  const cuentasFiltradas = cuentas.filter(
    (c) => c.rol === 'ADMIN' || (c.tipoUnidad || 'GUARDIA') === unidadActiva
  );

  // Actions
  const handleSavePersona = async (data: any) => {
    await crearPersona(data, adminInfo);
    await fetchAllData();
  };

  const handleUpdatePersona = async (id: string, data: Partial<Persona>) => {
    const updated = await actualizarPersona(id, data, adminInfo);
    if (selectedPersona && selectedPersona.id === id && updated) {
      setSelectedPersona(updated);
    }
    await fetchAllData();
  };

  const handleTogglePersonaActive = async (persona: Persona) => {
    await toggleEstadoPersona(persona.id, !persona.activo, adminInfo);
    if (selectedPersona && selectedPersona.id === persona.id) {
      setSelectedPersona({ ...selectedPersona, activo: !persona.activo });
    }
    await fetchAllData();
  };

  const handleCreateCuenta = async (data: {
    nombre: string;
    email: string;
    rol: RolUsuario;
    personaId: string | null;
  }) => {
    const generatedUid = `user-${Date.now()}`;
    await crearCuenta({ ...data, uid: generatedUid }, adminInfo);
    await fetchAllData();
  };

  const handleToggleCuentaActive = async (cuenta: Cuenta) => {
    await toggleEstadoCuenta(cuenta.uid, !cuenta.activo, adminInfo);
    await fetchAllData();
  };

  const handleCreateCuentaForPersona = async (persona: Persona) => {
    const cleanName = persona.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${cleanName}@grupo.local`;
    const uid = `user-${persona.id.substring(0, 8)}`;
    await crearCuenta(
      {
        uid,
        personaId: persona.id,
        nombre: persona.nombre,
        email,
        rol: 'USUARIO',
        activo: true,
      },
      adminInfo
    );
    await fetchAllData();
  };

  // Modo Administrador: Ver como usuario
  const handleImpersonateUser = async (persona: Persona) => {
    if (!currentCuenta || currentCuenta.rol !== 'ADMIN') {
      alert('Acción restringida: solo los administradores pueden utilizar la función de simulación de usuario.');
      return;
    }

    try {
      // 1. Guardar la sesión original de administrador en el storage para permitir el retorno instantáneo
      localStorage.setItem('admin_impersonator_uid', currentCuenta.uid);
      localStorage.setItem('admin_impersonator_nombre', currentCuenta.nombre);

      // 2. Registrar en auditoría de seguridad el inicio de la simulación
      await registrarAccionAudit(
        'MODO_ADMIN_VER_COMO_USUARIO_INICIO',
        adminInfo,
        {
          tipo: 'ADMINISTRACION',
          id: persona.id,
          nombre: persona.nombre,
        },
        `Admin ${adminInfo.nombre} activó la visualización simulada como el usuario ${persona.nombre} (${persona.empleo} - ${persona.unidad})`
      );

      // 3. Obtener o crear cuenta para esta persona
      let targetCuenta = cuentas.find((c) => c.personaId === persona.id);
      if (!targetCuenta) {
        const uid = `user-${persona.id.substring(0, 8)}`;
        const cleanName = persona.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
        const email = `${cleanName}@grupo.local`;
        await crearCuenta(
          {
            uid,
            personaId: persona.id,
            nombre: persona.nombre,
            email,
            rol: 'USUARIO',
            activo: true,
          },
          adminInfo
        );
        targetCuenta = {
          id: uid,
          uid,
          personaId: persona.id,
          nombre: persona.nombre,
          email,
          rol: 'USUARIO',
          activo: true,
          fechaCreacion: new Date().toISOString(),
        };
      }

      // 4. Cambiar contexto simulado
      await loginAsSimulatedUser(targetCuenta.uid);
    } catch (err) {
      console.error('Error al simular usuario:', err);
      alert('No se pudo activar la vista como usuario.');
    }
  };

  const stats: StatsPersonal = calcularStats(personas, cuentas);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <Header
        onNavigateTab={(tab, referenciaId) => {
          setSelectedPersona(null);
          if (tab === 'cuadrantes') {
            if (referenciaId?.startsWith('cambio-')) {
              setActiveTab('inicio');
              setPendingSolicitudIdToOpen(referenciaId);
            } else {
              setActiveTab('cuadrantes');
            }
          } else if (tab === 'personal') {
            setActiveTab('personal');
          } else if (tab === 'inicio') {
            setActiveTab('inicio');
          } else if (tab === 'chat') {
            setActiveTab('chat');
          } else if (tab === 'solicitud_cambio') {
            setActiveTab('inicio');
            if (referenciaId) {
              setPendingSolicitudIdToOpen(referenciaId);
            }
          }
        }}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for Desktop */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setSelectedPersona(null);
            setActiveTab(tab);
          }}
          personasCount={personasFiltradas.filter((p) => p.activo).length}
        />

        {/* Dynamic Body Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:p-8 md:pb-8">
          <div className="mx-auto max-w-6xl space-y-4">
            {/* SELECTOR DE UNIDAD OPERATIVA (Mando) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${unidadActiva === 'GUARDIA' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Unidad Militar Seleccionada
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {unidadActiva === 'GUARDIA' ? 'UNIDAD DE GUARDIA' : 'U.S. - UNIDAD DE SEGURIDAD'}
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      {unidadActiva === 'GUARDIA' ? '(Guardias 24h)' : '(Turnos 12h)'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  id="btn-switch-guardia"
                  onClick={() => setUnidadActiva('GUARDIA')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    unidadActiva === 'GUARDIA'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Guardia (24h)
                </button>
                <button
                  id="btn-switch-us"
                  onClick={() => setUnidadActiva('US')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    unidadActiva === 'US'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  U.S. Seguridad (12h)
                </button>
              </div>
            </div>

            {selectedPersona ? (
              <PersonaDetailPage
                persona={selectedPersona}
                cuentas={cuentasFiltradas}
                auditLogs={auditLogs}
                onBack={() => setSelectedPersona(null)}
                onUpdatePersona={handleUpdatePersona}
                onTogglePersonaActive={handleTogglePersonaActive}
                onToggleCuentaActive={handleToggleCuentaActive}
                onCreateCuentaForPersona={handleCreateCuentaForPersona}
                onImpersonate={handleImpersonateUser}
              />
            ) : (
              <>
                {activeTab === 'inicio' && (
                  <AdminDashboardPage
                    personas={personasFiltradas}
                    cuentas={cuentasFiltradas}
                    stats={stats}
                    recentLogs={auditLogs}
                    onSelectTab={setActiveTab}
                    onOpenNewPersonaModal={() => setIsNewPersonaModalOpen(false)}
                    adminInfo={adminInfo}
                    onRefreshPersonal={fetchAllData}
                    pendingSolicitudId={pendingSolicitudIdToOpen}
                    onClearPendingSolicitud={() => setPendingSolicitudIdToOpen(null)}
                  />
                )}

                {activeTab === 'cuadrantes' && (
                  <CuadrantesPage
                    personas={personasFiltradas}
                    onRefreshPersonal={fetchAllData}
                  />
                )}

                {activeTab === 'personal' && (
                  <PersonalPage
                    personas={personasFiltradas}
                    cuentas={cuentasFiltradas}
                    onSavePersona={handleSavePersona}
                    onUpdatePersona={handleUpdatePersona}
                    onTogglePersonaActive={handleTogglePersonaActive}
                    onOpenDetail={(p) => setSelectedPersona(p)}
                    onImpersonatePersona={handleImpersonateUser}
                  />
                )}

                {activeTab === 'cuentas' && (
                  <CuentasPage
                    cuentas={cuentasFiltradas}
                    personas={personasFiltradas}
                    onCreateCuenta={handleCreateCuenta}
                    onToggleActive={handleToggleCuentaActive}
                  />
                )}

                {activeTab === 'chat' && (
                  <ChatPage
                    personas={personasFiltradas}
                    currentPersona={null}
                    tipoUnidad={unidadActiva}
                    currentCuentaInfo={{
                      uid: currentCuenta?.uid || 'admin',
                      nombre: currentCuenta?.nombre || 'Administrador',
                      rol: 'ADMIN',
                      personaId: undefined,
                    }}
                  />
                )}

                {activeTab === 'historial' && <HistorialPage logs={auditLogs} />}

                {activeTab === 'excel' && (
                  <ImportarExcelPage
                    personas={personasFiltradas}
                    onImportCompleted={fetchAllData}
                  />
                )}

                {activeTab === 'config' && (
                  <ConfiguracionPage onRefreshAllData={fetchAllData} />
                )}

                {activeTab === 'proximamente' && <ProximamentePage />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setSelectedPersona(null);
          setActiveTab(tab);
        }}
      />

      {/* Global New Persona Modal */}
      <PersonaFormModal
        isOpen={isNewPersonaModalOpen}
        onClose={() => setIsNewPersonaModalOpen(false)}
        onSave={handleSavePersona}
      />
    </div>
  );
};
