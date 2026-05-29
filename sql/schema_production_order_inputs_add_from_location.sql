ALTER TABLE prd_order_inputs
  ADD COLUMN from_location_id INT UNSIGNED NULL AFTER item_id,
  ADD KEY idx_prd_order_inputs_from_loc (from_location_id),
  ADD CONSTRAINT fk_prd_order_inputs_from_loc
    FOREIGN KEY (from_location_id) REFERENCES m_locations (location_id);
