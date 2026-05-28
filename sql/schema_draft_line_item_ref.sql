-- Draft lines: optional item master link + business item code/name on draft
-- Run once on existing hanalite DB

SET NAMES utf8mb4;

ALTER TABLE pch_receipt_draft_lines
    MODIFY item_id INT UNSIGNED NULL DEFAULT NULL,
    ADD COLUMN item_cd VARCHAR(50) NULL DEFAULT NULL AFTER item_id,
    ADD COLUMN item_nm VARCHAR(200) NULL DEFAULT NULL AFTER item_cd;

ALTER TABLE sls_delivery_draft_lines
    MODIFY item_id INT UNSIGNED NULL DEFAULT NULL,
    ADD COLUMN item_cd VARCHAR(50) NULL DEFAULT NULL AFTER item_id,
    ADD COLUMN item_nm VARCHAR(200) NULL DEFAULT NULL AFTER item_cd;
