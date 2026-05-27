<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Lot Trace';
$lot = trim($_GET['lot'] ?? '');

$current = [];
$history = [];
$balances = [];

if ($lot !== '') {
    $stmt = db()->prepare(
        'SELECT c.lot, c.qty, c.updated_at, i.item_id, i.item_nm, t.itemtyp_nm
         FROM inv_currents c
         JOIN m_items i ON i.item_id = c.item_id
         JOIN m_itemtyps t ON t.itemtyp_id = i.itemtyp_id
         WHERE c.deleted_at IS NULL AND c.lot = ?
         ORDER BY i.item_id'
    );
    $stmt->execute([$lot]);
    $current = $stmt->fetchAll();

    $stmt = db()->prepare(
        'SELECT g.inv_grgi_id, g.move_qty, g.qty, g.actual_at, g.created_at, m.movetyps_nm, i.item_nm
         FROM inv_grgi g
         JOIN m_items i ON i.item_id = g.item_id
         JOIN m_movetyps m ON m.movetyps_id = g.movetyps_id
         WHERE g.deleted_at IS NULL AND g.lot = ?
         ORDER BY g.actual_at ASC, g.inv_grgi_id ASC'
    );
    $stmt->execute([$lot]);
    $history = $stmt->fetchAll();

    $stmt = db()->prepare(
        'SELECT b.period_year_month, b.qty, b.beg_qty, b.beg_at, i.item_nm
         FROM inv_balances b
         JOIN m_items i ON i.item_id = b.item_id
         WHERE b.deleted_at IS NULL AND b.lot = ?
         ORDER BY b.period_year_month DESC'
    );
    $stmt->execute([$lot]);
    $balances = $stmt->fetchAll();
}
?>
<div class="page-header"><h1>Lot Trace</h1></div>

<div class="card">
    <form class="form-inline" method="get">
        <div class="form-row">
            <label for="lot">Lot No.</label>
            <input id="lot" name="lot" value="<?= h($lot) ?>" required placeholder="Enter lot number">
        </div>
        <button class="btn btn-primary" type="submit">Search</button>
    </form>
</div>

<?php if ($lot !== ''): ?>
    <div class="card">
        <h2>Current Stock for Lot: <?= h($lot) ?></h2>
        <?php if (!$current): ?>
            <p class="empty">No current stock for this lot.</p>
        <?php else: ?>
            <table>
                <thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Updated</th></tr></thead>
                <tbody>
                <?php foreach ($current as $row): ?>
                    <tr>
                        <td><?= h($row['item_nm']) ?></td>
                        <td><?= h($row['itemtyp_nm']) ?></td>
                        <td><?= h(format_qty($row['qty'])) ?></td>
                        <td><?= h(format_datetime($row['updated_at'])) ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>

    <div class="card">
        <h2>Movement History</h2>
        <?php if (!$history): ?>
            <p class="empty">No movements for this lot.</p>
        <?php else: ?>
            <table>
                <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Move Qty</th><th>Balance</th><th>Registered</th></tr></thead>
                <tbody>
                <?php foreach ($history as $row): ?>
                    <tr>
                        <td><?= h(format_datetime($row['actual_at'])) ?></td>
                        <td><span class="badge badge-<?= strtolower($row['movetyps_nm']) === 'gr' ? 'gr' : 'gi' ?>"><?= h($row['movetyps_nm']) ?></span></td>
                        <td><?= h($row['item_nm']) ?></td>
                        <td><?= h(format_qty($row['move_qty'])) ?></td>
                        <td><?= h(format_qty($row['qty'])) ?></td>
                        <td><?= h(format_datetime($row['created_at'])) ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>

    <div class="card">
        <h2>Balance Snapshots</h2>
        <?php if (!$balances): ?>
            <p class="empty">No balance snapshots for this lot.</p>
        <?php else: ?>
            <table>
                <thead><tr><th>Period</th><th>Item</th><th>Beg Date</th><th>Beg Qty</th><th>Qty</th></tr></thead>
                <tbody>
                <?php foreach ($balances as $row): ?>
                    <tr>
                        <td><?= h($row['period_year_month']) ?></td>
                        <td><?= h($row['item_nm']) ?></td>
                        <td><?= h(format_datetime($row['beg_at'])) ?></td>
                        <td><?= h(format_qty($row['beg_qty'])) ?></td>
                        <td><?= h(format_qty($row['qty'])) ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
<?php endif; ?>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
