-- Link locations to Location Type Master; migrate legacy location_type enum.

INSERT INTO m_locationtyps (locationtyp_cd, locationtyp_nm) VALUES
    ('RM', 'Raw Material'),
    ('Process', 'Process'),
    ('NG', 'NG'),
    ('FG', 'Finished Goods')
ON DUPLICATE KEY UPDATE locationtyp_nm = VALUES(locationtyp_nm);

ALTER TABLE m_locations
    ADD COLUMN locationtyp_id INT UNSIGNED NULL DEFAULT NULL AFTER location_nm;

UPDATE m_locations l
INNER JOIN m_locationtyps t ON t.deleted_at IS NULL AND t.locationtyp_cd = l.location_type
SET l.locationtyp_id = t.locationtyp_id
WHERE l.deleted_at IS NULL;

UPDATE m_locations l
INNER JOIN m_locationtyps t ON t.deleted_at IS NULL AND t.locationtyp_cd = 'Process'
SET l.locationtyp_id = t.locationtyp_id
WHERE l.deleted_at IS NULL AND l.locationtyp_id IS NULL;

ALTER TABLE m_locations DROP COLUMN location_type;

ALTER TABLE m_locations
    ADD KEY idx_locations_locationtyp (locationtyp_id);

ALTER TABLE m_locations
    ADD CONSTRAINT fk_locations_locationtyp
    FOREIGN KEY (locationtyp_id) REFERENCES m_locationtyps (locationtyp_id);
