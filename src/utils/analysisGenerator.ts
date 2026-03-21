import { Equipment, MaintenanceRecord } from '../types';

export function generateRuleBasedAnalysis(equipment: Equipment, records: MaintenanceRecord[]): { analysis: string, recommendations: string } {
  if (!records || records.length === 0) {
    return {
      analysis: 'No hay registros suficientes para realizar un análisis.',
      recommendations: 'Realizar mediciones iniciales para establecer una línea base.'
    };
  }

  let analysisMarkdown = '';
  let recommendationsMarkdown = '';

  const techniques = Array.from(new Set(records.map(r => r.technique)));

  techniques.forEach(tech => {
    const techRecords = records.filter(r => r.technique === tech);
    const techAlarms = equipment.alarms?.[tech as 'termografia' | 'vibraciones' | 'ultrasonido' | 'lubricacion'];
    
    // Find the latest record for each measurement point
    const latestRecordsByPoint: Record<string, MaintenanceRecord> = {};
    techRecords.forEach(r => {
      const currentLatest = latestRecordsByPoint[r.measurementPoint];
      const rDate = r.createdAt?.toMillis ? r.createdAt.toMillis() : 0;
      const currentLatestDate = currentLatest?.createdAt?.toMillis ? currentLatest.createdAt.toMillis() : 0;
      
      if (!currentLatest || rDate > currentLatestDate) {
        latestRecordsByPoint[r.measurementPoint] = r;
      }
    });

    let maxStatus = 'normal'; // normal, warning, danger
    const pointsInWarning: string[] = [];
    const pointsInDanger: string[] = [];

    Object.values(latestRecordsByPoint).forEach(r => {
      if (techAlarms) {
        if (r.value >= techAlarms.danger) {
          maxStatus = 'danger';
          pointsInDanger.push(`${r.measurementPoint} (${r.value} ${r.unit})`);
        } else if (r.value >= techAlarms.warning) {
          if (maxStatus !== 'danger') maxStatus = 'warning';
          pointsInWarning.push(`${r.measurementPoint} (${r.value} ${r.unit})`);
        }
      }
    });

    // Technique specific norms and analysis
    let techName = '';
    let norm = '';
    let goodPractices = '';
    let specificRecommendations = '';

    switch (tech.toLowerCase()) {
      case 'termografia':
        techName = 'Termografía Infrarroja';
        norm = 'ISO 18434-1 (Monitoreo de condición y diagnóstico de máquinas — Termografía)';
        goodPractices = 'Evaluación de gradientes térmicos, inspección de conexiones eléctricas y mecánicas, identificación de sobrecalentamiento por fricción o falsos contactos.';
        specificRecommendations = 'Revisar conexiones eléctricas, verificar alineación y lubricación si hay sobrecalentamiento en rodamientos, asegurar ventilación adecuada.';
        break;
      case 'vibraciones':
        techName = 'Análisis de Vibraciones';
        norm = 'ISO 10816 / ISO 20816 (Evaluación de la vibración de máquinas mediante mediciones en partes no rotativas)';
        goodPractices = 'Monitoreo de tendencias de velocidad (mm/s) o aceleración (g), análisis espectral para identificar desbalanceo, desalineación, holguras o fallas en rodamientos.';
        specificRecommendations = 'Verificar alineación y balanceo, inspeccionar estado de rodamientos, revisar anclajes y cimentación para descartar holguras mecánicas.';
        break;
      case 'ultrasonido':
        techName = 'Inspección por Ultrasonido';
        norm = 'ISO 29821-1 (Monitoreo de condición y diagnóstico de máquinas — Ultrasonido)';
        goodPractices = 'Detección temprana de fallas en rodamientos (fricción), problemas de lubricación, detección de fugas de aire/gas, inspección de trampas de vapor y arcos eléctricos.';
        specificRecommendations = 'Aplicar plan de lubricación acústica (engrase basado en ultrasonido), revisar sellos y empaquetaduras, inspeccionar válvulas o trampas de vapor si aplica.';
        break;
      case 'lubricacion':
        techName = 'Lubricación';
        norm = 'ISO 18436-4 (Análisis de lubricantes) y buenas prácticas de ICML';
        goodPractices = 'Aplicación de la cantidad correcta de grasa en el intervalo adecuado, evitando la sobrelubricación y la mezcla de grasas incompatibles.';
        specificRecommendations = 'Verificar compatibilidad de grasas, respetar los intervalos de relubricación basados en horas de operación, y asegurar limpieza en los puntos de engrase.';
        break;
      default:
        techName = tech;
        norm = 'Estándares generales de mantenimiento industrial';
        goodPractices = 'Monitoreo continuo y registro de tendencias para identificar desviaciones de la línea base.';
        specificRecommendations = 'Continuar con el plan de monitoreo establecido y evaluar tendencias a largo plazo.';
        break;
    }

    analysisMarkdown += `#### ${techName}\n`;
    analysisMarkdown += `**Normativa de referencia:** ${norm}\n\n`;
    analysisMarkdown += `**Buenas prácticas:** ${goodPractices}\n\n`;
    
    if (tech.toLowerCase() === 'lubricacion') {
      analysisMarkdown += `**Puntos Lubricados:**\n`;
      Object.values(latestRecordsByPoint).forEach(r => {
        analysisMarkdown += `- ${r.measurementPoint}: ${r.value} ${r.unit} de grasa ${r.greaseType || 'N/A'} (a las ${r.operatingHours || 0} horas de operación)\n`;
      });
    } else {
      analysisMarkdown += `**Estado de Condición:**\n`;
      if (maxStatus === 'danger') {
        analysisMarkdown += `- 🔴 **Rojo (Alarma crítica):** Se han detectado valores que superan el umbral de Peligro (${techAlarms?.danger}).\n`;
        analysisMarkdown += `  - Puntos críticos: ${pointsInDanger.join(', ')}\n`;
      } else if (maxStatus === 'warning') {
        analysisMarkdown += `- 🟡 **Ámbar (Alarma):** Se han detectado valores que superan el umbral de Alarma (${techAlarms?.warning}), pero están por debajo del nivel de Peligro.\n`;
        analysisMarkdown += `  - Puntos en advertencia: ${pointsInWarning.join(', ')}\n`;
      } else {
        analysisMarkdown += `- 🟢 **Verde (Ok):** Todos los valores medidos se encuentran dentro de los parámetros normales de operación (por debajo de ${techAlarms?.warning || 'los umbrales de alarma'}).\n`;
      }
    }
    analysisMarkdown += `\n`;

    recommendationsMarkdown += `#### ${techName}\n`;
    if (tech.toLowerCase() === 'lubricacion') {
      recommendationsMarkdown += `**Recomendaciones de Lubricación:**\n`;
      recommendationsMarkdown += `- ${specificRecommendations}\n`;
      recommendationsMarkdown += `- Monitorear la temperatura y vibración de los rodamientos después de la lubricación para asegurar que no haya sobrelubricación.\n`;
    } else if (maxStatus === 'danger') {
      recommendationsMarkdown += `**¡ACCIÓN INMEDIATA REQUERIDA!**\n`;
      recommendationsMarkdown += `- Programar intervención correctiva a la brevedad para los puntos críticos.\n`;
      recommendationsMarkdown += `- ${specificRecommendations}\n`;
    } else if (maxStatus === 'warning') {
      recommendationsMarkdown += `**Atención Requerida:**\n`;
      recommendationsMarkdown += `- Aumentar la frecuencia de monitoreo en los puntos en advertencia.\n`;
      recommendationsMarkdown += `- Planificar inspección detallada en la próxima ventana de mantenimiento.\n`;
      recommendationsMarkdown += `- ${specificRecommendations}\n`;
    } else {
      recommendationsMarkdown += `**Mantenimiento Rutinario:**\n`;
      recommendationsMarkdown += `- El equipo opera en condiciones normales para esta técnica.\n`;
      recommendationsMarkdown += `- Continuar con las rutas de inspección predictiva según el calendario establecido.\n`;
    }
    recommendationsMarkdown += `\n`;
  });

  return {
    analysis: analysisMarkdown,
    recommendations: recommendationsMarkdown
  };
}
