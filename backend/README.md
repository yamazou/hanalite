# hanalite API (FastAPI)

ロットトレーサビリティ API — Purchase Receipt / Sales Delivery ドラフト、承認、ロケーション単位在庫

## 前提

- Python 3.11+
- MySQL `hanalite`（XAMPP 8.2 / ポート 3306）
- スキーマ適用済み（新規: `sql/schema.sql` + `sql/schema_drafts.sql` + `sql/schema_delivery_drafts.sql`）  
  既存 DB のマイグレーション手順は [../README.md](../README.md) を参照

## セットアップ

```powershell
cd c:\Users\lenovo\hanalite\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

## 起動

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API ルート: http://127.0.0.1:8000/
- Swagger UI: http://127.0.0.1:8000/docs
- ヘルスチェック: http://127.0.0.1:8000/api/v1/health

## プロジェクト構成

```
backend/
├── app/
│   ├── main.py           # FastAPI エントリ
│   ├── config.py         # 環境変数
│   ├── database.py       # SQLAlchemy 接続
│   ├── models/           # DB モデル
│   ├── schemas/          # Pydantic（API入出力）
│   ├── services/         # 業務ロジック
│   └── routers/          # HTTP エンドポイント
├── requirements.txt
└── .env.example
```

## 在庫の考え方

- 在庫は **品目 × ロケーション × ロット** 単位（`inv_currents`）
- 入出庫履歴（`inv_grgi`）にも `location_id` を記録
- Move type: **GR**（入庫）、**GI**（出庫）、**MV**（ロケーション間移動）
- Receipt 承認 → GR、Delivery 承認 → GI
- ロケーション未指定の明細はデフォルト Location（`MAIN`）に解決

---

## API 一覧

### Health

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/v1/health` | 死活監視 |

### Purchase — Receipt Drafts (`/api/v1/pch-receipt-drafts`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `` | 一覧（`?status=registered\|approved\|cancelled`） |
| POST | `` | 手入力作成 |
| GET | `/template` | Excel テンプレート |
| POST | `/import` | Excel 取込 |
| POST | `/import-pdf` | PDF 取込（保存 + 表抽出） |
| GET | `/{id}` | 詳細 |
| GET | `/{id}/attachment` | 添付 PDF ダウンロード |
| POST | `/{id}/lines` | 明細追加 |
| POST | `/{id}/approve` | 承認 → GR + 現在庫更新 |
| POST | `/{id}/cancel` | キャンセル（承認済みは逆仕訳のうえ `registered`、未承認は `cancelled`） |

### Sales — Delivery Drafts (`/api/v1/sls-delivery-drafts`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `` | 一覧（`?status=`） |
| POST | `` | 手入力作成 |
| GET | `/template` | Excel テンプレート |
| POST | `/import` | Excel 取込 |
| GET | `/{id}` | 詳細 |
| POST | `/{id}/lines` | 明細追加 |
| POST | `/{id}/approve` | 承認 → GI + 現在庫減算 |
| POST | `/{id}/cancel` | キャンセル（承認済みは逆仕訳のうえ `registered`、未承認は `cancelled`） |

PDF 取込は Delivery にはありません。

### Masters (`/api/v1/masters`)

| Method | Path | 説明 |
|--------|------|------|
| GET/POST/DELETE | `/itemtyps`, `/itemtyps/{id}` | 品目種別 |
| GET/POST/DELETE | `/suppliers`, `/suppliers/{id}` | 仕入先 |
| GET/POST/DELETE | `/movetyps`, `/movetyps/{id}` | 移動種別 |
| GET/POST/DELETE | `/locations`, `/locations/{id}` | ロケーション |
| GET/POST/PUT/DELETE | `/items`, `/items/{id}` | 品目 |
| GET | `/items/search?q=` | 品目検索（ピッカー用） |

### Item Processes (`/api/v1/masters/items`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/processes/final-items` | 工程登録済み FG 一覧 |
| PUT | `/processes/final-items` | FG 登録 |
| GET | `/{item_id}/processes` | 工程・投入取得 |
| PUT | `/{item_id}/processes` | 工程・投入保存 |

### Production (`/api/v1/production/orders`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `` | 製造オーダー一覧 |
| POST | `` | 製造オーダー作成 |
| GET | `/{order_id}` | 詳細（工程・投入含む） |
| PUT | `/{order_id}` | 更新 |
| POST | `/{order_id}/approve` | 承認（Ordered） |
| POST | `/{order_id}/cancel` | Registered に戻す |
| DELETE | `/{order_id}` | 削除（Registered のみ） |

### Inventory (`/api/v1/inventory`)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/currents` | 現在庫（`?location_id=&item_id=&lot=&include_zero=`） |
| GET | `/grgi` | 入出庫履歴（`?location_id=&item_id=&lot=`） |
| GET | `/movetyps` | 手動登録用 move type（GR / GI / MV） |
| POST | `/grgi` | 手動 GR/GI |
| POST | `/move` | ロケーション間移動（MV：GI + GR の2行） |
| GET | `/trace` | ロット追跡（`?lot=&location_id=`） |
| GET | `/balances` | 月次残高（`?period_year_month=&location_id=`） |
| POST | `/balances` | 月次残高スナップショット作成 |

---

## リクエスト例

### Receipt Draft 作成

```json
POST /api/v1/pch-receipt-drafts
{
  "receipt_at": "2026-05-27T10:00:00",
  "suppliers_id": 1,
  "reference_no": "PO-2026-001",
  "notes": "Manual entry",
  "lines": [
    {
      "item_id": 1,
      "location_id": 1,
      "lot": "LOT-001",
      "qty": 100,
      "line_no": 1
    }
  ]
}
```

`location_id` 省略時はデフォルト Location（`MAIN`）が使われます。

### Delivery Draft 作成

```json
POST /api/v1/sls-delivery-drafts
{
  "delivery_at": "2026-05-27T14:00:00",
  "reference_no": "SO-2026-001",
  "lines": [
    {
      "item_id": 1,
      "location_id": 1,
      "lot": "LOT-001",
      "qty": 10,
      "line_no": 1
    }
  ]
}
```

### ロケーション間移動（MV）

```json
POST /api/v1/inventory/move
{
  "item_id": 1,
  "from_location_id": 1,
  "to_location_id": 2,
  "lot": "LOT-001",
  "qty": 5,
  "actual_at": "2026-05-27T15:00:00"
}
```

### 手動 GR/GI

```json
POST /api/v1/inventory/grgi
{
  "item_id": 1,
  "location_id": 1,
  "lot": "LOT-001",
  "move_qty": 10,
  "movetyps_id": 1,
  "actual_at": "2026-05-27T10:00:00"
}
```

---

## ステータスフロー

Receipt / Delivery 共通:

```
registered  ──approve──►  approved  ──cancel──►  registered (+ 在庫逆仕訳)
     │
     └────cancel────►  cancelled（在庫変更なし）
```

| 操作 | Receipt | Delivery |
|------|---------|----------|
| approve | GR（入庫） | GI（出庫） |
| cancel（承認後） | GR 逆仕訳 → `registered` に戻す | GI 逆仕訳 → `registered` に戻す |
| cancel（登録済） | `cancelled`（在庫変更なし） | `cancelled`（在庫変更なし） |

---

## Excel 取込

Receipt / Delivery ともに Excel テンプレートに以下の列を含みます:

- `item_id` / `item_cd` / `item_nm`
- `location_id` / `location_cd` / `location_nm`
- `lot`, `qty`, `line_no`

Receipt のみ PDF 取込（`/import-pdf`）に対応しています。

---

## 一括検証

```powershell
# API 起動後
cd backend
.\.venv\Scripts\python.exe ..\scripts\verify_all.py
```

Receipt / Delivery / Inventory / Locations を含む API 疎通を確認します。

## 関連ドキュメント

- [../README.md](../README.md) — プロジェクト全体
- [../frontend/README.md](../frontend/README.md) — React UI（英語表記）
- [../docs/ER_DIAGRAM.md](../docs/ER_DIAGRAM.md) — ER 図
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — アーキテクチャ
