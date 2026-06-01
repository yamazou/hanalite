-- Production orders (MySQL / MariaDB)
-- Usage: mysql -u root hanalite < sql/schema_production_orders.sql

SET NAMES utf8mb4;

-- One header per FG production order
CREATE TABLE IF NOT EXISTS prd_orders (
  production_order_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  status VARCHAR(20) NOT NULL DEFAULT 'registered',
  production_date DATE NOT NULL,
  reference_no VARCHAR(100) NULL,
  source_type ENUM('manual', 'excel') NOT NULL DEFAULT 'manual',
  parent_item_id INT UNSIGNED NOT NULL,
  planned_qty DECIMAL(15, 3) NOT NULL,
  actual_qty DECIMAL(15, 3) NULL,
  lot VARCHAR(50) NOT NULL,
  notes TEXT NULL,
  approved_at DATETIME NULL DEFAULT NULL,
  cancelled_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (production_order_id),
  KEY idx_prd_orders_status (status),
  KEY idx_prd_orders_parent_item (parent_item_id),
  CONSTRAINT fk_prd_orders_parent FOREIGN KEY (parent_item_id) REFERENCES m_items (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Process steps (from Item Process master) per order
CREATE TABLE IF NOT EXISTS prd_order_lines (
  prd_order_line_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_order_id INT UNSIGNED NOT NULL,
  line_no INT NOT NULL DEFAULT 1,
  rm_location_id INT UNSIGNED NOT NULL,
  wip_location_id INT UNSIGNED NOT NULL,
  output_item_id INT UNSIGNED NULL,
  planned_qty DECIMAL(15, 3) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  actual_qty DECIMAL(15, 3) NULL,
  completed_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (prd_order_line_id),
  KEY idx_prd_order_lines_order (production_order_id),
  KEY idx_prd_order_lines_output_item (output_item_id),
  CONSTRAINT fk_prd_order_lines_order FOREIGN KEY (production_order_id) REFERENCES prd_orders (production_order_id),
  CONSTRAINT fk_prd_order_lines_rm_loc FOREIGN KEY (rm_location_id) REFERENCES m_locations (location_id),
  CONSTRAINT fk_prd_order_lines_wip_loc FOREIGN KEY (wip_location_id) REFERENCES m_locations (location_id),
  CONSTRAINT fk_prd_order_lines_output_item FOREIGN KEY (output_item_id) REFERENCES m_items (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prd_order_inputs (
  prd_order_input_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_order_id INT UNSIGNED NOT NULL,
  line_no INT NOT NULL DEFAULT 1,
  item_id INT UNSIGNED NOT NULL,
  from_location_id INT UNSIGNED NULL,
  req_qty DECIMAL(15, 3) NOT NULL,
  consume_qty DECIMAL(15, 3) NOT NULL,
  lot VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (prd_order_input_id),
  KEY idx_prd_order_inputs_order (production_order_id),
  KEY idx_prd_order_inputs_from_loc (from_location_id),
  CONSTRAINT fk_prd_order_inputs_order FOREIGN KEY (production_order_id) REFERENCES prd_orders (production_order_id),
  CONSTRAINT fk_prd_order_inputs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
  CONSTRAINT fk_prd_order_inputs_from_loc FOREIGN KEY (from_location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prd_order_outputs (
  prd_order_output_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  production_order_id INT UNSIGNED NOT NULL,
  prd_order_line_id INT UNSIGNED NULL,
  line_no INT NOT NULL DEFAULT 1,
  item_id INT UNSIGNED NOT NULL,
  output_qty DECIMAL(15, 3) NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  lot VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (prd_order_output_id),
  KEY idx_prd_order_outputs_order (production_order_id),
  KEY idx_prd_order_outputs_line (prd_order_line_id),
  CONSTRAINT fk_prd_order_outputs_order FOREIGN KEY (production_order_id) REFERENCES prd_orders (production_order_id),
  CONSTRAINT fk_prd_order_outputs_line FOREIGN KEY (prd_order_line_id) REFERENCES prd_order_lines (prd_order_line_id),
  CONSTRAINT fk_prd_order_outputs_item FOREIGN KEY (item_id) REFERENCES m_items (item_id),
  CONSTRAINT fk_prd_order_outputs_loc FOREIGN KEY (location_id) REFERENCES m_locations (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
