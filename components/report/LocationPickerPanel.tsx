'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2, Check, Navigation } from 'lucide-react'
import type { PickedLocation } from './LocationPickerInner'

const LocationPickerInner = dynamic(() => import('./LocationPickerInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117] rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#2da44e] animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Loading map engine...</span>
      </div>
    </div>
  ),
})

interface Props {
  isOpen: boolean
  onClose: () => void
  initialLocation: PickedLocation | null
  onConfirm: (loc: PickedLocation, address: string) => void
}

export function LocationPickerPanel({ isOpen, onClose, initialLocation, onConfirm }: Props) {
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(initialLocation)
  const [isGeocoding, setIsGeocoding] = useState(false)
  // Delay Leaflet mount until the Dialog's DOM transition has committed the container.
  // Without this, MapContainer's appendChild call fails because _container is still undefined.
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPickedLocation(initialLocation)
      const t = setTimeout(() => setShowMap(true), 100)
      return () => clearTimeout(t)
    } else {
      setShowMap(false)
    }
  }, [isOpen])

  async function handleConfirm() {
    if (!pickedLocation) return
    setIsGeocoding(true)
    try {
      const res = await fetch(`/api/geocode?lat=${pickedLocation.lat}&lng=${pickedLocation.lng}`)
      const data = await res.json()
      const address = data.address || `${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)}`
      onConfirm(pickedLocation, address)
      onClose()
    } catch {
      onConfirm(pickedLocation, `${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)}`)
      onClose()
    } finally {
      setIsGeocoding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-background border-border text-foreground w-[95vw] max-w-3xl sm:max-w-3xl p-0 rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2da44e]/10 border border-[#2da44e]/20 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#2da44e]" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground leading-none">
                Choose Issue Location
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                {pickedLocation
                  ? `Pin set at ${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)}`
                  : 'Tap anywhere on the map to drop a pin'}
              </DialogDescription>
            </div>
          </div>

          <Button
            size="sm"
            disabled={!pickedLocation || isGeocoding}
            onClick={handleConfirm}
            className="bg-[#2da44e] hover:bg-[#2c974b] text-white text-xs h-8 px-4 rounded-lg disabled:opacity-40 font-semibold"
          >
            {isGeocoding ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isGeocoding ? 'Locating...' : 'Confirm Location'}
          </Button>
        </div>

        {/* Map area */}
        <div className="relative" style={{ height: 'calc(85vh - 73px)' }}>
          {showMap ? (
            <LocationPickerInner
              key={isOpen ? 'open' : 'closed'}
              initialLocation={initialLocation}
              onLocationPick={setPickedLocation}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-[#2da44e]/20 border-t-[#2da44e] animate-spin" />
                <p className="text-sm font-semibold text-foreground">Loading map...</p>
              </div>
            </div>
          )}

          {/* Small non-blocking hint — top of map, disappears after pin placed */}
          {!pickedLocation && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
              <div className="flex items-center gap-2 bg-[#0d1117]/90 border border-[#30363d] rounded-full px-4 py-2 shadow-lg backdrop-blur-sm whitespace-nowrap">
                <Navigation className="w-3.5 h-3.5 text-[#2da44e] shrink-0" />
                <p className="text-[11px] font-semibold text-[#e6edf3]">Tap the map to drop a pin</p>
              </div>
            </div>
          )}

          {/* Legend bottom-left */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-[#0d1117]/90 border border-[#30363d] rounded-xl px-3 py-2.5 backdrop-blur-sm shadow-lg">
            <p className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider mb-2">Map Legend</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[10px] text-[#e6edf3] font-medium">
                <div className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/10" style={{ background: '#2da44e' }} />
                Selected location
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#8b949e]">
                Drag pin to adjust
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}