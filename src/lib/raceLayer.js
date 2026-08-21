import { MercatorCoordinate } from 'maplibre-gl'
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Clock,
  Camera,
  DirectionalLight,
  Group,
  Matrix4,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import confetti from 'canvas-confetti'

import { person } from '../data/person'
import { racePath, offsetPath } from '../data/route'
import { loseMessages, pickRandom } from '../data/loseMessages'
import { vehicles } from '../data/vehicle'

const MAX_CAR_SPEED = 0.095
const BOOST_DECAY = 0.25
const CAR_FRICTION = 0.94
const BIKE_FRICTION = 0.985
const WHEEL_SPIN = 14

// Làn đối thủ lệch sang bên bao nhiêu mét so với làn của khách.
const RIVAL_LANE_OFFSET = 42

function tuning(isMobile) {
  return {
    boostAccel: isMobile ? 0.024 : 0.018,
    bikeAccel: isMobile ? 0.006 : 0.003,
    bikeSpeedWhenBehind: isMobile ? 0.075 : 0.045,
    bikeSpeedWhenAhead: isMobile ? 0.05 : 0.03,
  }
}

function addLights(scene) {
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(100, 100, 100)
  scene.add(sun)
  scene.add(new AmbientLight(0xffffff, 1.5))
}

// Nội suy toạ độ tại vị trí `t` (chỉ số thực) trên polyline.
function sampleAt(path, t) {
  const i = Math.floor(t)
  const j = Math.min(i + 1, path.length - 1)
  const f = t - i
  return [path[i][0] + (path[j][0] - path[i][0]) * f, path[i][1] + (path[j][1] - path[i][1]) * f]
}

// Style Liberty của OpenFreeMap đã có sẵn layer `building-3d`.
// Style khác (Bright, Positron...) thì tự thêm khối nhà 3D vào.
const AXES = ['x', 'y', 'z']

function unitVector(axis, sign = 1) {
  return new Vector3(axis === 'x' ? sign : 0, axis === 'y' ? sign : 0, axis === 'z' ? sign : 0)
}

/**
 * Bánh xe hay có gốc toạ độ nằm ở tâm xe chứ không ở tâm bánh — xoay thẳng mesh
 * là bánh văng ra khỏi xe. Bọc mỗi bánh vào một Group đặt đúng tâm bánh rồi xoay
 * Group đó, và xoay quanh trục trục bánh (cạnh mỏng nhất của bbox) chứ không
 * cứng nhắc trục X.
 */
function repivotWheel(mesh) {
  const parent = mesh.parent
  if (!parent || !mesh.geometry) return null

  mesh.geometry.computeBoundingBox()
  const bbox = mesh.geometry.boundingBox
  if (!bbox) return null

  const center = bbox.getCenter(new Vector3())
  const extent = bbox.getSize(new Vector3())

  // Bánh là cái đĩa: mỏng nhất dọc theo trục quay.
  const axleAxis = AXES.reduce((a, b) => (extent[a] <= extent[b] ? a : b))
  const axis = unitVector(axleAxis).applyQuaternion(mesh.quaternion).normalize()

  mesh.updateMatrix()
  const centerInParent = center.applyMatrix4(mesh.matrix)

  const pivot = new Group()
  pivot.position.copy(centerInParent)
  parent.add(pivot)
  pivot.add(mesh)
  mesh.position.sub(centerInParent)

  return { pivot, axis }
}

function spinWheels(wheels, amount) {
  if (!amount) return
  wheels.forEach(({ pivot, axis }) => pivot.rotateOnAxis(axis, amount))
}

/**
 * Đưa model về hệ toạ độ của layer (X = đông, Y = bắc, Z = lên trời):
 * cạnh dài nhất thành chiều dài xe nằm dọc +X, cạnh ngắn nhất thành chiều cao
 * dọc +Z, scale về đúng `targetLength` mét, tâm về gốc, bánh chạm đất z = 0.
 *
 * Nhờ vậy đổi sang model .glb khác không phải dò lại rotation/scale bằng tay.
 */
function normalizeVehicle(root, targetLength, flip) {
  const measure = () => new Box3().setFromObject(root)

  const size = measure().getSize(new Vector3())
  const ranked = AXES.map((axis) => [axis, size[axis]]).sort((a, b) => b[1] - a[1])
  const [lengthAxis, widthAxis, heightAxis] = ranked.map(([axis]) => axis)

  // makeBasis map e_x -> cột 1..., ta cần chiều ngược lại nên invert.
  const basis = new Matrix4().makeBasis(
    unitVector(lengthAxis),
    unitVector(widthAxis),
    unitVector(heightAxis),
  )
  // Hoán vị lẻ sẽ lật gương model -> đảo trục ngang cho định thức về +1.
  if (basis.determinant() < 0) {
    basis.makeBasis(unitVector(lengthAxis), unitVector(widthAxis, -1), unitVector(heightAxis))
  }
  root.applyMatrix4(basis.invert())

  if (flip) root.applyMatrix4(new Matrix4().makeRotationZ(Math.PI))

  const spanX = measure().getSize(new Vector3()).x || 1
  root.applyMatrix4(new Matrix4().makeScale(...Array(3).fill(targetLength / spanX)))

  const box = measure()
  const center = box.getCenter(new Vector3())
  root.applyMatrix4(new Matrix4().makeTranslation(-center.x, -center.y, -box.min.z))

  // Group ngoài chỉ dùng để xoay theo hướng chạy, model bên trong đứng yên.
  const pivot = new Group()
  pivot.add(root)
  return pivot
}

// Hướng đi tại vị trí `t` trên polyline, tính bằng radian so với hướng đông.
function headingAt(path, t) {
  const ahead = Math.min(t + 0.02, path.length - 1)
  const behind = Math.max(ahead - 0.04, 0)
  const [lngA, latA] = sampleAt(path, behind)
  const [lngB, latB] = sampleAt(path, ahead)

  const metersPerLng = 111320 * Math.cos((latA * Math.PI) / 180)
  const east = (lngB - lngA) * metersPerLng
  const north = (latB - latA) * 111320
  return Math.atan2(north, east)
}

// Liberty không có sky layer -> pitch cao là lòi ra khoảng đen phía chân trời.
export function addSky(map) {
  map.setSky({
    'sky-color': '#8ec5ff',
    'sky-horizon-blend': 0.6,
    'horizon-color': '#ffffff',
    'horizon-fog-blend': 0.5,
    'fog-color': '#dfe8f2',
    'fog-ground-blend': 0.15,
  })
}

export function ensure3dBuildings(map) {
  if (map.getLayer('building-3d')) return
  const style = map.getStyle()
  const source = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0]
  if (!source) return

  try {
    map.addLayer({
      id: 'building-3d',
      type: 'fill-extrusion',
      source,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#d9d0c9',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 5],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    })
  } catch {
    // Style không có source-layer `building` -> bỏ qua, map vẫn chạy phẳng.
  }
}

export function addRaceLanes(map) {
  const left = offsetPath(racePath, -3)
  const right = offsetPath(racePath, 3)

  map.addSource('race-lanes', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { lane: 'left' }, geometry: { type: 'LineString', coordinates: left } },
        { type: 'Feature', properties: { lane: 'right' }, geometry: { type: 'LineString', coordinates: right } },
      ],
    },
  })

  map.addLayer({
    id: 'race-lane-glow',
    type: 'line',
    source: 'race-lanes',
    // Nền OpenFreeMap sáng hơn Mapbox Standard nên glow phải đậm hơn mới thấy.
    paint: { 'line-color': '#ff4d2d', 'line-width': 11, 'line-opacity': 0.45, 'line-blur': 5 },
  })

  map.addLayer({
    id: 'race-lane-stripes',
    type: 'line',
    source: 'race-lanes',
    paint: {
      'line-color': '#ffffff',
      'line-width': 3,
      'line-dasharray': [1.2, 1.1],
      'line-opacity': 1,
    },
  })
}

function lockGestures(map) {
  map.scrollZoom.disable()
  map.boxZoom.disable()
  map.dragRotate.disable()
  map.dragPan.disable()
  map.keyboard.disable()
  map.doubleClickZoom.disable()
  map.touchZoomRotate.disable()
}

function unlockGestures(map) {
  map.scrollZoom.enable()
  map.boxZoom.enable()
  map.dragRotate.enable()
  map.dragPan.enable()
  map.keyboard.enable()
  map.doubleClickZoom.enable()
  map.touchZoomRotate.enable()
}

/**
 * Gắn custom 3D layer chạy đua lên map.
 *
 * refs/callbacks đều do <MapScene /> sở hữu — layer chỉ đọc & set.
 */
export function addRaceLayer(map, {
  finishedRef,      // đã về đích (khoá vòng đua lại)
  countdownDoneRef, // 3-2-1 xong, được phép chạy
  boostRef,         // lực đẩy tích được từ mỗi lần nhấn Space
  gameOverRef,      // thua rồi
  resetRef,         // tăng lên mỗi lần "Làm kèo mới" -> layer tự reset
  setArrived,
  setGameOver,
  setLoseMessage,
  setCarScreenPos,
  isMobile,
  onArrived,
  onModelsReady,
  onProgress,
}) {
  const carScene = new Scene()
  const bikeScene = new Scene()
  const camera = new Camera()

  // Renderer dùng chung WebGL context của MapLibre -> tạo trong onAdd,
  // vì chỉ ở đó mới cầm được đúng `gl` (v6 dùng WebGL2, không lấy qua getContext được).
  let renderer = null

  const { boostAccel, bikeAccel, bikeSpeedWhenBehind, bikeSpeedWhenAhead } = tuning(isMobile)

  addLights(carScene)
  addLights(bikeScene)

  let car = null
  let bike = null
  let bikeMixer = null
  const clock = new Clock()
  const carWheels = []
  const bikeWheels = []

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  let loaded = 0
  const modelDone = () => {
    loaded += 1
    if (loaded >= 2) onModelsReady?.()
  }

  // Gộp tiến độ tải của cả 2 model thành 1 con số 0..1 cho màn loading.
  const bytes = { [vehicles.player.model]: 0, [vehicles.rival.model]: 0 }
  const trackProgress = (url) => (event) => {
    if (!event.lengthComputable) return
    bytes[url] = event.loaded / event.total
    onProgress?.((bytes[vehicles.player.model] + bytes[vehicles.rival.model]) / 2)
  }

  // Load + auto-fit chung cho cả 2 xe; khác nhau chỉ ở config trong vehicle.js.
  function loadVehicle(config, scene, onReady) {
    loader.load(
      config.model,
      (gltf) => {
        const rawWheels = []
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
          if (config.wheels.test(child.name)) rawWheels.push(child)
        })

        const wheels = rawWheels.map(repivotWheel).filter(Boolean)

        let mixer = null
        if (gltf.animations?.length) {
          mixer = new AnimationMixer(gltf.scene)
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play())
        }

        const pivot = normalizeVehicle(gltf.scene, config.length, config.flip)
        scene.add(pivot)
        onReady({ pivot, wheels, mixer })
        modelDone()
      },
      trackProgress(config.model),
      modelDone,
    )
  }

  loadVehicle(vehicles.player, carScene, (v) => {
    car = v.pivot
    carWheels.push(...v.wheels)
  })

  loadVehicle(vehicles.rival, bikeScene, (v) => {
    bike = v.pivot
    bikeWheels.push(...v.wheels)
    bikeMixer = v.mixer
  })

  let carT = 0
  let carSpeed = 0
  let bikeT = 0
  let bikeSpeed = 0
  let followCamera = true
  let resetSeen = resetRef.current

  const carLane = racePath
  const bikeLane = offsetPath(racePath, RIVAL_LANE_OFFSET)

  // Đặt model lên đúng toạ độ địa lý rồi render bằng ma trận chiếu của map.
  // Model đã được normalize sang đơn vị mét nên chỉ cần đổi mét -> mercator.
  function renderAt(scene, coord, mapMatrix) {
    const merc = MercatorCoordinate.fromLngLat({ lng: coord[0], lat: coord[1] }, 0)
    const scale = merc.meterInMercatorCoordinateUnits()

    const transform = new Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new Vector3(scale, -scale, scale))

    camera.projectionMatrix = new Matrix4().fromArray(mapMatrix).multiply(transform)
    renderer.resetState()
    renderer.render(scene, camera)
  }

  function resetRace() {
    carT = 0
    carSpeed = 0
    bikeT = 0
    bikeSpeed = 0
    followCamera = true
    resetSeen = resetRef.current
    lockGestures(map)
  }

  map.addLayer({
    id: 'car-layer',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      })
      renderer.autoClear = false
    },
    render(_gl, args) {
      // Phải là `defaultProjectionData.mainMatrix` — ma trận này nhận toạ độ
      // mercator [0,1], đúng hệ mà MercatorCoordinate.fromLngLat trả về.
      // `modelViewProjectionMatrix` là world space nên model bay mất tiêu.
      const mapMatrix = args?.defaultProjectionData?.mainMatrix ?? args

      if (!renderer || !car || !bike) {
        map.triggerRepaint()
        return
      }

      if (resetSeen !== resetRef.current) resetRace()

      const carCoord = sampleAt(carLane, carT)
      const bikeCoord = sampleAt(bikeLane, bikeT)

      const screen = map.project({ lng: carCoord[0], lat: carCoord[1] })
      setCarScreenPos({ x: screen.x, y: screen.y })

      if (bikeMixer) bikeMixer.update(clock.getDelta())

      // Xe luôn quay theo hướng của làn mình đang chạy.
      car.rotation.z = headingAt(carLane, carT)
      bike.rotation.z = headingAt(bikeLane, bikeT)

      renderAt(carScene, carCoord, mapMatrix)
      renderAt(bikeScene, bikeCoord, mapMatrix)

      const racing = countdownDoneRef.current && !gameOverRef.current

      if (racing && boostRef.current > 0) {
        carSpeed = Math.min(carSpeed + boostRef.current * boostAccel, MAX_CAR_SPEED)
        boostRef.current = Math.max(boostRef.current - BOOST_DECAY, 0)
      }

      if (racing) {
        // Rubber-band: xe đạp đạp hăng hơn khi đang bị dẫn trước.
        const cap = carT > bikeT ? bikeSpeedWhenBehind : bikeSpeedWhenAhead
        bikeSpeed = Math.min(bikeSpeed + bikeAccel, cap)
      }

      if (!gameOverRef.current) {
        carSpeed *= CAR_FRICTION
        bikeSpeed *= BIKE_FRICTION
      }

      if (gameOverRef.current) {
        carSpeed = 0
        bikeSpeed = 0
      } else if (carT < carLane.length - 1) {
        carT = Math.min(carT + carSpeed, carLane.length - 1)
        bikeT = Math.min(bikeT + bikeSpeed, bikeLane.length - 1)

        spinWheels(carWheels, -carSpeed * WHEEL_SPIN)
        spinWheels(bikeWheels, -bikeSpeed * WHEEL_SPIN)

        // Xe đạp về đích trước -> thua.
        if (bikeT >= bikeLane.length - 1 && carT < carLane.length - 1) {
          setLoseMessage(pickRandom(loseMessages))
          gameOverRef.current = true
          countdownDoneRef.current = false
          followCamera = false
          carSpeed = 0
          bikeSpeed = 0
          setGameOver(true)
        }
      } else if (!finishedRef.current) {
        // Xe hơi về đích -> thắng.
        finishedRef.current = true
        followCamera = false
        unlockGestures(map)
        map.flyTo({
          center: [person.location.lng, person.location.lat],
          zoom: 19,
          pitch: 75,
          bearing: -25,
          duration: 1500,
        })
        confetti({ particleCount: 180, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.7 } })
        setTimeout(() => onArrived?.(), 1000)
        setArrived(true)
      }

      if (followCamera && countdownDoneRef.current) {
        map.easeTo({ center: carCoord, duration: 0 })
      }

      map.triggerRepaint()
    },
  })
}
