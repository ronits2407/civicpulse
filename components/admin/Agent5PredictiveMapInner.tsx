'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import polyline from '@mapbox/polyline'

const NASHIK_CENTER: [number, number] = [19.9975, 73.7898]

interface Props {
  clusters: any[]
  currentClusterId: string | null
  userLocation: { lat: number; lng: number } | null
  centerTrigger?: number
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

function makePinIcon(color: string, isCurrent: boolean): L.DivIcon {
  const size = isCurrent ? 36 : 28;
  const opacity = isCurrent ? 1 : 0.6;
  const pulseHtml = isCurrent ? `
    <div style="
      position:absolute;inset:-10px;border-radius:50%;
      background:${color}30;
      animation:pulse-ring 2s infinite;
      z-index:0;
    "></div>
  ` : '';

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;opacity:${opacity};transition:all 0.3s ease;">
        ${pulseHtml}
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
        </div>
      </div>
      <style>
        @keyframes pulse-ring{
          0%{transform:scale(1);opacity:.8}
          70%{transform:scale(2);opacity:0}
          100%{transform:scale(1);opacity:0}
        }
      </style>`,
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
    </div>`,
})

function PredictiveLayer(props: Props) {
  const { clusters, currentClusterId, userLocation } = props
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (props.centerTrigger && props.centerTrigger > 0 && props.userLocation && map) {
      map.flyTo([props.userLocation.lat, props.userLocation.lng], 14, { duration: 1 })
    }
  }, [props.centerTrigger, props.userLocation, map])

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
      if (!currentClusterId) {
        bounds.extend([userLocation.lat, userLocation.lng])
      }
    }

    clusters.forEach((cluster) => {
      const isCurrent = cluster.id === currentClusterId
      const opacity = isCurrent ? 1 : (currentClusterId ? 0.4 : 1)

      cluster.issues.forEach((issue: any) => {
        const color = getCategoryColor(issue.category)
        const marker = L.marker([issue.location.lat, issue.location.lng], {
          icon: makePinIcon(color, isCurrent),
          opacity
        })

        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:8px;font-size:11px;">
             <strong>${issue.title || issue.category}</strong><br/>
             <span style="color:#8b949e">${issue.address}</span>
          </div>
        `, { className: 'civic-popup' })

        marker.addTo(lg)
        
        // Auto-zoom logic
        if (isCurrent || !currentClusterId) {
          bounds.extend([issue.location.lat, issue.location.lng])
        }
      })
    })

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 })
    }

  }, [clusters, currentClusterId, userLocation, map])

  return null
}

export default function Agent5PredictiveMapInner(props: Props) {
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
        key="predictive-map"
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
        <PredictiveLayer {...props} />
      </MapContainer>
    </>
  )
}
