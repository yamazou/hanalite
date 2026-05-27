<?php
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/functions.php';

$page_title = $page_title ?? APP_NAME;
$flash = get_flash();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($page_title) ?> | <?= h(APP_NAME) ?></title>
    <link rel="stylesheet" href="<?= h(BASE_URL) ?>/assets/style.css">
</head>
<body>
<div class="layout">
    <aside class="sidebar">
        <div class="brand"><?= h(APP_NAME) ?></div>
        <nav>
            <a class="<?= active_menu('/index.php') ?>" href="<?= h(BASE_URL) ?>/index.php">Dashboard</a>
            <div class="nav-group">Master</div>
            <a class="<?= active_menu('/masters/itemtyps.php') ?>" href="<?= h(BASE_URL) ?>/masters/itemtyps.php">Item Types</a>
            <a class="<?= active_menu('/masters/suppliers.php') ?>" href="<?= h(BASE_URL) ?>/masters/suppliers.php">Suppliers</a>
            <a class="<?= active_menu('/masters/items.php') ?>" href="<?= h(BASE_URL) ?>/masters/items.php">Items</a>
            <a class="<?= active_menu('/masters/movetyps.php') ?>" href="<?= h(BASE_URL) ?>/masters/movetyps.php">Move Types</a>
            <div class="nav-group">Inventory</div>
            <a class="<?= active_menu('/transactions/grgi.php') ?>" href="<?= h(BASE_URL) ?>/transactions/grgi.php">GR / GI</a>
            <a class="<?= active_menu('/transactions/currents.php') ?>" href="<?= h(BASE_URL) ?>/transactions/currents.php">Current Stock</a>
            <a class="<?= active_menu('/transactions/balances.php') ?>" href="<?= h(BASE_URL) ?>/transactions/balances.php">Balances</a>
            <div class="nav-group">Trace</div>
            <a class="<?= active_menu('/trace/lot.php') ?>" href="<?= h(BASE_URL) ?>/trace/lot.php">Lot Trace</a>
        </nav>
    </aside>
    <main class="content">
        <?php if ($flash): ?>
            <div class="alert alert-<?= h($flash['type']) ?>"><?= h($flash['message']) ?></div>
        <?php endif; ?>
