export const getLubricationRecommendation = (size: 'small' | 'medium' | 'large', shaftDiameter?: number, bearingType?: string) => {
  let quantity = 0;
  let frequency = 0;

  // Criterio 1: Capacidad del motor (machineSize)
  if (size === 'small') {
    quantity = 5;
    frequency = 3000;
  } else if (size === 'medium') {
    quantity = 15;
    frequency = 2000;
  } else if (size === 'large') {
    quantity = 30;
    frequency = 1000;
  }

  // Criterio 2: Diámetro de flecha y tipo de rodamiento (si existen)
  if (shaftDiameter) {
    // Fórmula simplificada basada en diámetro (G = D * 0.2 aprox si no hay ancho)
    quantity = Math.round(shaftDiameter * 0.2);
    
    if (bearingType) {
      const typeLower = bearingType.toLowerCase();
      if (typeLower.includes('rodillo')) {
        frequency = Math.max(500, frequency - 500); // Rodillos requieren más frecuencia
      } else if (typeLower.includes('bola')) {
        frequency = Math.min(4000, frequency + 500); // Bolas requieren menos
      }
    }
  }

  return { quantity, frequency };
};
