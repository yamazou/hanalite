<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/header.php';

$page_title = 'Move Types';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'create') {
            $name = trim($_POST['movetyps_nm'] ?? '');
            if ($name === '') {
                throw new RuntimeException('Name is required.');
            }
            $stmt = db()->prepare('INSERT INTO m_movetyps (movetyps_nm) VALUES (?)');
            $stmt->execute([$name]);
            flash('success', 'Move type created.');
        } elseif ($action === 'delete') {
            soft_delete_table('m_movetyps', 'movetyps_id', (int) ($_POST['movetyps_id'] ?? 0));
            flash('success', 'Move type deleted.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('/masters/movetyps.php');
}

$rows = db()->query('SELECT movetyps_id, movetyps_nm, created_at FROM m_movetyps WHERE deleted_at IS NULL ORDER BY movetyps_id')->fetchAll();
?>
<div class="page-header"><h1>Move Types</h1></div>

<div class="grid-2">
    <div class="card">
        <h2>Add</h2>
        <form method="post">
            <input type="hidden" name="action" value="create">
            <div class="form-row">
                <label for="movetyps_nm">Name</label>
                <input id="movetyps_nm" name="movetyps_nm" required placeholder="GR, GI...">
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
                    <td><?= h((string) $row['movetyps_id']) ?></td>
                    <td><?= h($row['movetyps_nm']) ?></td>
                    <td><?= h(format_datetime($row['created_at'])) ?></td>
                    <td>
                        <form method="post" onsubmit="return confirm('Delete?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="movetyps_id" value="<?= h((string) $row['movetyps_id']) ?>">
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
