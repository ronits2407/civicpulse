import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/db/server';
import { analyzePredictiveCluster } from '@/lib/agents/agent5-predictive';

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
    const { cluster } = body;

    if (!cluster) {
      return NextResponse.json({ error: 'Missing cluster data' }, { status: 400 });
    }

    const alerts = await analyzePredictiveCluster(cluster);

    return NextResponse.json({ success: true, alerts });

  } catch (error: any) {
    console.error('Predictive Agent Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
