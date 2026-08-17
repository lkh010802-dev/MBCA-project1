# B마트 V2 수요예측·재고최적화 최종 보완 요약

## 이번 단계: 5일 누적수요 rolling conformal 보정

- 기본 CatBoost 모델과 일별 예측 성능은 변경하지 않았습니다.
- 5일 누적 target과 미래 계획 feature가 Train/Validation/Test 경계를 넘지 않도록 purge했습니다.
- 8월을 초기 보정 이력으로 두고, 9–10월 validation에서만 14·21·30·45·60일·expanding 창을 비교했습니다.
- 테스트 결과를 보기 전에 30일 창이 선택됐습니다.
- 테스트에서는 예측일보다 먼저 5일 target이 완전히 확정된 잔차만 순차적으로 보정 이력에 추가했습니다.
- 기존 validation 전체 고정 보정은 삭제하지 않고 fallback과 비교 기준으로 유지했습니다.
- 보정 잔차 이력은 별도 CSV와 manifest 해시 검증 대상으로 저장했습니다.
- Streamlit 결과에 `calibration_as_of`, `calibration_age_days`, `calibration_status`를 표시하고 stale 상태를 경고합니다.

## 전체 재실행 결과

- 전체 노트북: 47개 셀 모두 통과, 약 21분 11초
- Point TEST: MAE 3.6623, RMSE 5.1237, R² 0.9866, WAPE 3.5401%
- Point rolling 평균: R² 0.9818, WAPE 4.0918%
- 일별 Quantile TEST: P90 coverage 90.96%, P95 coverage 95.96%, crossing 0

## 5일 누적수요 비교

| 방식 | P90 coverage | P95 coverage | P90 pinball | P95 pinball | crossing |
|---|---:|---:|---:|---:|---:|
| 30일 rolling conformal | 90.01% | 94.25% | 13.00 | 9.29 | 0 |
| 기존 고정 validation 보정 | 88.32% | 93.07% | 12.41 | 8.90 | 0 |

Coverage는 목표에 가까워졌지만 구간 폭이 넓어져 pinball loss는 악화됐습니다. 따라서 “모든 지표가 개선됐다”가 아니라, 재고 서비스 수준을 우선한 보수적 보정이라는 해석이 정확합니다.

## 동적 재고 시뮬레이션

평가 기간은 2023-11-01~2024-01-26, lead time 4일·review period 1일·lost sales 가정입니다.

| 정책 | Service level | Fill rate | 평균 기말재고 | 총 부족량 |
|---|---:|---:|---:|---:|
| 기존 7일 평균 판매량 | 58.34% | 76.36% | 53.88 | 212,382 |
| 누적수요 V2 P90 | 91.83% | 96.40% | 104.97 | 32,389 |
| 누적수요 V2 P95 | 94.09% | 96.89% | 144.99 | 27,926 |

서비스 수준이 높아진 대신 평균 재고도 증가했습니다. 실제 비용 입력이 없으므로 P90/P95 중 어느 정책이 경제적으로 최적인지는 아직 결정할 수 없습니다.

## 남아 있는 한계

- `Demand < Units Sold`가 21,000행(27.63%)이므로 Demand를 잠재수요·lost sales 정답으로 단정할 수 없습니다.
- 실제 입고예정, MOQ, 박스, 미납, 단가·보유비·품절비 데이터가 없어 기본 시뮬레이션에서는 입고예정 0, MOQ 0, 박스 1, 비용 비활성 상태입니다.
- rolling calibration은 5일 실제값이 확정될 때마다 residual history를 갱신해야 합니다. stale 경고가 나오면 예측 결과를 확정 발주에 바로 쓰지 말고 보정 이력을 먼저 점검해야 합니다.
- 정적 정책표는 당일 입고 가정의 참고치이며 동적 재고최적화 결과가 아닙니다.

## 실행

`bmart_v2_app` 폴더에서 다음 명령을 실행합니다.

```bash
python -m pip install -r requirements.txt
streamlit run app.py
```

앱 기동 health check와 5일 실입력 inference 검증을 모두 통과했습니다.
