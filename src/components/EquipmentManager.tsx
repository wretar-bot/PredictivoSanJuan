import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Equipment, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandler';
import { createFirestoreBackup, exportEquipmentCSV, importCSV } from '../utils/backup';
import { Plus, Trash2, Edit2, Loader2, Settings2, Thermometer, Waves, Activity, CheckSquare, X, Copy, Download, Upload } from 'lucide-react';

import { getLubricationRecommendation } from '../utils/lubrication';

export function EquipmentManager() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormData = {
    name: '',
    packageUnit: '',
    machineSize: 'medium' as 'small' | 'medium' | 'large',
    foundationType: 'rigid' as 'rigid' | 'flexible',
    techniques: { termografia: true, ultrasonido: true, vibraciones: true, lubricacion: true },
    driveType: 'Bomba',
    customDriveType: '',
    motorPoints: { libre: true, cople: true, cuerpo: true },
    drivePoints: { libre: true, cople: true, cuerpo: true },
    extraPoints: ['', '', '', ''],
    alarms: {
      termografia: { warning: 65, danger: 85 },
      vibraciones: { warning: 4.5, danger: 7.1 },
      ultrasonido: { warning: 35, danger: 45 }
    },
    operatingHours: 0,
    motorShaftDiameter: '',
    motorBearingType: '',
    driveShaftDiameter: '',
    driveBearingType: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'equipment')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Equipment[];
      
      data.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      
      setEquipmentList(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'equipment');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEdit = (eq: Equipment) => {
    setEditingId(eq.id);
    
    const isCustomDrive = !['Bomba', 'Ventilador', 'Compresor', 'Reductor'].includes(eq.driveType);
    
    // Parse points back to checkboxes
    const motorPoints = { libre: false, cople: false, cuerpo: false };
    const drivePoints = { libre: false, cople: false, cuerpo: false };
    const extraPoints = ['', '', '', ''];
    let extraIdx = 0;

    eq.inspectionPoints.forEach(p => {
      if (p === 'Motor - R. Lado Libre') motorPoints.libre = true;
      else if (p === 'Motor - R. Lado Cople') motorPoints.cople = true;
      else if (p === 'Motor - Cuerpo') motorPoints.cuerpo = true;
      else if (p.includes('R. Lado Libre') && !p.startsWith('Motor')) drivePoints.libre = true;
      else if (p.includes('R. Lado Cople') && !p.startsWith('Motor')) drivePoints.cople = true;
      else if (p.includes('Cuerpo') && !p.startsWith('Motor')) drivePoints.cuerpo = true;
      else if (extraIdx < 4) {
        extraPoints[extraIdx] = p;
        extraIdx++;
      }
    });

    setFormData({
      name: eq.name,
      packageUnit: eq.packageUnit || '',
      machineSize: eq.machineSize || 'medium',
      foundationType: eq.foundationType || 'rigid',
      techniques: {
        termografia: eq.techniques?.includes('termografia') || (eq as any).technique === 'termografia',
        ultrasonido: eq.techniques?.includes('ultrasonido') || (eq as any).technique === 'ultrasonido',
        vibraciones: eq.techniques?.includes('vibraciones') || (eq as any).technique === 'vibraciones',
        lubricacion: eq.techniques?.includes('lubricacion') || (eq as any).technique === 'lubricacion'
      },
      driveType: isCustomDrive ? 'Otro' : eq.driveType,
      customDriveType: isCustomDrive ? eq.driveType : '',
      motorPoints,
      drivePoints,
      extraPoints,
      alarms: {
        termografia: eq.alarms?.termografia || initialFormData.alarms.termografia,
        vibraciones: eq.alarms?.vibraciones || initialFormData.alarms.vibraciones,
        ultrasonido: eq.alarms?.ultrasonido || initialFormData.alarms.ultrasonido
      },
      operatingHours: eq.operatingHours || 0,
      motorShaftDiameter: eq.motorShaftDiameter ? eq.motorShaftDiameter.toString() : '',
      motorBearingType: eq.motorBearingType || '',
      driveShaftDiameter: eq.driveShaftDiameter ? eq.driveShaftDiameter.toString() : '',
      driveBearingType: eq.driveBearingType || ''
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(initialFormData);
  };

  const getRecommendedAlarms = (size: 'small' | 'medium' | 'large', foundation: 'rigid' | 'flexible') => {
    if (size === 'small') return { warning: 2.8, danger: 4.5 };
    if (size === 'medium') return { warning: 4.5, danger: 7.1 };
    if (size === 'large' && foundation === 'rigid') return { warning: 7.1, danger: 11.2 };
    return { warning: 11.2, danger: 18.0 }; // large flexible
  };

  const handleSizeChange = (size: 'small' | 'medium' | 'large') => {
    const newAlarms = getRecommendedAlarms(size, formData.foundationType);
    setFormData(prev => ({
      ...prev,
      machineSize: size,
      alarms: { ...prev.alarms, vibraciones: newAlarms }
    }));
  };

  const handleFoundationChange = (foundation: 'rigid' | 'flexible') => {
    const newAlarms = getRecommendedAlarms(formData.machineSize, foundation);
    setFormData(prev => ({
      ...prev,
      foundationType: foundation,
      alarms: { ...prev.alarms, vibraciones: newAlarms }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const actualDriveType = formData.driveType === 'Otro' 
      ? (formData.customDriveType || 'Accionamiento') 
      : formData.driveType;

    const points: string[] = [];
    
    // Motor points
    if (formData.motorPoints.libre) points.push('Motor - R. Lado Libre');
    if (formData.motorPoints.cople) points.push('Motor - R. Lado Cople');
    if (formData.motorPoints.cuerpo) points.push('Motor - Cuerpo');
    
    // Drive points
    if (formData.drivePoints.libre) points.push(`${actualDriveType} - R. Lado Libre`);
    if (formData.drivePoints.cople) points.push(`${actualDriveType} - R. Lado Cople`);
    if (formData.drivePoints.cuerpo) points.push(`${actualDriveType} - Cuerpo`);

    // Extra points
    formData.extraPoints.forEach(p => {
      if (p.trim()) points.push(p.trim());
    });

    if (points.length === 0) {
      alert('Debes seleccionar al menos un punto de inspección.');
      return;
    }

    const selectedTechniques = Object.entries(formData.techniques)
      .filter(([_, isSelected]) => isSelected)
      .map(([tech]) => tech);

    if (selectedTechniques.length === 0) {
      alert('Debes seleccionar al menos una técnica predictiva.');
      return;
    }

    setSaving(true);
    
    const equipmentData: any = {
      name: formData.name,
      packageUnit: formData.packageUnit || '',
      machineSize: formData.machineSize,
      foundationType: formData.foundationType,
      techniques: selectedTechniques,
      driveType: actualDriveType,
      inspectionPoints: points,
      alarms: formData.alarms,
      authorUid: auth.currentUser.uid,
      operatingHours: formData.operatingHours,
    };

    if (formData.motorShaftDiameter) equipmentData.motorShaftDiameter = Number(formData.motorShaftDiameter);
    if (formData.motorBearingType) equipmentData.motorBearingType = formData.motorBearingType;
    if (formData.driveShaftDiameter) equipmentData.driveShaftDiameter = Number(formData.driveShaftDiameter);
    if (formData.driveBearingType) equipmentData.driveBearingType = formData.driveBearingType;

    if (editingId) {
      updateDoc(doc(db, 'equipment', editingId), equipmentData).catch(error => {
        console.error("Error updating equipment:", error);
        alert("Error al actualizar el equipo en la nube. Los cambios se revertirán.");
      });
    } else {
      addDoc(collection(db, 'equipment'), {
        ...equipmentData,
        createdAt: serverTimestamp()
      }).catch(error => {
        console.error("Error adding equipment:", error);
        alert("Error al guardar el equipo en la nube. El registro se revertirá.");
      });
      createFirestoreBackup('auto-equipment').catch(console.error);
    }
    
    setFormData(initialFormData);
    setEditingId(null);
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar este equipo?')) return;
    deleteDoc(doc(db, 'equipment', id)).catch(error => {
      console.error("Error deleting equipment:", error);
      alert("Error al eliminar el equipo. Puede que no tengas permisos o conexión.");
    });
    if (editingId === id) {
      handleCancelEdit();
    }
  };

  const getTechniqueIcon = (technique: string) => {
    switch (technique) {
      case 'termografia': return <Thermometer className="w-4 h-4 text-orange-500" />;
      case 'ultrasonido': return <Waves className="w-4 h-4 text-blue-500" />;
      case 'vibraciones': return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'lubricacion': return <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"><span className="text-[10px] text-white font-bold">L</span></div>;
      default: return null;
    }
  };

  const handleCopyPackageUnit = async (packageUnitName: string) => {
    if (packageUnitName === 'Sin Unidad Paquete') return;
    
    const newPackageUnitName = prompt(`Ingrese el nombre para la nueva Unidad Paquete (copia de ${packageUnitName}):`, `${packageUnitName} (Copia)`);
    if (!newPackageUnitName) return;

    if (!auth.currentUser) return;

    const equipmentToCopy = equipmentList.filter(eq => eq.packageUnit === packageUnitName);
    
    setSaving(true);
    try {
      for (const eq of equipmentToCopy) {
        const { id, createdAt, ...rest } = eq as any;
        await addDoc(collection(db, 'equipment'), {
          ...rest,
          packageUnit: newPackageUnitName,
          createdAt: serverTimestamp()
        });
      }
      alert(`Unidad Paquete "${newPackageUnitName}" creada exitosamente con ${equipmentToCopy.length} equipos.`);
    } catch (error) {
      console.error("Error copying package unit:", error);
      alert("Error al copiar la Unidad Paquete.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    setSaving(true);
    try {
      await exportEquipmentCSV();
    } catch (error) {
      console.error(error);
      alert('Error al exportar los equipos.');
    } finally {
      setSaving(false);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('¿Estás seguro de importar este archivo CSV? Los equipos se añadirán a la base de datos actual.')) {
      e.target.value = '';
      return;
    }

    setSaving(true);
    try {
      await importCSV(file);
      alert('Equipos importados correctamente.');
    } catch (error) {
      console.error(error);
      alert('Error al importar el archivo CSV. Verifica el formato.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Gestión de Equipos</h1>
          <p className="text-sm text-zinc-500 mt-1">Da de alta los equipos, sus técnicas y los puntos a inspeccionar.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              disabled={saving}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-all"
            >
              <Upload className="w-4 h-4" />
              Importar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden sticky top-6">
            <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />} 
                {editingId ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h2>
              {editingId && (
                <button onClick={handleCancelEdit} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Unidad Paquete</label>
                <input
                  required
                  type="text"
                  value={formData.packageUnit}
                  onChange={e => setFormData({ ...formData, packageUnit: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  placeholder="Ej. Unidad Paquete 1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Nombre del Equipo</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  placeholder="Ej. Bomba de Agua 1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Horas de Operación</label>
                <input
                  type="number"
                  min="0"
                  value={formData.operatingHours}
                  onChange={e => setFormData({ ...formData, operatingHours: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                  placeholder="Ej. 1500"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700">Tamaño / Potencia (ISO 10816)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.machineSize === 'small' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}>
                    <input type="radio" name="machineSize" value="small" checked={formData.machineSize === 'small'} onChange={() => handleSizeChange('small')} className="sr-only" />
                    <span className="text-sm font-medium text-zinc-900">Pequeña (&lt; 15 kW)</span>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.machineSize === 'medium' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}>
                    <input type="radio" name="machineSize" value="medium" checked={formData.machineSize === 'medium'} onChange={() => handleSizeChange('medium')} className="sr-only" />
                    <span className="text-sm font-medium text-zinc-900">Mediana (15-75 kW)</span>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.machineSize === 'large' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}>
                    <input type="radio" name="machineSize" value="large" checked={formData.machineSize === 'large'} onChange={() => handleSizeChange('large')} className="sr-only" />
                    <span className="text-sm font-medium text-zinc-900">Grande (&gt; 75 kW)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700">Tipo de Base</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.foundationType === 'rigid' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}>
                    <input type="radio" name="foundationType" value="rigid" checked={formData.foundationType === 'rigid'} onChange={() => handleFoundationChange('rigid')} className="sr-only" />
                    <span className="text-sm font-medium text-zinc-900">Rígida</span>
                  </label>
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.foundationType === 'flexible' ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}>
                    <input type="radio" name="foundationType" value="flexible" checked={formData.foundationType === 'flexible'} onChange={() => handleFoundationChange('flexible')} className="sr-only" />
                    <span className="text-sm font-medium text-zinc-900">Flexible</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-all mt-4"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Edit2 className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />)}
                {editingId ? 'Guardar Cambios' : 'Registrar Equipo'}
              </button>
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-700">Técnicas Predictivas</label>
                <div className="grid grid-cols-1 gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={formData.techniques.termografia} onChange={e => setFormData({...formData, techniques: {...formData.techniques, termografia: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                    Termografía
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={formData.techniques.vibraciones} onChange={e => setFormData({...formData, techniques: {...formData.techniques, vibraciones: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                    Vibraciones
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={formData.techniques.ultrasonido} onChange={e => setFormData({...formData, techniques: {...formData.techniques, ultrasonido: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                    Ultrasonido
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input type="checkbox" checked={formData.techniques.lubricacion} onChange={e => setFormData({...formData, techniques: {...formData.techniques, lubricacion: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                    Lubricación
                  </label>
                </div>
              </div>

              <div className="space-y-4 border-t border-zinc-100 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-zinc-500" />
                  Puntos de Inspección
                </h3>
                
                {/* Motor */}
                <div className="space-y-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Motor</label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.motorPoints.libre} onChange={e => setFormData({...formData, motorPoints: {...formData.motorPoints, libre: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      R. Lado Libre
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.motorPoints.cople} onChange={e => setFormData({...formData, motorPoints: {...formData.motorPoints, cople: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      R. Lado Cople
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.motorPoints.cuerpo} onChange={e => setFormData({...formData, motorPoints: {...formData.motorPoints, cuerpo: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      Cuerpo
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-zinc-200">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Diámetro Flecha (mm)</label>
                      <input type="number" step="any" min="0" value={formData.motorShaftDiameter} onChange={e => setFormData({...formData, motorShaftDiameter: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" placeholder="Ej. 50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Tipo de Rodamiento</label>
                      <input type="text" value={formData.motorBearingType} onChange={e => setFormData({...formData, motorBearingType: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" placeholder="Ej. Bolas" />
                    </div>
                  </div>
                </div>

                {/* Accionamiento */}
                <div className="space-y-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Accionamiento</label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={formData.driveType}
                      onChange={e => setFormData({ ...formData, driveType: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                    >
                      <option value="Bomba">Bomba</option>
                      <option value="Ventilador">Ventilador</option>
                      <option value="Compresor">Compresor</option>
                      <option value="Reductor">Reductor</option>
                      <option value="Otro">Otro...</option>
                    </select>
                    {formData.driveType === 'Otro' && (
                      <input
                        type="text"
                        placeholder="Especificar tipo..."
                        value={formData.customDriveType}
                        onChange={e => setFormData({ ...formData, customDriveType: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.drivePoints.libre} onChange={e => setFormData({...formData, drivePoints: {...formData.drivePoints, libre: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      R. Lado Libre
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.drivePoints.cople} onChange={e => setFormData({...formData, drivePoints: {...formData.drivePoints, cople: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      R. Lado Cople
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                      <input type="checkbox" checked={formData.drivePoints.cuerpo} onChange={e => setFormData({...formData, drivePoints: {...formData.drivePoints, cuerpo: e.target.checked}})} className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                      Cuerpo
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-zinc-200">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Diámetro Flecha (mm)</label>
                      <input type="number" step="any" min="0" value={formData.driveShaftDiameter} onChange={e => setFormData({...formData, driveShaftDiameter: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" placeholder="Ej. 60" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700">Tipo de Rodamiento</label>
                      <input type="text" value={formData.driveBearingType} onChange={e => setFormData({...formData, driveBearingType: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" placeholder="Ej. Rodillos" />
                    </div>
                  </div>
                </div>

                {/* Puntos Extra */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Puntos Extra (Opcionales)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <input
                        key={i}
                        type="text"
                        placeholder={`Punto extra ${i + 1}...`}
                        value={formData.extraPoints[i]}
                        onChange={e => {
                          const newExtras = [...formData.extraPoints];
                          newExtras[i] = e.target.value;
                          setFormData({ ...formData, extraPoints: newExtras });
                        }}
                        className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-zinc-100 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-500" />
                  Configuración de Alarmas
                </h3>
                <p className="text-xs text-zinc-500">
                  Valores por defecto basados en normativas (ej. ISO 10816 para vibraciones, ajustados según el tamaño y tipo de base).
                </p>

                {formData.techniques.termografia && (
                  <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-orange-500" /> Termografía (°C)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Alarma (Warning)</label>
                        <input type="number" step="any" value={formData.alarms.termografia.warning} onChange={e => setFormData({...formData, alarms: {...formData.alarms, termografia: {...formData.alarms.termografia, warning: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Peligro (Danger)</label>
                        <input type="number" step="any" value={formData.alarms.termografia.danger} onChange={e => setFormData({...formData, alarms: {...formData.alarms, termografia: {...formData.alarms.termografia, danger: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                    </div>
                  </div>
                )}

                {formData.techniques.vibraciones && (
                  <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Activity className="w-3 h-3 text-emerald-500" /> Vibraciones (mm/s)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Alarma (Warning)</label>
                        <input type="number" step="any" value={formData.alarms.vibraciones.warning} onChange={e => setFormData({...formData, alarms: {...formData.alarms, vibraciones: {...formData.alarms.vibraciones, warning: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Peligro (Danger)</label>
                        <input type="number" step="any" value={formData.alarms.vibraciones.danger} onChange={e => setFormData({...formData, alarms: {...formData.alarms, vibraciones: {...formData.alarms.vibraciones, danger: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                    </div>
                  </div>
                )}

                {formData.techniques.ultrasonido && (
                  <div className="space-y-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Waves className="w-3 h-3 text-blue-500" /> Ultrasonido (dB)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500">Alarma (Warning)</label>
                        <input type="number" step="any" value={formData.alarms.ultrasonido.warning} onChange={e => setFormData({...formData, alarms: {...formData.alarms, ultrasonido: {...formData.alarms.ultrasonido, warning: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500">Peligro (Danger)</label>
                        <input type="number" step="any" value={formData.alarms.ultrasonido.danger} onChange={e => setFormData({...formData, alarms: {...formData.alarms, ultrasonido: {...formData.alarms.ultrasonido, danger: Number(e.target.value)}}})} className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Lista de Equipos */}
        <div className="lg:col-span-2 space-y-4">
          {equipmentList.length === 0 ? (
            <div className="bg-white border border-zinc-200 border-dashed rounded-2xl p-12 text-center text-zinc-500">
              No hay equipos registrados aún.
            </div>
          ) : (
            Object.entries(
              equipmentList.reduce((acc, eq) => {
                const group = eq.packageUnit || 'Sin Unidad Paquete';
                if (!acc[group]) acc[group] = [];
                acc[group].push(eq);
                return acc;
              }, {} as Record<string, Equipment[]>)
            ).map(([packageUnit, equipments]) => (
              <div key={packageUnit} className="space-y-4">
                <div className="flex items-center justify-between bg-zinc-100 px-4 py-2 rounded-xl">
                  <h2 className="text-md font-semibold text-zinc-800">{packageUnit}</h2>
                  {packageUnit !== 'Sin Unidad Paquete' && (
                    <button
                      onClick={() => handleCopyPackageUnit(packageUnit)}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      title="Copiar Unidad Paquete"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </button>
                  )}
                </div>
                {equipments.map(eq => (
                  <div key={eq.id} className={`bg-white border ${editingId === eq.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-zinc-200'} rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row gap-6 justify-between items-start transition-all`}>
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-zinc-900">{eq.name}</h3>
                        <div className="flex gap-1.5 flex-wrap">
                          {(eq.techniques || ((eq as any).technique ? [(eq as any).technique] : [])).map((tech: string, idx: number) => (
                            <span key={tech || idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-medium capitalize">
                              {getTechniqueIcon(tech)}
                              {tech}
                            </span>
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium capitalize">
                          {eq.driveType}
                        </span>
                        {eq.machineSize && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium capitalize">
                            {eq.machineSize === 'small' ? 'Pequeña (< 15 kW)' : eq.machineSize === 'medium' ? 'Mediana (15-75 kW)' : 'Grande (> 75 kW)'}
                          </span>
                        )}
                        {eq.foundationType && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium capitalize">
                            Base {eq.foundationType === 'rigid' ? 'Rígida' : 'Flexible'}
                          </span>
                        )}
                        {eq.operatingHours !== undefined && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium capitalize">
                            {eq.operatingHours} hrs
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Puntos de Inspección</h4>
                        <div className="flex flex-wrap gap-2">
                          {eq.inspectionPoints.map((point, idx) => (
                            <span key={idx} className="px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-700">
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>

                      {eq.techniques.includes('lubricacion') && (
                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recomendaciones de Lubricación</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {eq.inspectionPoints.some(p => p.startsWith('Motor') && (p.includes('Lado Libre') || p.includes('Lado Cople'))) && (
                              <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                                <h5 className="text-xs font-medium text-amber-800 mb-1">Motor</h5>
                                {(() => {
                                  const rec = getLubricationRecommendation(eq.machineSize || 'medium', eq.motorShaftDiameter, eq.motorBearingType);
                                  return (
                                    <div className="text-xs text-amber-700/80 space-y-0.5">
                                      <p>Cantidad: <span className="font-semibold text-amber-900">{rec.quantity}g</span></p>
                                      <p>Frecuencia: <span className="font-semibold text-amber-900">{rec.frequency} hrs</span></p>
                                      {(eq.motorShaftDiameter || eq.motorBearingType) && (
                                        <p className="text-[10px] mt-1 opacity-75">
                                          Basado en: {eq.motorShaftDiameter ? `Ø${eq.motorShaftDiameter}mm` : ''} {eq.motorBearingType ? `(${eq.motorBearingType})` : ''}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {eq.inspectionPoints.some(p => !p.startsWith('Motor') && (p.includes('Lado Libre') || p.includes('Lado Cople'))) && (
                              <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                                <h5 className="text-xs font-medium text-amber-800 mb-1">Accionamiento</h5>
                                {(() => {
                                  const rec = getLubricationRecommendation(eq.machineSize || 'medium', eq.driveShaftDiameter, eq.driveBearingType);
                                  return (
                                    <div className="text-xs text-amber-700/80 space-y-0.5">
                                      <p>Cantidad: <span className="font-semibold text-amber-900">{rec.quantity}g</span></p>
                                      <p>Frecuencia: <span className="font-semibold text-amber-900">{rec.frequency} hrs</span></p>
                                      {(eq.driveShaftDiameter || eq.driveBearingType) && (
                                        <p className="text-[10px] mt-1 opacity-75">
                                          Basado en: {eq.driveShaftDiameter ? `Ø${eq.driveShaftDiameter}mm` : ''} {eq.driveBearingType ? `(${eq.driveBearingType})` : ''}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEdit(eq)}
                        className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar equipo"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(eq.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
