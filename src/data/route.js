// Đường đua: polyline chạy dọc con đường dẫn tới địa điểm.
// Mở devtools, click lên map để lấy toạ độ (console.log lng/lat trong MapScene).
export const racePath = [
  [106.6848397451, 11.0564404999],
  [106.68442, 11.05587],
  [106.68398, 11.05527],
  [106.68357, 11.0547],
  [106.68323851634403, 11.054218999048373],
]

const METERS_PER_DEGREE = 111320

// Dịch cả polyline sang ngang `offset` mét theo pháp tuyến của đường.
export function offsetPath(path, offset) {
  return path.map(([lng, lat], i) => {
    const prev = path[Math.max(i - 1, 0)]
    const next = path[Math.min(i + 1, path.length - 1)]
    const latRad = (lat * Math.PI) / 180
    const metersPerLng = METERS_PER_DEGREE * Math.cos(latRad)

    const dx = (next[0] - prev[0]) * metersPerLng
    const dy = (next[1] - prev[1]) * METERS_PER_DEGREE
    const len = Math.hypot(dx, dy) || 1

    const nx = -dy / len
    const ny = dx / len

    return [lng + (nx * offset) / metersPerLng, lat + (ny * offset) / METERS_PER_DEGREE]
  })
}
