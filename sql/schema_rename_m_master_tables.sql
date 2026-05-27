-- Rename master tables to m_* naming
-- Usage: mysql -u root hanalite < sql/schema_rename_m_master_tables.sql

SET NAMES utf8mb4;

RENAME TABLE
    itemtyps TO m_itemtyps,
    suppliers TO m_suppliers,
    movetyps TO m_movetyps,
    items TO m_items,
    boms TO m_boms;
