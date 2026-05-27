<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Suppliers';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'create') {
            $name = trim($_POST['suppliers_nm'] ?? '');
            if ($name === '') {
                throw new RuntimeException('Name is required.');
            }
            $stmt = db()->prepare('INSERT INTO m_suppliers (suppliers_nm) VALUES (?)');
            $stmt->execute([$name]);
            flash('success', 'Supplier created.');
        } elseif ($action === 'delete') {
            soft_delete_table('m_suppliers', 'suppliers_id', (int) ($_POST['suppliers_id'] ?? 0));
            flash('success', 'Supplier deleted.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/masters/suppliers.php');
}

$rows = db()->query('SELECT suppliers_id, suppliers_nm, created_at FROM m_suppliers WHERE deleted_at IS NULL ORDER BY suppliers_id')->fetchAll();
?>
<div class="page-header"><h1>Suppliers</h1></div>

<div class="grid-2">
    <div class="card">
        <h2>Add</h2>
        <form method="post">
            <input type="hidden" name="action" value="create">
            <div class="form-row">
                <label for="suppliers_nm">Name</label>
                <input id="suppliers_nm" name="suppliers_nm" required>
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
                    <td><?= h((string) $row['suppliers_id']) ?></td>
                    <td><?= h($row['suppliers_nm']) ?></td>
                    <td><?= h(format_datetime($row['created_at'])) ?></td>
                    <td>
                        <form method="post" onsubmit="return confirm('Delete?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="suppliers_id" value="<?= h((string) $row['suppliers_id']) ?>">
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
