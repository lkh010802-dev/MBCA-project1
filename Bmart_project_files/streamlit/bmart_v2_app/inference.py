from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor


MODEL_FILES = {
    "point": "Bmart_v2_point_model.cbm",
    "p90": "Bmart_v2_quantile_p90.cbm",
    "p95": "Bmart_v2_quantile_p95.cbm",
    "leadtime_p90": "Bmart_v2_leadtime_quantile_p90.cbm",
    "leadtime_p95": "Bmart_v2_leadtime_quantile_p95.cbm",
}
CONFIG_FILE = "Bmart_v2_model_config.json"
LEADTIME_RESIDUAL_FILE = "Bmart_v2_leadtime_calibration_residuals.csv"

COLUMN_ALIASES = {
    "Date": "date",
    "Day_of_Week": "day_of_week",
    "Is_Holiday": "is_holiday",
    "Store ID": "store_id",
    "Product ID": "product_id",
    "Category": "category",
    "Region": "region",
    "Inventory Level": "inventory_level",
    "Units Sold": "units_sold",
    "Units Ordered": "units_ordered",
    "Price": "price",
    "Discount": "discount_pct",
    "Weather Condition": "weather_condition",
    "Promotion": "promotion_flag",
    "Competitor Pricing": "competitor_pricing",
    "Seasonality": "seasonality",
    "Epidemic": "epidemic",
    "Demand": "demand_qty",
}

ORDER_INPUT_DEFAULTS = {
    "incoming_order_qty": 0.0,
    "backorder_qty": 0.0,
    "pack_size": 1,
    "minimum_order_qty": 0,
}
TIME_FEATURES = [
    "demand_lag_1",
    "demand_lag_7",
    "demand_lag_14",
    "demand_lag_28",
    "demand_rolling_mean_7",
    "demand_rolling_mean_28",
    "demand_rolling_std_7",
]
GENERATED_FEATURES = {
    "day_of_week",
    "year",
    "month",
    "day",
    "month_sin",
    "month_cos",
    *TIME_FEATURES,
}


class ArtifactBundleError(RuntimeError):
    pass


class InputValidationError(ValueError):
    pass


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.rename(columns=COLUMN_ALIASES).copy()
    if "date" in result.columns:
        result["date"] = pd.to_datetime(result["date"], errors="raise")
    return result


def ensure_order_inputs(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    for column, default in ORDER_INPUT_DEFAULTS.items():
        if column not in result.columns:
            result[column] = default
        else:
            result[column] = result[column].fillna(default)
        result[column] = pd.to_numeric(result[column], errors="raise")

    if result[["incoming_order_qty", "backorder_qty", "minimum_order_qty"]].lt(0).any().any():
        raise InputValidationError("입고예정·미납·MOQ 수량은 0 이상이어야 합니다.")
    if result["pack_size"].le(0).any():
        raise InputValidationError("pack_size는 1 이상의 양수여야 합니다.")
    return result


def calculate_constrained_order_qty(
    target_stock,
    on_hand,
    incoming_order_qty=0,
    backorder_qty=0,
    pack_size=1,
    minimum_order_qty=0,
):
    target = np.asarray(target_stock, dtype=float)
    hand = np.asarray(on_hand, dtype=float)
    incoming = np.asarray(incoming_order_qty, dtype=float)
    backorder = np.asarray(backorder_qty, dtype=float)
    pack = np.asarray(pack_size, dtype=float)
    moq = np.asarray(minimum_order_qty, dtype=float)

    if np.any(pack <= 0):
        raise InputValidationError("pack_size는 1 이상의 양수여야 합니다.")
    if np.any(incoming < 0) or np.any(backorder < 0) or np.any(moq < 0):
        raise InputValidationError("입고예정·미납·MOQ 수량은 0 이상이어야 합니다.")

    inventory_position = hand + incoming - backorder
    raw_order = np.maximum(target - inventory_position, 0)
    pack_rounded = np.where(
        raw_order > 0,
        np.ceil(raw_order / pack) * pack,
        0,
    )
    moq_rounded = np.ceil(moq / pack) * pack
    return np.where(
        pack_rounded > 0,
        np.maximum(pack_rounded, moq_rounded),
        0,
    ).astype(int)


def _load_model(path: Path) -> CatBoostRegressor:
    model = CatBoostRegressor()
    model.load_model(str(path))
    return model


class BmartInventoryPredictor:
    def __init__(self, artifact_dir: str | Path):
        self.artifact_dir = Path(artifact_dir).expanduser().resolve()
        config_path = self.artifact_dir / CONFIG_FILE
        required_paths = [config_path] + [
            self.artifact_dir / filename for filename in MODEL_FILES.values()
        ]
        missing = [str(path) for path in required_paths if not path.exists()]
        if missing:
            raise ArtifactBundleError(f"Artifact 누락: {missing}")

        with config_path.open("r", encoding="utf-8") as handle:
            self.config = json.load(handle)

        manifest_path = self.artifact_dir / "Bmart_v2_artifact_manifest.json"
        if manifest_path.exists():
            with manifest_path.open("r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            for filename, metadata in manifest.get("files", {}).items():
                artifact_path = self.artifact_dir / filename
                if not artifact_path.exists():
                    raise ArtifactBundleError(f"Manifest Artifact 누락: {filename}")
                current_hash = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
                if current_hash != metadata["sha256"]:
                    raise ArtifactBundleError(f"Artifact hash 불일치: {filename}")

        self.feature_columns = self.config["features"]
        self.categorical_features = self.config["categorical_features"]
        leadtime = self.config["leadtime_demand_model"]
        self.leadtime_feature_columns = leadtime["feature_columns"]
        self.protection_period_days = int(leadtime["protection_period_days"])
        self.leadtime_future_features = list(
            leadtime["planned_feature_contract"]["aggregation_rules"]
        )
        self.required_plan_columns = set(
            leadtime["planned_feature_contract"]["required_daily_columns"]
        )

        self.p90_correction = float(self.config["p90_correction"])
        self.p95_correction = float(self.config["p95_correction"])
        self.leadtime_p90_correction = float(leadtime["p90_correction"])
        self.leadtime_p95_correction = float(leadtime["p95_correction"])
        self.leadtime_calibration = leadtime.get("calibration", {})
        self.leadtime_window_days = self.leadtime_calibration.get(
            "selected_window_days"
        )
        self.leadtime_stale_warning_days = int(
            self.leadtime_calibration.get("stale_warning_days", 14)
        )
        residual_filename = self.leadtime_calibration.get(
            "residual_history_file", LEADTIME_RESIDUAL_FILE
        )
        residual_path = self.artifact_dir / residual_filename
        self.leadtime_residual_history = None
        if self.leadtime_calibration.get("default_method") == "rolling_conformal":
            if not residual_path.exists():
                raise ArtifactBundleError(
                    f"Rolling calibration residual file is missing: {residual_filename}"
                )
            residuals = pd.read_csv(residual_path)
            required_residual_columns = {
                "protection_end_date", "residual_p90", "residual_p95"
            }
            missing_residual_columns = required_residual_columns - set(residuals.columns)
            if missing_residual_columns:
                raise ArtifactBundleError(
                    "Calibration residual columns are missing: "
                    f"{sorted(missing_residual_columns)}"
                )
            residuals["protection_end_date"] = pd.to_datetime(
                residuals["protection_end_date"], errors="raise"
            )
            self.leadtime_residual_history = residuals
        self.target_contract = self.config.get("target_contract", {
            "status": "warning_unverified_semantics",
            "operational_interpretation": "Demand 의미가 검증되지 않았습니다.",
        })

        self.point_model = _load_model(self.artifact_dir / MODEL_FILES["point"])
        self.p90_model = _load_model(self.artifact_dir / MODEL_FILES["p90"])
        self.p95_model = _load_model(self.artifact_dir / MODEL_FILES["p95"])
        self.leadtime_p90_model = _load_model(
            self.artifact_dir / MODEL_FILES["leadtime_p90"]
        )
        self.leadtime_p95_model = _load_model(
            self.artifact_dir / MODEL_FILES["leadtime_p95"]
        )

    @property
    def forecast_input_columns(self) -> set[str]:
        model_inputs = set(self.feature_columns) - GENERATED_FEATURES
        return model_inputs | {"date", "inventory_level"}

    def _validate_history(self, history: pd.DataFrame) -> pd.DataFrame:
        required = {"date", "store_id", "product_id", "demand_qty"}
        missing = required - set(history.columns)
        if missing:
            raise InputValidationError(f"수요 이력 필수 컬럼 누락: {sorted(missing)}")
        if history.duplicated(["date", "store_id", "product_id"]).any():
            raise InputValidationError("수요 이력의 date-store-product 키가 중복되었습니다.")
        return history.sort_values(["store_id", "product_id", "date"])

    def build_one_day_features(
        self,
        history_df: pd.DataFrame,
        forecast_rows: pd.DataFrame,
    ) -> pd.DataFrame:
        history = self._validate_history(normalize_columns(history_df))
        forecast = ensure_order_inputs(normalize_columns(forecast_rows))
        missing = self.forecast_input_columns - set(forecast.columns)
        if missing:
            raise InputValidationError(f"미래 입력 필수 컬럼 누락: {sorted(missing)}")
        if forecast.duplicated(["date", "store_id", "product_id"]).any():
            raise InputValidationError("미래 입력의 date-store-product 키가 중복되었습니다.")

        latest = (
            history.groupby(["store_id", "product_id"])["date"]
            .max()
            .rename("latest_history_date")
            .reset_index()
        )
        forecast = forecast.merge(
            latest,
            on=["store_id", "product_id"],
            how="left",
            validate="many_to_one",
        )
        forecast["is_next_day"] = (
            forecast["date"] - forecast["latest_history_date"]
            == pd.Timedelta(days=1)
        )

        window_status = []
        for (store_id, product_id), group in history.groupby(
            ["store_id", "product_id"], sort=False
        ):
            recent = group["date"].sort_values().tail(28)
            consecutive = (
                len(recent) == 28
                and recent.diff().dropna().eq(pd.Timedelta(days=1)).all()
            )
            window_status.append({
                "store_id": store_id,
                "product_id": product_id,
                "consecutive_28_day_history": bool(consecutive),
            })
        forecast = forecast.merge(
            pd.DataFrame(window_status),
            on=["store_id", "product_id"],
            how="left",
            validate="many_to_one",
        )

        history_small = history[["date", "store_id", "product_id", "demand_qty"]].copy()
        history_small["_forecast_row"] = False
        forecast["demand_qty"] = np.nan
        forecast["_forecast_row"] = True
        combined = pd.concat([history_small, forecast], ignore_index=True, sort=False)
        combined = combined.sort_values(
            ["store_id", "product_id", "date", "_forecast_row"]
        ).reset_index(drop=True)

        for lag in [1, 7, 14, 28]:
            combined[f"demand_lag_{lag}"] = (
                combined.groupby(["store_id", "product_id"])["demand_qty"].shift(lag)
            )
        combined["demand_rolling_mean_7"] = (
            combined.groupby(["store_id", "product_id"])["demand_qty"]
            .transform(lambda x: x.shift(1).rolling(7, min_periods=7).mean())
        )
        combined["demand_rolling_mean_28"] = (
            combined.groupby(["store_id", "product_id"])["demand_qty"]
            .transform(lambda x: x.shift(1).rolling(28, min_periods=28).mean())
        )
        combined["demand_rolling_std_7"] = (
            combined.groupby(["store_id", "product_id"])["demand_qty"]
            .transform(lambda x: x.shift(1).rolling(7, min_periods=7).std())
        )

        prepared = combined[combined["_forecast_row"]].copy()
        prepared["day_of_week"] = prepared["date"].dt.day_name()
        prepared["year"] = prepared["date"].dt.year
        prepared["month"] = prepared["date"].dt.month
        prepared["day"] = prepared["date"].dt.day
        prepared["month_sin"] = np.sin(2 * np.pi * prepared["month"] / 12)
        prepared["month_cos"] = np.cos(2 * np.pi * prepared["month"] / 12)
        prepared["history_ready"] = (
            prepared[TIME_FEATURES].notna().all(axis=1)
            & prepared["is_next_day"].fillna(False)
            & prepared["consecutive_28_day_history"].fillna(False)
        )
        return prepared

    def _predict_and_order(
        self,
        prepared: pd.DataFrame,
        model_p90: CatBoostRegressor,
        model_p95: CatBoostRegressor,
        features: list[str],
        p90_correction: float,
        p95_correction: float,
        ready_column: str,
        p90_output: str,
        p95_output: str,
    ) -> pd.DataFrame:
        result_columns = [
            "date",
            "store_id",
            "product_id",
            "inventory_level",
            "incoming_order_qty",
            "backorder_qty",
            "pack_size",
            "minimum_order_qty",
            ready_column,
        ]
        if "protection_end_date" in prepared.columns:
            result_columns.insert(1, "protection_end_date")
        result = prepared[result_columns].copy()
        for metadata_column in [
            "calibration_p90_correction",
            "calibration_p95_correction",
            "calibration_as_of",
            "calibration_age_days",
            "calibration_status",
        ]:
            if metadata_column in prepared.columns:
                result[metadata_column] = prepared[metadata_column]
        result["prediction_status"] = np.where(
            result[ready_column],
            "ok",
            "insufficient_or_nonconsecutive_history",
        )

        ready = prepared[ready_column]
        if ready.any():
            ready_rows = prepared.loc[ready]
            ready_features = ready_rows[features]
            p90 = np.maximum(
                model_p90.predict(ready_features) + p90_correction,
                0,
            )
            p95_raw = np.maximum(
                model_p95.predict(ready_features) + p95_correction,
                0,
            )
            p95 = np.maximum(p95_raw, p90)
            inventory_position = (
                ready_rows["inventory_level"]
                + ready_rows["incoming_order_qty"]
                - ready_rows["backorder_qty"]
            )
            unconstrained = np.ceil(
                np.maximum(p95 - inventory_position.to_numpy(), 0)
            ).astype(int)
            constrained = calculate_constrained_order_qty(
                p95,
                ready_rows["inventory_level"],
                ready_rows["incoming_order_qty"],
                ready_rows["backorder_qty"],
                ready_rows["pack_size"],
                ready_rows["minimum_order_qty"],
            )

            result.loc[ready, "inventory_position"] = inventory_position
            result.loc[ready, p90_output] = p90
            result.loc[ready, p95_output] = p95
            result.loc[ready, "unconstrained_order_qty"] = unconstrained
            result.loc[ready, "recommended_order_qty"] = constrained
            result.loc[ready, "order_constraint_applied"] = constrained != unconstrained

        return result.sort_values(
            ["date", "store_id", "product_id"]
        ).reset_index(drop=True)

    def _rolling_leadtime_corrections(
        self,
        forecast_dates: pd.Series,
    ) -> pd.DataFrame:
        if self.leadtime_residual_history is None:
            return pd.DataFrame({
                "calibration_p90_correction": self.leadtime_p90_correction,
                "calibration_p95_correction": self.leadtime_p95_correction,
                "calibration_as_of": pd.NaT,
                "calibration_age_days": np.nan,
                "calibration_status": "fixed_fallback",
            }, index=range(len(forecast_dates)))

        history = self.leadtime_residual_history
        rows = []
        for forecast_date in pd.to_datetime(forecast_dates):
            eligible = history[history["protection_end_date"] < forecast_date]
            if eligible.empty:
                rows.append({
                    "calibration_p90_correction": self.leadtime_p90_correction,
                    "calibration_p95_correction": self.leadtime_p95_correction,
                    "calibration_as_of": pd.NaT,
                    "calibration_age_days": np.nan,
                    "calibration_status": "fallback_no_matured_residual",
                })
                continue

            recent = eligible
            if self.leadtime_window_days is not None:
                recent = eligible[
                    eligible["protection_end_date"]
                    >= forecast_date - pd.Timedelta(days=self.leadtime_window_days)
                ]
            status = "fresh"
            if recent.empty:
                latest_date = eligible["protection_end_date"].max()
                recent = eligible[
                    eligible["protection_end_date"]
                    >= latest_date
                    - pd.Timedelta(days=int(self.leadtime_window_days) - 1)
                ]
                status = "stale_fallback_latest_window"

            as_of = recent["protection_end_date"].max()
            age_days = int((forecast_date - as_of).days)
            if age_days > self.leadtime_stale_warning_days:
                status = "stale_fallback_latest_window"
            rows.append({
                "calibration_p90_correction": float(
                    np.quantile(recent["residual_p90"], 0.90)
                ),
                "calibration_p95_correction": float(
                    np.quantile(recent["residual_p95"], 0.95)
                ),
                "calibration_as_of": as_of,
                "calibration_age_days": age_days,
                "calibration_status": status,
            })
        return pd.DataFrame(rows)

    def predict_one_day(
        self,
        history_df: pd.DataFrame,
        forecast_rows: pd.DataFrame,
    ) -> pd.DataFrame:
        prepared = self.build_one_day_features(history_df, forecast_rows)
        result = self._predict_and_order(
            prepared,
            self.p90_model,
            self.p95_model,
            self.feature_columns,
            self.p90_correction,
            self.p95_correction,
            "history_ready",
            "p90_target_stock",
            "recommended_target_stock",
        )
        prepared_sorted = prepared.sort_values(
            ["date", "store_id", "product_id"]
        ).reset_index(drop=True)
        ready = prepared_sorted["history_ready"]
        result["point_forecast"] = np.nan
        if ready.any():
            result.loc[ready, "point_forecast"] = np.maximum(
                self.point_model.predict(
                    prepared_sorted.loc[ready, self.feature_columns]
                ),
                0,
            )
        return result

    def build_protection_period_features(
        self,
        history_df: pd.DataFrame,
        forecast_plan_rows: pd.DataFrame,
    ) -> pd.DataFrame:
        history = self._validate_history(normalize_columns(history_df))
        plan = ensure_order_inputs(normalize_columns(forecast_plan_rows))
        required = {
            "date",
            "store_id",
            "product_id",
            *self.required_plan_columns,
        }
        missing = required - set(plan.columns)
        if missing:
            raise InputValidationError(f"5일 계획 입력 필수 컬럼 누락: {sorted(missing)}")
        if plan.duplicated(["date", "store_id", "product_id"]).any():
            raise InputValidationError("5일 계획의 date-store-product 키가 중복되었습니다.")

        latest = history.groupby(["store_id", "product_id"])["date"].max()
        invalid = []
        for key, group in plan.groupby(["store_id", "product_id"], sort=False):
            if key not in latest.index:
                invalid.append((*key, "history_missing"))
                continue
            expected = list(pd.date_range(
                latest.loc[key] + pd.Timedelta(days=1),
                periods=self.protection_period_days,
                freq="D",
            ))
            if list(group["date"].sort_values()) != expected:
                invalid.append((*key, "consecutive_plan_required"))
        if invalid:
            raise InputValidationError(
                f"각 SKU에 연속 {self.protection_period_days}일 계획이 필요합니다: {invalid[:5]}"
            )

        first_day = (
            plan.sort_values(["store_id", "product_id", "date"])
            .groupby(["store_id", "product_id"], as_index=False)
            .head(1)
        )
        prepared = self.build_one_day_features(history, first_day)
        aggregates = (
            plan.groupby(["store_id", "product_id"], as_index=False)
            .agg(
                protection_price_mean=("price", "mean"),
                protection_discount_mean=("discount_pct", "mean"),
                protection_promotion_days=("promotion_flag", "sum"),
                protection_holiday_days=("is_holiday", "sum"),
                protection_end_date=("date", "max"),
            )
        )
        prepared = prepared.merge(
            aggregates,
            on=["store_id", "product_id"],
            how="left",
            validate="one_to_one",
        )
        prepared["protection_history_ready"] = (
            prepared["history_ready"]
            & prepared[self.leadtime_future_features].notna().all(axis=1)
        )
        return prepared

    def predict_protection_period(
        self,
        history_df: pd.DataFrame,
        forecast_plan_rows: pd.DataFrame,
    ) -> pd.DataFrame:
        prepared = self.build_protection_period_features(
            history_df,
            forecast_plan_rows,
        )
        ready = prepared["protection_history_ready"]
        corrections = self._rolling_leadtime_corrections(
            prepared.loc[ready, "date"]
        )
        for column in corrections.columns:
            prepared.loc[ready, column] = corrections[column].to_numpy()
        return self._predict_and_order(
            prepared,
            self.leadtime_p90_model,
            self.leadtime_p95_model,
            self.leadtime_feature_columns,
            prepared.loc[ready, "calibration_p90_correction"].to_numpy(),
            prepared.loc[ready, "calibration_p95_correction"].to_numpy(),
            "protection_history_ready",
            "protection_p90_target_stock",
            "protection_p95_target_stock",
        )
