import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OperationType, Equipment } from '../types';
import { handleFirestoreError } from '../utils/errorHandler';
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export function RecordForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [recentOMs, setRecentOMs] = useState<string[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    omNumber: '',
    equipmentId: '', // We store ID temporarily to find the equipment
    equipmentName: '',
    measurementPoint: '',
    technique: 'termografia',
    value: '',
    unit: '',
    notes: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch equipment
    const qEq = query(
      collection(db, 'equipment')
    );

    const unsubscribeEq = onSnapshot(qEq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Equipment[];
      setEquipmentList(data);
      setLoadingEquipment(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'equipment');
      setLoadingEquipment(false);
    });

    // Fetch recent OMs
    const qRecords = query(
      collection(db, 'maintenance_records')
    );

    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      const records = snapshot.docs.map(doc => {
        const data = doc.data({ serverTimestamps: 'estimate' });
        return {
          omNumber: data.omNumber,
          equipmentId: data.equipmentId,
          technique: data.technique,
          measurementPoint: data.measurementPoint,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
        };
      });
      
      setAllRecords(records);
      
      // Sort by newest first
      const sortedForOMs = [...records].sort((a, b) => b.createdAt - a.createdAt);
      
      // Extract unique OM numbers
      const uniqueOMs = Array.from(new Set(sortedForOMs.map(r => r.omNumber))).filter(Boolean);
      setRecentOMs(uniqueOMs);
    }, (error) => {
      console.error("Error fetching recent OMs:", error);
    });

    return () => {
      unsubscribeEq();
      unsubscribeRecords();
    };
  }, []);

  const selectedEquipment = equipmentList.find(eq => eq.id === formData.equipmentId);

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eqId = e.target.value;
    const eq = equipmentList.find(item => item.id === eqId);
    
    if (eq) {
      // Handle legacy single technique or new multiple techniques
      const availableTechniques = eq.techniques || ((eq as any).technique ? [(eq as any).technique] : []);
      const defaultTechnique = availableTechniques.length > 0 && availableTechniques[0] ? availableTechniques[0] : 'termografia';
      
      let defaultUnit = '';
      switch (defaultTechnique.toLowerCase()) {
        case 'termografia': defaultUnit = '°C'; break;
        case 'vibraciones': defaultUnit = 'mm/s'; break;
        case 'ultrasonido': defaultUnit = 'dB'; break;
      }

      setFormData(prev => ({
        ...prev,
        equipmentId: eq.id,
        equipmentName: eq.packageUnit ? `${eq.packageUnit} - ${eq.name}` : eq.name,
        technique: defaultTechnique,
        measurementPoint: '', // Reset point when equipment changes
        unit: defaultUnit
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        equipmentId: '',
        equipmentName: '',
        measurementPoint: '',
        technique: 'termografia',
        unit: ''
      }));
    }
  };

  const handleTechniqueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTechnique = e.target.value || 'termografia';
    let newUnit = '';
    switch (newTechnique.toLowerCase()) {
      case 'termografia': newUnit = '°C'; break;
      case 'vibraciones': newUnit = 'mm/s'; break;
      case 'ultrasonido': newUnit = 'dB'; break;
    }
    setFormData(prev => {
      let newMeasurementPoint = prev.measurementPoint;
      if (
        (newTechnique.toLowerCase() === 'vibraciones' || newTechnique.toLowerCase() === 'ultrasonido') &&
        newMeasurementPoint.toLowerCase().includes('cuerpo')
      ) {
        newMeasurementPoint = '';
      }
      return {
        ...prev,
        technique: newTechnique,
        unit: newUnit,
        measurementPoint: newMeasurementPoint
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    if (!formData.equipmentName || !formData.measurementPoint) {
      alert('Por favor selecciona un equipo y un punto de medición.');
      return;
    }

    setLoading(true);
    
    addDoc(collection(db, 'maintenance_records'), {
      omNumber: formData.omNumber,
      equipmentId: formData.equipmentId,
      equipmentName: formData.equipmentName,
      measurementPoint: formData.measurementPoint,
      technique: formData.technique,
      value: Number(formData.value),
      unit: formData.unit,
      notes: formData.notes,
      createdAt: serverTimestamp(),
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    }).then(() => {
      setFormData(prev => ({
        ...prev,
        measurementPoint: '',
        value: '',
        notes: ''
      }));
      
      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      if (onSuccess) onSuccess();
    }).catch(error => {
      console.error("Error adding record:", error);
      alert("Error al guardar el registro en la nube. El registro se revertirá.");
      setLoading(false);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // If technique changes, check if current measurement point is still valid
      if (name === 'technique' && selectedEquipment) {
        const tech = value.toLowerCase();
        if (tech === 'vibraciones' || tech === 'ultrasonido') {
          if (newData.measurementPoint.toLowerCase().includes('cuerpo')) {
            newData.measurementPoint = '';
          }
        }
      }
      
      return newData;
    });
  };

  if (loadingEquipment) {
    return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  }

  const availablePoints = selectedEquipment?.inspectionPoints.filter(point => {
    const tech = formData.technique.toLowerCase();
    
    const alreadyRecorded = allRecords.some(r => 
      r.omNumber === formData.omNumber &&
      r.equipmentId === formData.equipmentId &&
      r.technique === tech &&
      r.measurementPoint === point
    );
    
    if (alreadyRecorded) return false;

    if (tech === 'vibraciones' || tech === 'ultrasonido') {
      return !point.toLowerCase().includes('cuerpo');
    }
    return true;
  }) || [];

  return (
    <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
        <h2 className="text-lg font-semibold text-zinc-900">Nuevo Registro de Mantenimiento</h2>
        <p className="text-sm text-zinc-500 mt-1">Ingresa los datos de la medición predictiva.</p>
      </div>
      
      {equipmentList.length === 0 ? (
        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-medium text-zinc-900">No hay equipos registrados</h3>
            <p className="text-sm text-zinc-500 mt-1">Para crear un registro de mantenimiento, primero debes dar de alta al menos un equipo en la sección "Equipos".</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {showSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-medium">Registro guardado exitosamente. Puedes continuar con el siguiente punto.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Orden de Mantenimiento (OM)</label>
              <input
                required
                type="text"
                name="omNumber"
                list="om-list"
                autoComplete="off"
                value={formData.omNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-mono"
                placeholder="Ej. OM-2026-001"
              />
              <datalist id="om-list">
                {recentOMs.map((om, idx) => (
                  <option key={idx} value={om} />
                ))}
              </datalist>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Equipo</label>
              <select
                required
                value={formData.equipmentId}
                onChange={handleEquipmentChange}
                className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all cursor-pointer"
              >
                <option value="" disabled>Selecciona un equipo...</option>
                {equipmentList.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.packageUnit ? `${eq.packageUnit} - ${eq.name}` : eq.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Punto de Medición</label>
              {selectedEquipment && availablePoints.length === 0 ? (
                <div className="w-full px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Todos los puntos registrados para esta técnica.
                </div>
              ) : (
                <select
                  required
                  name="measurementPoint"
                  value={formData.measurementPoint}
                  onChange={handleChange}
                  disabled={!selectedEquipment}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>Selecciona un punto...</option>
                  {availablePoints.map((point, idx) => (
                    <option key={idx} value={point}>{point}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Técnica Predictiva</label>
              {selectedEquipment && (selectedEquipment.techniques?.length > 1) ? (
                <select
                  required
                  name="technique"
                  value={formData.technique}
                  onChange={handleTechniqueChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all cursor-pointer capitalize"
                >
                  {selectedEquipment.techniques.map(tech => (
                    <option key={tech} value={tech}>{tech}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={formData.technique}
                  className="w-full px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-500 capitalize cursor-not-allowed"
                />
              )}
              <p className="text-xs text-zinc-400">Selecciona la técnica de medición.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Valor</label>
                <input
                  required
                  type="number"
                  step="any"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all font-mono"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Unidad</label>
                <input
                  required
                  disabled
                  type="text"
                  name="unit"
                  value={formData.unit}
                  className="w-full px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-500 cursor-not-allowed transition-all"
                  placeholder="Se asigna automáticamente"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Notas Adicionales (Opcional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all resize-none"
                placeholder="Observaciones sobre la medición..."
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !selectedEquipment || availablePoints.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Registro
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
