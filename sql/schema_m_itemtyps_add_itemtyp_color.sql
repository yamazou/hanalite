-- Item type display color for grids/trees (#RRGGBB, optional)
ALTER TABLE m_itemtyps
  ADD COLUMN itemtyp_color VARCHAR(7) NULL DEFAULT NULL AFTER itemtyp_nm;
