# hanalite

軽量ロットトレーサビリティシステム（MySQL `hanalite`）

- **React UI**: http://localhost:5180 — Purchase / Sales / Inventory / Masters（画面表記は英語）
- **FastAPI**: http://127.0.0.1:8000/docs

## 前提

- MySQL 8（例: XAMPP の MySQL on 3306）
- データベース: `hanalite`

## セットアップ

### 新規インストール

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_drafts.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_delivery_drafts.sql
```

### 既存 DB のマイグレーション

順番に適用してください。

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_rename_pch_receipt_tables.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_rename_m_master_tables.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_item_cd.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_boms.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_locations.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_delivery_drafts.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_inventory_locations.sql
```

### 起動（開発）

```bat
start-hanalite.bat
```

React UI: http://localhost:5180  
Swagger: http://127.0.0.1:8000/docs

## テーブル構成

### マスタ

| テーブル | 内容 |
|----------|------|
| `m_itemtyps` | 品目種別（RM, WIP, FG など） |
| `m_suppliers` | 仕入先 |
| `m_locations` | ロケーション（倉庫・保管場所） |
| `m_items` | 品目（`item_cd` 業務コード + 仕入先5件まで） |
| `m_boms` | BOM（親品目 → 子品目、子必要量） |
| `m_movetyps` | 移動種別（GR / GI / MV） |

### トランザクション

| テーブル | 内容 |
|----------|------|
| `pch_receipt_draft` / `pch_receipt_draft_lines` | 入荷ドラフト（承認前） |
| `sls_delivery_draft` / `sls_delivery_draft_lines` | 出荷ドラフト（承認前） |
| `inv_grgi` | 入出庫履歴（ロケーション単位） |
| `inv_currents` | 現在庫（品目 × ロケーション × ロット） |
| `inv_balances` | 月次開始残高スナップショット（ロケーション単位） |

ER 図・API 対応表: [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md)  
アーキテクチャ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## React / FastAPI（推奨）

### API

| 領域 | ベースパス |
|------|------------|
| Purchase Receipt Drafts | `/api/v1/pch-receipt-drafts` |
| Sales Delivery Drafts | `/api/v1/sls-delivery-drafts` |
| Masters | `/api/v1/masters/*` |
| Inventory | `/api/v1/inventory/*` |

在庫は **ロケーション単位** で管理します。Receipt / Delivery 明細にも `location_id` が必須です。  
ロケーション間移動は move type **MV**（`POST /api/v1/inventory/move`）で記録されます。

### UI（英語表記）

サイドメニュー構成:

| グループ | 画面 |
|----------|------|
| **Purchase → Receipt** | Receipt Drafts, New Receipt, Excel Import, PDF Import |
| **Sales → Delivery** | Delivery Drafts, New Delivery, Excel Import |
| **Inventory** | Current Stock, GR/GI Movements, Lot Trace, Period Balances |
| **Masters** | Item Types, Suppliers, Move Types, Locations, Items, BOM |

詳細なルート一覧: [frontend/README.md](frontend/README.md)

## 主な機能

| 画面 | 内容 |
|------|------|
| Receipt Drafts | 入荷ドラフト一覧・承認（GR）・キャンセル |
| Delivery Drafts | 出荷ドラフト一覧・承認（GI）・キャンセル |
| Current Stock | ロケーション別・ロット別現在庫 |
| GR/GI Movements | 手動 GR/GI、ロケーション間移動（MV）、履歴 |
| Lot Trace | ロット番号で履歴・現在庫・残高を追跡（ロケーション filter 可） |
| Period Balances | 月次残高スナップショット（ロケーション単位） |
| Masters | 各マスタの登録・削除 |

## 使い方（例）

1. Masters で Item Types / Suppliers / Locations / Items を登録
2. Purchase → New Receipt で品目・**Location**・ロット・数量を入力し承認 → Current Stock に反映
3. Sales → New Delivery で出荷を登録・承認 → 在庫が減算
4. Inventory → GR/GI Movements でロケーション間移動（MV）を登録
5. Lot Trace でロット番号（と Location）を指定して追跡

## 検証

API 起動後:

```powershell
cd backend
.\.venv\Scripts\python.exe ..\scripts\verify_all.py
```

## 設定

DB 接続は `backend/.env` で変更できます。
