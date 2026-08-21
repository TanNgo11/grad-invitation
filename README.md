# Thiệp mời tốt nghiệp — đua xe trên bản đồ 3D

MapLibre GL JS + OpenFreeMap (bản đồ 3D miễn phí, không cần API key) + Three.js.
Khách vào phải đua xe tới địa điểm — thắng thì confetti nổ
và thiệp mời hiện ra.

## Chạy

```bash
npm install
npm run dev
```

Không cần API key, không cần đăng ký gì. Bản đồ lấy từ
[OpenFreeMap](https://openfreemap.org/) (OpenStreetMap data, MapLibre GL JS) —
miễn phí, không giới hạn request, không token.

Đổi tông bản đồ trong `src/data/person.js`:

| Style | URL |
|---|---|
| Liberty (mặc định, có nhà 3D) | `https://tiles.openfreemap.org/styles/liberty` |
| Bright | `https://tiles.openfreemap.org/styles/bright` |
| Positron (xám nhạt) | `https://tiles.openfreemap.org/styles/positron` |

OpenFreeMap chạy bằng donate, không có SLA. Muốn chắc ăn hơn thì dùng
[MapTiler](https://www.maptiler.com/) free tier (100k loads/tháng, cần key) —
chỉ việc thay `mapStyle` bằng URL style của MapTiler kèm `?key=...`.

## Sửa nội dung

| Muốn đổi | Sửa file |
|---|---|
| Tên, trường, bằng, ngày giờ, địa điểm | `src/data/person.js` |
| Câu chọc khi thua | `src/data/loseMessages.js` |
| Đường đua (polyline) | `src/data/route.js` |
| Xe 3D (file model, chiều dài, hướng đầu xe) | `src/data/vehicle.js` |
| Bản đồ (style) | `src/data/person.js` — biến `mapStyle` |
| Ảnh đại diện | `src/assets/avatar.svg` (đổi sang `.jpg/.png` thì sửa import trong `InvitationCard.jsx`) |
| Logo footer | `public/logo.svg` |
| Độ khó / tốc độ xe đạp | `src/lib/raceLayer.js` — hàm `tuning()` |

### Đổi xe

1. Bỏ file `.glb` vào `public/models/`.
2. Nén lại cho nhẹ (bắt buộc — code dùng `MeshoptDecoder`):
   ```bash
   npm run model -- public/models/lexus-raw.glb public/models/lexus.glb
   ```
   Xem model có gì (mesh, texture, animation):
   ```bash
   npm run model:inspect -- public/models/lexus.glb
   ```
3. Trỏ `model` trong `src/data/vehicle.js` sang file mới.

Không cần dò rotation hay scale — `normalizeVehicle()` tự xoay, tự scale về đúng
`length` mét và tự cho bánh chạm đất. Chỉ 2 thứ có thể phải chỉnh tay:

- `flip: true` nếu xe chạy lùi (đít đi trước).
- `wheels` — regex khớp tên mesh bánh xe để quay bánh. Chạy `model:inspect` xem
  tên mesh thật rồi sửa nếu model đặt tên lạ.

### Đổi địa điểm + đường đua

1. Sửa `location.lat/lng` trong `src/data/person.js`.
2. Mở app, bật devtools console rồi **click lên map** — mỗi lần click in ra `lng`/`lat`.
3. Click dọc theo con đường dẫn tới địa điểm, copy các cặp toạ độ vào mảng
   `racePath` trong `src/data/route.js` (điểm cuối = đích).

## Luật chơi

- Nhấn `Space` (desktop) hoặc nút **Launch** (mobile) lần đầu → đếm ngược 3-2-1.
- Sau đó mỗi lần nhấn cộng thêm lực đẩy (`BOOST_PER_TAP`, tối đa `MAX_BOOST`);
  xe có ma sát nên ngừng nhấn là chậm dần.
- Xe đạp tự chạy, và **đạp nhanh hơn khi đang bị dẫn trước** (rubber-band) —
  chỉnh trong `tuning()`.
- Xe đạp về đích trước → màn hình thua + câu chọc random + nút "Làm kèo mới".
- Xe hơi về đích trước → mở khoá thao tác map, bay về địa điểm, confetti, hiện thiệp.

## Deploy Vercel

Framework preset `Vite`, không cần env var, không cần sửa gì.

## Assets

`public/models/car.min.glb` và `public/models/suv.min.glb` là model 3D **dùng tạm**:

| Vai | Model hiện tại | Muốn dùng |
|---|---|---|
| Xe khách mời | Porsche 911 GT3 RS | Lexus |
| Đối thủ | Toyota Land Cruiser 300 | Mercedes-AMG G63 |

Model có thương hiệu Lexus / G63 chỉ có trên Sketchfab (nhiều bản CC Attribution
dùng được), mà API download bắt buộc đăng nhập nên phải tự tải. Tải xong làm theo
mục "Đổi xe" ở trên — không cần sửa code, chỉ sửa `src/data/vehicle.js`.

Kiểm tra license trước khi công khai.

## Ghi chú kỹ thuật

Vài chỗ dễ vấp nếu sau này nâng version:

- **Worker của MapLibre.** MapLibre tự tìm worker bằng
  `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Rollup không thấy được
  lời gọi đó nên bản build thiếu file, worker chết im lặng và map treo mãi ở màn
  loading. `MapScene.jsx` gọi `setWorkerUrl()` với chunk do Vite bundle
  (`?worker&url`) để tránh chuyện này.
- **Ma trận chiếu.** Custom layer phải dùng
  `args.defaultProjectionData.mainMatrix` (hệ mercator 0..1, khớp với
  `MercatorCoordinate.fromLngLat`). Dùng `modelViewProjectionMatrix` là world
  space — model sẽ biến mất khỏi màn hình.
- **WebGL context.** `WebGLRenderer` phải tạo trong `onAdd(map, gl)` để xài
  chung context với MapLibre; `canvas.getContext('webgl')` trả `null` vì
  MapLibre v6 dùng WebGL2.
- **`maxPitch: 85`.** MapLibre mặc định chặn pitch ở 60, không set thì góc 75 bị kẹp.
- **Model `.glb`** đã nén meshopt (5.5 MB → 1.7 MB), giải nén bằng
  `MeshoptDecoder`. Thay model mới thì nén lại:
  `npx @gltf-transform/cli meshopt in.glb out.glb`.
- **Bánh xe.** Nhiều model đặt gốc toạ độ của mesh bánh ở tâm xe chứ không ở tâm
  bánh — xoay thẳng mesh là bánh văng ra ngoài. `repivotWheel()` bọc mỗi bánh vào
  một Group đặt đúng tâm bánh, và xoay quanh trục trục bánh (cạnh mỏng nhất của
  bounding box) thay vì cứng nhắc trục X.
- **Auto-fit.** `normalizeVehicle()` tự xoay model (cạnh dài nhất thành chiều dài
  xe, cạnh ngắn nhất thành chiều cao), scale về đúng số mét khai báo trong
  `vehicle.js`, đặt bánh chạm đất, rồi mỗi frame xoay đầu xe theo hướng đường
  đua. Nên đổi model chỉ cần sửa `vehicle.js`, không phải dò rotation tay.
  Nếu xe chạy lùi thì bật `flip: true`.
"# grad-invitation" 
