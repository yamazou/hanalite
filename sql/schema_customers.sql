-- Customers master and item customer links
-- Usage: mysql -u root hanalite < sql/schema_customers.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS m_customers (
    customers_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customers_cd VARCHAR(50) NOT NULL,
    customers_nm VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (customers_id),
    UNIQUE KEY uk_customers_cd (customers_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Column adds for existing databases: see backend app/db_schema.py ensure_m_customers_and_item_customer_cols

INSERT INTO m_customers (customers_cd, customers_nm, created_at, updated_at)
SELECT 'Customer1', 'Customer1', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM m_customers WHERE customers_cd = 'Customer1' AND deleted_at IS NULL
);

INSERT INTO m_customers (customers_cd, customers_nm, created_at, updated_at)
SELECT 'Customer2', 'Customer2', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM m_customers WHERE customers_cd = 'Customer2' AND deleted_at IS NULL
);
