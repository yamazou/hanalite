<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Current Stock';

$lot_filter = trim($_GET['lot'] ?? '');
$item_filter = (int) ($_GET['item_id'] ?? 0);

$sql = 'SELECT c.inv_current_id, c.lot, c.qty, c.updated_at, i.item_id, i.item_nm, t.itemtyp_nm
        FROM inv_currents c
        JOIN items i ON i.item_id = c.item_id
        JOIN itemtyps t ON t.itemtyp_id = i.itemtyp_id
        WHERE c.deleted_at IS NULL AND c.qty > 0';
$params = [];

if ($lot_filter !== '') {
    $sql .= ' AND c.lot LIKE ?';
    $params[] = '%' . $lot_filter . '%';
}
if ($item_filter > 0) {
    $sql .= ' AND c.item_id = ?';
    $params[] = $item_filter;
}
$sql .= ' ORDER BY c.lot, i.item_id';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
$items = get_items();
?>
<div class="page-header"><h1>Current Stock</h1></div>

<div class="card">
    <form class="form-inline" method="get">
        <div class="form-row">
            <label for="lot">Lot</label>
            <input id="lot" name="lot" value="<?= h($lot_filter) ?>" placeholder="Search lot">
        </div>
        <div class="form-row">
            <label for="item_id">Item</label>
            <select id="item_id" name="item_id">
                <option value="">All</option>
                <?php foreach ($items as $item): ?>
                    <option value="<?= h((string) $item['item_id']) ?>" <?= $item_filter === (int) $item['item_id'] ? 'selected' : '' ?>>
                        <?= h($item['item_nm']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <button class="btn btn-primary" type="submit">Filter</button>
        <a class="btn btn-secondary" href="<?= h(BASE_URL) ?>/transactions/currents.php">Reset</a>
    </form>
</div>

<div class="card">
    <?php if (!$rows): ?>
        <p class="empty">No stock records.</p>
    <?php else: ?>
        <table>
            <thead>
                <tr><th>Item</th><th>Type</th><th>Lot</th><th>Qty</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><?= h($row['item_nm']) ?></td>
                    <td><?= h($row['itemtyp_nm']) ?></td>
                    <td><?= h($row['lot']) ?></td>
                    <td><?= h(format_qty($row['qty'])) ?></td>
                    <td><?= h(format_datetime($row['updated_at'])) ?></td>
                    <td><a class="btn btn-secondary btn-sm" href="<?= h(BASE_URL) ?>/trace/lot.php?lot=<?= urlencode($row['lot']) ?>">Trace</a></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
