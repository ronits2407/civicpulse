'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Send, Loader2, Navigation, Map, CheckCircle2, X, Video, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { LocationPickerPanel } from '@/components/report/LocationPickerPanel'
import { WebcamModal } from '@/components/report/WebcamModal'

export default function ReportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Webcam state
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'image' | 'video'>('image')

  // Location state
  const [locationMode, setLocationMode] = useState<'none' | 'gps' | 'map'>('none')
  const [isGettingGPS, setIsGettingGPS] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      return
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice reporting is not supported in your browser.')
      return
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      
      recognition.continuous = true
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
        toast.success('Listening...', { id: 'mic-toast' })
      }

      recognition.onresult = (event: any) => {
        const current = event.resultIndex
        const transcript = event.results[current][0].transcript
        setText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + transcript)
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied.', { id: 'mic-toast' })
        } else if (event.error !== 'no-speech') {
          toast.error(`Microphone error: ${event.error}`, { id: 'mic-toast' })
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        toast.dismiss('mic-toast')
      }

      recognition.start()
    } catch (err) {
      toast.error('Could not start microphone.', { id: 'mic-toast' })
      console.error(err)
    }
  }

  // ----------------------------------------------------------------
  // Image handlers
  // ----------------------------------------------------------------
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement> | File) {
    const file = e instanceof File ? e : e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement> | File) {
    const file = e instanceof File ? e : e.target.files?.[0]
    if (!file) return
    
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Video is too large. Please select a video under 20MB.')
      if (!(e instanceof File) && e.target) e.target.value = ''
      return
    }

    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
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

  // ----------------------------------------------------------------
  // GPS location
  // ----------------------------------------------------------------
  async function handleUseCurrentLocation() {
    setIsGettingGPS(true)
    toast.loading('Getting your location...', { id: 'gps-toast' })
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })
      const { latitude: lat, longitude: lng } = pos.coords
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        if (data.address) address = data.address
      } catch {}
      setCoordinates({ lat, lng, address })
      setLocationMode('gps')
      toast.success('Location captured!', { id: 'gps-toast' })
    } catch {
      toast.error('Could not get your location. Please allow location access.', { id: 'gps-toast' })
    } finally {
      setIsGettingGPS(false)
    }
  }

  // ----------------------------------------------------------------
  // Map picker confirm
  // ----------------------------------------------------------------
  function handleMapConfirm(loc: { lat: number; lng: number }, address: string) {
    setCoordinates({ lat: loc.lat, lng: loc.lng, address })
    setLocationMode('map')
  }

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  async function handleSubmit() {
    if (!text.trim() || isSubmitting) return
    setError('')
    setIsSubmitting(true)

    try {
      let finalCoords = coordinates

      // If no location picked, silently try GPS one last time
      if (!finalCoords) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })
          finalCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
          }
        } catch {}
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

        if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`)

        if (upload) {
          const { data: urlData } = supabase.storage.from('issue-media').getPublicUrl(upload.path)
          imageUrl = urlData.publicUrl
        }
      }

      let videoUrl: string | null = null
      if (videoFile) {
        const filename = `${user.id}/${Date.now()}-${videoFile.name}`
        const { data: upload, error: uploadError } = await supabase.storage
          .from('issue-media')
          .upload(filename, videoFile)

        if (uploadError) throw new Error(`Failed to upload video: ${uploadError.message}`)

        if (upload) {
          const { data: urlData } = supabase.storage.from('issue-media').getPublicUrl(upload.path)
          videoUrl = urlData.publicUrl
        }
      }

      const response = await fetch('/api/reports/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl, videoUrl, coordinates: finalCoords, userId: user.id }),
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
            <label htmlFor="issue-description" className="block text-sm font-semibold text-foreground mb-2">Describe problem</label>
            <div className="relative">
              <Textarea
                id="issue-description"
                placeholder="Describe the problem... e.g. There's a large pothole on MG Road, it damaged my bike yesterday"
                value={text}
                onChange={e => setText(e.target.value)}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground min-h-[150px] resize-none rounded-xl focus-visible:ring-1 focus-visible:ring-[#0969da] pr-14 pb-14"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute bottom-3 right-3 p-3 rounded-full transition-colors flex items-center justify-center ${
                  isListening 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice reporting'}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>

          {/* Media Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Upload image</label>
              {imagePreview ? (
                <div className="flex flex-col gap-3 max-w-md mx-auto">
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Issue preview"
                      className="w-full max-h-[200px] object-cover"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 font-semibold transition-colors"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                  >
                    Remove Photo
                  </Button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-4 transition-all duration-200 ${
                    isDragging
                      ? 'border-[#0969da] bg-[#0969da]/10'
                      : 'border-border hover:bg-muted/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-foreground">Upload photo</span>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG</p>
                  </div>
                  <div className="flex flex-col sm:flex-row w-full gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setCameraMode('image')
                        setIsCameraOpen(true)
                      }}
                    >
                      Take Photo
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="flex-1"
                      onClick={() => fileRef.current?.click()}
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Upload video <span className="text-muted-foreground font-normal text-xs">(Admin only)</span></label>
              {videoPreview ? (
                <div className="flex flex-col gap-3 max-w-md mx-auto">
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <video
                      src={videoPreview}
                      controls
                      className="w-full max-h-[200px] object-cover"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 font-semibold transition-colors"
                    onClick={() => { setVideoFile(null); setVideoPreview(null) }}
                  >
                    Remove Video
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-4 transition-all duration-200 border-border hover:bg-muted/10"
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Video className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-foreground">Upload video</span>
                    <p className="text-xs text-muted-foreground mt-1">MP4, WebM up to 20MB</p>
                  </div>
                  <div className="flex flex-col sm:flex-row w-full gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setCameraMode('video')
                        setIsCameraOpen(true)
                      }}
                    >
                      Record
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="flex-1"
                      onClick={() => videoRef.current?.click()}
                    >
                      Browse
                    </Button>
                  </div>
                </div>
              )}
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
            </div>
          </div>

          {/* Location Section */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Issue location
              <span className="ml-2 text-xs font-normal text-muted-foreground">(helps route to the right department)</span>
            </label>

            <AnimatePresence mode="wait">
              {coordinates ? (
                <motion.div
                  key="location-set"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3 bg-[#2da44e]/8 border border-[#2da44e]/25 rounded-xl px-4 py-3"
                >
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-[#2da44e]/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#2da44e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#2da44e] mb-0.5">
                      {locationMode === 'gps' ? 'GPS Location Captured' : 'Map Location Set'}
                    </p>
                    <p className="text-sm text-foreground font-medium truncate">{coordinates.address}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setCoordinates(null); setLocationMode('none') }}
                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
                    title="Clear location"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="location-picker"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {/* Option 1 - GPS */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isGettingGPS}
                    aria-label="Use current GPS location"
                    className="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card hover:border-[#0969da]/50 hover:bg-[#0969da]/5 transition-all duration-200 p-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#0969da] focus-visible:outline-none"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#0969da]/10 border border-[#0969da]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      {isGettingGPS ? (
                        <Loader2 className="w-5 h-5 text-[#0969da] animate-spin" />
                      ) : (
                        <Navigation className="w-5 h-5 text-[#0969da]" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {isGettingGPS ? 'Getting location...' : 'Use current location'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Auto-detect via GPS</p>
                    </div>
                  </button>

                  {/* Option 2 - Map picker */}
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    aria-label="Choose location on map"
                    className="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card hover:border-[#2da44e]/50 hover:bg-[#2da44e]/5 transition-all duration-200 p-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2da44e] focus-visible:outline-none"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#2da44e]/10 border border-[#2da44e]/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                      <Map className="w-5 h-5 text-[#2da44e]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground leading-snug">Choose on map</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Tap to pin exact spot</p>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Submit */}
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

      {/* Location picker map dialog */}
      <LocationPickerPanel
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        initialLocation={coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : null}
        onConfirm={handleMapConfirm}
      />

      {/* Webcam modal */}
      <WebcamModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        mode={cameraMode}
        onCapture={(file) => {
          if (cameraMode === 'image') handleImageSelect(file)
          else handleVideoSelect(file)
        }}
      />
    </div>
  )
}