-- Fix process lines that store FG as output on every step (incorrect backfill).
UPDATE prd_order_lines l
INNER JOIN prd_orders o ON o.production_order_id = l.production_order_id
SET l.output_item_id = NULL
WHERE l.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND l.output_item_id = o.parent_item_id;
