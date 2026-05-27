<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Item Types';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'create') {
            $name = trim($_POST['itemtyp_nm'] ?? '');
            if ($name === '') {
                throw new RuntimeException('Name is required.');
            }
            $stmt = db()->prepare('INSERT INTO itemtyps (itemtyp_nm) VALUES (?)');
            $stmt->execute([$name]);
            flash('success', 'Item type created.');
        } elseif ($action === 'delete') {
            soft_delete_table('itemtyps', 'itemtyp_id', (int) ($_POST['itemtyp_id'] ?? 0));
            flash('success', 'Item type deleted.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/masters/itemtyps.php');
}

$rows = db()->query('SELECT itemtyp_id, itemtyp_nm, created_at FROM itemtyps WHERE deleted_at IS NULL ORDER BY itemtyp_id')->fetchAll();
?>
<div class="page-header"><h1>Item Types</h1></div>

<div class="grid-2">
    <div class="card">
        <h2>Add</h2>
        <form method="post">
            <input type="hidden" name="action" value="create">
            <div class="form-row">
                <label for="itemtyp_nm">Name</label>
                <input id="itemtyp_nm" name="itemtyp_nm" required placeholder="RM, WIP, FG...">
            </div>
            <button class="btn btn-primary" type="submit">Save</button>
        </form>
    </div>
    <div class="card">
        <h2>List</h2>
        <table>
            <thead><tr><th>ID</th><th>Name</th><th>Created</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($rows as $row): ?>
                <tr>
                    <td><?= h((string) $row['itemtyp_id']) ?></td>
                    <td><?= h($row['itemtyp_nm']) ?></td>
                    <td><?= h(format_datetime($row['created_at'])) ?></td>
                    <td>
                        <form method="post" onsubmit="return confirm('Delete?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="itemtyp_id" value="<?= h((string) $row['itemtyp_id']) ?>">
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
