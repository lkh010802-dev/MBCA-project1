export function sum(data, field) {
  return data.reduce((total, row) => total + Number(row[field] || 0), 0);
}

export function average(data, field) {
  if (!data.length) return 0;
  return sum(data, field) / data.length;
}

export function getSummary(data) {
  const urgent = data.filter((r) => r.reorder_flag_90 === 1).length;
  const adequate = data.filter(
    (r) => r.stock_level_start >= r.safety_stock_90
  ).length;

  return {
    predictedDemand: sum(data, "predicted_demand"),
    urgentOrders: urgent,
    recommendedOrderQty: sum(data, "order_qty_90"),
    adequateRate: data.length ? (adequate / data.length) * 100 : 0
  };
}

export function getOrderPriority(data, limit = 5) {
  const grouped = new Map();

  data.forEach((row) => {
    const key = row.product_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        product_id: key,
        category: row.category,
        order_qty_90: 0,
        predicted_demand: 0,
        stock_level_start: 0,
        reorder_count: 0
      });
    }
    const item = grouped.get(key);
    item.order_qty_90 += row.order_qty_90;
    item.predicted_demand += row.predicted_demand;
    item.stock_level_start += row.stock_level_start;
    item.reorder_count += row.reorder_flag_90;
  });

  return [...grouped.values()]
    .sort((a, b) => b.order_qty_90 - a.order_qty_90)
    .slice(0, limit);
}

export function getProductChartData(data) {
  const grouped = new Map();

  data.forEach((row) => {
    if (!grouped.has(row.product_id)) {
      grouped.set(row.product_id, {
        product_id: row.product_id,
        predicted_demand: 0,
        lead_time_demand: 0,
        order_qty_90: 0
      });
    }
    const item = grouped.get(row.product_id);
    item.predicted_demand += row.predicted_demand;
    item.lead_time_demand += row.lead_time_demand;
    item.order_qty_90 += row.order_qty_90;
  });

  return [...grouped.values()]
    .sort((a, b) => b.order_qty_90 - a.order_qty_90)
    .slice(0, 8);
}

export function getRiskRows(data, limit = 8) {
  return [...data]
    .filter((r) => r.reorder_flag_90 === 1)
    .sort((a, b) => b.order_qty_90 - a.order_qty_90)
    .slice(0, limit);
}

export function getInventoryStatus(data) {
  let shortage = 0;
  let adequate = 0;
  let excess = 0;

  data.forEach((row) => {
    const stock = row.stock_level_start;
    const safety = row.safety_stock_90;
    const reorder = row.reorder_point_90;

    if (stock <= reorder) shortage++;
    else if (stock <= safety * 1.5) adequate++;
    else excess++;
  });

  return [
    { name: "부족", value: shortage },
    { name: "적정", value: adequate },
    { name: "과잉", value: excess }
  ];
}

export function getRecommendedOrders(data, limit = 20) {
  return [...data]
    .filter((r) => r.order_qty_90 > 0)
    .sort((a, b) => b.order_qty_90 - a.order_qty_90)
    .slice(0, limit);
}