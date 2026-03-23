import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { RecordForm } from './components/RecordForm';
import { EquipmentManager } from './components/EquipmentManager';
import { AIAssistant } from './components/AIAssistant';
import { Reports } from './components/Reports';
import { DatabaseManager } from './components/DatabaseManager';
import { UserManagement } from './components/UserManagement';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkAndCreateMonthlyBackup } from './utils/backup';
import { Activity, PlusCircle, LayoutDashboard, Bot, LogOut, Menu, X, Settings2, FileText, Database, WifiOff, Wifi, Users, Pin, PinOff } from 'lucide-react';
import { EsentiaLogo } from './components/EsentiaLogo';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'equipment' | 'reports' | 'ai' | 'database' | 'users'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [siteName, setSiteName] = useState('');
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const isExpanded = isSidebarPinned || isSidebarHovered;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        setSiteName(snap.data().siteName || '');
      }
    }).catch(console.error);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check authorization and admin status
        if (currentUser.email === 'wretar@gmail.com') {
          setIsAuthorized(true);
          setIsAdmin(true);
          setUser(currentUser);
          checkAndCreateMonthlyBackup();
        } else {
          try {
            const usersRef = collection(db, 'authorized_users');
            const snapshot = await getDocs(usersRef);
            const currentUserDoc = snapshot.docs.find(d => d.id === currentUser.email);
            
            if (currentUserDoc) {
              setIsAuthorized(true);
              setUser(currentUser);
              checkAndCreateMonthlyBackup();
              
              if (currentUserDoc.data().role === 'admin') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            } else {
              // Not authorized
              setIsAuthorized(false);
              setUser(null);
              setIsAdmin(false);
              await logOut();
            }
          } catch (err) {
            console.error("Error checking authorization status:", err);
            setIsAuthorized(false);
            setUser(null);
            setIsAdmin(false);
            await logOut();
          }
        }
      } else {
        setUser(null);
        setIsAuthorized(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-zinc-100 text-center space-y-8">
          <div className="mx-auto w-48 h-24 flex items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-zinc-900/20">
            <EsentiaLogo />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Predictive Maintenance Hub</h1>
            <p className="mt-2 text-sm text-zinc-500">Inicia sesión para gestionar tus registros de termografía, ultrasonido y vibraciones.</p>
          </div>
          
          {isAuthorized === false && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200 text-left">
              <p className="font-semibold mb-1">Acceso Denegado</p>
              <p>Tu cuenta no está autorizada para acceder a esta aplicación. Contacta al administrador (wretar@gmail.com) para solicitar acceso.</p>
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 py-3 px-4 rounded-xl font-medium transition-all shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  const NavItems = ({ isExpanded = true }: { isExpanded?: boolean }) => (
    <>
      <button
        onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'dashboard' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Dashboard" : undefined}
      >
        <LayoutDashboard className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Dashboard</span>}
      </button>
      <button
        onClick={() => { setActiveTab('add'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'add' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Nuevo Registro" : undefined}
      >
        <PlusCircle className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Nuevo Registro</span>}
      </button>
      <button
        onClick={() => { setActiveTab('equipment'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'equipment' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Equipos" : undefined}
      >
        <Settings2 className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Equipos</span>}
      </button>
      <button
        onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'reports' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Reportes" : undefined}
      >
        <FileText className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Reportes</span>}
      </button>
      <button
        onClick={() => { setActiveTab('ai'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'ai' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Asistente IA" : undefined}
      >
        <Bot className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Asistente IA</span>}
      </button>
      <button
        onClick={() => { setActiveTab('database'); setIsMobileMenuOpen(false); }}
        className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'database' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        title={!isExpanded ? "Base de Datos" : undefined}
      >
        <Database className="w-5 h-5 shrink-0" />
        {isExpanded && <span className="truncate">Base de Datos</span>}
      </button>
      {isAdmin && (
        <button
          onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
          className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-colors w-full ${activeTab === 'users' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
          title={!isExpanded ? "Usuarios" : undefined}
        >
          <Users className="w-5 h-5 shrink-0" />
          {isExpanded && <span className="truncate">Usuarios</span>}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="w-24 h-8 flex items-center justify-center rounded-md overflow-hidden">
              <EsentiaLogo />
            </div>
            {siteName && <span className="text-xs text-zinc-500 font-medium mt-1">{siteName}</span>}
          </div>
          <div className="ml-2 flex items-center" title={isOnline ? "Conectado" : "Sin conexión"}>
            {isOnline ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-zinc-600">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 z-10 bg-white pt-20 px-4 pb-4 flex flex-col"
          >
            <nav className="space-y-2 flex-1">
              <NavItems />
            </nav>
            <div className="border-t border-zinc-100 pt-4 mt-auto">
              <div className="flex items-center gap-3 px-4 py-3 mb-2">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logOut}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-zinc-200 h-screen sticky top-0 transition-all duration-300 z-30 ${isExpanded ? 'w-64' : 'w-20'}`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className={`p-6 flex items-center ${isExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
          {isExpanded ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="w-32 h-12 flex items-center justify-center rounded-lg overflow-hidden shadow-sm">
                    <EsentiaLogo />
                  </div>
                  {siteName && <span className="text-xs text-zinc-500 font-medium mt-1">{siteName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div title={isOnline ? "Conectado" : "Sin conexión"}>
                  {isOnline ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                </div>
                <button 
                  onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  title={isSidebarPinned ? "Desfijar menú" : "Fijar menú"}
                >
                  {isSidebarPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 flex items-center justify-center rounded-lg overflow-hidden shadow-sm bg-zinc-900 text-white font-bold text-xl">
                E
              </div>
              <div title={isOnline ? "Conectado" : "Sin conexión"}>
                {isOnline ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              </div>
            </>
          )}
        </div>
        
        <nav className={`flex-1 ${isExpanded ? 'px-4' : 'px-3'} space-y-1.5 mt-4`}>
          <NavItems isExpanded={isExpanded} />
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className={`flex items-center ${isExpanded ? 'gap-3 px-2' : 'justify-center'} py-2 mb-2`}>
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Avatar" className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm" referrerPolicy="no-referrer" />
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{user.displayName}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={logOut}
            className={`flex items-center justify-center gap-2 w-full ${isExpanded ? 'px-4' : 'px-0'} py-2 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors`}
            title={!isExpanded ? "Cerrar Sesión" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isExpanded && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 md:p-10 lg:p-12 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col">
        {!isOnline && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start sm:items-center gap-3 shadow-sm">
            <div className="bg-amber-100 p-2 rounded-lg shrink-0">
              <WifiOff className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Estás trabajando sin conexión</h3>
              <p className="text-sm text-amber-700 mt-0.5">
                Los registros y equipos que crees se guardarán localmente en tu dispositivo y se sincronizarán automáticamente con la nube cuando recuperes la conexión a internet.
              </p>
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full flex-1"
          >
            {activeTab === 'dashboard' && <Dashboard isAdmin={isAdmin} />}
            {activeTab === 'add' && <RecordForm />}
            {activeTab === 'equipment' && <EquipmentManager />}
            {activeTab === 'reports' && <Reports isAdmin={isAdmin} />}
            {activeTab === 'ai' && <AIAssistant />}
            {activeTab === 'database' && <DatabaseManager />}
            {activeTab === 'users' && isAdmin && <UserManagement />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
