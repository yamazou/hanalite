-- Remove from_location_id from item process inputs (issue location derived on expansion).
-- Usage: mysql -u root hanalite < sql/schema_itemproc_inputs_drop_from_location.sql
-- Also applied automatically on backend startup via ensure_itemproc_inputs_drop_from_location_column().

SET NAMES utf8mb4;

SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'm_itemproc_inputs'
    AND COLUMN_NAME = 'from_location_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE m_itemproc_inputs DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'm_itemproc_inputs'
    AND COLUMN_NAME = 'from_location_id'
    AND INDEX_NAME != 'PRIMARY'
  LIMIT 1
);
SET @sql := IF(@idx IS NULL, 'SELECT 1', CONCAT('ALTER TABLE m_itemproc_inputs DROP INDEX `', @idx, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE m_itemproc_inputs DROP COLUMN IF EXISTS from_location_id;
