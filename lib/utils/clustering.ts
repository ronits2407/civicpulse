import { kmeans } from 'ml-kmeans';

/**
 * Calculate WCSS (Within-Cluster Sum of Squares) manually as ml-kmeans doesn't expose it directly
 */
export function calculateWCSS(data: number[][], clusters: number[], centroids: number[][]) {
  let wcss = 0;
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const clusterIdx = clusters[i];
    const centroid = centroids[clusterIdx];
    if (centroid) {
      // Euclidean distance squared
      const distSq = Math.pow(point[0] - centroid[0], 2) + Math.pow(point[1] - centroid[1], 2);
      wcss += distSq;
    }
  }
  return wcss;
}

export interface ClusteringResult {
  clusters: number[];
  centroids: number[][];
  optimalK: number;
}

/**
 * Perform K-Means clustering with automatic optimal K detection using the Kneedle algorithm
 * @param data Array of [lat, lng] coordinates
 * @param maxK Limit the maximum number of clusters (default 10)
 */
export function getOptimalClusters(data: number[][], maxKLimit: number = 10): ClusteringResult {
  let optimalK = 1;
  const maxK = Math.min(maxKLimit, data.length);
  
  if (data.length > 2) {
    const wcssValues: number[] = [];
    
    for (let k = 1; k <= maxK; k++) {
      const result = kmeans(data, k, { initialization: 'kmeans++' });
      const wcss = calculateWCSS(data, result.clusters, result.centroids.map(c => c));
      wcssValues.push(wcss);
    }
    
    // Improved Elbow Method: Kneedle algorithm (distance to line connecting first and last points)
    let maxDistance = -1;
    const p1 = { x: 1, y: wcssValues[0] };
    const p2 = { x: maxK, y: wcssValues[maxK - 1] };
    
    const m = (p2.y - p1.y) / (p2.x - p1.x);
    const c = p1.y - m * p1.x;

    for (let i = 0; i < wcssValues.length; i++) {
      const k = i + 1;
      const wcss = wcssValues[i];
      
      // Line equation: y = m*x + c
      const lineY = m * k + c;
      
      // Vertical distance from curve to the line
      const distance = lineY - wcss;
      
      if (distance > maxDistance) {
        maxDistance = distance;
        optimalK = k;
      }
    }
    
    // Fallback if elbow not clearly found
    if (optimalK === 1 && data.length > 1) {
       optimalK = Math.max(1, Math.ceil(data.length / 10));
    }
  } else {
    optimalK = data.length;
  }

  // Run final K-Means with optimal K
  const finalResult = kmeans(data, optimalK, { initialization: 'kmeans++' });
  
  return {
    clusters: finalResult.clusters,
    centroids: finalResult.centroids.map(c => c),
    optimalK
  };
}
