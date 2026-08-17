from __future__ import annotations

from collections.abc import Mapping

import numpy as np
import pandas as pd


DEFAULT_THRESHOLDS = {
    "point_wape_warning_pct": 6.0,
    "point_wape_retrain_pct": 8.0,
    "absolute_bias_warning_pct": 3.0,
    "p90_coverage_min_pct": 87.0,
    "p90_coverage_max_pct": 93.0,
    "p95_coverage_min_pct": 92.0,
    "p95_coverage_max_pct": 98.0,
    "psi_warning": 0.20,
    "psi_retrain": 0.30,
    "missing_feature_rate_retrain_pct": 0.0,
    "unknown_category_rate_warning_pct": 1.0,
    "consecutive_warning_windows_for_retrain": 3,
}


def prediction_metrics(
    actual,
    point_forecast,
    p90_forecast=None,
    p95_forecast=None,
) -> dict[str, float]:
    actual = np.asarray(actual, dtype=float)
    point = np.asarray(point_forecast, dtype=float)
    if actual.shape != point.shape:
        raise ValueError("actual과 point_forecast 길이가 다릅니다.")
    if actual.size == 0:
        raise ValueError("평가할 관측치가 없습니다.")
    if not np.isfinite(actual).all() or not np.isfinite(point).all():
        raise ValueError("actual 또는 point_forecast에 비정상 값이 있습니다.")

    error = point - actual
    denominator = np.abs(actual).sum()
    metrics = {
        "rows": float(actual.size),
        "mae": float(np.abs(error).mean()),
        "rmse": float(np.sqrt(np.square(error).mean())),
        "wape_pct": float(np.abs(error).sum() / denominator * 100)
        if denominator > 0
        else np.nan,
        "bias": float(error.mean()),
        "bias_pct": float(error.sum() / denominator * 100)
        if denominator > 0
        else np.nan,
    }
    if p90_forecast is not None:
        p90 = np.asarray(p90_forecast, dtype=float)
        if p90.shape != actual.shape:
            raise ValueError("P90 길이가 actual과 다릅니다.")
        metrics["p90_coverage_pct"] = float((actual <= p90).mean() * 100)
    if p95_forecast is not None:
        p95 = np.asarray(p95_forecast, dtype=float)
        if p95.shape != actual.shape:
            raise ValueError("P95 길이가 actual과 다릅니다.")
        metrics["p95_coverage_pct"] = float((actual <= p95).mean() * 100)
        if p90_forecast is not None:
            metrics["quantile_crossing_rate_pct"] = float((p90 > p95).mean() * 100)
    return metrics


def population_stability_index(reference, current, bins: int = 10) -> float:
    reference = np.asarray(reference, dtype=float)
    current = np.asarray(current, dtype=float)
    reference = reference[np.isfinite(reference)]
    current = current[np.isfinite(current)]
    if reference.size == 0 or current.size == 0:
        return np.nan

    edges = np.unique(np.quantile(reference, np.linspace(0, 1, bins + 1)))
    if edges.size < 3:
        return 0.0 if np.isclose(reference.mean(), current.mean()) else np.inf
    edges[0] = -np.inf
    edges[-1] = np.inf
    ref_counts, _ = np.histogram(reference, bins=edges)
    cur_counts, _ = np.histogram(current, bins=edges)
    epsilon = 1e-6
    ref_pct = np.clip(ref_counts / ref_counts.sum(), epsilon, None)
    cur_pct = np.clip(cur_counts / cur_counts.sum(), epsilon, None)
    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))


def assess_retraining(
    metrics: Mapping[str, float],
    thresholds: Mapping[str, float] | None = None,
    consecutive_warning_windows: int = 0,
) -> pd.DataFrame:
    limits = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    checks = []

    def add(metric, value, warning, retrain, direction):
        status = "ok"
        if direction == "high":
            if value >= retrain:
                status = "retrain"
            elif value >= warning:
                status = "warning"
        elif direction == "range":
            low_warning, high_warning = warning
            low_retrain, high_retrain = retrain
            if value < low_retrain or value > high_retrain:
                status = "retrain"
            elif value < low_warning or value > high_warning:
                status = "warning"
        checks.append({"metric": metric, "value": value, "status": status})

    if "wape_pct" in metrics:
        add(
            "wape_pct",
            float(metrics["wape_pct"]),
            limits["point_wape_warning_pct"],
            limits["point_wape_retrain_pct"],
            "high",
        )
    if "bias_pct" in metrics:
        add(
            "absolute_bias_pct",
            abs(float(metrics["bias_pct"])),
            limits["absolute_bias_warning_pct"],
            limits["absolute_bias_warning_pct"] * 2,
            "high",
        )
    if "p90_coverage_pct" in metrics:
        low = limits["p90_coverage_min_pct"]
        high = limits["p90_coverage_max_pct"]
        add(
            "p90_coverage_pct",
            float(metrics["p90_coverage_pct"]),
            (low, high),
            (low - 2, high + 2),
            "range",
        )
    if "p95_coverage_pct" in metrics:
        low = limits["p95_coverage_min_pct"]
        high = limits["p95_coverage_max_pct"]
        add(
            "p95_coverage_pct",
            float(metrics["p95_coverage_pct"]),
            (low, high),
            (low - 2, high + 2),
            "range",
        )
    if "max_numeric_psi" in metrics:
        add(
            "max_numeric_psi",
            float(metrics["max_numeric_psi"]),
            limits["psi_warning"],
            limits["psi_retrain"],
            "high",
        )
    if "missing_feature_rate_pct" in metrics:
        add(
            "missing_feature_rate_pct",
            float(metrics["missing_feature_rate_pct"]),
            limits["missing_feature_rate_retrain_pct"],
            limits["missing_feature_rate_retrain_pct"],
            "high",
        )

    result = pd.DataFrame(checks)
    persistent = (
        consecutive_warning_windows
        >= int(limits["consecutive_warning_windows_for_retrain"])
    )
    if persistent and not result.empty and result["status"].eq("warning").any():
        result.loc[result["status"].eq("warning"), "status"] = "retrain"
        result["reason"] = "persistent_warning_windows"
    else:
        result["reason"] = "current_window"
    return result
