-- Item Process master: From Location optional on input rows (set on Production Order).
ALTER TABLE m_itemproc_inputs
  MODIFY COLUMN from_location_id INT UNSIGNED NULL COMMENT 'Issue location for input';
