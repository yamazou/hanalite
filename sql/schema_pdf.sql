-- Phase 4: PDF attachment & import source tracking

SET NAMES utf8mb4;

ALTER TABLE inv_receipt_drafts
    ADD COLUMN source_type ENUM('manual', 'excel', 'pdf') NOT NULL DEFAULT 'manual' AFTER status,
    ADD COLUMN attachment_path VARCHAR(255) NULL DEFAULT NULL AFTER notes,
    ADD COLUMN attachment_original_name VARCHAR(255) NULL DEFAULT NULL AFTER attachment_path,
    ADD COLUMN parse_message TEXT NULL DEFAULT NULL AFTER attachment_original_name;
