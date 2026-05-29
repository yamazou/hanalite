-- Add production date and external reference to production orders
-- Usage: mysql -u root hanalite < sql/schema_production_orders_add_header.sql

SET NAMES utf8mb4;

ALTER TABLE prd_orders
  ADD COLUMN production_date DATE NOT NULL DEFAULT (CURRENT_DATE) AFTER status,
  ADD COLUMN reference_no VARCHAR(100) NULL DEFAULT NULL AFTER production_date;
