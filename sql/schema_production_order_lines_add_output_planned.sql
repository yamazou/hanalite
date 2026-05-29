-- Per process line: output item and planned quantity (overrides BOM / order header when set)
ALTER TABLE prd_order_lines
  ADD COLUMN output_item_id INT UNSIGNED NULL AFTER wip_location_id,
  ADD COLUMN planned_qty DECIMAL(15, 3) NULL AFTER output_item_id,
  ADD KEY idx_prd_order_lines_output_item (output_item_id),
  ADD CONSTRAINT fk_prd_order_lines_output_item
    FOREIGN KEY (output_item_id) REFERENCES m_items (item_id);

UPDATE prd_order_lines l
INNER JOIN prd_orders o ON o.production_order_id = l.production_order_id
SET l.planned_qty = COALESCE(l.planned_qty, o.planned_qty)
WHERE l.deleted_at IS NULL AND o.deleted_at IS NULL;

-- Wrong backfill: FG parent_item_id on every line hides BOM step outputs.
UPDATE prd_order_lines l
INNER JOIN prd_orders o ON o.production_order_id = l.production_order_id
SET l.output_item_id = NULL
WHERE l.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND l.output_item_id = o.parent_item_id;
