# hanalite API (FastAPI)

ロットトレーサビリティ — 入荷ドラフト・承認・在庫反映 API

## 前提

- Python 3.11+
- MySQL `hanalite`（XAMPP 8.2 / ポート 3306）
- スキーマ: `sql/schema.sql` + `sql/schema_drafts.sql` 適用済み

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

## API 一覧（Phase 1）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/v1/health` | 死活監視 |
| GET | `/api/v1/receipt-drafts` | 入荷ドラフト一覧（`?status=registered`） |
| POST | `/api/v1/receipt-drafts` | ドラフト作成（status=registered） |
| GET | `/api/v1/receipt-drafts/{id}` | 詳細 |
| POST | `/api/v1/receipt-drafts/{id}/approve` | 承認 → `inv_grgi` + 現在庫更新 |
| POST | `/api/v1/receipt-drafts/{id}/cancel` | キャンセル（承認済みはマイナス記録） |
| GET | `/api/v1/masters/items` | 品目一覧（React 用） |

## ドラフト作成例

```json
POST /api/v1/receipt-drafts
{
  "receipt_at": "2026-05-27T10:00:00",
  "suppliers_id": 1,
  "reference_no": "PO-2026-001",
  "notes": "Manual entry",
  "lines": [
    { "item_id": 1, "lot": "LOT-001", "qty": 100, "line_no": 1 }
  ]
}
```

## ステータスフロー

```
registered  ──approve──►  approved  ──cancel──►  cancelled (+ inv_grgi マイナス)
     │
     └────cancel────►  cancelled（在庫変更なし）
```

## Excel / PDF 取込

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/v1/receipt-drafts/template` | Excel テンプレート |
| POST | `/api/v1/receipt-drafts/import` | Excel 取込 |
| POST | `/api/v1/receipt-drafts/import-pdf` | PDF 取込（保存 + 表抽出） |
| GET | `/api/v1/receipt-drafts/{id}/attachment` | 添付 PDF ダウンロード |
| POST | `/api/v1/receipt-drafts/{id}/lines` | 明細追加（PDF 未抽出時など） |

## 一括検証

```powershell
# API 起動後
cd backend
.\.venv\Scripts\python.exe ..\scripts\verify_all.py
```
