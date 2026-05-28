-- Header (1 per FG) + process lines (multiple per order)
-- Run on DB that already has prd_orders with itemproc_id on header.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS prd_order_lines (
  prd_order_line_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_order_id BIGINT UNSIGNED NOT NULL,
  line_no INT NOT NULL DEFAULT 1,
  itemproc_id BIGINT UNSIGNED NOT NULL,
  rm_location_id INT UNSIGNED NOT NULL,
  wip_location_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  actual_qty DECIMAL(15, 3) NULL,
  completed_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (prd_order_line_id),
  KEY idx_prd_order_lines_order (production_order_id),
  KEY idx_prd_order_lines_itemproc (itemproc_id),
  CONSTRAINT fk_prd_order_lines_order FOREIGN KEY (production_order_id) REFERENCES prd_orders (production_order_id),
  CONSTRAINT fk_prd_order_lines_itemproc FOREIGN KEY (itemproc_id) REFERENCES m_itemprocs (itemproc_id),
  CONSTRAINT fk_prd_order_lines_rm_loc FOREIGN KEY (rm_location_id) REFERENCES m_locations (location_id),
  CONSTRAINT fk_prd_order_lines_wip_loc FOREIGN KEY (wip_location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing header-level process into one line per order
INSERT INTO prd_order_lines (
  production_order_id, line_no, itemproc_id, rm_location_id, wip_location_id,
  status, actual_qty, completed_at, created_at, updated_at
)
SELECT
  o.production_order_id,
  1,
  o.itemproc_id,
  o.rm_location_id,
  o.wip_location_id,
  IF(o.status = 'completed', 'completed', 'planned'),
  o.actual_qty,
  o.completed_at,
  COALESCE(o.created_at, NOW()),
  COALESCE(o.updated_at, NOW())
FROM prd_orders o
WHERE o.deleted_at IS NULL
  AND o.itemproc_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM prd_order_lines l
    WHERE l.production_order_id = o.production_order_id AND l.deleted_at IS NULL
  );

ALTER TABLE prd_order_outputs
  ADD COLUMN prd_order_line_id BIGINT UNSIGNED NULL AFTER production_order_id;

ALTER TABLE prd_order_outputs
  ADD KEY idx_prd_order_outputs_line (prd_order_line_id);

ALTER TABLE prd_order_outputs
  ADD CONSTRAINT fk_prd_order_outputs_line
    FOREIGN KEY (prd_order_line_id) REFERENCES prd_order_lines (prd_order_line_id);

ALTER TABLE prd_orders DROP FOREIGN KEY fk_prd_orders_itemproc;
ALTER TABLE prd_orders DROP FOREIGN KEY fk_prd_orders_rm_loc;
ALTER TABLE prd_orders DROP FOREIGN KEY fk_prd_orders_wip_loc;

ALTER TABLE prd_orders DROP COLUMN itemproc_id;
ALTER TABLE prd_orders DROP COLUMN rm_location_id;
ALTER TABLE prd_orders DROP COLUMN wip_location_id;
