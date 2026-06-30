'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import polyline from '@mapbox/polyline'

const NASHIK_CENTER: [number, number] = [19.9975, 73.7898]

interface Props {
  clusters: any[]
  selectedClusterId: string | null
  userLocation: { lat: number; lng: number } | null
  activeRoute: any | null
}

const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: '#0969da',
  sanitation: '#34d399',
  safety: '#f87171',
  utility: '#fbbf24',
  environment: '#2dd4bf',
}

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || '#94a3b8'
}

function makePinIcon(color: string, number?: number): L.DivIcon {
  const size = 28
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          width:${size}px;height:${size}px;
          background:${color};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2px solid #0d1117;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          display:flex;align-items:center;justify-content:center;
          position:relative;
          z-index:1;
        ">
          <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font-size:10px;font-weight:bold;">
            ${number !== undefined ? number : ''}
          </div>
        </div>
      </div>`,
  })
}

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

function RouteLayer({ clusters, selectedClusterId, userLocation, activeRoute }: Props) {
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

    const bounds = L.latLngBounds([])

    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], { icon: USER_ICON }).addTo(lg)
      // Include user location in auto-zoom bounds only if no cluster is selected, OR if an active route is showing (since it starts from the user)
      if (!selectedClusterId || activeRoute) {
        bounds.extend([userLocation.lat, userLocation.lng])
      }
    }

    clusters.forEach((cluster, clusterIndex) => {
      const isSelected = cluster.id === selectedClusterId
      const opacity = isSelected ? 1 : 0.3

      let orderedIssues = cluster.issues
      if (isSelected && activeRoute?.optimizedWaypointIndices) {
        const mapped = activeRoute.optimizedWaypointIndices.map((i: number) => cluster.issues[i]).filter(Boolean)
        if (mapped.length === cluster.issues.length && mapped.length > 0) {
          orderedIssues = mapped
        }
      }

      orderedIssues.forEach((issue: any, i: number) => {
        const color = getCategoryColor(issue.category)
        const number = isSelected && activeRoute ? i + 1 : undefined
        const marker = L.marker([issue.location.lat, issue.location.lng], {
          icon: makePinIcon(color, number),
          opacity
        })

        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:8px;font-size:11px;">
             <strong>${issue.title || issue.category}</strong><br/>
             <span style="color:#8b949e">${issue.address}</span>
          </div>
        `, { className: 'civic-popup' })

        marker.addTo(lg)
        // Auto-zoom to this issue if its cluster is selected, or if nothing is selected (zoom to see all city issues)
        if (isSelected || !selectedClusterId) {
          bounds.extend([issue.location.lat, issue.location.lng])
        }
      })
    })

    if (activeRoute && activeRoute.encodedPolyline) {
      try {
        const decoded = polyline.decode(activeRoute.encodedPolyline)
        L.polyline(decoded, {
          color: '#0969da',
          weight: 5,
          opacity: 0.8,
          dashArray: '10 5'
        }).addTo(lg)
      } catch (e) {
        console.error('Failed to decode polyline', e)
      }
    }

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 })
    }

  }, [clusters, selectedClusterId, userLocation, activeRoute, map])

  return null
}

export default function RoutePlannerMapInner(props: Props) {
  const center: [number, number] = props.userLocation
    ? [props.userLocation.lat, props.userLocation.lng]
    : NASHIK_CENTER

  return (
    <>
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
        .civic-popup .leaflet-popup-content { margin: 0 !important; }
        .civic-popup .leaflet-popup-tip-container { display: none; }
      `}</style>
      <MapContainer
        key="route-planner-map"
        center={center}
        zoom={13}
        style={{ width: '100%', height: '100%', borderRadius: '0' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <RouteLayer {...props} />
      </MapContainer>
    </>
  )
}
