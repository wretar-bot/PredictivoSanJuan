import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { createFirestoreBackup, clearDatabase, restoreBackup, generateBackupData } from '../utils/backup';
import { Save, Download, Upload, Trash2, Database, AlertTriangle, Loader2 } from 'lucide-react';

export function DatabaseManager() {
  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [backups, setBackups] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Load settings
    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        const data = snap.data({ serverTimestamps: 'estimate' });
        setCompanyName(data.companyName || '');
        setSiteName(data.siteName || '');
      }
      setLoadingSettings(false);
    });

    // Load backups
    const q = query(
      collection(db, 'backups'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setBackups(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
    });

    // Check admin status
    const checkAdmin = async () => {
      if (auth.currentUser?.email === 'wretar@gmail.com') {
        setIsAdmin(true);
        return;
      }
      try {
        const usersRef = collection(db, 'authorized_users');
        const snapshot = await getDocs(usersRef);
        const currentUserDoc = snapshot.docs.find(d => d.id === auth.currentUser?.email);
        if (currentUserDoc && currentUserDoc.data().role === 'admin') {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
      }
    };
    checkAdmin();

    return () => unsub();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSavingSettings(true);
    
    setDoc(doc(db, 'settings', 'global'), {
      companyName,
      siteName,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(error => {
      console.error(error);
      alert('Error al guardar los datos en la nube.');
    });
    
    // Update UI immediately for offline support
    setTimeout(() => {
      setSavingSettings(false);
      alert('Datos guardados localmente. Se sincronizarán cuando haya conexión.');
    }, 500);
  };

  const handleExportLocal = async () => {
    setProcessing(true);
    try {
      const data = await generateBackupData();
      if (!data) return;
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar.');
    } finally {
      setProcessing(false);
    }
  };

  const handleImportLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('¿Estás seguro de importar este respaldo? Esto reemplazará todos los datos actuales.')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setProcessing(true);
    try {
      const text = await file.text();
      await restoreBackup(text);
      alert('Respaldo importado correctamente.');
    } catch (error) {
      console.error(error);
      alert('Error al importar el respaldo. Verifica que el archivo sea válido.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateCloudBackup = async () => {
    setProcessing(true);
    try {
      await createFirestoreBackup('manual');
      alert('Respaldo en la nube creado.');
    } catch (e) {
      console.error(e);
      alert('Error al crear respaldo.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('¡ADVERTENCIA! ¿Estás completamente seguro de borrar toda la base de datos? Esta acción no se puede deshacer.')) return;
    if (!window.confirm('Por favor, confirma nuevamente. Se borrarán todos los equipos y registros.')) return;
    
    setProcessing(true);
    try {
      await clearDatabase();
      alert('Base de datos borrada correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al borrar la base de datos.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm('¿Eliminar este respaldo de la nube?')) return;
    try {
      await deleteDoc(doc(db, 'backups', id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadCloudBackup = (dataStr: string, date: any) => {
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = date?.toDate ? date.toDate().toISOString().split('T')[0] : 'backup';
    a.download = `respaldo_nube_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Administración de Base de Datos</h1>
        <p className="text-sm text-zinc-500 mt-1">Configura los datos de la empresa y gestiona los respaldos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Datos de la Empresa */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Datos de la Empresa</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
            {loadingSettings ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Nombre de la Empresa</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    disabled={savingSettings || !isAdmin}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all disabled:opacity-50"
                    placeholder="Ej. Industrias ABC"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Nombre del Sitio / Planta</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    disabled={savingSettings || !isAdmin}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all disabled:opacity-50"
                    placeholder="Ej. Planta Norte"
                  />
                </div>
                {isAdmin && (
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-all"
                  >
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Datos
                  </button>
                )}
              </>
            )}
          </form>
        </div>

        {/* Gestión de Respaldos */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Respaldos Locales</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-600">Exporta tu base de datos a un archivo JSON o restaura un respaldo previo.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportLocal}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 disabled:opacity-50 transition-all"
              >
                <Download className="w-4 h-4" />
                Exportar JSON
              </button>
              
              {isAdmin && (
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportLocal}
                    ref={fileInputRef}
                    disabled={processing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    Importar JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Respaldos en la Nube */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-zinc-900">Respaldos en la Nube</h2>
            <button
              onClick={handleCreateCloudBackup}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              <Database className="w-4 h-4" />
              Crear Respaldo
            </button>
          </div>
          <div className="p-0">
            {backups.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">No hay respaldos en la nube.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {backups.map(b => (
                  <li key={b.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        Respaldo {b.type === 'manual' ? 'Manual' : b.type === 'auto-equipment' ? 'Automático (Nuevo Equipo)' : 'Automático (Mensual)'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString() : 'Pendiente...'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadCloudBackup(b.data, b.createdAt)}
                        className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Descargar JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteBackup(b.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar respaldo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Zona de Peligro */}
        {isAdmin && (
          <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-6 py-5 border-b border-red-200 bg-red-100/50 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">Zona de Peligro</h2>
            </div>
            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-red-900">Borrar Base de Datos</h3>
                <p className="text-sm text-red-700 mt-1">Esta acción eliminará permanentemente todos los equipos y registros. Los respaldos en la nube no se borrarán.</p>
              </div>
              <button
                onClick={handleClearDatabase}
                disabled={processing}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Borrar Todo
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
