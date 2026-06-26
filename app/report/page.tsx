'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, MapPin, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ReportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number, address: string} | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    getLocation().then(setCoordinates).catch(console.error)
  }, [])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function getLocation(): Promise<{ lat: number; lng: number; address: string }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          try {
            const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
            const data = await res.json()
            const address = data.address || `${lat}, ${lng}`
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
    if (!text.trim() || isSubmitting) return
    setError('')
    setIsSubmitting(true)

    try {
      let finalCoords = coordinates
      if (!finalCoords) {
        finalCoords = await getLocation()
        setCoordinates(finalCoords)
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      let imageUrl: string | null = null
      if (imageFile) {
        const filename = `${user.id}/${Date.now()}-${imageFile.name}`
        const { data: upload, error: uploadError } = await supabase.storage
          .from('issue-media')
          .upload(filename, imageFile)

        if (uploadError) {
          console.error('Image upload failed:', uploadError)
          throw new Error(`Failed to upload image: ${uploadError.message}`)
        }

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
          coordinates: finalCoords,
          userId: user.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Report Submitted', { description: 'Your report is being analyzed by our AI.' })
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 sm:p-10">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Report an issue</h1>
            <p className="text-sm text-muted-foreground mt-1">Submit a new civic issue for analysis and resolution.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="border-border text-foreground hover:bg-muted"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Describe problem</label>
            <Textarea
              placeholder="Describe the problem... e.g. There's a large pothole on MG Road, it damaged my bike yesterday"
              value={text}
              onChange={e => setText(e.target.value)}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground min-h-[150px] resize-none rounded-xl focus-visible:ring-1 focus-visible:ring-[#0969da]"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Upload your image</label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border group max-w-md mx-auto">
                <img
                  src={imagePreview}
                  alt="Issue preview"
                  className="w-full max-h-[300px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <Button
                    variant="outline"
                    className="border-border text-foreground bg-background hover:bg-muted opacity-100 shadow-xl font-semibold px-8 py-4 text-base rounded-xl"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                  >
                    Remove Photo
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 group/upload ${
                  isDragging 
                    ? 'border-[#0969da] bg-[#0969da]/10' 
                    : 'border-border hover:bg-muted/30'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center group-hover/upload:scale-105 transition-transform duration-200">
                  <Camera className="w-7 h-7 text-muted-foreground group-hover/upload:text-foreground transition-colors" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-[#0969da] hover:underline">Upload a photo</span>
                  <span className="text-sm text-muted-foreground"> or drag and drop</span>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </div>
              </div>
            )}
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

          {/* Submit Button */}
          <div className="pt-6 border-t border-border flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || isSubmitting}
              size="lg"
              className="bg-[#2da44e] hover:bg-[#2c974b] text-white disabled:opacity-40 font-semibold px-8 rounded-xl"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}