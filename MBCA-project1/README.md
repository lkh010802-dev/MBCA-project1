# SmartOrder React Dashboard

A마트 목업과 B마트 수요예측·재고정책 결과를 함께 확인하는 React/Vite 대시보드입니다.

## 실행

```bash
pnpm install
pnpm run data:build
pnpm run dev
```

## CSV 갱신

`data/` 폴더의 아래 파일을 새 결과로 교체합니다.

- `Bmart_v2_service_result.csv`
- `B_mart.csv`
- `Bmart_v2_rolling_validation.csv`
- `Bmart_v2_dynamic_policy_comparison.csv`

그다음 `pnpm run data:build`를 실행하면 다음 React 데이터가 자동 생성됩니다.

- `src/data/bmartRealData.json`
- `src/data/bmartAnalysisData.json`

## 화면

- 대시보드
- 품절 위험
- 재고 현황
- 수요 분석
- 발주 관리

발주 관리는 브라우저 안에서 수량 조정·승인·보류 상태를 관리하고, 승인된 발주안을 CSV로 내려받습니다. 실제 구매 시스템으로 주문을 전송하지는 않습니다.

## 검증

```bash
pnpm run lint
pnpm run build
```
