import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { MdMyLocation } from 'react-icons/md'

import { person, mapStyle } from '../data/person'
import { racePath } from '../data/route'
import { addRaceLanes, addRaceLayer, addSky, ensure3dBuildings } from '../lib/raceLayer'

// MapLibre tự tìm worker bằng `new URL('./maplibre-gl-worker.mjs', import.meta.url)`.
// Rollup không thấy được lời gọi đó nên không emit file -> bản build 404 và map
// treo mãi ở màn loading. Trỏ thẳng vào chunk worker do Vite bundle ra.
setWorkerUrl(maplibreWorkerUrl)

const VIEW = { zoom: 19, pitch: 75, bearing: -25 }
const BOOST_PER_TAP = 0.8
const MAX_BOOST = 8

export default function MapScene({ onArrived }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const isMobile = window.innerWidth <= 768

  // refs điều khiển vòng đua (đọc/ghi trong render loop, không gây re-render)
  const finishedRef = useRef(false)
  const countdownDoneRef = useRef(false)
  const countingRef = useRef(false)
  const boostRef = useRef(0)
  const gameOverRef = useRef(false)
  const readyRef = useRef(false)
  const spinRef = useRef(false)
  const resetRef = useRef(0)
  const timersRef = useRef([])

  const [arrived, setArrived] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [loseMessage, setLoseMessage] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [boosting, setBoosting] = useState(false)
  const [mobilePopup, setMobilePopup] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  // Vệt xe chạy 60fps -> ghi thẳng vào DOM, không qua setState để khỏi
  // re-render cả scene mỗi frame.
  const trailRef = useRef(null)
  const moveTrail = useCallback((pos) => {
    const el = trailRef.current
    if (el) el.style.transform = `translate3d(${pos.x + 50}px, ${pos.y - 20}px, 0)`
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  const runCountdown = useCallback(() => {
    if (countingRef.current) return
    countingRef.current = true
    setStarted(true)
    setCountdown(3)
    clearTimers()
    timersRef.current = [
      window.setTimeout(() => setCountdown(2), 1000),
      window.setTimeout(() => setCountdown(1), 2000),
      window.setTimeout(() => {
        setCountdown(null)
        countingRef.current = false
        countdownDoneRef.current = true
      }, 3000),
    ]
  }, [clearTimers])

  const boost = useCallback(() => {
    if (!readyRef.current || finishedRef.current || gameOverRef.current) return
    if (!countdownDoneRef.current) {
      runCountdown()
      return
    }
    boostRef.current = Math.min(boostRef.current + BOOST_PER_TAP, MAX_BOOST)
    setStarted(true)
    setBoosting(true)
    window.setTimeout(() => setBoosting(false), 140)
  }, [runCountdown])

  useEffect(() => {
    if (!containerRef.current) return
    // StrictMode chạy effect 2 lần trong dev -> nếu không chặn thì tải model 2 lượt.
    if (mapRef.current) return

    const venue = [person.location.lng, person.location.lat]
    const startLine = [racePath[0][0], racePath[0][1]]

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center: venue,
      ...VIEW,
      maxPitch: 85,
      antialias: true,
    })
    mapRef.current = map

    map.scrollZoom.disable()
    map.boxZoom.disable()
    map.dragRotate.disable()
    map.dragPan.disable()
    map.keyboard.disable()
    map.doubleClickZoom.disable()
    map.touchZoomRotate.disable()

    map.on('error', (e) => {
      console.error('[map]', e.error || e)
      setError(String(e.error?.message || e.error || 'map error'))
    })

    // Tiện lấy toạ độ khi muốn vẽ lại đường đua.
    map.on('click', (e) => console.log('lng:', e.lngLat.lng, 'lat:', e.lngLat.lat))

    // Trước khi vào đua: xoay vòng quanh địa điểm cho đẹp.
    const startOrbit = () => {
      spinRef.current = true
      const step = () => {
        if (!spinRef.current) return
        map.setBearing((map.getBearing() + 0.4) % 360)
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    // Models xong -> bay về vạch xuất phát, mở tutorial.
    const goToStartLine = () => {
      spinRef.current = false
      map.easeTo({ center: startLine, ...VIEW, duration: 2200 })
      readyRef.current = true
      setMapReady(true)
    }

    map.on('load', () => {
      try {
        addSky(map)
        ensure3dBuildings(map)
        addRaceLanes(map)
      } catch (err) {
        // Layer trang trí hỏng thì kệ, miễn là đường đua vẫn dựng được.
        console.error('[decor]', err)
      }

      addRaceLayer(map, {
        finishedRef,
        countdownDoneRef,
        boostRef,
        gameOverRef,
        resetRef,
        setArrived,
        setGameOver,
        setLoseMessage,
        setCarScreenPos: moveTrail,
        isMobile,
        onArrived,
        onModelsReady: goToStartLine,
        onProgress: setProgress,
      })
      startOrbit()

      const el = document.createElement('div')
      el.innerHTML = `
        <div class="marker-bounce">
          <div class="marker-pulse"></div>
          <div class="marker-pin"></div>
        </div>
      `
      new Marker({ element: el, anchor: 'bottom' }).setLngLat(venue).addTo(map)
    })

    return () => {
      spinRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) boost()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [boost])

  // Trên mobile popup "tới nơi" chỉ hiện 1.5s rồi tắt để nhường chỗ cho thiệp.
  useEffect(() => {
    if (!arrived || !isMobile) return
    setMobilePopup(true)
    const id = setTimeout(() => setMobilePopup(false), 1500)
    return () => clearTimeout(id)
  }, [arrived, isMobile])

  const restart = () => {
    clearTimers()
    finishedRef.current = false
    countdownDoneRef.current = false
    countingRef.current = false
    gameOverRef.current = false
    boostRef.current = 0
    resetRef.current += 1

    setArrived(false)
    setGameOver(false)
    setStarted(false)
    setBoosting(false)
    setCountdown(null)
    setMobilePopup(false)
    moveTrail({ x: -100, y: -100 })

    mapRef.current?.easeTo({
      center: [racePath[0][0], racePath[0][1]],
      ...VIEW,
      duration: 1200,
    })
    mapRef.current?.triggerRepaint()
  }

  const racingUiVisible = mapReady && !arrived && !gameOver

  return (
    <>
      <div ref={containerRef} className="map" />

      {!mapReady && (
        <div className="map-loading">
          <div className="map-loading__spinner" />
          <p>Đang tải đường đua... {Math.round(progress * 100)}%</p>
          <div className="map-loading__bar">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          {error && <p className="map-loading__error">{error}</p>}
        </div>
      )}

      {racingUiVisible && <div ref={trailRef} className="car-trail" />}

      {racingUiVisible && !started && (
        <div className="race-tutorial">
          <div className="race-tutorial__eyebrow">Gạ đua</div>
          <h2>Đua xe hong ní ?</h2>
          <p>
            {isMobile ? (
              'Nhấn Launch để lái chiếc Lết xù của ní.'
            ) : (
              <>
                Nhấn <b>Space</b> để lái chiếc Lết xù của b
              </>
            )}
          </p>
          <button type="button" onClick={boost}>
            {isMobile ? 'Quất' : 'Dzô'}
          </button>
        </div>
      )}

      {countdown !== null && (
        <div className="countdown-overlay">
          <span key={countdown}>{countdown}</span>
        </div>
      )}

      {racingUiVisible && (
        <button
          className={`launch-button ${boosting ? 'is-boosting' : ''}`}
          type="button"
          onPointerDown={boost}
          aria-label="Launch car"
        >
          <span>{isMobile ? 'Launch' : 'Space'}</span>
        </button>
      )}

      {gameOver && (
        <div className="game-over">
          <div className="game-over__eyebrow">Thua là Thua</div>
          <h2>{loseMessage}</h2>
          <button type="button" onClick={restart}>
            Làm kèo mới
          </button>
        </div>
      )}

      <button
        className="recenter-button"
        onClick={() =>
          mapRef.current?.flyTo({
            center: [person.location.lng, person.location.lat],
            ...VIEW,
            duration: 1500,
          })
        }
      >
        <MdMyLocation />
      </button>

      {((!isMobile && arrived) || (isMobile && mobilePopup)) && (
        <div className={`destination-popup ${isMobile ? 'mobile-popup' : ''}`}>
          <div className="destination-icon">🎊</div>
          <div>
            <div className="destination-title">... hên thôi ní</div>
          </div>
        </div>
      )}
    </>
  )
}
