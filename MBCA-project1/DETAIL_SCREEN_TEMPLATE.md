# SmartOrder 세부 화면 템플릿 안내

메인 대시보드는 유지하고 `App.jsx` 안에 다음 세 화면을 추가했습니다.

## 품절 위험

- 컴포넌트: `RiskPage`
- 매장·위험 상태·상품 검색 필터
- 긴급/주의/정상 분포
- 예상 부족 수량과 예상 품절일
- 최근 30일 반복 결품 TOP 6
- 상품별 위험 상세 표

## 재고 현황

- 컴포넌트: `InventoryPage`
- 매장·카테고리·재고 상태 필터
- 부족/적정/과잉 요약 카드
- 현재 재고와 권장재고 비교 막대
- 매장별 재고 상태 분포
- 과잉재고 TOP 6

## 수요 분석

- 컴포넌트: `DemandAnalysisPage`
- 9,100행 서비스 결과의 프로모션·할인·지역 집계
- 76,000행 원본 데이터의 계절별 평균 수요
- 결품 후보 다음날과 일반 관측 다음날 수요 비교
- 카테고리별 평균 수요
- 모델 중요도/SHAP 연결용 주요 요인 영역

## 발주 관리

- 컴포넌트: `OrderManagementPage`
- 발주 필요·위험 상품 자동 선별
- 모델 권장량과 담당자 최종 발주량 비교
- 박스 단위와 MOQ 자동 적용
- 개별·일괄 승인/보류
- 승인 발주안 CSV 다운로드
- 실제 외부 발주 전송 없이 브라우저 안에서만 상태 관리

## 현재 데이터 계약

세 화면은 기존 `dashboardProducts` 배열을 공통으로 사용합니다. 필요한 주요 필드는 다음과 같습니다.

```text
id, mart, store, storeId, product, label,
category, categoryKo, region,
risk, actualDemand, demand,
stock, targetStock, orderQty,
stockoutDate, frequency,
promotion, discountPct,
inventoryStatus, managementAction,
shortage, excess
```

B마트는 `src/data/bmartRealData.json`, A마트는 `src/data/mockData.js`에서 공급됩니다.

## 팀 작업 시 교체할 부분

1. `data/` 폴더의 CSV를 교체합니다.
2. `pnpm run data:build`로 React JSON을 다시 생성합니다.
3. `주요 수요 요인 템플릿`에는 최종 모델의 feature importance 또는 SHAP 결과를 연결합니다.
4. 결품·프로모션·할인 그래프는 기술통계이며 인과효과로 표현하지 않습니다.

## 실행

```bash
pnpm install
pnpm run data:build
pnpm run dev
```

검증은 `pnpm run build`, `pnpm run lint`로 수행합니다.
