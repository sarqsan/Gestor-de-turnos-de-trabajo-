import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './firebase/context';
import { AdminLayout } from './components/layout/AdminLayout';
import { UserPortalPage } from './pages/UserPortalPage';
import { LoginPage } from './pages/LoginPage';
import { ADMIN_1_DATA } from './services/seedService';

const AppContent: React.FC = () => {
  const { currentCuenta, loading, isAdmin, isUsuario, loginAsSimulatedUser } = useAuth();

  // If no session exists in localStorage and not loading, default to Admin 1 demo session
  useEffect(() => {
    const saved = localStorage.getItem('app_active_uid');
    if (!loading && !currentCuenta && !saved) {
      loginAsSimulatedUser(ADMIN_1_DATA.uid);
    }
  }, [loading, currentCuenta, loginAsSimulatedUser]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-3 border-slate-300 border-t-blue-600 dark:border-slate-800 dark:border-t-blue-500" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Cargando Gestión de Personal...
          </p>
        </div>
      </div>
    );
  }

  if (!currentCuenta) {
    return <LoginPage />;
  }

  if (isAdmin) {
    return <AdminLayout />;
  }

  if (isUsuario) {
    return <UserPortalPage />;
  }

  return <LoginPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
