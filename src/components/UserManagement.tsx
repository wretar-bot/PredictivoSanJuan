import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Shield, UserPlus, Trash2, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthorizedUser {
  email: string;
  role: 'admin' | 'user';
  addedAt: string;
  addedBy: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    if (!auth.currentUser?.email) return;
    
    if (auth.currentUser.email === 'wretar@gmail.com') {
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'authorized_users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(doc => ({
        email: doc.id,
        ...doc.data()
      })) as AuthorizedUser[];
      setUsers(usersData);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError("No tienes permisos para ver los usuarios o hubo un error.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !auth.currentUser?.email) return;

    try {
      const userRef = doc(db, 'authorized_users', newEmail.trim().toLowerCase());
      await setDoc(userRef, {
        role: newRole,
        addedAt: new Date().toISOString(),
        addedBy: auth.currentUser.email
      });
      
      setNewEmail('');
      setNewRole('user');
      fetchUsers();
    } catch (err: any) {
      console.error("Error adding user:", err);
      setError("Error al añadir usuario. Verifica tus permisos.");
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (email === 'wretar@gmail.com') {
      alert("No se puede eliminar al administrador principal.");
      return;
    }
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el acceso a ${email}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'authorized_users', email));
      fetchUsers();
    } catch (err: any) {
      console.error("Error removing user:", err);
      setError("Error al eliminar usuario.");
    }
  };

  if (!isAdmin && auth.currentUser?.email !== 'wretar@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
        <ShieldAlert className="w-16 h-16 text-zinc-300" />
        <h2 className="text-xl font-semibold text-zinc-700">Acceso Denegado</h2>
        <p>Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-zinc-500 mt-1">Administra quién tiene acceso a la aplicación y sus roles.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          Modo Administrador
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 bg-zinc-50/50">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-zinc-500" />
            Añadir Nuevo Usuario
          </h3>
          <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-shadow"
                required
              />
            </div>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
              className="py-2.5 px-4 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
            >
              <option value="user">Usuario (Lectura/Escritura)</option>
              <option value="admin">Administrador (Gestión de Usuarios)</option>
            </select>
            <button
              type="submit"
              className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Añadir Acceso
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Añadido Por</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {/* Main Admin - Always visible */}
              <tr className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                      W
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">wretar@gmail.com</p>
                      <p className="text-xs text-zinc-500">Administrador Principal</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">Sistema</td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs text-zinc-400 italic">No eliminable</span>
                </td>
              </tr>

              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 mx-auto mb-2"></div>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    No hay usuarios adicionales configurados.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.email} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-medium">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium text-zinc-900">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Shield className="w-3.5 h-3.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                          Usuario
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-xs">
                      {user.addedBy}
                      <br />
                      {new Date(user.addedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveUser(user.email)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar acceso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
