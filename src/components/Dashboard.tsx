import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MaintenanceRecord, Equipment, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandler';
import { format } from 'date-fns';
import { Search, Filter, Trash2, Activity, Thermometer, Waves, ChevronDown, ChevronUp, Bot, Loader2, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generateRuleBasedAnalysis } from '../utils/analysisGenerator';
import { getLubricationRecommendation } from '../utils/lubrication';

export function Dashboard() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipments, setEquipments] = useState<Record<string, Equipment>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTechnique, setFilterTechnique] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedAnalysis, setExpandedAnalysis] = useState<Record<string, boolean>>({});
  const [visibleCharts, setVisibleCharts] = useState<Record<string, boolean>>({});
  const [groupBy, setGroupBy] = useState<'equipment' | 'om'>('equipment');
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        setSiteName(snap.data().siteName || '');
      }
    }).catch(console.error);

    const qRecords = query(
      collection(db, 'maintenance_records')
    );

    const qEquipments = query(
      collection(db, 'equipment')
    );

    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as MaintenanceRecord[];
      
      data.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      
      setRecords(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_records');
      setLoading(false);
    });

    const unsubEquipments = onSnapshot(qEquipments, (snapshot) => {
      const eqMap: Record<string, Equipment> = {};
      snapshot.docs.forEach(doc => {
        eqMap[doc.id] = { id: doc.id, ...doc.data() } as Equipment;
      });
      setEquipments(eqMap);
    });

    return () => {
      unsubRecords();
      unsubEquipments();
    };
  }, []);

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
    deleteDoc(doc(db, 'maintenance_records', id)).catch(error => {
      console.error("Error deleting record:", error);
      alert("Error al eliminar el registro. Puede que no tengas permisos o conexión.");
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAnalysis = (key: string) => {
    setExpandedAnalysis(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  const handleDownloadCSV = (groupName: string, groupRecords: MaintenanceRecord[]) => {
    if (!groupRecords || groupRecords.length === 0) return;

    const rows = groupRecords.map(record => ({
      Equipo: record.equipmentName || 'Desconocido',
      Técnica: record.technique,
      Punto: record.measurementPoint,
      OM: record.omNumber,
      Fecha: record.createdAt?.toDate ? format(record.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '',
      Valor: record.value,
      Unidad: record.unit,
      Notas: record.notes || ''
    }));

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(header => `"${(row as any)[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registros_${groupName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      (record.omNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.equipmentName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTechnique = filterTechnique === 'all' || record.technique === filterTechnique;
    return matchesSearch && matchesTechnique;
  });

  // Group by Equipment Name or OM -> Technique -> Measurement Point
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const groupKey = groupBy === 'equipment' 
      ? (record.equipmentName || 'Equipo Desconocido') 
      : (record.omNumber || 'OM Desconocida');
    const tech = record.technique || 'Desconocida';
    
    if (!acc[groupKey]) acc[groupKey] = {};
    if (!acc[groupKey][tech]) acc[groupKey][tech] = { points: {} };
    if (!acc[groupKey][tech].points[record.measurementPoint]) acc[groupKey][tech].points[record.measurementPoint] = [];
    
    acc[groupKey][tech].points[record.measurementPoint].push(record);
    return acc;
  }, {} as Record<string, Record<string, { points: Record<string, MaintenanceRecord[]> }>>);

  const getTechniqueIcon = (technique: string) => {
    if (!technique) return null;
    switch (technique.toLowerCase()) {
      case 'termografia': return <Thermometer className="w-4 h-4 text-orange-500" />;
      case 'ultrasonido': return <Waves className="w-4 h-4 text-blue-500" />;
      case 'vibraciones': return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'lubricacion': return <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"><span className="text-[10px] text-white font-bold">L</span></div>;
      default: return null;
    }
  };

  const getAlarmStatus = (record: MaintenanceRecord) => {
    if (!record.equipmentId) return 'normal';
    const eq = equipments[record.equipmentId];
    if (!eq || !eq.alarms) return 'normal';

    const techAlarms = eq.alarms[record.technique];
    if (!techAlarms) return 'normal';

    if (record.value >= techAlarms.danger) return 'danger';
    if (record.value >= techAlarms.warning) return 'warning';
    return 'normal';
  };

  const equipmentStatusCounts = { danger: 0, warning: 0, normal: 0 };
  const totalEquipments = Object.keys(equipments).length;
  
  Object.values(equipments).forEach(eq => {
    const eqRecords = records.filter(r => r.equipmentId === eq.id);
    if (eqRecords.length === 0) {
      equipmentStatusCounts.normal++;
      return;
    }

    const latestRecords: Record<string, MaintenanceRecord> = {};
    eqRecords.forEach(r => {
      const key = `${r.technique}-${r.measurementPoint}`;
      const rTime = r.createdAt?.toMillis ? r.createdAt.toMillis() : 0;
      const lTime = latestRecords[key]?.createdAt?.toMillis ? latestRecords[key].createdAt.toMillis() : 0;
      if (!latestRecords[key] || rTime > lTime) {
        latestRecords[key] = r;
      }
    });

    let status = 'normal';
    for (const r of Object.values(latestRecords)) {
      const s = getAlarmStatus(r);
      if (s === 'danger') {
        status = 'danger';
        break;
      }
      if (s === 'warning') {
        status = 'warning';
      }
    }
    equipmentStatusCounts[status as keyof typeof equipmentStatusCounts]++;
  });

  const lubricationAlerts: { equipment: Equipment, point: string, type: 'motor' | 'drive', currentHours: number, lastHours: number, recommended: number }[] = [];
  
  Object.values(equipments).forEach(eq => {
    if (!eq.operatingHours) return;

    const eqRecords = records.filter(r => r.equipmentId === eq.id && r.technique === 'lubricacion' && r.lubricationPerformed !== false);
    
    // Check Motor
    if (eq.inspectionPoints.some(p => p.startsWith('Motor') && (p.includes('Lado Libre') || p.includes('Lado Cople')))) {
      const rec = getLubricationRecommendation(eq.machineSize || 'medium', eq.motorShaftDiameter, eq.motorBearingType);
      const motorRecords = eqRecords.filter(r => r.measurementPoint.startsWith('Motor') && (r.measurementPoint.includes('Lado Libre') || r.measurementPoint.includes('Lado Cople')));
      
      let lastHours = 0;
      if (motorRecords.length > 0) {
        // Find the record with highest operatingHours
        lastHours = Math.max(...motorRecords.map(r => r.operatingHours || 0));
      }

      if (eq.operatingHours - lastHours >= rec.frequency) {
        lubricationAlerts.push({
          equipment: eq,
          point: 'Motor',
          type: 'motor',
          currentHours: eq.operatingHours,
          lastHours,
          recommended: rec.frequency
        });
      }
    }

    // Check Drive
    if (eq.inspectionPoints.some(p => !p.startsWith('Motor') && (p.includes('Lado Libre') || p.includes('Lado Cople')))) {
      const rec = getLubricationRecommendation(eq.machineSize || 'medium', eq.driveShaftDiameter, eq.driveBearingType);
      const driveRecords = eqRecords.filter(r => !r.measurementPoint.startsWith('Motor') && (r.measurementPoint.includes('Lado Libre') || r.measurementPoint.includes('Lado Cople')));
      
      let lastHours = 0;
      if (driveRecords.length > 0) {
        lastHours = Math.max(...driveRecords.map(r => r.operatingHours || 0));
      }

      if (eq.operatingHours - lastHours >= rec.frequency) {
        lubricationAlerts.push({
          equipment: eq,
          point: 'Accionamiento',
          type: 'drive',
          currentHours: eq.operatingHours,
          lastHours,
          recommended: rec.frequency
        });
      }
    }
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Historial de Mediciones</h1>
          {siteName && <p className="text-sm text-zinc-500 mt-1">{siteName}</p>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-wrap">
          <button
            onClick={collapseAll}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors whitespace-nowrap"
          >
            Retraer todos
          </button>

          <div className="relative">
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as 'equipment' | 'om');
                setExpandedGroups({});
              }}
              className="pl-4 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 appearance-none w-full sm:w-auto cursor-pointer"
            >
              <option value="equipment">Agrupar por Equipo</option>
              <option value="om">Agrupar por OM</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por OM o Equipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 w-full sm:w-64 transition-all"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select
              value={filterTechnique}
              onChange={(e) => setFilterTechnique(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 appearance-none w-full sm:w-auto cursor-pointer"
            >
              <option value="all">Todas las técnicas</option>
              <option value="termografia">Termografía</option>
              <option value="ultrasonido">Ultrasonido</option>
              <option value="vibraciones">Vibraciones</option>
              <option value="lubricacion">Lubricación</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen de Equipos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-zinc-500">Total Equipos</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{totalEquipments}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-emerald-700">Normal</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{equipmentStatusCounts.normal}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 shadow-sm flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-yellow-700">Advertencia</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{equipmentStatusCounts.warning}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-red-700">Peligro</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{equipmentStatusCounts.danger}</p>
        </div>
      </div>

      {/* Alertas de Lubricación */}
      {lubricationAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">L</span>
            </div>
            <h2 className="text-lg font-semibold text-amber-900">Equipos que requieren lubricación</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lubricationAlerts.map((alert, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-zinc-900">{alert.equipment.name}</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                    {alert.point}
                  </span>
                </div>
                <div className="text-sm text-zinc-600 space-y-1">
                  <p>Horas actuales: <span className="font-mono font-medium">{alert.currentHours}</span></p>
                  <p>Última lubricación: <span className="font-mono font-medium">{alert.lastHours}</span></p>
                  <p>Frecuencia recomendada: <span className="font-mono font-medium">{alert.recommended}</span></p>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-50 text-xs font-medium text-amber-700">
                  Excedido por: {alert.currentHours - alert.lastHours - alert.recommended} horas
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(groupedRecords).length === 0 ? (
        <div className="bg-white border border-zinc-200 border-dashed rounded-2xl p-12 text-center text-zinc-500">
          No se encontraron registros.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedRecords).map(([groupName, techs]) => {
            const eq = Object.values(equipments).find(e => e.name === groupName);
            const equipmentRecords = Object.values(techs).flatMap(t => Object.values(t.points).flat());

            return (
              <div key={groupName} className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                  <h2 className="text-xl font-bold text-zinc-900">{groupName}</h2>
                  <div className="flex gap-2">
                    {equipmentRecords.length > 0 && (
                      <button
                        onClick={() => handleDownloadCSV(groupName, equipmentRecords)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors text-sm font-medium"
                        title="Exportar CSV"
                      >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                      </button>
                    )}
                    {groupBy === 'equipment' && eq && equipmentRecords.length > 0 && (
                      <button
                        onClick={() => toggleAnalysis(eq.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-sm font-medium"
                      >
                        <Activity className="w-4 h-4" />
                        {expandedAnalysis[eq.id] ? 'Ocultar Análisis' : 'Ver Análisis'}
                        {expandedAnalysis[eq.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-zinc-100">
                  {Object.entries(techs).map(([tech, data]) => {
                    const key = `${groupName}-${tech}`;
                    const isExpanded = expandedGroups[key] ?? false;
                    
                    return (
                      <div key={key} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                        <button 
                          onClick={() => toggleGroup(key)}
                          className="w-full px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center hover:bg-zinc-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-zinc-200 text-zinc-700 text-sm font-medium capitalize shadow-sm">
                              {getTechniqueIcon(tech)}
                              {tech}
                            </span>
                          </div>
                          <div className="text-zinc-400">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </button>
                
                {isExpanded && (
                  <div className="p-6 space-y-10">
                    {Object.entries(data.points).map(([pointName, pointRecords]) => {
                      // Prepare data for chart (reverse to show chronological order left-to-right)
                      const chartData = [...pointRecords]
                        .filter((r: any) => tech !== 'lubricacion' || r.lubricationPerformed !== false)
                        .reverse()
                        .map(r => ({
                          date: r.createdAt?.toDate ? format(r.createdAt.toDate(), 'dd/MM/yy') : '',
                          operatingHours: r.operatingHours || 0,
                          value: r.value,
                          unit: r.unit
                        }));

                      return (
                        <div key={pointName} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-medium text-zinc-800 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              {pointName}
                            </h3>
                            {chartData.length > 1 && (
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-700 transition-colors">Tendencia</span>
                                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${visibleCharts[`${key}-${pointName}`] ? 'bg-indigo-500' : 'bg-zinc-200'}`}>
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${visibleCharts[`${key}-${pointName}`] ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </div>
                                <input 
                                  type="checkbox" 
                                  className="sr-only"
                                  checked={!!visibleCharts[`${key}-${pointName}`]}
                                  onChange={() => {
                                    const chartKey = `${key}-${pointName}`;
                                    setVisibleCharts(prev => ({ ...prev, [chartKey]: !prev[chartKey] }));
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          
                          {/* Chart Section */}
                          {chartData.length > 1 && visibleCharts[`${key}-${pointName}`] && (
                            <div className="h-48 w-full bg-zinc-50/50 border border-zinc-100 rounded-xl p-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                                  <XAxis dataKey={tech === 'lubricacion' ? 'operatingHours' : 'date'} fontSize={12} tickLine={false} axisLine={false} stroke="#a1a1aa" dy={10} />
                                  <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#a1a1aa" width={40} />
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#18181b', fontWeight: 500 }}
                                    formatter={(value: number, name: string, props: any) => [`${value} ${props.payload.unit}`, 'Valor']}
                                    labelFormatter={(label) => tech === 'lubricacion' ? `${label} horas` : label}
                                    labelStyle={{ color: '#71717a', marginBottom: '4px' }}
                                  />
                                  {(() => {
                                    const eqId = pointRecords[0]?.equipmentId;
                                    const eq = eqId ? equipments[eqId] : null;
                                    const techAlarms = eq?.alarms?.[tech as 'termografia' | 'vibraciones' | 'ultrasonido' | 'lubricacion'];
                                    
                                    if (!techAlarms) return null;
                                    
                                    return (
                                      <>
                                        <ReferenceLine y={techAlarms.warning} stroke="#f97316" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Alarma', fill: '#f97316', fontSize: 10 }} />
                                        <ReferenceLine y={techAlarms.danger} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Peligro', fill: '#ef4444', fontSize: 10 }} />
                                      </>
                                    );
                                  })()}
                                  <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#4f46e5" 
                                    strokeWidth={2} 
                                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} 
                                    activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }} 
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Table Section */}
                          <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                                <tr>
                                  <th className="px-4 py-3">Fecha</th>
                                  <th className="px-4 py-3">OM</th>
                                  <th className="px-4 py-3">Valor</th>
                                  {tech === 'lubricacion' && (
                                    <>
                                      <th className="px-4 py-3">Realizado</th>
                                      <th className="px-4 py-3">Tipo de Grasa</th>
                                      <th className="px-4 py-3">Horas Op.</th>
                                    </>
                                  )}
                                  <th className="px-4 py-3">Notas</th>
                                  <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {pointRecords.map(record => {
                                  const status = getAlarmStatus(record);
                                  return (
                                    <tr key={record.id} className="hover:bg-zinc-50/50 transition-colors group">
                                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                                        {record.createdAt?.toDate ? format(record.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '...'}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-zinc-900">{record.omNumber}</td>
                                      <td className="px-4 py-3 font-mono font-medium">
                                        {tech === 'lubricacion' && record.lubricationPerformed === false ? (
                                          <span className="text-zinc-400">-</span>
                                        ) : (
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${
                                            status === 'danger' ? 'bg-red-100 text-red-700' :
                                            status === 'warning' ? 'bg-orange-100 text-orange-700' :
                                            'bg-emerald-100 text-emerald-700'
                                          }`}>
                                            {record.value} {record.unit}
                                          </span>
                                        )}
                                      </td>
                                      {tech === 'lubricacion' && (
                                        <>
                                          <td className="px-4 py-3">
                                            {record.lubricationPerformed !== false ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">Sí</span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs font-medium">No</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-zinc-600">{record.greaseType || '-'}</td>
                                          <td className="px-4 py-3 text-zinc-600">{record.operatingHours || '-'}</td>
                                        </>
                                      )}
                                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate" title={record.notes}>
                                        {record.notes || '-'}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          onClick={() => handleDelete(record.id)}
                                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                          title="Eliminar registro"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {groupBy === 'equipment' && eq && equipmentRecords.length > 0 && expandedAnalysis[eq.id] && (() => {
          const { analysis, recommendations } = generateRuleBasedAnalysis(eq, equipmentRecords);
          return (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-6 mt-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Estado y Análisis
                </h3>
                <div className="prose prose-sm prose-blue max-w-none text-zinc-700">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Recomendaciones
                </h3>
                <div className="prose prose-sm prose-blue max-w-none text-zinc-700">
                  <ReactMarkdown>{recommendations}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  })}
</div>
)}
</div>
);
}
