-- Remove rm_location_id from item process master (RM location comes from Location type RM).
-- Usage: mysql -u root hanalite < sql/schema_itemprocs_drop_rm_location.sql
-- Also applied automatically on backend startup via ensure_itemprocs_drop_rm_location_column().

SET NAMES utf8mb4;

SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'm_itemprocs'
    AND COLUMN_NAME = 'rm_location_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE m_itemprocs DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'm_itemprocs'
    AND COLUMN_NAME = 'rm_location_id'
    AND INDEX_NAME != 'PRIMARY'
  LIMIT 1
);
SET @sql := IF(@idx IS NULL, 'SELECT 1', CONCAT('ALTER TABLE m_itemprocs DROP INDEX `', @idx, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE m_itemprocs DROP COLUMN IF EXISTS rm_location_id;
