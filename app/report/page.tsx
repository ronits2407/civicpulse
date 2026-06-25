'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, MapPin, Send, CheckCircle, Loader2 } from 'lucide-react'

type Step = 'input' | 'locating' | 'processing' | 'done'

export default function ReportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('input')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function getLocation(): Promise<{ lat: number; lng: number; address: string }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          try {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
            )
            const data = await res.json()
            const address = data.results?.[0]?.formatted_address || `${lat}, ${lng}`
            resolve({ lat, lng, address })
          } catch {
            resolve({ lat, lng, address: `${lat}, ${lng}` })
          }
        },
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  async function handleSubmit() {
    if (!text.trim()) return
    setError('')

    try {
      setStep('locating')
      const coordinates = await getLocation()

      setStep('processing')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      let imageUrl: string | null = null
      if (imageFile) {
        const filename = `${user.id}/${Date.now()}-${imageFile.name}`
        const { data: upload } = await supabase.storage
          .from('issue-media')
          .upload(filename, imageFile)

        if (upload) {
          const { data: urlData } = supabase.storage
            .from('issue-media')
            .getPublicUrl(upload.path)
          imageUrl = urlData.publicUrl
        }
      }

      const response = await fetch('/api/reports/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          imageUrl,
          coordinates,
          userId: user.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setResult(data)
      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStep('input')
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Report an Issue</h1>
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">
                    What's the issue?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Describe the problem... e.g. There's a large pothole on MG Road near the clock tower, it damaged my bike yesterday"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[120px] resize-none"
                  />

                  {imagePreview && (
                    <div className="relative rounded-lg overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Issue preview"
                        className="w-full h-48 object-cover"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => { setImageFile(null); setImagePreview(null) }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-muted"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Add Photo
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm">{error}</p>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={!text.trim()}
                    className="w-full bg-[#2da44e] hover:bg-[#2c974b] disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Report
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(step === 'locating' || step === 'processing') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-6"
            >
              <Loader2 className="w-12 h-12 text-[#0969da] animate-spin" />
              <div className="text-center">
                <p className="text-foreground font-medium">
                  {step === 'locating' ? 'Getting your location...' : 'AI is analyzing your report...'}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {step === 'processing' && 'Classifying, validating, and routing to the right department'}
                </p>
              </div>
            </motion.div>
          )}

          {step === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle className="w-16 h-16 text-[#2da44e]" />
                <h2 className="text-2xl font-bold text-foreground">
                  {result.isDuplicate ? 'Issue Already Tracked' : 'Report Submitted'}
                </h2>
                <p className="text-muted-foreground text-center text-sm">
                  {result.isDuplicate
                    ? 'Your report has been added to an existing cluster. More voices = faster resolution.'
                    : 'Your report is now in the civic system.'}
                </p>
              </div>

              {!result.isDuplicate && result.classification && (
                <Card className="bg-card border-border">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Category</span>
                      <Badge variant="secondary" className="capitalize">
                        {result.classification.category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Severity</span>
                      <Badge
                        className={
                          result.classification.severity >= 7
                            ? 'bg-red-500'
                            : result.classification.severity >= 4
                            ? 'bg-yellow-500'
                            : 'bg-[#2da44e]'
                        }
                      >
                        {result.classification.severity}/10
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Credibility</span>
                      <span className="text-foreground text-sm font-medium">
                        {result.credibilityScore}/10
                      </span>
                    </div>
                    {result.slaDeadline && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">Resolution by</span>
                        <span className="text-foreground text-sm">
                          {new Date(result.slaDeadline).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {result.needsVerification && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-yellow-400 text-sm">
                          Nearby citizens will be asked to verify this report
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-border text-foreground hover:bg-muted"
                  onClick={() => router.push('/dashboard')}
                >
                  View Dashboard
                </Button>
                <Button
                  className="flex-1 bg-[#2da44e] hover:bg-[#2c974b]"
                  onClick={() => {
                    setText('')
                    setImageFile(null)
                    setImagePreview(null)
                    setResult(null)
                    setStep('input')
                  }}
                >
                  Report Another
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}