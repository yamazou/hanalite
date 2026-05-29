-- Add source type to production orders
-- Usage: mysql -u root hanalite < sql/schema_production_orders_add_source.sql

SET NAMES utf8mb4;

ALTER TABLE prd_orders
  ADD COLUMN source_type ENUM('manual', 'excel') NOT NULL DEFAULT 'manual' AFTER reference_no;
