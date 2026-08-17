# B마트 수요예측·발주 추천 앱

노트북에서 학습한 모델을 다시 학습하지 않고 불러와, 다음 날 또는 향후 5일 누적수요 기준 발주량을 계산하는 Streamlit 앱입니다.

## 실행

```bash
python -m pip install -r requirements.txt
streamlit run app.py
```

기본 Artifact 위치는 `artifacts/`입니다. 다른 폴더를 쓰려면 `BMART_ARTIFACT_DIR` 환경변수로 지정할 수 있습니다.

## 필요한 Artifact

- `Bmart_v2_model_config.json`
- Point, 일별 P90/P95, 5일 누적 P90/P95 모델 5개
- `Bmart_v2_leadtime_calibration_residuals.csv`
- `Bmart_v2_artifact_manifest.json`

5일 누적 예측은 validation에서 선택한 30일 rolling conformal 보정을 사용합니다. 예측일 이전에 결과가 확정된 잔차만 사용하며, 최근 잔차가 없으면 마지막 30일 이력을 쓰고 결과에 `calibration_status`와 `calibration_age_days`를 표시합니다.

## 입력

- 수요 이력: SKU별 최근 28일 이상의 연속 `demand_qty` 이력
- 다음 날 계획: 다음 날의 모델 입력 변수와 현재고
- 5일 계획: SKU별로 최신 이력 다음 날부터 정확히 연속 5일
- 선택 운영값: `incoming_order_qty`, `backorder_qty`, `pack_size`, `minimum_order_qty`

원본 영문 컬럼명과 정제된 snake_case 컬럼명을 모두 인식합니다. `Units Ordered`는 입고일 정보가 없으므로 입고예정으로 자동 재사용하지 않습니다.

## 운영 주의

`Demand`는 데이터셋이 제공한 목표값이며 잠재수요나 lost sales로 검증되지 않았습니다. 서비스 수준·품절률·비용 결과는 시나리오 비교용이며 운영 확정 KPI가 아닙니다. 5일 누적 실제값이 성숙할 때마다 residual history를 갱신하고, 앱의 stale 경고가 나오면 보정 상태를 먼저 점검하세요.
