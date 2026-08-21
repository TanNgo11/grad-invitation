// Model 3D được auto-fit lúc load: tự xoay cho đúng hướng, tự scale về đúng
// số mét khai báo ở đây, tự đặt bánh chạm đất. Nên quăng file .glb bất kỳ vào
// `public/models/` rồi trỏ `model` sang là chạy — không cần dò rotation tay.

export const vehicles = {
  // Xe của khách mời
  player: {
    model: '/models/car.min.glb',
    length: 24, // chiều dài trên map (mét) — phóng to cho dễ nhìn ở zoom 19
    flip: true, // nếu xe chạy lùi (đít đi trước) thì đổi thành true
    wheels: /wheel|tyre|tire|rim/i, // tên mesh bánh xe, dùng để quay bánh
  },

  // Đối thủ
  rival: {
    model: '/models/suv.min.glb',
    length: 22,
    flip: false,
    wheels: /wheel|tyre|tire|rim/i,
  },
}
