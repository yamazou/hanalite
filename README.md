# hanalite

軽量ロットトレーサビリティシステム（MySQL `hanalite`）

- **React UI**（推奨）: http://localhost:5180
- **FastAPI**: http://127.0.0.1:8000/docs
- **PHP 版**（プロトタイプ）: http://localhost:8080/hanalite/

## 前提

- XAMPP 8.2（Apache: 8080, MySQL: 3306）
- データベース: `hanalite`

## セットアップ

1. スキーマ適用（初回のみ）

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_drafts.sql
```

既存DBに `item_cd` を追加する場合:

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_item_cd.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_boms.sql
```

2. ブラウザで開く

```
http://localhost:8080/hanalite/
```

## テーブル構成

### マスタ
- `itemtyps` … 品目種別（RM, WIP, FG など）
- `suppliers` … 仕入先
- `items` … 品目（`item_cd` 業務コード + 仕入先5件まで）
- `boms` … BOM（親品目 `p_item_id` → 子品目 `c_item_id`、子必要量 `c_req_qty`）
- `movetyps` … 移動種別（GR / GI）

### トランザクション
- `inv_grgi` … 入出庫履歴
- `inv_currents` … 現在庫（品目×ロット）
- `inv_balances` … 月次開始残高スナップショット

## 主な機能

| 画面 | 内容 |
|------|------|
| Dashboard | 件数サマリ・直近入出庫 |
| Master | 各マスタの登録・削除 |
| GR / GI | 入庫(GR)・出庫(GI)登録、現在庫自動更新 |
| Current Stock | ロット別現在庫一覧 |
| Balances | 月次残高スナップショット作成 |
| Lot Trace | ロット番号で履歴・現在庫・残高を追跡 |

## 使い方（例）

1. Item Types / Suppliers / Items を登録
2. GR / GI でロット入出庫を登録
3. Lot Trace でロット番号を検索して追跡

## 設定

DB接続は `config.php` で変更できます。
