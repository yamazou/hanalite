-- Retired: Bill of Materials (m_boms). Item Processes (m_itemprocs) replace this feature.
-- Usage: mysql -u root hanalite < sql/schema_drop_m_boms.sql
-- Also applied automatically on backend startup via ensure_drop_m_boms_table().

SET NAMES utf8mb4;

DROP TABLE IF EXISTS m_boms;
