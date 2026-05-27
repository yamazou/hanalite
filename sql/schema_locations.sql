-- hanalite: add locations master table
-- Run after schema.sql for existing DB

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS m_locations (
    location_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    location_cd   VARCHAR(50)  NOT NULL,
    location_nm   VARCHAR(200) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (location_id),
    UNIQUE KEY uk_locations_cd (location_cd),
    UNIQUE KEY uk_locations_nm (location_nm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
