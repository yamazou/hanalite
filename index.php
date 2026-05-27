<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/header.php';

$pdo = db();

$stats = [
    'items' => (int) $pdo->query('SELECT COUNT(*) FROM m_items WHERE deleted_at IS NULL')->fetchColumn(),
    'current_lots' => (int) $pdo->query('SELECT COUNT(*) FROM inv_currents WHERE deleted_at IS NULL AND qty > 0')->fetchColumn(),
    'movements' => (int) $pdo->query('SELECT COUNT(*) FROM inv_grgi WHERE deleted_at IS NULL')->fetchColumn(),
];

$recent = $pdo->query(
    'SELECT g.inv_grgi_id, g.lot, g.move_qty, g.qty, g.actual_at, m.movetyps_nm, i.item_nm
     FROM inv_grgi g
     JOIN m_items i ON i.item_id = g.item_id
     JOIN m_movetyps m ON m.movetyps_id = g.movetyps_id
     WHERE g.deleted_at IS NULL
     ORDER BY g.actual_at DESC, g.inv_grgi_id DESC
     LIMIT 10'
)->fetchAll();

$page_title = 'Dashboard';
?>
<div class="page-header">
    <h1>Dashboard</h1>
</div>

<div class="grid-3">
    <div class="stat">
        <div class="stat-label">Items</div>
        <div class="stat-value"><?= h((string) $stats['items']) ?></div>
    </div>
    <div class="stat">
        <div class="stat-label">Active Lots</div>
        <div class="stat-value"><?= h((string) $stats['current_lots']) ?></div>
    </div>
    <div class="stat">
        <div class="stat-label">Movements</div>
        <div class="stat-value"><?= h((string) $stats['movements']) ?></div>
    </div>
</div>

<div class="card">
    <h2>Recent GR / GI</h2>
    <?php if (!$recent): ?>
        <p class="empty">No movements yet.</p>
    <?php else: ?>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th>Lot</th>
                    <th>Move Qty</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($recent as $row): ?>
                    <tr>
                        <td><?= h(format_datetime($row['actual_at'])) ?></td>
                        <td>
                            <span class="badge badge-<?= strtolower($row['movetyps_nm']) === 'gr' ? 'gr' : 'gi' ?>">
                                <?= h($row['movetyps_nm']) ?>
                            </span>
                        </td>
                        <td><?= h($row['item_nm']) ?></td>
                        <td><a href="<?= h(BASE_URL) ?>/trace/lot.php?lot=<?= urlencode($row['lot']) ?>"><?= h($row['lot']) ?></a></td>
                        <td><?= h(format_qty($row['move_qty'])) ?></td>
                        <td><?= h(format_qty($row['qty'])) ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
