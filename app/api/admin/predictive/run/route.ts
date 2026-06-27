import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/db/server';
import { runPredictiveAgent } from '@/lib/agents/agent5-predictive';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Auth check - Must be admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body for config
    const body = await req.json();
    const { lookbackDays, bbox } = body;

    // Validate lookbackDays
    const days = parseInt(lookbackDays);
    if (isNaN(days) || days <= 0) {
      return NextResponse.json({ error: 'Invalid lookbackDays' }, { status: 400 });
    }

    // Since this can take time, in a true async architecture we might trigger a Cloud Task.
    // For Vercel/Next.js we can return immediately and let it run, but since this is on a Node runtime 
    // or Cloud Run we can just await it or fire and forget.
    // We will await it for now so the UI can get immediate feedback for the MVP.
    const alerts = await runPredictiveAgent(days, bbox);

    return NextResponse.json({ success: true, count: alerts.length, alerts });
    
  } catch (error: any) {
    console.error('Predictive Agent Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
