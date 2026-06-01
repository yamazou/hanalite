-- Remove production order status `cancelled` (soft-delete former cancelled rows).

SET NAMES utf8mb4;

UPDATE prd_orders
SET deleted_at = COALESCE(deleted_at, NOW()),
    cancelled_at = NULL
WHERE status = 'cancelled'
  AND deleted_at IS NULL;
