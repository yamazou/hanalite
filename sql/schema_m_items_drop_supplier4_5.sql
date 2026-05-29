-- Remove optional supplier slots 4 and 5 from m_items (run on existing DB).
ALTER TABLE m_items
    DROP FOREIGN KEY fk_items_supplier4,
    DROP FOREIGN KEY fk_items_supplier5;

ALTER TABLE m_items
    DROP COLUMN supplier4_id,
    DROP COLUMN supplier5_id;
