import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('issue_comments')
      .select('*, profiles(email)')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Fetch user metadata for avatars and names
    const uniqueUserIds = [...new Set(data.map((c: any) => c.user_id))]
    const usersData = await Promise.all(
      uniqueUserIds.map(id => serviceClient.auth.admin.getUserById(id))
    )
    const userMetaMap: Record<string, any> = {}
    for (const { data: userData } of usersData) {
      if (userData?.user) {
        userMetaMap[userData.user.id] = userData.user.user_metadata
      }
    }

    const enrichedComments = data.map((c: any) => ({
      ...c,
      profiles: {
        ...c.profiles,
        full_name: userMetaMap[c.user_id]?.full_name,
        avatar_url: userMetaMap[c.user_id]?.avatar_url || userMetaMap[c.user_id]?.picture
      }
    }))

    return NextResponse.json({ comments: enrichedComments })
  } catch (error: any) {
    console.error('Fetch comments error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params
    const { commentText } = await request.json()

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!commentText || typeof commentText !== 'string') {
      return NextResponse.json({ error: 'Invalid comment text' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('issue_comments')
      .insert({
        issue_id: issueId,
        user_id: user.id,
        comment_text: commentText
      })
      .select('*, profiles(email)')
      .single()

    if (error) throw error

    return NextResponse.json({ comment: data })
  } catch (error: any) {
    console.error('Post comment error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to post comment' },
      { status: 500 }
    )
  }
}
