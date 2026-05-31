-- Item Process master: Req Qty optional on input rows (set on Production Order).
ALTER TABLE m_itemproc_inputs
  MODIFY COLUMN req_qty DECIMAL(15, 3) NULL;
