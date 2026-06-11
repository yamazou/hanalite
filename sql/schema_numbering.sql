-- Numbering Elements / Patterns masters (lot auto-numbering)

CREATE TABLE IF NOT EXISTS m_numbering_elements (
    numbering_element_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    numbering_element_cd VARCHAR(50)  NOT NULL COMMENT 'Element code (YY, MM, SEQ, …)',
    numbering_element_nm VARCHAR(100) NOT NULL,
    element_kind         VARCHAR(30)  NOT NULL COMMENT 'date_yy|date_mm|date_dd|date_yyyy|sequence|revision|item_cd|literal',
    seq_width            INT UNSIGNED NULL DEFAULT NULL COMMENT 'Zero-pad width for sequence/revision',
    literal_text         VARCHAR(50)  NULL DEFAULT NULL,
    preview_sample       VARCHAR(20)  NOT NULL DEFAULT '' COMMENT 'Shown in numbering image preview',
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at           DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (numbering_element_id),
    UNIQUE KEY uk_numbering_elements_cd (numbering_element_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_numbering_patterns (
    numbering_pattern_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    numbering_pattern_cd VARCHAR(50)  NOT NULL,
    numbering_pattern_nm VARCHAR(100) NOT NULL,
    element_1  VARCHAR(50) NULL DEFAULT NULL,
    element_2  VARCHAR(50) NULL DEFAULT NULL,
    element_3  VARCHAR(50) NULL DEFAULT NULL,
    element_4  VARCHAR(50) NULL DEFAULT NULL,
    element_5  VARCHAR(50) NULL DEFAULT NULL,
    element_6  VARCHAR(50) NULL DEFAULT NULL,
    element_7  VARCHAR(50) NULL DEFAULT NULL,
    element_8  VARCHAR(50) NULL DEFAULT NULL,
    element_9  VARCHAR(50) NULL DEFAULT NULL,
    element_10 VARCHAR(50) NULL DEFAULT NULL,
    seq_reset_scope ENUM('never', 'daily', 'monthly', 'yearly') NOT NULL DEFAULT 'daily',
    numbering_image VARCHAR(100) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (numbering_pattern_id),
    UNIQUE KEY uk_numbering_patterns_cd (numbering_pattern_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_numbering_sequences (
    numbering_sequence_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    numbering_pattern_id  INT UNSIGNED NOT NULL,
    scope_key             VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Usually item_cd',
    period_key            VARCHAR(20)  NOT NULL DEFAULT '' COMMENT 'Reset bucket (e.g. YYYYMMDD)',
    last_value            INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (numbering_sequence_id),
    UNIQUE KEY uk_numbering_sequences_scope (numbering_pattern_id, scope_key, period_key),
    KEY idx_numbering_sequences_pattern (numbering_pattern_id),
    CONSTRAINT fk_numbering_sequences_pattern
        FOREIGN KEY (numbering_pattern_id)
        REFERENCES m_numbering_patterns (numbering_pattern_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items → numbering pattern (run after tables exist)
-- ALTER TABLE m_items
--     ADD COLUMN numbering_pattern_id INT UNSIGNED NULL DEFAULT NULL AFTER customer2_id,
--     ADD KEY idx_items_numbering_pattern (numbering_pattern_id),
--     ADD CONSTRAINT fk_items_numbering_pattern
--         FOREIGN KEY (numbering_pattern_id)
--         REFERENCES m_numbering_patterns (numbering_pattern_id);
