-- Production order status: add `started` (after ordered/approved, when actual qty is saved)

SET NAMES utf8mb4;

-- VARCHAR status column: no enum change required; document allowed values:
-- registered | approved | started | completed | cancelled
