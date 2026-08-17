from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import streamlit as st

from inference import ArtifactBundleError, BmartInventoryPredictor, InputValidationError


APP_DIR = Path(__file__).resolve().parent
DEFAULT_ARTIFACT_DIR = Path(os.getenv("BMART_ARTIFACT_DIR", APP_DIR / "artifacts"))
PROTECTION_MODE = "향후 5일 누적수요"
ONE_DAY_MODE = "다음 날 1일 수요"

st.set_page_config(
    page_title="B마트 수요예측·발주 추천",
    page_icon="🛒",
    layout="wide",
)


@st.cache_resource
def load_predictor(artifact_dir: str):
    return BmartInventoryPredictor(artifact_dir)


def read_uploaded_csv(uploaded_file):
    if uploaded_file is None:
        return None
    return pd.read_csv(uploaded_file)


st.title("B마트 수요예측·발주 추천")
st.caption("Point·P90·P95 예측과 재고예정·MOQ·박스 단위를 반영한 발주 보조 도구")

with st.sidebar:
    st.header("실행 설정")
    artifact_dir = st.text_input("모델 폴더", str(DEFAULT_ARTIFACT_DIR))
    prediction_mode = st.radio(
        "예측 방식",
        [PROTECTION_MODE, ONE_DAY_MODE],
        index=0,
    )

try:
    predictor = load_predictor(artifact_dir)
except (ArtifactBundleError, OSError, ValueError) as error:
    st.error(f"모델을 불러오지 못했습니다: {error}")
    st.info("모델 폴더의 config, 모델 5개, calibration residual 파일을 확인하세요.")
    st.stop()

target_message = predictor.target_contract.get(
    "operational_interpretation",
    "Demand 의미가 실제 잠재수요로 검증되지 않았습니다.",
)
st.warning(
    f"해석 주의: {target_message} 서비스 수준과 재고비용은 운영 확정치가 아니라 시나리오 지표입니다."
)

left, right = st.columns(2)
with left:
    history_file = st.file_uploader(
        "수요 이력 CSV",
        type=["csv"],
        help="SKU별로 최근 28일 이상의 연속 demand_qty 이력이 필요합니다.",
    )
with right:
    plan_label = "향후 5일 계획 CSV" if prediction_mode == PROTECTION_MODE else "다음 날 계획 CSV"
    plan_file = st.file_uploader(
        plan_label,
        type=["csv"],
        help="가격·할인·프로모션·휴일 등 예측 시점에 확정되거나 시나리오로 정한 값을 넣습니다.",
    )

with st.expander("입력 규칙 보기"):
    st.markdown(
        """
- 원본 영문 컬럼명과 정제된 snake_case 컬럼명을 모두 인식합니다.
- 이력에는 `date`, `store_id`, `product_id`, `demand_qty`가 필요합니다.
- 계획에는 모델 입력 feature와 `inventory_level`이 필요합니다.
- 선택 입력: `incoming_order_qty`, `backorder_qty`, `pack_size`, `minimum_order_qty`.
- `Units Ordered`는 입고일 정보가 없어 입고예정으로 자동 사용하지 않습니다.
- 5일 모드는 SKU별로 이력 다음 날부터 정확히 연속 5일 계획이 필요합니다.
"""
    )

history_df = read_uploaded_csv(history_file)
plan_df = read_uploaded_csv(plan_file)

if history_df is not None and plan_df is not None:
    st.subheader("입력 미리보기")
    preview_left, preview_right = st.columns(2)
    preview_left.dataframe(history_df.head(10), use_container_width=True)
    preview_right.dataframe(plan_df.head(10), use_container_width=True)

    if st.button("예측 및 발주량 계산", type="primary", use_container_width=True):
        try:
            if prediction_mode == PROTECTION_MODE:
                result = predictor.predict_protection_period(history_df, plan_df)
            else:
                result = predictor.predict_one_day(history_df, plan_df)
        except (InputValidationError, ValueError, KeyError) as error:
            st.error(f"입력 검증 실패: {error}")
        else:
            ok_count = int(result["prediction_status"].eq("ok").sum())
            total_order = int(result["recommended_order_qty"].fillna(0).sum())
            constraint_count = int(
                result.get("order_constraint_applied", pd.Series(dtype=bool))
                .fillna(False)
                .sum()
            )

            metric_a, metric_b, metric_c = st.columns(3)
            metric_a.metric("예측 완료 SKU", f"{ok_count:,}")
            metric_b.metric("총 추천 발주량", f"{total_order:,}")
            metric_c.metric("MOQ·박스 조정 SKU", f"{constraint_count:,}")

            if "calibration_status" in result.columns:
                stale = result["calibration_status"].fillna("").str.startswith("stale")
                fallback = result["calibration_status"].fillna("").str.startswith("fallback")
                if stale.any():
                    max_age = result.loc[stale, "calibration_age_days"].max()
                    st.warning(
                        f"보정 이력이 오래되었습니다(최대 {max_age:.0f}일). "
                        "최근 실측수요로 calibration residual 파일을 갱신하세요."
                    )
                if fallback.any():
                    st.warning("성숙한 보정 잔차가 없어 고정 validation 보정을 사용한 행이 있습니다.")

            st.subheader("추천 결과")
            st.dataframe(result, use_container_width=True, hide_index=True)
            st.download_button(
                "결과 CSV 다운로드",
                data=result.to_csv(index=False).encode("utf-8-sig"),
                file_name="bmart_order_recommendations.csv",
                mime="text/csv",
                use_container_width=True,
            )
else:
    st.info("수요 이력 CSV와 계획 CSV를 모두 업로드하면 예측을 실행할 수 있습니다.")
