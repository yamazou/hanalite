-- Remove production order status `started` (merge into `approved` / Ordered).

SET NAMES utf8mb4;

UPDATE prd_orders SET status = 'approved' WHERE status = 'started';
