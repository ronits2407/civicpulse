import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/db/server';
import { fetchAndClusterIssues } from '@/lib/agents/agent5-predictive';

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

    const clusters = await fetchAndClusterIssues(days, bbox);

    return NextResponse.json({ success: true, count: clusters.length, clusters });

  } catch (error: any) {
    console.error('Predictive Agent Clustering Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
