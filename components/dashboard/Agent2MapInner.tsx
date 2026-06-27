'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Issue } from '@/lib/db/types'

// Helper to parse EWKB Point from Supabase
function parseLocation(loc: any): { lat: number, lng: number } | null {
  if (!loc) return null;
  if (typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return loc;
  }
  if (typeof loc === 'string' && loc.length === 50) {
    try {
      const bytes = new Uint8Array(25);
      for (let i = 0; i < 25; i++) {
        bytes[i] = parseInt(loc.substr(i * 2, 2), 16);
      }
      const view = new DataView(bytes.buffer);
      const isLittleEndian = bytes[0] === 1;
      const lng = view.getFloat64(9, isLittleEndian);
      const lat = view.getFloat64(17, isLittleEndian);
      return { lat, lng };
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface Props {
  issue: Issue
  allIssues: Issue[]
}

// ------------------------------------------------------------------
// Category colour palette
// ------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, { pin: string; circle: string; fill: string }> = {
  infrastructure: { pin: '#0969da', circle: '#0969da', fill: '#0969da22' },
  sanitation:     { pin: '#34d399', circle: '#34d399', fill: '#34d39922' },
  safety:         { pin: '#f87171', circle: '#f87171', fill: '#f8717122' },
  utility:        { pin: '#fbbf24', circle: '#fbbf24', fill: '#fbbf2422' },
  environment:    { pin: '#2dd4bf', circle: '#2dd4bf', fill: '#2dd4bf22' },
}
const DEFAULT_COLOR = { pin: '#94a3b8', circle: '#94a3b8', fill: '#94a3b822' }

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? DEFAULT_COLOR
}

function makePinIcon(category: string, isCenter: boolean = false): L.DivIcon {
  const { pin } = getCategoryColor(category)
  const size = isCenter ? 24 : 16
  const border = isCenter ? `2px solid #fff` : `1px solid #0d1117`
  
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          width:${size}px;height:${size}px;
          background:${pin};
          border-radius:50%;
          border:${border};
          box-shadow:0 2px 8px rgba(0,0,0,0.8);
        "></div>
      </div>`,
  })
}

// ------------------------------------------------------------------
// Radar overlay icon
// ------------------------------------------------------------------
function RadarLayer({ centerIssue, allIssues }: { centerIssue: Issue; allIssues: Issue[] }) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!map) return
    if (layerGroupRef.current) {
      layerGroupRef.current.clearLayers()
    } else {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }
    const lg = layerGroupRef.current

    // Add CSS for radar
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes radar-pulse {
        0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
      }
      .radar-marker {
        pointer-events: none;
      }
    `
    document.head.appendChild(style)

    const colors = getCategoryColor(centerIssue.category)

    const centerLoc = parseLocation(centerIssue.location)
    if (!centerLoc) return

    // 1. Draw the static circle (200m)
    L.circle([centerLoc.lat, centerLoc.lng], {
      radius: 200,
      color: colors.pin,
      fillColor: colors.pin,
      fillOpacity: 0.1,
      weight: 1.5,
      opacity: 0.8,
      dashArray: '4 4'
    }).addTo(lg)

    // 2. Draw the outward pulses using a custom overlay
    // At zoom 16 near equator, 1 meter is roughly 1.3 pixels. So 200m radius = ~260px radius.
    const radiusPx = 280; 
    const radarIcon = L.divIcon({
      className: 'radar-marker',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: `
        <div style="position: absolute; left: 0; top: 0;">
          <!-- Outward pulses -->
          <div style="
            position: absolute;
            width: ${radiusPx * 2}px;
            height: ${radiusPx * 2}px;
            border-radius: 50%;
            border: 2px solid ${colors.pin};
            animation: radar-pulse 3s ease-out infinite;
          "></div>
          <div style="
            position: absolute;
            width: ${radiusPx * 2}px;
            height: ${radiusPx * 2}px;
            border-radius: 50%;
            border: 2px solid ${colors.pin};
            animation: radar-pulse 3s ease-out infinite;
            animation-delay: 1.5s;
          "></div>
        </div>
      `
    })

    L.marker([centerLoc.lat, centerLoc.lng], { icon: radarIcon, zIndexOffset: -100 }).addTo(lg)

    // 3. Render all other issues
    const MAX_DIST_DEG = 0.01 
    const nearby = allIssues.filter(i => {
      if (i.id === centerIssue.id) return false
      const loc = parseLocation(i.location)
      if (!loc) return false
      return Math.abs(loc.lat - centerLoc.lat) < MAX_DIST_DEG &&
             Math.abs(loc.lng - centerLoc.lng) < MAX_DIST_DEG
    })

    for (const issue of nearby) {
      const loc = parseLocation(issue.location)
      if (!loc) continue

      const dLat = (loc.lat - centerLoc.lat) * 111320
      const dLng = (loc.lng - centerLoc.lng) * 111320 * Math.cos(centerLoc.lat * Math.PI / 180)
      const dist = Math.sqrt(dLat * dLat + dLng * dLng)

      // Add tiny jitter if they are perfectly stacked (distance < 5m)
      // so they can be seen slightly offset from the center pin
      let renderLat = loc.lat
      let renderLng = loc.lng
      if (dist < 5) {
        // ~15 meters of jitter
        renderLat += (Math.random() - 0.5) * 0.0003
        renderLng += (Math.random() - 0.5) * 0.0003
      }

      const isInside = dist <= 200

      const marker = L.marker([renderLat, renderLng], {
        icon: makePinIcon(issue.category, false),
      })
      marker.addTo(lg)

      if (isInside) {
        L.polyline(
          [
            [centerLoc.lat, centerLoc.lng],
            [renderLat, renderLng]
          ], 
          { color: colors.pin, weight: 1, dashArray: '2 4', opacity: 0.7 }
        ).addTo(lg)
      }
    }

    // 4. Finally render the center issue
    L.marker([centerLoc.lat, centerLoc.lng], {
      icon: makePinIcon(centerIssue.category, true),
      zIndexOffset: 1000
    }).addTo(lg)

    return () => {
      style.remove()
      layerGroupRef.current?.clearLayers()
    }
  }, [centerIssue, allIssues, map])

  return null
}

export default function Agent2MapInner({ issue, allIssues }: Props) {
  const centerLoc = parseLocation(issue.location)

  // Wait until we have a valid location before trying to render the map
  if (!centerLoc) return null

  const center: [number, number] = [centerLoc.lat, centerLoc.lng]

  return (
    <>
      <style>{`
        .leaflet-container { background: #0d1117 !important; }
        .leaflet-tile { filter: brightness(0.7) saturate(1.1); }
        .leaflet-control-attribution { display: none !important; }
      `}</style>
      <MapContainer
        center={center}
        zoom={16}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        touchZoom={true}
        attributionControl={false}
        style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <RadarLayer centerIssue={issue} allIssues={allIssues} />
      </MapContainer>
    </>
  )
}
