-- Add Supplier Code / Customer Code to existing databases
-- Usage: mysql -u root hanalite < sql/schema_supplier_customer_codes.sql
-- Prefer backend startup patch ensure_supplier_and_customer_codes() for automatic migration.

SET NAMES utf8mb4;

-- Suppliers
ALTER TABLE m_suppliers
    ADD COLUMN IF NOT EXISTS suppliers_cd VARCHAR(50) NULL DEFAULT NULL AFTER suppliers_id;

UPDATE m_suppliers
SET suppliers_cd = LEFT(TRIM(suppliers_nm), 50)
WHERE (suppliers_cd IS NULL OR suppliers_cd = '') AND deleted_at IS NULL;

ALTER TABLE m_suppliers
    MODIFY COLUMN suppliers_cd VARCHAR(50) NOT NULL;

-- Customers (run after m_customers exists)
ALTER TABLE m_customers
    ADD COLUMN IF NOT EXISTS customers_cd VARCHAR(50) NULL DEFAULT NULL AFTER customers_id;

UPDATE m_customers
SET customers_cd = LEFT(TRIM(customers_nm), 50)
WHERE (customers_cd IS NULL OR customers_cd = '') AND deleted_at IS NULL;

ALTER TABLE m_customers
    MODIFY COLUMN customers_cd VARCHAR(50) NOT NULL;

-- Unique indexes (ignore error if already exists)
-- ALTER TABLE m_suppliers ADD UNIQUE KEY uk_suppliers_cd (suppliers_cd);
-- ALTER TABLE m_customers ADD UNIQUE KEY uk_customers_cd (customers_cd);
