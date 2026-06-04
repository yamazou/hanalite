-- Company and user masters + tenant columns (run on existing DB via db_schema patches too)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS m_companies (
    co_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_cd   VARCHAR(50)  NOT NULL COMMENT 'Company code shown at login',
    company_nm   VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (co_id),
    UNIQUE KEY uk_companies_cd (company_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS m_users (
    user_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    co_id        INT UNSIGNED NOT NULL,
    user_cd      VARCHAR(50)  NOT NULL COMMENT 'Login user id',
    user_nm      VARCHAR(200) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL DEFAULT NULL,
    created_by   INT UNSIGNED NULL DEFAULT NULL,
    updated_by   INT UNSIGNED NULL DEFAULT NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uk_users_co_user_cd (co_id, user_cd),
    KEY idx_users_co (co_id),
    CONSTRAINT fk_users_co FOREIGN KEY (co_id) REFERENCES m_companies (co_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
