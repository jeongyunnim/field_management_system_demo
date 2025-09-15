import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

const PMTILES_URL = '/data/korea.pmtiles' // 여기에 로컬 PMTiles 파일을 두세요

async function fileExists(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

export default function MapPanel() {
  const mapRef = useRef<Map | null>(null)
  const elRef = useRef<HTMLDivElement | null>(null)
  const [usePmtiles, setUsePmtiles] = useState(false)

  useEffect(() => {
    let cancelled = false
    fileExists(PMTILES_URL).then((ok) => {
      if (!cancelled) setUsePmtiles(ok)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!elRef.current || mapRef.current) return

    // PMTiles 프로토콜 등록
    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const style = usePmtiles
      ? {
          version: 8,
          sources: {
            // PMTiles 벡터 소스
            'pmtiles-source': {
              type: 'vector',
              url: `pmtiles://${PMTILES_URL}`
            }
          },
          layers: [
            // 간단한 벡터 레이어 (실무에선 스타일 JSON을 사용)
            {
              id: 'land',
              type: 'fill',
              source: 'pmtiles-source',
              'source-layer': 'land', // PMTiles의 레이어 이름에 맞게 수정 필요
              paint: { 'fill-color': '#e5f5e0' }
            }
          ]
        }
      : {
          version: 8,
          sources: {
            // OSM 래스터 타일
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            { id: 'osm', type: 'raster', source: 'osm-tiles' }
          ]
        }

    const map = new maplibregl.Map({
      container: elRef.current,
      style,
      center: [126.9784, 37.5667], // 서울
      zoom: 10
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      // PMTiles 프로토콜 제거(선택)
      // @ts-expect-error - removeProtocol은 타입 정의에 없음
      maplibregl.removeProtocol && maplibregl.removeProtocol('pmtiles')
    }
  }, [usePmtiles])

  return <div ref={elRef} className="w-full h-full" />
}
