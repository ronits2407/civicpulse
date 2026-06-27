import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/db/client'

export const runtime = 'edge'

export async function GET(request: Request, props: { params: Promise<{ issue_id: string }> }) {
  try {
    const params = await props.params;
    const supabase = createClient()
    const { data: issue, error } = await supabase
      .from('issues')
      .select('*')
      .eq('id', params.issue_id)
      .single()

    if (error || !issue) {
      return new Response('Not found', { status: 404 })
    }

    // Determine estimated commuters saved.
    // If it's a high severity issue, more commuters saved. Just a fun metric.
    const baseCommuters = issue.category === 'infrastructure' || issue.category === 'sanitation' ? 500 : 100
    const estimatedSaved = baseCommuters + (issue.severity * 50)

    let fixTimeText = 'recently'
    if (issue.resolved_at && issue.created_at) {
      const created = new Date(issue.created_at)
      const resolved = new Date(issue.resolved_at)
      const diffHours = Math.round((resolved.getTime() - created.getTime()) / (1000 * 60 * 60))
      fixTimeText = diffHours > 0 ? `in ${diffHours} hours` : 'in record time'
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0d1117',
            fontFamily: 'sans-serif',
            color: '#e6edf3',
            padding: '40px',
            border: '8px solid #2da44e',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '80%' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 'bold',
                color: '#2da44e',
                marginBottom: 20,
                textTransform: 'uppercase',
                letterSpacing: 2,
                display: 'flex',
              }}
            >
              Impact Receipt
            </div>
            <div style={{ fontSize: 32, marginBottom: 30, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex' }}>Your report&nbsp;</div>
              <div style={{ color: '#0969da', fontWeight: 'bold', display: 'flex' }}>"{issue.title}"</div>
              <div style={{ display: 'flex' }}>{` was fixed ${fixTimeText}.`}</div>
            </div>
            <div
              style={{
                fontSize: 28,
                color: '#8b949e',
                marginBottom: 40,
                fontStyle: 'italic',
                display: 'flex',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              {`📍 ${issue.address || 'Nashik'}`}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: '#161b22',
                padding: '20px 40px',
                borderRadius: 20,
                border: '2px solid #30363d',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 40, marginRight: 15, display: 'flex' }}>🌟</div>
              <div style={{ fontSize: 32, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <div style={{ display: 'flex' }}>You improved the city for an estimated&nbsp;</div>
                <div style={{ color: '#f87171', fontWeight: 'bold', display: 'flex' }}>{`${estimatedSaved}`}</div>
                <div style={{ display: 'flex' }}>&nbsp;citizens!</div>
              </div>
            </div>
            <div style={{ marginTop: 50, fontSize: 24, color: '#8b949e', display: 'flex' }}>
              CivicPulse - Empowering Citizens with AI
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    console.error(e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}
