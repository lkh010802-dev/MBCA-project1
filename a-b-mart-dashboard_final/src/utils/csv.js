import Papa from "papaparse";

const numberFields = [
  "base_price", "actual_price", "discount_pct", "promotion_flag",
  "is_holiday", "stock_level_start", "lead_time_days", "true_demand",
  "sales_qty", "lost_sales_qty", "day_of_week", "seasonality",
  "lag_1", "lag_7", "lag_14", "lag_28",
  "rolling_mean_3", "rolling_mean_7", "rolling_mean_14", "rolling_mean_28",
  "demand_std_7", "demand_std_14", "demand_std_28", "predicted_demand",
  "lead_time_days_adj", "demand_std", "lead_time_demand",
  "safety_stock_90", "safety_stock_95", "recommended_stock_90",
  "recommended_stock_95", "reorder_point_90", "reorder_point_95",
  "reorder_flag_90", "reorder_flag_95", "order_qty_90", "order_qty_95"
];

export function loadDashboardCsv(path = "/dashboard_full_data.csv") {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) => {
          const converted = { ...row };
          numberFields.forEach((field) => {
            converted[field] = Number(converted[field] || 0);
          });
          return converted;
        });
        resolve(convertedRows(rows));
      },
      error: reject
    });
  });
}

function convertedRows(rows) {
  return rows.filter((row) => row.store_id && row.product_id);
}