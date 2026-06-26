'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface PickedLocation {
  lat: number
  lng: number
}

interface Props {
  initialLocation: PickedLocation | null
  onLocationPick: (loc: PickedLocation) => void
}

// ------------------------------------------------------------------
// Pin icon
// ------------------------------------------------------------------
function makePickedIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
    html: `
      <div style="position:relative;width:32px;height:32px">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(45,164,78,0.18);
          animation:lp-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(-45deg);
          width:28px;height:28px;
          background:#2da44e;
          border-radius:50% 50% 50% 0;
          border:2.5px solid #0d1117;
          box-shadow:0 3px 12px rgba(45,164,78,0.55);
          display:flex;align-items:center;justify-content:center;
        ">
          <div style="transform:rotate(45deg);color:#fff;font-size:14px;font-weight:700;line-height:1">+</div>
        </div>
      </div>
      <style>
        @keyframes lp-pulse {
          0%  { transform:scale(1);   opacity:.8 }
          60% { transform:scale(2.2); opacity:0  }
          100%{ transform:scale(1);   opacity:0  }
        }
      </style>`,
  })
}

// ------------------------------------------------------------------
// Click-to-place + drag layer
// ------------------------------------------------------------------
function PickLayer({
  initialLocation,
  onLocationPick,
}: {
  initialLocation: PickedLocation | null
  onLocationPick: (loc: PickedLocation) => void
}) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const icon = useRef(makePickedIcon())

  function placeMarker(lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: icon.current,
        draggable: true,
      }).addTo(map)

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng()
        onLocationPick({ lat: pos.lat, lng: pos.lng })
      })
    }
    onLocationPick({ lat, lng })
  }

  useEffect(() => {
    if (initialLocation) {
      placeMarker(initialLocation.lat, initialLocation.lng)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMapEvents({
    click(e) {
      placeMarker(e.latlng.lat, e.latlng.lng)
    },
  })

  return null
}

// ------------------------------------------------------------------
// Locate-me control - renders a GPS button in the bottom-right slot
// Uses a Leaflet Control container + React portal so it can call useMap()
// ------------------------------------------------------------------
function LocateMeControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [controlContainer, setControlContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const LocateControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'lp-locate-control')
        // Stop map interactions from firing when the button is clicked
        L.DomEvent.disableClickPropagation(div)
        L.DomEvent.disableScrollPropagation(div)
        return div
      },
    })
    const ctrl = new LocateControl({ position: 'bottomright' }) as L.Control & { getContainer(): HTMLElement }
    ctrl.addTo(map)
    setControlContainer(ctrl.getContainer())
    return () => { ctrl.remove() }
  }, [map])

  function handleLocate() {
    if (locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, {
          animate: true,
          duration: 0.8,
        })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  if (!controlContainer) return null

  return createPortal(
    <button
      onClick={handleLocate}
      title="Center on my location"
      style={{
        width: 36,
        height: 36,
        background: '#161b22',
        border: '2px solid #30363d',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: locating ? 'default' : 'pointer',
        marginBottom: 10,
        marginRight: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.55)',
        color: locating ? '#8b949e' : '#2da44e',
        transition: 'color 0.2s, box-shadow 0.2s',
        outline: 'none',
      }}
      onMouseEnter={e => { if (!locating) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(45,164,78,0.25), 0 2px 10px rgba(0,0,0,0.55)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.55)' }}
    >
      {locating ? (
        /* Spinning arc while locating */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
          <path d="M12 3 A9 9 0 0 1 21 12" strokeOpacity="1" style={{ animation: 'lp-spin 0.9s linear infinite' }} />
        </svg>
      ) : (
        /* Crosshair icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2"  x2="12" y2="7"  />
          <line x1="12" y1="17" x2="12" y2="22" />
          <line x1="2"  y1="12" x2="7"  y2="12" />
          <line x1="17" y1="12" x2="22" y2="12" />
        </svg>
      )}
    </button>,
    controlContainer
  )
}

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------
const NASHIK_CENTER: [number, number] = [19.9975, 73.7898]

export default function LocationPickerInner({ initialLocation, onLocationPick }: Props) {
  const center: [number, number] = initialLocation
    ? [initialLocation.lat, initialLocation.lng]
    : NASHIK_CENTER

  return (
    <>
      <style>{`
        .leaflet-container { background: #0d1117 !important; cursor: crosshair !important; }
        .leaflet-tile { filter: brightness(0.92) saturate(1.1); }
        .lp-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          border-radius: 10px !important;
          padding: 0 !important;
        }
        .lp-popup .leaflet-popup-content { margin: 0 !important; }
        .lp-popup .leaflet-popup-tip-container { display: none; }
        .leaflet-control-attribution {
          background: rgba(13,17,23,0.8) !important;
          color: #8b949e !important;
          font-size: 9px !important;
          border-radius: 6px 0 0 0 !important;
        }
        .leaflet-control-attribution a { color: #8b949e !important; }
        .leaflet-control-zoom a {
          background: #161b22 !important;
          color: #e6edf3 !important;
          border-color: #30363d !important;
        }
        .leaflet-control-zoom a:hover { background: #21262d !important; }
        .lp-locate-control { background: transparent !important; border: none !important; }
        @keyframes lp-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: '100%', height: '100%', borderRadius: '12px' }}
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <PickLayer
          initialLocation={initialLocation}
          onLocationPick={onLocationPick}
        />
        <LocateMeControl />
      </MapContainer>
    </>
  )
}