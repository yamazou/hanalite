-- Add Item Type Code; existing itemtyp_nm becomes display name.
ALTER TABLE m_itemtyps
    ADD COLUMN itemtyp_cd VARCHAR(50) NULL AFTER itemtyp_id;

UPDATE m_itemtyps
SET itemtyp_cd = itemtyp_nm
WHERE itemtyp_cd IS NULL OR TRIM(itemtyp_cd) = '';

ALTER TABLE m_itemtyps
    MODIFY COLUMN itemtyp_cd VARCHAR(50) NOT NULL;
