-- Split move type code (GR, GI, …) from display name.
-- Run once on existing DBs; app startup also runs ensure_m_movetyps_cd_nm().

ALTER TABLE m_movetyps
  CHANGE COLUMN movetyps_nm movetyps_cd VARCHAR(50) NOT NULL;

ALTER TABLE m_movetyps
  ADD COLUMN movetyps_nm VARCHAR(100) NULL DEFAULT NULL AFTER movetyps_cd;
