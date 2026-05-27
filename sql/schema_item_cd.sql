-- Add item_cd to m_items (run once on existing hanalite DB)
-- Usage: mysql -u root hanalite < sql/schema_item_cd.sql

SET NAMES utf8mb4;

ALTER TABLE m_items
    ADD COLUMN item_cd VARCHAR(50) NULL DEFAULT NULL AFTER item_id;

UPDATE m_items
SET item_cd = CONCAT('ITEM-', LPAD(item_id, 6, '0'))
WHERE item_cd IS NULL OR TRIM(item_cd) = '';

ALTER TABLE m_items
    MODIFY item_cd VARCHAR(50) NOT NULL;

ALTER TABLE m_items
    ADD UNIQUE KEY uk_items_item_cd (item_cd);
