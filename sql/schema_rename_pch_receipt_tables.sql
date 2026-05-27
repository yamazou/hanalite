-- Rename receipt draft tables from inv_* to pch_* (existing DB migration)
-- Usage: mysql -u root hanalite < sql/schema_rename_pch_receipt_tables.sql

SET NAMES utf8mb4;

RENAME TABLE
    inv_receipt_drafts TO pch_receipt_draft,
    inv_receipt_draft_lines TO pch_receipt_draft_lines;
