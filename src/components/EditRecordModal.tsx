import React, { useState, useEffect } from 'react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MaintenanceRecord } from '../types';
import { Save, Loader2, X } from 'lucide-react';

interface EditRecordModalProps {
  record: MaintenanceRecord;
  onClose: () => void;
}

export function EditRecordModal({ record, onClose }: EditRecordModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: record.createdAt?.toDate ? record.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    omNumber: record.omNumber || '',
    value: record.value?.toString() || '',
    notes: record.notes || '',
    greaseType: record.greaseType || '',
    operatingHours: record.operatingHours?.toString() || '',
    lubricationPerformed: record.lubricationPerformed !== false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const updateData: any = {
      omNumber: formData.omNumber,
      value: record.technique === 'lubricacion' && !formData.lubricationPerformed ? 0 : Number(formData.value),
      notes: formData.notes,
      createdAt: formData.date ? Timestamp.fromDate(new Date(`${formData.date}T12:00:00`)) : record.createdAt,
    };

    if (record.technique === 'lubricacion') {
      updateData.lubricationPerformed = formData.lubricationPerformed;
      updateData.greaseType = formData.lubricationPerformed ? formData.greaseType : '';
      updateData.operatingHours = Number(formData.operatingHours);
    }

    try {
      await updateDoc(doc(db, 'maintenance_records', record.id), updateData);
      onClose();
    } catch (error) {
      console.error("Error updating record:", error);
      alert("Error al actualizar el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <h3 className="text-lg font-semibold text-zinc-900">Editar Registro</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 space-y-1">
            <p className="text-sm text-zinc-500">Equipo: <span className="font-medium text-zinc-900">{record.equipmentName}</span></p>
            <p className="text-sm text-zinc-500">Punto: <span className="font-medium text-zinc-900">{record.measurementPoint}</span></p>
            <p className="text-sm text-zinc-500">Técnica: <span className="font-medium text-zinc-900 capitalize">{record.technique}</span></p>
          </div>

          <form id="edit-record-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Fecha</label>
                <input
                  required
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">OM</label>
                <input
                  required
                  type="text"
                  name="omNumber"
                  value={formData.omNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {record.technique === 'lubricacion' && (
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="lubricationPerformed"
                    checked={formData.lubricationPerformed}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-amber-900">Lubricación realizada</span>
                </label>
              </div>
            )}

            {record.technique !== 'lubricacion' || formData.lubricationPerformed ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Valor</label>
                  <input
                    required
                    type="number"
                    step="any"
                    name="value"
                    value={formData.value}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Unidad</label>
                  <input
                    disabled
                    type="text"
                    value={record.unit}
                    className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-500 cursor-not-allowed"
                  />
                </div>
              </div>
            ) : null}

            {record.technique === 'lubricacion' && (
              <div className="grid grid-cols-2 gap-4">
                {formData.lubricationPerformed && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Tipo de Grasa</label>
                    <input
                      required
                      type="text"
                      name="greaseType"
                      value={formData.greaseType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
                <div className={`space-y-2 ${!formData.lubricationPerformed ? 'col-span-2' : ''}`}>
                  <label className="text-sm font-medium text-zinc-700">Horas de Operación</label>
                  <input
                    required
                    type="number"
                    min="0"
                    name="operatingHours"
                    value={formData.operatingHours}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Notas Adicionales</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-xl text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-record-form"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
