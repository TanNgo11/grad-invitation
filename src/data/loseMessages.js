// Câu chọc khi thua — sửa thoải mái.
export const loseMessages = [
  'Thua G63 là sao ní',
  'Xe đẹp mà lái như đi bộ =))',
  'Bằng lái mua ở đâu chỉ t với',
  'Nhầm chân ga với chân thắng hả',
  'Về kể thua G63 chắc không ai tin :3',
  'Cảnh báo: có GÀ trên đường đua',
  'Gửi số tài khoản đi =)))',
  'Luyện tập thêm đi, t đi ăn cơm cái',
  'Cổ điển. Tôn trọng.',
  'Ra đường t nể mỗi ní',
  'Tuyệt đối điện ảnh',
  'Nói gì nữa giờ =)))',
  'Thua quài dị ní',
  'Ê nha =)))',
  'Chạy chậm để ngắm cảnh hả',
]

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)]
}
