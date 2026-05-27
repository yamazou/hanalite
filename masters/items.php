<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Items';
$itemtyps = get_itemtyps();
$suppliers = get_suppliers();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'create' || $action === 'update') {
            $item_nm = trim($_POST['item_nm'] ?? '');
            $itemtyp_id = (int) ($_POST['itemtyp_id'] ?? 0);
            if ($item_nm === '' || $itemtyp_id <= 0) {
                throw new RuntimeException('Item name and type are required.');
            }
            $supplier_ids = [];
            for ($i = 1; $i <= 5; $i++) {
                $val = (int) ($_POST["supplier{$i}_id"] ?? 0);
                $supplier_ids[$i] = $val > 0 ? $val : null;
            }

            if ($action === 'create') {
                $stmt = db()->prepare(
                    'INSERT INTO items (item_nm, itemtyp_id, supplier1_id, supplier2_id, supplier3_id, supplier4_id, supplier5_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                $stmt->execute([
                    $item_nm, $itemtyp_id,
                    $supplier_ids[1], $supplier_ids[2], $supplier_ids[3], $supplier_ids[4], $supplier_ids[5],
                ]);
                flash('success', 'Item created.');
            } else {
                $item_id = (int) ($_POST['item_id'] ?? 0);
                $stmt = db()->prepare(
                    'UPDATE items SET item_nm = ?, itemtyp_id = ?, supplier1_id = ?, supplier2_id = ?,
                     supplier3_id = ?, supplier4_id = ?, supplier5_id = ?, updated_at = NOW()
                     WHERE item_id = ? AND deleted_at IS NULL'
                );
                $stmt->execute([
                    $item_nm, $itemtyp_id,
                    $supplier_ids[1], $supplier_ids[2], $supplier_ids[3], $supplier_ids[4], $supplier_ids[5],
                    $item_id,
                ]);
                flash('success', 'Item updated.');
            }
        } elseif ($action === 'delete') {
            soft_delete_table('items', 'item_id', (int) ($_POST['item_id'] ?? 0));
            flash('success', 'Item deleted.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/masters/items.php');
}

$edit_id = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
$edit = $edit_id > 0 ? get_item($edit_id) : null;

$rows = db()->query(
    'SELECT i.item_id, i.item_nm, t.itemtyp_nm,
            s1.suppliers_nm AS supplier1_nm
     FROM items i
     JOIN itemtyps t ON t.itemtyp_id = i.itemtyp_id
     LEFT JOIN suppliers s1 ON s1.suppliers_id = i.supplier1_id
     WHERE i.deleted_at IS NULL
     ORDER BY i.item_id'
)->fetchAll();

?>
<div class="page-header"><h1>Items</h1></div>

<div class="grid-2">
    <div class="card">
        <h2><?= $edit ? 'Edit' : 'Add' ?> Item</h2>
        <form method="post">
            <input type="hidden" name="action" value="<?= $edit ? 'update' : 'create' ?>">
            <?php if ($edit): ?>
                <input type="hidden" name="item_id" value="<?= h((string) $edit['item_id']) ?>">
            <?php endif; ?>
            <div class="form-row">
                <label for="item_nm">Item Name</label>
                <input id="item_nm" name="item_nm" required value="<?= h($edit['item_nm'] ?? '') ?>">
            </div>
            <div class="form-row">
                <label for="itemtyp_id">Item Type</label>
                <select id="itemtyp_id" name="itemtyp_id" required>
                    <option value="">Select</option>
                    <?php foreach ($itemtyps as $t): ?>
                        <option value="<?= h((string) $t['itemtyp_id']) ?>" <?= ((int) ($edit['itemtyp_id'] ?? 0) === (int) $t['itemtyp_id']) ? 'selected' : '' ?>>
                            <?= h($t['itemtyp_nm']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php for ($i = 1; $i <= 5; $i++): ?>
                <div class="form-row">
                    <label for="supplier<?= $i ?>_id">Supplier <?= $i ?><?= $i === 1 ? ' (Main)' : ' (Sub)' ?></label>
                    <select id="supplier<?= $i ?>_id" name="supplier<?= $i ?>_id">
                        <?= supplier_options($suppliers, isset($edit["supplier{$i}_id"]) ? (int) $edit["supplier{$i}_id"] : null) ?>
                    </select>
                </div>
            <?php endfor; ?>
            <button class="btn btn-primary" type="submit">Save</button>
            <?php if ($edit): ?>
                <a class="btn btn-secondary" href="<?= h(BASE_URL) ?>/masters/items.php">Cancel</a>
            <?php endif; ?>
        </form>
    </div>
    <div class="card">
        <h2>List</h2>
        <table>
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Main Supplier</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><?= h((string) $row['item_id']) ?></td>
                    <td><?= h($row['item_nm']) ?></td>
                    <td><?= h($row['itemtyp_nm']) ?></td>
                    <td><?= h($row['supplier1_nm'] ?? '-') ?></td>
                    <td>
                        <a class="btn btn-secondary btn-sm" href="<?= h(BASE_URL) ?>/masters/items.php?edit=<?= h((string) $row['item_id']) ?>">Edit</a>
                        <form method="post" style="display:inline" onsubmit="return confirm('Delete?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="item_id" value="<?= h((string) $row['item_id']) ?>">
                            <button class="btn btn-danger btn-sm" type="submit">Delete</button>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php require_once __DIR__ . '/../includes/footer.php'; ?>
