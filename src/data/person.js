// ---------------------------------------------------------------
// SỬA MỌI THỨ Ở FILE NÀY — không cần đụng code khác.
// ---------------------------------------------------------------

export const person = {
  name: 'Nguyễn Huy Hoàng',
  university: 'Eastern International University',
  degree: 'Bachelor of Business Administration',

  // Định dạng phải parse được bằng new Date(`${date} ${time}`)
  date: '22 August 2026',
  time: '11:30',
  rangeTime: ' 11:30 - 12:00',

  location: {
    name: 'Hall B - WTC EXPO International Exhibition Center',
    lat: 11.054569,
    lng: 106.682984,
  },
}

// Link nút "Get Directions"
export const directionsUrl =
  `https://www.google.com/maps/dir/?api=1&destination=${person.location.lat},${person.location.lng}`

// Bản đồ: OpenFreeMap — miễn phí, không cần API key, không giới hạn request.
// Đổi sang 'bright' hoặc 'positron' nếu muốn tông sáng hơn.
export const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'

// Chữ dưới footer
export const footer = {
  text: 'Made by',
  logo: '/logo.svg',
}
