# B마트 프로젝트 파일 구성

- `notebooks/`: 최종 모델 노트북, 실행 완료본, 입고 보완 Colab 노트북
- `model_artifacts/`: 모델, 검증 결과, 서비스 결과, 설정 및 manifest
- `receipt_artifacts/`: 발주·입고 이력, 입고 반영 추천, 정책 비교 및 설정
- `streamlit/`: Streamlit 앱 소스와 ZIP
- `source_data/`: 원본 `B_mart.csv`
- `scripts/`: 입고 보완 노트북 및 React 데이터 생성 코드
- `docs/`: 보완 요약 문서

React 대시보드는 상위 `MBCA-project1/` 폴더에 있습니다.

## 주의

`receipt_artifacts/`의 현재 입고 데이터는 실제 ERP 원장이 아니라 `SEED=42`로 생성한 시뮬레이션입니다. 운영 성과로 해석하지 말고, 실제 발주·입고 CSV 연결 전 계산 및 화면 흐름 검증용으로 사용해야 합니다.
