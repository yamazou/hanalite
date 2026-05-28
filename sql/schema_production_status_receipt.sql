-- Align production order status with receipt/delivery drafts: registered | approved | cancelled

SET NAMES utf8mb4;

ALTER TABLE prd_orders
  ADD COLUMN approved_at DATETIME NULL DEFAULT NULL AFTER notes,
  ADD COLUMN cancelled_at DATETIME NULL DEFAULT NULL AFTER approved_at;

UPDATE prd_orders SET status = 'registered' WHERE status IN ('planned', 'in_progress');
UPDATE prd_orders SET status = 'approved', approved_at = completed_at WHERE status = 'completed';
UPDATE prd_orders SET status = 'cancelled' WHERE status = 'cancelled';

ALTER TABLE prd_orders MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'registered';
