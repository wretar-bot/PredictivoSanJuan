import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MaintenanceRecord, Equipment, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandler';
import { FileText, Printer, Loader2, AlertCircle, Activity, Thermometer, Waves, Download, Save } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generateRuleBasedAnalysis } from '../utils/analysisGenerator';
import { EsentiaLogo } from './EsentiaLogo';

export function Reports() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [reportType, setReportType] = useState<'om' | 'equipment'>('om');
  const [selectedId, setSelectedId] = useState<string>('');
  
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [companyInfo, setCompanyInfo] = useState({ name: '', site: '' });

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch company settings
    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        const data = snap.data({ serverTimestamps: 'estimate' });
        setCompanyInfo({ name: data.companyName || '', site: data.siteName || '' });
      }
    }).catch(console.error);

    const qRecords = query(collection(db, 'maintenance_records'));
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) })) as MaintenanceRecord[];
      // Sort chronologically (oldest to newest for charts)
      data.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateA - dateB;
      });
      setRecords(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'maintenance_records'));

    const qEq = query(collection(db, 'equipment'));
    const unsubscribeEq = onSnapshot(qEq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) })) as Equipment[];
      setEquipmentList(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'equipment'));

    return () => {
      unsubscribeRecords();
      unsubscribeEq();
    };
  }, []);

  // Get unique OMs
  const uniqueOMs = Array.from(new Set(records.map(r => r.omNumber))).filter(Boolean).sort((a, b) => b.localeCompare(a));

  const handleGenerateReport = () => {
    if (!selectedId) return;
    setGenerating(true);
    setReportData(null);
    setAiAnalysis('');

    try {
      // 1. Filter records based on selection
      let filteredRecords: MaintenanceRecord[] = [];
      let reportTitle = '';
      
      if (reportType === 'om') {
        // Find records for this OM
        const omRecords = records.filter(r => r.omNumber === selectedId);
        
        // Identify unique equipment and points measured in this OM
        const measuredPoints = new Set(omRecords.map(r => `${r.equipmentId}-${r.technique}-${r.measurementPoint}`));
        
        // Include ALL historical records for those specific equipment/technique/point combinations
        filteredRecords = records.filter(r => measuredPoints.has(`${r.equipmentId}-${r.technique}-${r.measurementPoint}`));
        
        reportTitle = `Reporte de Orden de Mantenimiento: ${selectedId}`;
      } else {
        const eq = equipmentList.find(e => e.id === selectedId);
        filteredRecords = records.filter(r => r.equipmentId === selectedId);
        reportTitle = `Reporte de Equipo: ${eq?.name || selectedId}`;
      }

      if (filteredRecords.length === 0) {
        alert('No hay registros para la selección actual.');
        setGenerating(false);
        return;
      }

      // 2. Group data for the report view
      const grouped = filteredRecords.reduce((acc, record) => {
        const eqName = record.equipmentName || 'Equipo Desconocido';
        const tech = record.technique || 'Desconocida';
        
        if (!acc[eqName]) acc[eqName] = {};
        if (!acc[eqName][tech]) acc[eqName][tech] = { points: {} };
        if (!acc[eqName][tech].points[record.measurementPoint]) acc[eqName][tech].points[record.measurementPoint] = [];
        
        acc[eqName][tech].points[record.measurementPoint].push(record);
        return acc;
      }, {} as Record<string, Record<string, { points: Record<string, MaintenanceRecord[]> }>>);

      // Get unique authors
      const authors = Array.from(new Set(filteredRecords.map(r => r.authorName || 'Usuario Desconocido'))).join(', ');

      setReportData({ title: reportTitle, date: new Date(), grouped, authors });

      // 3. Gather Rule-Based Analysis from Equipments
      const involvedEquipments = new Set(filteredRecords.map(r => r.equipmentId));
      let combinedAnalysis = '';

      involvedEquipments.forEach(eqId => {
        const eq = equipmentList.find(e => e.id === eqId);
        if (eq) {
          const eqRecords = filteredRecords.filter(r => r.equipmentId === eqId);
          if (eqRecords.length > 0) {
            const { analysis, recommendations } = generateRuleBasedAnalysis(eq, eqRecords);
            combinedAnalysis += `### Equipo: ${eq.name}\n\n`;
            combinedAnalysis += `#### Análisis\n${analysis}\n\n`;
            combinedAnalysis += `#### Recomendaciones\n${recommendations}\n\n`;
            combinedAnalysis += `---\n\n`;
          }
        }
      });

      setAiAnalysis(combinedAnalysis || 'No hay datos suficientes para generar un análisis.');

    } catch (error: any) {
      console.error("Error generating report:", error);
      alert(`Hubo un error al generar el reporte o el análisis de IA: ${error?.message || error}`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    
    const rows: any[] = [];
    Object.entries(reportData.grouped).forEach(([eqName, techs]: [string, any]) => {
      Object.entries(techs).forEach(([tech, data]: [string, any]) => {
        Object.entries(data.points).forEach(([pointName, pointRecords]: [string, any]) => {
          pointRecords.forEach((record: MaintenanceRecord) => {
            rows.push({
              Equipo: eqName,
              Técnica: tech,
              Punto: pointName,
              OM: record.omNumber,
              Fecha: record.createdAt?.toDate ? format(record.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '',
              Valor: record.value,
              Unidad: record.unit,
              Notas: record.notes || '',
              RegistradoPor: record.authorName || 'Desconocido'
            });
          });
        });
      });
    });

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTechniqueIcon = (technique: string) => {
    if (!technique) return null;
    switch (technique.toLowerCase()) {
      case 'termografia': return <Thermometer className="w-4 h-4 text-orange-500" />;
      case 'ultrasonido': return <Waves className="w-4 h-4 text-blue-500" />;
      case 'vibraciones': return <Activity className="w-4 h-4 text-emerald-500" />;
      default: return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-zinc-900" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls Section - Hidden during print */}
      <div className="print:hidden bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Generador de Reportes</h2>
            <p className="text-sm text-zinc-500">Genera informes con análisis de tendencias e IA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">Tipo de Reporte</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as 'om' | 'equipment');
                setSelectedId('');
              }}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all cursor-pointer"
            >
              <option value="om">Por Orden de Mantenimiento (OM)</option>
              <option value="equipment">Por Equipo</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              {reportType === 'om' ? 'Seleccionar OM' : 'Seleccionar Equipo'}
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all cursor-pointer"
            >
              <option value="" disabled>Selecciona una opción...</option>
              {reportType === 'om' 
                ? uniqueOMs.map(om => <option key={om} value={om}>{om}</option>)
                : equipmentList.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.techniques?.join(', ') || (eq as any).technique})</option>)
              }
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={!selectedId || generating}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generar
            </button>
            
            {reportData && (
              <>
                <button
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center justify-center p-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                  title="Descargar CSV"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center p-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                  title="Guardar PDF"
                >
                  <Save className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report View - Styled for print */}
      {reportData && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0">
          {/* Report Header */}
          <div className="border-b-2 border-zinc-900 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{reportData.title}</h1>
              <div className="text-zinc-500 mt-2 space-y-1">
                <p><strong>Fecha de Generación:</strong> {format(reportData.date, 'dd/MM/yyyy HH:mm')}</p>
                {companyInfo.name && <p><strong>Empresa:</strong> {companyInfo.name} {companyInfo.site ? `- ${companyInfo.site}` : ''}</p>}
                <p><strong>Registrado por:</strong> {reportData.authors}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="w-48 h-16 mb-2">
                <EsentiaLogo />
              </div>
              <p className="text-sm text-zinc-500">Reporte de Análisis Predictivo</p>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="mb-10 bg-zinc-50 border border-zinc-200 rounded-2xl p-6 print:bg-transparent print:border-zinc-300 print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-zinc-900">Diagnóstico Global y Recomendaciones</h2>
            </div>
            {generating ? (
              <div className="flex items-center gap-3 text-zinc-500 py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                Analizando datos...
              </div>
            ) : (
              <div className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-li:text-zinc-700">
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Data Section */}
          <div className="space-y-12">
            {Object.entries(reportData.grouped).map(([eqName, techs]: [string, any]) => (
              <div key={eqName} className="print:break-inside-avoid space-y-8">
                {Object.entries(techs).map(([tech, data]: [string, any]) => (
                  <div key={`${eqName}-${tech}`}>
                    <div className="flex items-center gap-3 mb-6 bg-zinc-900 text-white px-4 py-2 rounded-lg print:bg-zinc-100 print:text-zinc-900 print:border print:border-zinc-300">
                      {getTechniqueIcon(tech)}
                      <h3 className="text-lg font-bold">{eqName}</h3>
                      <span className="ml-auto text-sm font-medium opacity-80 capitalize">{tech}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                      {Object.entries(data.points).map(([pointName, pointRecords]: [string, any]) => {
                        const chartData = pointRecords.map((r: any) => ({
                          date: r.createdAt?.toDate ? format(r.createdAt.toDate(), 'dd/MM/yy') : '',
                          value: r.value,
                          unit: r.unit
                        }));

                        return (
                          <div key={pointName} className="border border-zinc-200 rounded-xl p-5 print:border-zinc-300 print:break-inside-avoid">
                            <h4 className="text-md font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-indigo-500" />
                              Punto de Medición: {pointName}
                            </h4>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Chart */}
                              {chartData.length > 1 ? (
                                <div className="h-48 w-full bg-zinc-50/50 rounded-lg p-2 border border-zinc-100 print:bg-transparent print:border-none">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                                      <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke="#a1a1aa" dy={10} />
                                      <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a1a1aa" width={40} />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number, name: string, props: any) => [`${value} ${props.payload.unit}`, 'Valor']}
                                      />
                                      <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: '#4f46e5' }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="h-48 w-full flex items-center justify-center bg-zinc-50 rounded-lg border border-zinc-100 text-zinc-400 text-sm italic print:bg-transparent print:border-dashed">
                                  Datos insuficientes para gráfica de tendencia
                                </div>
                              )}

                              {/* Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium print:bg-transparent print:border-zinc-300">
                                    <tr>
                                      <th className="px-3 py-2">Fecha</th>
                                      <th className="px-3 py-2">OM</th>
                                      <th className="px-3 py-2">Valor</th>
                                      <th className="px-3 py-2">Notas</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 print:divide-zinc-200">
                                    {/* Show only last 5 records in report to save space */}
                                    {pointRecords.slice(-5).reverse().map((record: any) => (
                                      <tr key={record.id}>
                                        <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                                          {record.createdAt?.toDate ? format(record.createdAt.toDate(), 'dd/MM/yyyy') : '...'}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-zinc-900">{record.omNumber}</td>
                                        <td className="px-3 py-2 font-mono font-medium text-zinc-900">
                                          {record.value} <span className="text-zinc-500 font-normal">{record.unit}</span>
                                        </td>
                                        <td className="px-3 py-2 text-zinc-500 truncate max-w-[150px]" title={record.notes}>
                                          {record.notes || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {pointRecords.length > 5 && (
                                  <p className="text-xs text-zinc-400 mt-2 italic text-right">
                                    Mostrando los 5 registros más recientes de {pointRecords.length} totales.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
