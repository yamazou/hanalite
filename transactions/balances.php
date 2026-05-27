<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Inventory Balances';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $period = trim($_POST['period_year_month'] ?? '');
        $count = create_period_balance($period);
        flash('success', "Balance snapshot created for {$period} ({$count} rows).");
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/transactions/balances.php');
}

$period_filter = trim($_GET['period'] ?? '');
$sql = 'SELECT b.period_year_month, b.lot, b.qty, b.beg_qty, b.beg_at, i.item_nm
        FROM inv_balances b
        JOIN m_items i ON i.item_id = b.item_id
        WHERE b.deleted_at IS NULL';
$params = [];
if ($period_filter !== '') {
    $sql .= ' AND b.period_year_month = ?';
    $params[] = $period_filter;
}
$sql .= ' ORDER BY b.period_year_month DESC, b.lot, i.item_id';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$periods = db()->query(
    'SELECT DISTINCT period_year_month FROM inv_balances WHERE deleted_at IS NULL ORDER BY period_year_month DESC'
)->fetchAll(PDO::FETCH_COLUMN);

$current_period = date('Ym');
?>
<div class="page-header"><h1>Inventory Balances</h1></div>

<div class="grid-2">
    <div class="card">
        <h2>Create Snapshot</h2>
        <p>Save current stock as beginning balance for a month.</p>
        <form method="post">
            <div class="form-row">
                <label for="period_year_month">Period (YYYYMM)</label>
                <input id="period_year_month" name="period_year_month" required pattern="\d{6}" value="<?= h($current_period) ?>">
            </div>
            <button class="btn btn-primary" type="submit">Create Snapshot</button>
        </form>
    </div>
    <div class="card">
        <h2>Filter</h2>
        <form class="form-inline" method="get">
            <div class="form-row">
                <label for="period">Period</label>
                <select id="period" name="period">
                    <option value="">All</option>
                    <?php foreach ($periods as $p): ?>
                        <option value="<?= h($p) ?>" <?= $period_filter === $p ? 'selected' : '' ?>><?= h($p) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button class="btn btn-primary" type="submit">Filter</button>
        </form>
    </div>
</div>

<div class="card">
    <?php if (!$rows): ?>
        <p class="empty">No balance records.</p>
    <?php else: ?>
        <table>
            <thead>
                <tr><th>Period</th><th>Item</th><th>Lot</th><th>Beg Date</th><th>Beg Qty</th><th>Qty</th></tr>
            </thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><?= h($row['period_year_month']) ?></td>
                    <td><?= h($row['item_nm']) ?></td>
                    <td><a href="<?= h(BASE_URL) ?>/trace/lot.php?lot=<?= urlencode($row['lot']) ?>"><?= h($row['lot']) ?></a></td>
                    <td><?= h(format_datetime($row['beg_at'])) ?></td>
                    <td><?= h(format_qty($row['beg_qty'])) ?></td>
                    <td><?= h(format_qty($row['qty'])) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
