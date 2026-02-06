/**
 * Calculate the centroid of a GeoJSON Polygon or MultiPolygon
 */
export function calculateCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.type || !geometry.coordinates) return null;

  if (geometry.type === 'Polygon') {
    return getPolygonCentroid(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    // For MultiPolygon, find the largest polygon by area (approx) and use its centroid
    let largestArea = 0;
    let bestCentroid: [number, number] | null = null;

    for (const polygonCoords of geometry.coordinates) {
      const area = estimatePolygonArea(polygonCoords);
      if (area > largestArea) {
        largestArea = area;
        bestCentroid = getPolygonCentroid(polygonCoords);
      }
    }
    return bestCentroid;
  }

  return null;
}

/**
 * Estimate polygon area (simple implementation for ranking MultiPolygons)
 */
function estimatePolygonArea(coordinates: number[][][]): number {
  if (!coordinates || coordinates.length === 0) return 0;
  const ring = coordinates[0]; // Outer ring
  if (!ring || ring.length < 3) return 0;

  let area = 0;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[i];
    const p2 = ring[j];
    if (p1 && p2 && p1.length >= 2 && p2.length >= 2) {
      area += (p2[0]! + p1[0]!) * (p2[1]! - p1[1]!);
    }
  }
  
  return Math.abs(area / 2);
}

/**
 * Get centroid of a single polygon
 */
function getPolygonCentroid(coordinates: number[][][]): [number, number] | null {
  if (!coordinates || coordinates.length === 0) return null;
  const ring = coordinates[0]; // Outer ring
  if (!ring || ring.length < 3) return null; // A polygon must have at least 3 points
  
  let x = 0, y = 0, area = 0;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[i];
    const p2 = ring[j];
    
    // Ensure points exist and have at least x,y coordinates
    if (p1 && p2 && p1.length >= 2 && p2.length >= 2) {
      const x1 = p1[0]!;
      const y1 = p1[1]!;
      const x2 = p2[0]!;
      const y2 = p2[1]!;

      const f = x1 * y2 - x2 * y1;
      area += f;
      x += (x1 + x2) * f;
      y += (y1 + y2) * f;
    }
  }
  
  const f = area * 3;
  // If area is 0 (collinear points or degenerate), fallback to first point
  const firstPoint = ring[0];
  if (f === 0) {
    return (firstPoint && firstPoint.length >= 2) 
      ? [firstPoint[0]!, firstPoint[1]!] 
      : null;
  }
  
  return [x / f, y / f];
}
