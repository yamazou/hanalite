<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST,
            DB_PORT,
            DB_NAME,
            DB_CHARSET
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . BASE_URL . $path);
    exit;
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function get_flash(): ?array
{
    if (!isset($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

function active_menu(string $path): string
{
    $current = $_SERVER['SCRIPT_NAME'] ?? '';
    return str_contains($current, $path) ? 'active' : '';
}

function format_qty($qty): string
{
    return number_format((float) $qty, 3, '.', ',');
}

function format_datetime(?string $dt): string
{
    if ($dt === null || $dt === '') {
        return '-';
    }
    return date('Y-m-d H:i', strtotime($dt));
}

function soft_delete_table(string $table, string $pk, int $id): void
{
    $allowed = ['itemtyps', 'suppliers', 'movetyps', 'items'];
    if (!in_array($table, $allowed, true)) {
        throw new InvalidArgumentException('Invalid table');
    }
    $stmt = db()->prepare("UPDATE {$table} SET deleted_at = NOW() WHERE {$pk} = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);
}

function get_itemtyps(): array
{
    return db()->query('SELECT itemtyp_id, itemtyp_nm FROM itemtyps WHERE deleted_at IS NULL ORDER BY itemtyp_id')->fetchAll();
}

function get_suppliers(): array
{
    return db()->query('SELECT suppliers_id, suppliers_nm FROM suppliers WHERE deleted_at IS NULL ORDER BY suppliers_id')->fetchAll();
}

function get_movetyps(): array
{
    return db()->query('SELECT movetyps_id, movetyps_nm FROM movetyps WHERE deleted_at IS NULL ORDER BY movetyps_id')->fetchAll();
}

function get_items(): array
{
    $sql = 'SELECT i.item_id, i.item_nm, t.itemtyp_nm
            FROM items i
            JOIN itemtyps t ON t.itemtyp_id = i.itemtyp_id AND t.deleted_at IS NULL
            WHERE i.deleted_at IS NULL
            ORDER BY i.item_id';
    return db()->query($sql)->fetchAll();
}

function supplier_options(array $suppliers, ?int $selected): string
{
    $html = '<option value="">-</option>';
    foreach ($suppliers as $s) {
        $sel = ((int) $s['suppliers_id'] === (int) $selected) ? ' selected' : '';
        $html .= '<option value="' . h((string) $s['suppliers_id']) . '"' . $sel . '>' . h($s['suppliers_nm']) . '</option>';
    }
    return $html;
}

function get_item(int $item_id): ?array
{
    $stmt = db()->prepare('SELECT * FROM items WHERE item_id = ? AND deleted_at IS NULL');
    $stmt->execute([$item_id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function process_grgi(int $item_id, string $lot, float $move_qty, int $movetyps_id, string $actual_at): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $movetyp = $pdo->prepare('SELECT movetyps_nm FROM movetyps WHERE movetyps_id = ? AND deleted_at IS NULL');
        $movetyp->execute([$movetyps_id]);
        $movetyp_nm = $movetyp->fetchColumn();
        if (!$movetyp_nm) {
            throw new RuntimeException('Movement type not found.');
        }

        $stmt = $pdo->prepare(
            'SELECT inv_current_id, qty FROM inv_currents
             WHERE item_id = ? AND lot = ? AND deleted_at IS NULL FOR UPDATE'
        );
        $stmt->execute([$item_id, $lot]);
        $current = $stmt->fetch();
        $current_qty = $current ? (float) $current['qty'] : 0.0;

        if ($movetyp_nm === 'GR') {
            $new_qty = $current_qty + $move_qty;
        } elseif ($movetyp_nm === 'GI') {
            $new_qty = $current_qty - $move_qty;
            if ($new_qty < 0) {
                throw new RuntimeException('Insufficient stock for GI.');
            }
        } else {
            throw new RuntimeException('Unsupported movement type.');
        }

        if ($current) {
            $upd = $pdo->prepare('UPDATE inv_currents SET qty = ?, updated_at = NOW() WHERE inv_current_id = ?');
            $upd->execute([$new_qty, $current['inv_current_id']]);
        } else {
            if ($movetyp_nm === 'GI') {
                throw new RuntimeException('No stock record for this lot.');
            }
            $ins = $pdo->prepare('INSERT INTO inv_currents (item_id, qty, lot) VALUES (?, ?, ?)');
            $ins->execute([$item_id, $new_qty, $lot]);
        }

        $grgi = $pdo->prepare(
            'INSERT INTO inv_grgi (item_id, qty, lot, move_qty, movetyps_id, actual_at)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $grgi->execute([$item_id, $new_qty, $lot, $move_qty, $movetyps_id, $actual_at]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function create_period_balance(string $period): int
{
    $pdo = db();
    if (!preg_match('/^\d{6}$/', $period)) {
        throw new InvalidArgumentException('Period must be YYYYMM.');
    }

    $year = (int) substr($period, 0, 4);
    $month = (int) substr($period, 4, 2);
    $beg_at = sprintf('%04d-%02d-01 00:00:00', $year, $month);

    $rows = $pdo->query(
        'SELECT item_id, lot, qty FROM inv_currents WHERE deleted_at IS NULL AND qty > 0'
    )->fetchAll();

    $insert = $pdo->prepare(
        'INSERT INTO inv_balances (period_year_month, item_id, qty, lot, beg_at, beg_qty)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE qty = VALUES(qty), beg_qty = VALUES(beg_qty), updated_at = NOW(), deleted_at = NULL'
    );

    $count = 0;
    foreach ($rows as $row) {
        $insert->execute([
            $period,
            $row['item_id'],
            $row['qty'],
            $row['lot'],
            $beg_at,
            $row['qty'],
        ]);
        $count++;
    }
    return $count;
}
