-- Location Type master and link on Item Type master.

CREATE TABLE IF NOT EXISTS m_locationtyps (
    locationtyp_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    locationtyp_cd VARCHAR(50) NOT NULL,
    locationtyp_nm VARCHAR(100) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (locationtyp_id),
    UNIQUE KEY uk_locationtyps_cd (locationtyp_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE m_itemtyps
    ADD COLUMN locationtyp_id INT UNSIGNED NULL DEFAULT NULL AFTER itemtyp_color;

ALTER TABLE m_itemtyps
    ADD KEY idx_itemtyps_locationtyp (locationtyp_id);

ALTER TABLE m_itemtyps
    ADD CONSTRAINT fk_itemtyps_locationtyp
    FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id);
