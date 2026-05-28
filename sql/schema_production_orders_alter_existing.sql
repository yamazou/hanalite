-- Apply when m_itemprocs / prd_orders already exist from an older script.
-- Fixes: (1) MySQL partial unique index via active_key
--        (2) missing prd_orders.itemproc_id (causes API 500)

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1) m_itemprocs: active rows unique on (item_id, process_no)
--    Skip if active_key already exists (duplicate column error = already applied).
-- ---------------------------------------------------------------------------
ALTER TABLE m_itemprocs
  ADD COLUMN active_key TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED;

ALTER TABLE m_itemprocs
  ADD UNIQUE KEY uq_itemproc_item_process_active (item_id, process_no, active_key);

-- ---------------------------------------------------------------------------
-- 2) prd_orders: link to item process master
--    Legacy orders created before itemproc_id cannot be kept (no process row).
--    Remove test data only; comment out DELETE block if you will backfill manually.
-- ---------------------------------------------------------------------------
DELETE poi FROM prd_order_inputs poi
  INNER JOIN prd_orders po ON po.production_order_id = poi.production_order_id;

DELETE poo FROM prd_order_outputs poo
  INNER JOIN prd_orders po ON po.production_order_id = poo.production_order_id;

DELETE FROM prd_orders;

-- Must match m_itemprocs.itemproc_id (often BIGINT UNSIGNED on existing DBs)
ALTER TABLE prd_orders
  ADD COLUMN itemproc_id BIGINT UNSIGNED NOT NULL AFTER parent_item_id;

ALTER TABLE prd_orders
  ADD KEY idx_prd_orders_itemproc (itemproc_id);

ALTER TABLE prd_orders
  ADD CONSTRAINT fk_prd_orders_itemproc
    FOREIGN KEY (itemproc_id) REFERENCES m_itemprocs (itemproc_id);

-- If itemproc_id was already added as INT, fix type before adding FK:
-- ALTER TABLE prd_orders MODIFY COLUMN itemproc_id BIGINT UNSIGNED NOT NULL;
