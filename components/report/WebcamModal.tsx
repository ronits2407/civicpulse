'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, Video as VideoIcon, StopCircle } from 'lucide-react'

interface WebcamModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'image' | 'video'
  onCapture: (file: File) => void
}

export function WebcamModal({ isOpen, onClose, mode, onCapture }: WebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const stopAllTracks = (s: MediaStream | null) => {
    if (s) {
      s.getTracks().forEach(t => {
        t.stop()
      })
    }
  }

  useEffect(() => {
    let mounted = true
    let currentStream: MediaStream | null = null

    const initStream = async () => {
      // If there's already a stream in state, stop it to be safe
      if (stream) {
        stopAllTracks(stream)
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: mode === 'video',
        })
      } catch (err) {
        try {
          currentStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: mode === 'video',
          })
        } catch (e) {
          console.error('Failed to get camera', e)
        }
      }

      if (!mounted && currentStream) {
        stopAllTracks(currentStream)
        return
      }

      if (currentStream) {
        setStream(currentStream)
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream
          videoRef.current.play().catch(console.error)
        }
      }
    }

    if (isOpen) {
      initStream()
    }

    return () => {
      mounted = false
      if (currentStream) stopAllTracks(currentStream)
      if (stream) stopAllTracks(stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setStream(null)
    }
  }, [isOpen, mode])

  const takePhoto = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
            onCapture(file)
            onClose()
          }
        }, 'image/jpeg', 0.9)
      }
    }
  }

  const startRecording = () => {
    if (stream) {
      chunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' })
        onCapture(file)
        onClose()
      }

      mediaRecorder.start()
      setIsRecording(true)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'image' ? 'Take Photo' : 'Record Video'}
          </DialogTitle>
        </DialogHeader>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
          {!stream && <p className="text-white/50 text-sm">Accessing camera...</p>}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className="w-full h-full object-cover absolute inset-0"
          />
        </div>

        <div className="flex justify-center mt-4">
          {mode === 'image' ? (
            <Button onClick={takePhoto} className="rounded-full w-14 h-14 p-0 shadow-lg" size="icon">
              <Camera className="w-6 h-6" />
            </Button>
          ) : isRecording ? (
            <Button onClick={stopRecording} variant="destructive" className="rounded-full w-14 h-14 p-0 shadow-lg animate-pulse" size="icon">
              <StopCircle className="w-6 h-6" />
            </Button>
          ) : (
            <Button onClick={startRecording} className="rounded-full w-14 h-14 p-0 shadow-lg bg-red-500 hover:bg-red-600" size="icon">
              <VideoIcon className="w-6 h-6" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
