from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


CATEGORY_KO = {
    "Electronics": "전자제품",
    "Clothing": "의류",
    "Groceries": "식료품",
    "Toys": "완구",
    "Furniture": "가구",
}
REGION_KO = {"North": "북부", "South": "남부", "East": "동부", "West": "서부"}
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def number_value(row: dict[str, str], key: str, default: float = 0.0) -> float:
    try:
        value = row.get(key, "")
        return float(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return default


def rounded(value: float) -> int:
    return int(math.floor(value + 0.5))


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def pct_change(current: float, previous: float) -> float:
    return ((current - previous) / previous * 100) if previous else 0.0


def trend_text(current: float, previous: float, unit: str = "%") -> str:
    change = current - previous if unit == "%p" else pct_change(current, previous)
    return f"전일 대비 {change:+.1f}{unit}"


def risk_of(priority: str) -> str:
    if priority in {"긴급", "높음"}:
        return "긴급"
    if priority == "보통":
        return "주의"
    return "정상"


def stockout_date(row: dict[str, str], latest_date: datetime) -> str:
    if number_value(row, "shortage_to_target") <= 0:
        return "-"
    daily = max(number_value(row, "point_forecast"), 1.0)
    inventory = max(number_value(row, "inventory_position", number_value(row, "inventory_level")), 0.0)
    days = max(1, math.ceil(inventory / daily))
    return (latest_date + timedelta(days=days)).strftime("%Y-%m-%d")


def aggregate(rows: list[dict[str, str]], group_key, value_key: str = "demand_qty") -> list[dict]:
    groups: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        groups[str(group_key(row))].append(number_value(row, value_key))
    return [
        {"label": label, "averageDemand": round(average(values), 3), "rows": len(values)}
        for label, values in sorted(groups.items())
    ]


def rolling_model_metrics(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    rows = read_csv(path)
    return {
        "name": "CatBoost",
        "rmse": round(average([number_value(row, "RMSE") for row in rows]), 3),
        "mae": round(average([number_value(row, "MAE") for row in rows]), 3),
        "r2": round(average([number_value(row, "R2") for row in rows]), 5),
        "wape": round(average([number_value(row, "WAPE") for row in rows]), 3),
        "bias": round(average([number_value(row, "Bias") for row in rows]), 3),
        "validation": f"날짜 기준 롤링 {len(rows)}-Fold",
        "trainedThrough": max(row["Valid_End"] for row in rows),
    }


def dynamic_policy_metrics(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    rows = read_csv(path)
    p95 = next((row for row in rows if "P95" in row.get("policy", "")), None)
    if not p95:
        return {}
    return {
        "policy": p95["policy"],
        "serviceLevel": round(number_value(p95, "Service_Level"), 2),
        "stockoutRate": round(number_value(p95, "Stockout_Rate"), 2),
        "fillRate": round(number_value(p95, "Fill_Rate"), 2),
        "evaluationStart": p95.get("Evaluation_Start"),
        "evaluationEnd": p95.get("Evaluation_End"),
        "leadTimeDays": rounded(number_value(p95, "Lead_Time_Days")),
    }


def build_service_json(
    service_rows: list[dict[str, str]],
    rolling_path: Path | None,
    dynamic_path: Path | None,
) -> dict:
    service_rows.sort(key=lambda row: (row["date"], row["store_id"], row["product_id"]))
    dates = sorted({row["date"] for row in service_rows})
    latest_date_text = dates[-1]
    previous_date_text = dates[-2]
    latest_date = datetime.strptime(latest_date_text, "%Y-%m-%d")
    latest = [row for row in service_rows if row["date"] == latest_date_text]
    previous = [row for row in service_rows if row["date"] == previous_date_text]
    series: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in service_rows:
        series[(row["store_id"], row["product_id"])].append(row)

    def summary_values(rows: list[dict[str, str]]) -> dict[str, float]:
        return {
            "demand": sum(number_value(row, "point_forecast") for row in rows),
            "urgent": sum(risk_of(row.get("order_priority", "")) == "긴급" for row in rows),
            "orderQty": sum(number_value(row, "recommended_order_qty") for row in rows),
            "healthyRate": sum(row.get("inventory_status") == "적정 재고" for row in rows) / max(len(rows), 1) * 100,
        }

    current_summary = summary_values(latest)
    previous_summary = summary_values(previous)
    products = []
    for row in latest:
        key = (row["store_id"], row["product_id"])
        history = series[key][-12:]
        target = number_value(row, "recommended_target_stock")
        point = number_value(row, "point_forecast")
        frequency = sum(item.get("inventory_status") == "발주 필요" for item in series[key][-30:])
        products.append({
            "id": f"B-{row['store_id']}-{row['product_id']}",
            "mart": "B",
            "store": f"{row['store_id']} · {REGION_KO.get(row.get('region', ''), row.get('region', ''))}",
            "storeId": row["store_id"],
            "product": row["product_id"],
            "label": f"{CATEGORY_KO.get(row.get('category', ''), row.get('category', '상품'))} {row['product_id']}",
            "category": row.get("category"),
            "categoryKo": CATEGORY_KO.get(row.get("category", ""), row.get("category", "기타")),
            "region": row.get("region"),
            "risk": risk_of(row.get("order_priority", "")),
            "originalPriority": row.get("order_priority", "해당 없음"),
            "demand": rounded(point),
            "actualDemand": rounded(number_value(row, "demand_qty")),
            "stock": rounded(number_value(row, "inventory_level")),
            "inventoryPosition": rounded(number_value(row, "inventory_position", number_value(row, "inventory_level"))),
            "incomingOrderQty": rounded(number_value(row, "incoming_order_qty")),
            "backorderQty": rounded(number_value(row, "backorder_qty")),
            "packSize": max(1, rounded(number_value(row, "pack_size", 1))),
            "minimumOrderQty": rounded(number_value(row, "minimum_order_qty")),
            "constraintApplied": row.get("order_constraint_applied", "False").lower() == "true",
            "safety": max(0, rounded(target - point)),
            "targetStock": rounded(target),
            "orderQty": rounded(number_value(row, "recommended_order_qty")),
            "stockoutDate": stockout_date(row, latest_date),
            "frequency": f"{frequency}회 / 30일",
            "currentSales": [rounded(number_value(item, "demand_qty")) for item in history],
            "forecast": [round(number_value(item, "point_forecast"), 1) for item in history],
            "price": round(number_value(row, "price"), 2),
            "promotion": number_value(row, "promotion_flag") > 0,
            "discountPct": number_value(row, "discount_pct"),
            "inventoryStatus": row.get("inventory_status", "적정 재고"),
            "managementAction": row.get("management_action", "정상 유지"),
            "shortage": rounded(number_value(row, "shortage_to_target")),
            "excess": rounded(number_value(row, "excess_inventory")),
        })
    risk_order = {"긴급": 0, "주의": 1, "정상": 2}
    products.sort(key=lambda item: (risk_order[item["risk"]], -item["shortage"], item["storeId"], item["product"]))

    inventory_by_store = []
    for store_id in sorted({row["store_id"] for row in latest}):
        store_rows = [row for row in latest if row["store_id"] == store_id]
        region = store_rows[0].get("region", "")
        inventory_by_store.append({
            "store": f"{store_id} · {REGION_KO.get(region, region)}",
            "shortage": rounded(sum(number_value(row, "shortage_to_target") for row in store_rows)),
            "healthy": rounded(sum(number_value(row, "inventory_level") for row in store_rows if row.get("inventory_status") == "적정 재고")),
            "excess": rounded(sum(number_value(row, "excess_inventory") for row in store_rows)),
        })

    model = rolling_model_metrics(rolling_path)
    model.update(dynamic_policy_metrics(dynamic_path))
    model["confidence"] = round(max(0.0, 1 - model.get("wape", 0) / 100), 5)
    return {
        "metadata": {
            "source": "Bmart_v2_service_result.csv",
            "latestDate": latest_date_text,
            "rowCount": len(service_rows),
            "latestRowCount": len(latest),
            "storeCount": len({row["store_id"] for row in latest}),
            "productCount": len({row["product_id"] for row in latest}),
            "target": "demand_qty",
        },
        "summary": {
            "demand": rounded(current_summary["demand"]),
            "urgent": rounded(current_summary["urgent"]),
            "orderQty": rounded(current_summary["orderQty"]),
            "healthyRate": round(current_summary["healthyRate"], 1),
            "demandTrend": trend_text(current_summary["demand"], previous_summary["demand"]),
            "urgentTrend": f"전일 대비 {current_summary['urgent'] - previous_summary['urgent']:+.0f}개",
            "orderTrend": trend_text(current_summary["orderQty"], previous_summary["orderQty"]),
            "healthyTrend": trend_text(current_summary["healthyRate"], previous_summary["healthyRate"], "%p"),
            "asOf": latest_date_text.replace("-", "."),
            "asOfLabel": f"{latest_date_text.replace('-', '.')} ({WEEKDAY_KO[latest_date.weekday()]})",
        },
        "inventorySummary": {
            "shortage": sum(item["shortage"] for item in products),
            "healthy": sum(item["stock"] for item in products if item["inventoryStatus"] == "적정 재고"),
            "excess": sum(item["excess"] for item in products),
        },
        "inventoryByStore": inventory_by_store,
        "model": model,
        "products": products,
    }


def build_analysis_json(service_rows: list[dict[str, str]], raw_rows: list[dict[str, str]] | None) -> dict:
    promotion = aggregate(service_rows, lambda row: "프로모션 적용" if number_value(row, "promotion_flag") else "프로모션 미적용")

    def discount_band(row: dict[str, str]) -> str:
        value = number_value(row, "discount_pct")
        if value == 0:
            return "0%"
        if value <= 5:
            return "1~5%"
        if value <= 10:
            return "6~10%"
        return "11% 이상"

    result = {
        "metadata": {
            "serviceRows": len(service_rows),
            "serviceStart": min(row["date"] for row in service_rows),
            "serviceEnd": max(row["date"] for row in service_rows),
            "interpretation": "기술통계이며 인과효과 또는 잠재수요 추정치가 아닙니다.",
        },
        "promotion": promotion,
        "discount": aggregate(service_rows, discount_band),
        "region": aggregate(service_rows, lambda row: REGION_KO.get(row.get("region", ""), row.get("region", "기타"))),
        "category": aggregate(service_rows, lambda row: CATEGORY_KO.get(row.get("category", ""), row.get("category", "기타"))),
        "season": [],
        "stockoutRelationship": [],
    }
    if raw_rows:
        result["metadata"]["rawRows"] = len(raw_rows)
        result["season"] = aggregate(raw_rows, lambda row: row.get("Seasonality", "Unknown"), "Demand")
        by_series: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
        for row in sorted(raw_rows, key=lambda item: (item["Store ID"], item["Product ID"], item["Date"])):
            by_series[(row["Store ID"], row["Product ID"])].append(row)
        after_proxy: list[float] = []
        after_normal: list[float] = []
        for rows in by_series.values():
            for current, following in zip(rows, rows[1:]):
                proxy = number_value(current, "Inventory Level") > 0 and number_value(current, "Units Sold") >= number_value(current, "Inventory Level")
                (after_proxy if proxy else after_normal).append(number_value(following, "Demand"))
        result["stockoutRelationship"] = [
            {"label": "결품 후보 다음날", "averageDemand": round(average(after_proxy), 3), "rows": len(after_proxy)},
            {"label": "일반 관측 다음날", "averageDemand": round(average(after_normal), 3), "rows": len(after_normal)},
        ]
        result["metadata"]["stockoutProxyDefinition"] = "Inventory Level > 0 and Units Sold >= Inventory Level"
    return result


def build_receipt_json(
    recommendation_rows: list[dict[str, str]],
    open_order_rows: list[dict[str, str]],
    supplier_rows: list[dict[str, str]],
    comparison_rows: list[dict[str, str]],
    config: dict,
) -> dict:
    latest_date = max(row["date"] for row in recommendation_rows)
    latest = [row for row in recommendation_rows if row["date"] == latest_date]
    open_by_product: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in open_order_rows:
        open_by_product[(row["store_id"], row["product_id"])].append(row)

    products = {}
    for row in latest:
        key = (row["store_id"], row["product_id"])
        open_rows = open_by_product.get(key, [])
        products[f"B-{row['store_id']}-{row['product_id']}"] = {
            "incomingOrderQty": rounded(number_value(row, "incoming_order_qty")),
            "effectiveIncomingQty": rounded(number_value(row, "effective_incoming_qty")),
            "openPurchaseOrders": rounded(number_value(row, "open_purchase_orders")),
            "receiptAdjustedInventoryPosition": rounded(number_value(row, "receipt_adjusted_inventory_position")),
            "receiptAdjustedOrderQty": rounded(number_value(row, "receipt_adjusted_order_qty")),
            "duplicateOrderAvoidedQty": rounded(number_value(row, "duplicate_order_avoided_qty")),
            "receiptStatuses": dict(Counter(item.get("known_status", "입고 예정") for item in open_rows)),
        }

    return {
        "metadata": {
            "dataOrigin": config.get("data_origin", "unknown"),
            "asOf": latest_date,
            "interpretation": "실제 발주·입고 원장이 없으므로 현재 값은 파이프라인 검증용 시뮬레이션입니다.",
            "delayedReceiptWeight": config.get("policy", {}).get("delayed_receipt_weight", 0.7),
        },
        "summary": {
            "openOrders": len(open_order_rows),
            "openQty": rounded(sum(number_value(row, "open_qty") for row in open_order_rows)),
            "delayedOrders": sum(row.get("known_status") == "입고 지연" for row in open_order_rows),
            "partialOrders": sum(number_value(row, "known_received_qty") > 0 for row in open_order_rows),
            "effectiveIncomingQty": rounded(sum(number_value(row, "effective_incoming_qty") for row in open_order_rows)),
        },
        "products": products,
        "openOrders": sorted(open_order_rows, key=lambda row: (row.get("known_status") != "입고 지연", row.get("expected_arrival_date", ""))),
        "suppliers": supplier_rows,
        "policyComparison": comparison_rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build React JSON files from Bmart CSV artifacts")
    parser.add_argument("--service", type=Path, default=Path("data/Bmart_v2_service_result.csv"))
    parser.add_argument("--raw", type=Path, default=Path("data/B_mart.csv"))
    parser.add_argument("--rolling", type=Path, default=Path("data/Bmart_v2_rolling_validation.csv"))
    parser.add_argument("--dynamic", type=Path, default=Path("data/Bmart_v2_dynamic_policy_comparison.csv"))
    parser.add_argument("--output", type=Path, default=Path("src/data/bmartRealData.json"))
    parser.add_argument("--analysis-output", type=Path, default=Path("src/data/bmartAnalysisData.json"))
    parser.add_argument("--receipt-recommendation", type=Path, default=Path("data/Bmart_receipt_adjusted_order_recommendation.csv"))
    parser.add_argument("--open-orders", type=Path, default=Path("data/Bmart_open_orders.csv"))
    parser.add_argument("--supplier-summary", type=Path, default=Path("data/Bmart_supplier_leadtime_summary.csv"))
    parser.add_argument("--receipt-comparison", type=Path, default=Path("data/Bmart_receipt_policy_comparison.csv"))
    parser.add_argument("--receipt-config", type=Path, default=Path("data/Bmart_receipt_model_config.json"))
    parser.add_argument("--receipt-output", type=Path, default=Path("src/data/bmartReceiptData.json"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    service_rows = read_csv(args.service)
    raw_rows = read_csv(args.raw) if args.raw.exists() else None
    service_json = build_service_json(service_rows, args.rolling, args.dynamic)
    analysis_json = build_analysis_json(service_rows, raw_rows)
    receipt_json = build_receipt_json(
        read_csv(args.receipt_recommendation),
        read_csv(args.open_orders),
        read_csv(args.supplier_summary),
        read_csv(args.receipt_comparison),
        json.loads(args.receipt_config.read_text(encoding="utf-8")),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.analysis_output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(service_json, ensure_ascii=False, indent=2), encoding="utf-8")
    args.analysis_output.write_text(json.dumps(analysis_json, ensure_ascii=False, indent=2), encoding="utf-8")
    args.receipt_output.write_text(json.dumps(receipt_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"service rows: {len(service_rows):,}")
    print(f"products: {len(service_json['products']):,}")
    print(f"wrote: {args.output}")
    print(f"wrote: {args.analysis_output}")
    print(f"wrote: {args.receipt_output}")


if __name__ == "__main__":
    main()
