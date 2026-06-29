'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface MapIssue {
  id: string
  title: string
  category: string
  status: string
  address: string
  location: { lat: number; lng: number }
  cluster_id: string | null
  severity: number
}

interface Props {
  issues: MapIssue[]
  userLocation: { lat: number; lng: number } | null
}

// ------------------------------------------------------------------
// Category colour palette — mirrors DashboardClient CATEGORY_DETAILS
// ------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, { pin: string; circle: string; fill: string }> = {
  infrastructure: { pin: '#0969da', circle: '#0969da', fill: '#0969da22' },
  sanitation: { pin: '#34d399', circle: '#34d399', fill: '#34d39922' },
  safety: { pin: '#f87171', circle: '#f87171', fill: '#f8717122' },
  utility: { pin: '#fbbf24', circle: '#fbbf24', fill: '#fbbf2422' },
  environment: { pin: '#2dd4bf', circle: '#2dd4bf', fill: '#2dd4bf22' },
}
const DEFAULT_COLOR = { pin: '#94a3b8', circle: '#94a3b8', fill: '#94a3b822' }

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? DEFAULT_COLOR
}

// ------------------------------------------------------------------
// Custom pin SVG div-icon
// ------------------------------------------------------------------
function makePinIcon(category: string, count?: number, status?: string): L.DivIcon {
  const { pin } = getCategoryColor(category)
  const size = count ? 30 : 22
  const isCommunityReview = status === 'community_review' && !count

  const inner = count
    ? `<span style="color:#fff;font-size:11px;font-weight:700;line-height:1;margin-bottom:2px;margin-left:2px">${count}</span>`
    : `<div style="width:8px;height:8px;background:#fff;border-radius:50%;margin-bottom:2px;margin-left:2px"></div>`

  const glowRing = isCommunityReview
    ? `<div style="
        position:absolute;inset:-8px;border-radius:50%;
        background:rgba(234,88,12,0.3);
        animation:review-pulse 2s infinite;
        pointer-events:none;
      "></div>`
    : ''

  const border = isCommunityReview ? '2px solid #ea580c' : '2px solid #0d1117'

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${glowRing}
        <div style="
          width:${size}px;height:${size}px;
          background:${pin};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:${border};
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          display:flex;align-items:center;justify-content:center;
          position:relative;
          z-index:1;
        ">
          <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;width:100%;height:100%">
            ${inner}
          </div>
        </div>
      </div>
      <style>
        @keyframes review-pulse{
          0%{transform:scale(0.8);opacity:.8}
          70%{transform:scale(1.8);opacity:0}
          100%{transform:scale(0.8);opacity:0}
        }
      </style>`,
  })
}

// ------------------------------------------------------------------
// User location pulse icon
// ------------------------------------------------------------------
const USER_ICON = L.divIcon({
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `
    <div style="position:relative;width:20px;height:20px">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(45,164,78,0.2);
        animation:pulse-ring 2s infinite;
      "></div>
      <div style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:12px;height:12px;border-radius:50%;
        background:#2da44e;border:2px solid #0d1117;
        box-shadow:0 0 8px rgba(45,164,78,0.6);
      "></div>
    </div>
    <style>
      @keyframes pulse-ring{
        0%{transform:scale(1);opacity:.8}
        70%{transform:scale(2);opacity:0}
        100%{transform:scale(1);opacity:0}
      }
    </style>`,
})

// ------------------------------------------------------------------
// Cluster / standalone issue computation
// ------------------------------------------------------------------
interface ClusterGroup {
  cluster_id: string
  category: string
  issues: MapIssue[]
  centroid: { lat: number; lng: number }
  radius: number // metres
}

function computeClusters(issues: MapIssue[]): {
  clusters: ClusterGroup[]
  standalone: MapIssue[]
} {
  const clusterMap: Record<string, MapIssue[]> = {}

  for (const issue of issues) {
    if (issue.cluster_id) {
      if (!clusterMap[issue.cluster_id]) clusterMap[issue.cluster_id] = []
      clusterMap[issue.cluster_id].push(issue)
    }
  }

  const clusters: ClusterGroup[] = []
  const clusteredIds = new Set<string>()

  for (const [cid, members] of Object.entries(clusterMap)) {
    if (members.length < 2) continue // treat single-member "clusters" as standalone
    members.forEach((m) => clusteredIds.add(m.id))

    const avgLat = members.reduce((s, m) => s + m.location.lat, 0) / members.length
    const avgLng = members.reduce((s, m) => s + m.location.lng, 0) / members.length

    // Radius = max distance from centroid to any member, floored at 80 m
    const radius = Math.max(
      80,
      ...members.map((m) => {
        const dLat = (m.location.lat - avgLat) * 111320
        const dLng = (m.location.lng - avgLng) * 111320 * Math.cos((avgLat * Math.PI) / 180)
        return Math.sqrt(dLat * dLat + dLng * dLng)
      })
    )

    // Dominant category = most common among members
    const catCounts: Record<string, number> = {}
    members.forEach((m) => {
      catCounts[m.category] = (catCounts[m.category] ?? 0) + 1
    })
    const dominantCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]

    clusters.push({
      cluster_id: cid,
      category: dominantCat,
      issues: members,
      centroid: { lat: avgLat, lng: avgLng },
      radius,
    })
  }

  const standalone = issues.filter((i) => !clusteredIds.has(i.id))
  return { clusters, standalone }
}

// ------------------------------------------------------------------
// Layer renderer — runs inside <MapContainer> so it can call useMap()
// ------------------------------------------------------------------
function IssueLayer({
  issues,
  userLocation,
}: {
  issues: MapIssue[]
  userLocation: { lat: number; lng: number } | null
}) {
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

    const { clusters, standalone } = computeClusters(issues)

    // ---- Clustered groups ----
    for (const cluster of clusters) {
      const colors = getCategoryColor(cluster.category)

      // Circle
      L.circle([cluster.centroid.lat, cluster.centroid.lng], {
        radius: cluster.radius,
        color: colors.circle,
        fillColor: colors.fill,
        fillOpacity: 0.18,
        weight: 1.5,
        opacity: 0.55,
        dashArray: '4 4',
      }).addTo(lg)

      // Centroid marker with count badge
      const marker = L.marker([cluster.centroid.lat, cluster.centroid.lng], {
        icon: makePinIcon(cluster.category, cluster.issues.length),
      })

      marker.bindPopup(
        `<div style="
          font-family:system-ui,sans-serif;
          background:#161b22;color:#e6edf3;
          border:1px solid #30363d;border-radius:10px;
          padding:10px 14px;min-width:180px;
        ">
          <div style="font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
            ${cluster.issues.length} Clustered Reports
          </div>
          <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px">
            ${cluster.issues
          .slice(0, 5)
          .map(
            (i) =>
              `<li style="font-size:12px;font-weight:600;color:#e6edf3;padding:3px 0;border-bottom:1px solid #21262d">${i.title || i.category}</li>`
          )
          .join('')}
            ${cluster.issues.length > 5 ? `<li style="font-size:11px;color:#8b949e;padding-top:2px">+${cluster.issues.length - 5} more…</li>` : ''}
          </ul>
        </div>`,
        { className: 'civic-popup' }
      )
      marker.addTo(lg)
    }

    // ---- Standalone pins ----
    for (const issue of standalone) {
      const marker = L.marker([issue.location.lat, issue.location.lng], {
        icon: makePinIcon(issue.category, undefined, issue.status),
      })

      const { pin } = getCategoryColor(issue.category)
      marker.bindPopup(
        `<div style="
          font-family:system-ui,sans-serif;
          background:#161b22;color:#e6edf3;
          border:1px solid #30363d;border-radius:10px;
          padding:10px 14px;min-width:160px;max-width:220px;
        ">
          <div style="
            display:inline-block;font-size:10px;font-weight:700;
            color:${pin};background:${pin}18;border:1px solid ${pin}44;
            border-radius:9999px;padding:2px 8px;text-transform:capitalize;
            margin-bottom:6px;letter-spacing:.03em;margin-right:6px;
          ">${issue.category}</div>
          ${issue.status === 'community_review'
          ? `<div style="
                  display:inline-block;font-size:10px;font-weight:700;
                  color:#ea580c;background:#ea580c18;border:1px solid #ea580c44;
                  border-radius:9999px;padding:2px 8px;text-transform:uppercase;
                  margin-bottom:6px;letter-spacing:.03em
                ">Pending Verification</div>`
          : ''
        }
          <div style="font-size:12px;font-weight:700;color:#e6edf3;line-height:1.4">${issue.title || issue.category}</div>
          <div style="font-size:11px;color:#8b949e;margin-top:4px">${issue.address || ''}</div>
        </div>`,
        { className: 'civic-popup' }
      )
      marker.addTo(lg)
    }

    // ---- User location marker ----
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], { icon: USER_ICON })
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600">📍 Your Location</div>`,
          { className: 'civic-popup' }
        )
        .addTo(lg)
    }

    return () => {
      layerGroupRef.current?.clearLayers()
    }
  }, [issues, userLocation, map])

  return null
}

// ------------------------------------------------------------------
// Locate-me control - renders a GPS button in the bottom-right slot
// ------------------------------------------------------------------
function LocateMeControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [controlContainer, setControlContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const LocateControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'lp-locate-control')
        L.DomEvent.disableClickPropagation(div)
        L.DomEvent.disableScrollPropagation(div)
        return div
      },
    })
    const ctrl = new LocateControl({ position: 'bottomright' }) as L.Control & { getContainer(): HTMLElement }
    ctrl.addTo(map)
    setControlContainer(ctrl.getContainer() ?? null)
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
          <path d="M12 3 A9 9 0 0 1 21 12" strokeOpacity="1" style={{ animation: 'lp-spin 0.9s linear infinite' }} />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="7" />
          <line x1="12" y1="17" x2="12" y2="22" />
          <line x1="2" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="22" y2="12" />
        </svg>
      )}
    </button>,
    controlContainer
  )
}

// ------------------------------------------------------------------
// Main export — the full Leaflet map (dynamically imported, no SSR)
// ------------------------------------------------------------------
const NASHIK_CENTER: [number, number] = [19.9975, 73.7898]

export default function IssueMapInner({ issues, userLocation }: Props) {
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : NASHIK_CENTER

  return (
    <>
      {/* Inject global styles for Leaflet popup chrome */}
      <style>{`
        .leaflet-container { background: #0d1117 !important; }
        .leaflet-tile { filter: brightness(0.92) saturate(1.1); }
        .civic-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          border-radius: 10px !important;
          padding: 0 !important;
        }
        .civic-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .civic-popup .leaflet-popup-tip-container { display: none; }
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
        .leaflet-control-zoom a:hover {
          background: #21262d !important;
        }
        .lp-locate-control { background: transparent !important; border: none !important; }
        @keyframes lp-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
      <MapContainer
        center={center}
        zoom={13}
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
        <IssueLayer issues={issues} userLocation={userLocation} />
        <LocateMeControl />
      </MapContainer>
    </>
  )
}
