import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params
    const updates = await request.json()

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow updating status and department_id
    const allowedUpdates: any = {}
    if (updates.status) allowedUpdates.status = updates.status
    if (updates.department_id !== undefined) allowedUpdates.department_id = updates.department_id || null

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('issues')
      .update(allowedUpdates)
      .eq('id', issueId)
      .select()
      .single()

    if (error) throw error

    // Grant karma if resolved
    if (updates.status === 'resolved' && data.user_id) {
      // Check if already awarded (simple check to prevent spam clicks on frontend)
      const { data: existingKarma } = await serviceClient
        .from('karma_events')
        .select('id')
        .eq('issue_id', issueId)
        .eq('event_type', 'issue_resolved')
        .single()
        
      if (!existingKarma) {
        await serviceClient.from('karma_events').insert({
          user_id: data.user_id,
          event_type: 'issue_resolved',
          points: 50,
          issue_id: issueId,
        })
      }
    }

    return NextResponse.json({ issue: data })
  } catch (error: any) {
    console.error('Update issue error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update issue' },
      { status: 500 }
    )
  }
}
