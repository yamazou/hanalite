-- Add location_type to existing location master
-- Allowed values in app: RM, Process, NG, FG

SET NAMES utf8mb4;

ALTER TABLE m_locations
  ADD COLUMN location_type VARCHAR(20) NOT NULL DEFAULT 'Process' AFTER location_nm;

UPDATE m_locations
SET location_type = 'Process'
WHERE location_type IS NULL OR location_type = '';
