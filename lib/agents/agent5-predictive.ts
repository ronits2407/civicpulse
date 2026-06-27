import { createServerSupabaseClient } from '@/lib/db/server'
import { generateStructuredJSON } from '@/lib/ai/client'
import { getOptimalClusters } from '@/lib/utils/clustering'
import wkx from 'wkx'

interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface PredictiveAlertOutput {
  predicted_category: string;
  confidence: number;
  basis_summary: string;
}

const SYSTEM_PROMPT = `
You are Agent 5, a Predictive Hotspot Intelligence AI for a civic issue reporting platform.
You are given a cluster of historical civic issues (category, severity, created_at, location).
Your task is to analyze these issues and predict potential future problems in the SAME area.
For example, a history of 'waterlogging' in the past might indicate a high chance of 'flooding' or 'potholes' in the near future.
You must output an array of predictions for the cluster. Each prediction should contain:
- predicted_category: The predicted civic issue category (e.g., 'flooding', 'potholes', 'disease_outbreak').
- confidence: A number between 0 and 1 indicating how confident you are in the prediction.
- basis_summary: A short, concise summary (1-2 sentences) explaining the prediction based on the data. For example: "Based on 23 waterlogging reports in the last month, there is a high risk of potholes."

Return ONLY valid JSON in this exact structure:
[
  {
    "predicted_category": "string",
    "confidence": 0.85,
    "basis_summary": "string"
  }
]
`;

export async function runPredictiveAgent(lookbackDays: number, bbox?: BBox) {
  const supabase = await createServerSupabaseClient()
  
  // 1. Fetch issues within lookback period
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - lookbackDays);
  
  const { data: issues, error } = await supabase
    .from('issues')
    .select('*')
    .gte('created_at', dateLimit.toISOString())
    
  if (error) throw error;
  if (!issues || issues.length === 0) return [];

  // 2. Decode PostGIS locations and optionally filter by bbox
  const mappedIssues = issues.map((issue: any) => {
    let loc = issue.location
    if (typeof loc === 'string') {
      try {
        if (loc.startsWith('POINT')) {
          const match = loc.match(/POINT\(([^ ]+) ([^)]+)\)/)
          if (match) {
            loc = { lat: parseFloat(match[2]), lng: parseFloat(match[1]) }
          }
        } else {
          const geom = wkx.Geometry.parse(Buffer.from(loc, 'hex'))
          const geojson = geom.toGeoJSON() as any
          if (geojson.type === 'Point') {
            loc = { lat: geojson.coordinates[1], lng: geojson.coordinates[0] }
          }
        }
      } catch (e) {
        loc = null
      }
    }
    return { ...issue, location: loc }
  }).filter((i: any) => i.location && typeof i.location.lat === 'number' && typeof i.location.lng === 'number');

  const filteredIssues = bbox ? mappedIssues.filter((i: any) => {
    const { lat, lng } = i.location;
    return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
  }) : mappedIssues;

  if (filteredIssues.length === 0) return [];

  // 3. Cluster the issues
  const dataPoints = filteredIssues.map((i: any) => [i.location.lat, i.location.lng]);
  const { clusters: clusterIndices, centroids } = getOptimalClusters(dataPoints);

  const clusteredData = centroids.map((centroid, idx) => ({
    centroid: { lat: centroid[0], lng: centroid[1] },
    issues: filteredIssues.filter((_, i) => clusterIndices[i] === idx)
  }));

  const generatedAlerts = [];

  // 4. Generate predictions per cluster
  for (const cluster of clusteredData) {
    if (cluster.issues.length === 0) continue;

    // Summarize cluster data for Gemini
    const clusterSummary = cluster.issues.map((i: any) => ({
      category: i.category,
      subcategory: i.subcategory,
      severity: i.severity,
      created_at: i.created_at,
    }));

    const prompt = `Cluster Location: lat ${cluster.centroid.lat}, lng ${cluster.centroid.lng}\nHistorical Issues in cluster:\n${JSON.stringify(clusterSummary, null, 2)}`;

    try {
      // Use Pro model for Agent 5 as per rules
      const predictions = await generateStructuredJSON<PredictiveAlertOutput[]>(prompt, SYSTEM_PROMPT, true);
      
      // 5. Insert predictions into database
      for (const pred of predictions) {
        const pointWkt = `POINT(${cluster.centroid.lng} ${cluster.centroid.lat})`;
        const alertToInsert = {
          location: pointWkt,
          predicted_category: pred.predicted_category,
          confidence: pred.confidence,
          basis_summary: pred.basis_summary,
          prediction_date: new Date().toISOString(),
          is_actioned: false
        };
        
        const { error: insertError } = await supabase
          .from('predictive_alerts')
          .insert(alertToInsert);
          
        if (insertError) {
          console.error('[Agent 5] Error inserting predictive alert:', insertError);
        } else {
          generatedAlerts.push(alertToInsert);
        }
      }
    } catch (err) {
      console.error('[Agent 5] Failed to generate predictions for a cluster:', err);
    }
  }

  // 6. Mark issues as Agent 5 completed
  const allIssueIds = filteredIssues.map((i: any) => i.id);
  if (allIssueIds.length > 0) {
    const { error: updateError } = await supabase
      .from('issues')
      .update({ agent5_completed: true })
      .in('id', allIssueIds);
    if (updateError) {
      console.error('[Agent 5] Error marking issues completed:', updateError);
    }
  }

  return generatedAlerts;
}
