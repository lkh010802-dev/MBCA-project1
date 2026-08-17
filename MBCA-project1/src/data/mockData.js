// 마트별 상단 핵심 지표입니다. 실제 모델 API가 연결되면 이 객체를 응답값으로 교체합니다.
export const summaryByMart = {
  A: { demand: 12846, urgent: 23, orderQty: 8320, healthyRate: 78.6 },
  B: { demand: 9348, urgent: 16, orderQty: 5740, healthyRate: 73.2 },
}

// 상품별 수요·재고·발주 목업 데이터입니다.
// currentSales는 최근 12일 실제 수요, forecast는 같은 기간의 예측 수요입니다.
export const products = [
  { id: 1, mart: 'A', store: '강남점', product: 'PRD_04_GROC', label: '식료품 04', category: 'Grocery', risk: '긴급', demand: 295, stock: 84, safety: 48, orderQty: 259, stockoutDate: '2026-08-15', frequency: '3회 / 30일', currentSales: [142, 178, 151, 205, 166, 214, 173, 201, 159, 188, 146, 92], forecast: [128, 156, 137, 179, 149, 181, 162, 175, 151, 164, 132, 108], price: 3200 },
  { id: 2, mart: 'A', store: '잠실점', product: 'PRD_02_ELEC', label: '전자제품 02', category: 'Electronics', risk: '긴급', demand: 162, stock: 58, safety: 31, orderQty: 135, stockoutDate: '2026-08-16', frequency: '2회 / 30일', currentSales: [88, 95, 104, 101, 119, 116, 131, 126, 140, 137, 121, 112], forecast: [84, 91, 98, 102, 110, 119, 124, 129, 133, 130, 125, 117], price: 28900 },
  { id: 3, mart: 'A', store: '홍대점', product: 'PRD_08_HOME', label: '생활용품 08', category: 'Home', risk: '주의', demand: 117, stock: 103, safety: 22, orderQty: 36, stockoutDate: '2026-08-18', frequency: '1회 / 30일', currentSales: [72, 74, 69, 83, 81, 89, 92, 90, 96, 101, 95, 88], forecast: [70, 73, 75, 79, 82, 87, 89, 92, 94, 96, 93, 90], price: 8900 },
  { id: 4, mart: 'A', store: '강남점', product: 'PRD_05_FASH', label: '의류 05', category: 'Apparel', risk: '주의', demand: 91, stock: 88, safety: 16, orderQty: 19, stockoutDate: '2026-08-20', frequency: '1회 / 30일', currentSales: [52, 61, 58, 63, 67, 72, 75, 73, 81, 78, 74, 69], forecast: [50, 57, 59, 64, 66, 70, 72, 75, 77, 76, 72, 70], price: 17900 },
  { id: 5, mart: 'A', store: '분당점', product: 'PRD_01_GROC', label: '식료품 01', category: 'Grocery', risk: '정상', demand: 76, stock: 121, safety: 18, orderQty: 0, stockoutDate: '-', frequency: '0회 / 30일', currentSales: [58, 60, 62, 65, 63, 67, 68, 70, 71, 73, 72, 74], forecast: [57, 61, 63, 64, 66, 67, 69, 70, 72, 72, 73, 75], price: 4600 },
  { id: 6, mart: 'B', store: '서부점', product: 'B_PRD_101', label: 'B마트 상품 101', category: 'Grocery', risk: '긴급', demand: 246, stock: 61, safety: 41, orderQty: 226, stockoutDate: '2026-08-15', frequency: '4회 / 30일', currentSales: [121, 139, 148, 154, 163, 171, 179, 188, 183, 191, 170, 143], forecast: [118, 132, 145, 151, 158, 166, 174, 180, 178, 181, 165, 151], price: 5100 },
  { id: 7, mart: 'B', store: '동부점', product: 'B_PRD_204', label: 'B마트 상품 204', category: 'Home', risk: '주의', demand: 138, stock: 97, safety: 29, orderQty: 70, stockoutDate: '2026-08-18', frequency: '2회 / 30일', currentSales: [77, 82, 85, 92, 98, 104, 109, 115, 118, 114, 108, 99], forecast: [74, 80, 86, 90, 95, 101, 106, 111, 113, 112, 107, 102], price: 12400 },
  { id: 8, mart: 'B', store: '중앙점', product: 'B_PRD_330', label: 'B마트 상품 330', category: 'Apparel', risk: '정상', demand: 84, stock: 132, safety: 17, orderQty: 0, stockoutDate: '-', frequency: '0회 / 30일', currentSales: [61, 63, 65, 67, 69, 72, 71, 74, 76, 78, 77, 79], forecast: [60, 62, 64, 66, 68, 70, 72, 73, 75, 76, 78, 80], price: 21900 },
]

// 매장별 부족·적정·과잉 재고 분포 차트에 사용하는 데이터입니다.
export const inventoryByStore = [
  { store: '강남점', shortage: 48, healthy: 198, excess: 12 },
  { store: '잠실점', shortage: 22, healthy: 147, excess: 28 },
  { store: '홍대점', shortage: 31, healthy: 175, excess: 19 },
  { store: '분당점', shortage: 18, healthy: 206, excess: 9 },
]

// 동일한 날짜 기준 테스트 구간에서 비교한 모델 성능 예시입니다.
export const modelMetrics = [
  { name: 'Linear Regression', rmse: 58.4, mae: 37.8, r2: 0.61 },
  { name: 'Random Forest', rmse: 31.7, mae: 19.6, r2: 0.87 },
  { name: 'XGBoost', rmse: 27.9, mae: 16.8, r2: 0.91 },
  { name: 'LightGBM', rmse: 28.5, mae: 17.2, r2: 0.90 },
]
