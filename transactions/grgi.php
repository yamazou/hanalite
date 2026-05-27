<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'GR / GI';
$items = get_items();
$movetyps = get_movetyps();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $item_id = (int) ($_POST['item_id'] ?? 0);
        $lot = trim($_POST['lot'] ?? '');
        $move_qty = (float) ($_POST['move_qty'] ?? 0);
        $movetyps_id = (int) ($_POST['movetyps_id'] ?? 0);
        $actual_at = trim($_POST['actual_at'] ?? '');

        if ($item_id <= 0 || $lot === '' || $move_qty <= 0 || $movetyps_id <= 0 || $actual_at === '') {
            throw new RuntimeException('All fields are required and move qty must be greater than zero.');
        }

        $actual_at = date('Y-m-d H:i:s', strtotime($actual_at));
        process_grgi($item_id, $lot, $move_qty, $movetyps_id, $actual_at);
        flash('success', 'Movement recorded.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/transactions/grgi.php');
}

$history = db()->query(
    'SELECT g.inv_grgi_id, g.lot, g.move_qty, g.qty, g.actual_at, m.movetyps_nm, i.item_nm
     FROM inv_grgi g
     JOIN items i ON i.item_id = g.item_id
     JOIN movetyps m ON m.movetyps_id = g.movetyps_id
     WHERE g.deleted_at IS NULL
     ORDER BY g.actual_at DESC, g.inv_grgi_id DESC
     LIMIT 50'
)->fetchAll();

$now = date('Y-m-d\TH:i');
?>
<div class="page-header"><h1>GR / GI Entry</h1></div>

<div class="grid-2">
    <div class="card">
        <h2>New Movement</h2>
        <form method="post">
            <div class="form-row">
                <label for="item_id">Item</label>
                <select id="item_id" name="item_id" required>
                    <option value="">Select</option>
                    <?php foreach ($items as $item): ?>
                        <option value="<?= h((string) $item['item_id']) ?>">
                            [<?= h((string) $item['item_id']) ?>] <?= h($item['item_nm']) ?> (<?= h($item['itemtyp_nm']) ?>)
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-row">
                <label for="lot">Lot No.</label>
                <input id="lot" name="lot" required placeholder="LOT-20260527-001">
            </div>
            <div class="form-row">
                <label for="movetyps_id">Move Type</label>
                <select id="movetyps_id" name="movetyps_id" required>
                    <option value="">Select</option>
                    <?php foreach ($movetyps as $m): ?>
                        <option value="<?= h((string) $m['movetyps_id']) ?>"><?= h($m['movetyps_nm']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-row">
                <label for="move_qty">Move Qty</label>
                <input id="move_qty" name="move_qty" type="number" step="0.001" min="0.001" required>
            </div>
            <div class="form-row">
                <label for="actual_at">Actual Date</label>
                <input id="actual_at" name="actual_at" type="datetime-local" value="<?= h($now) ?>" required>
            </div>
            <button class="btn btn-primary" type="submit">Register</button>
        </form>
    </div>
    <div class="card">
        <h2>History</h2>
        <table>
            <thead>
                <tr><th>Date</th><th>Type</th><th>Item</th><th>Lot</th><th>Move</th><th>Balance</th></tr>
            </thead>
            <tbody>
            <?php foreach ($history as $row): ?>
                <tr>
                    <td><?= h(format_datetime($row['actual_at'])) ?></td>
                    <td><span class="badge badge-<?= strtolower($row['movetyps_nm']) === 'gr' ? 'gr' : 'gi' ?>"><?= h($row['movetyps_nm']) ?></span></td>
                    <td><?= h($row['item_nm']) ?></td>
                    <td><a href="<?= h(BASE_URL) ?>/trace/lot.php?lot=<?= urlencode($row['lot']) ?>"><?= h($row['lot']) ?></a></td>
                    <td><?= h(format_qty($row['move_qty'])) ?></td>
                    <td><?= h(format_qty($row['qty'])) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
