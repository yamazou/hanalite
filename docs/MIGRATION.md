# PHP → FastAPI + React 移行ガイド

## 現状

| 項目 | PHP 版 | 新 API |
|------|--------|--------|
| 場所 | `hanalite/*.php` | `hanalite/backend/` |
| URL | http://localhost:8080/hanalite/ | http://127.0.0.1:8000/docs |
| 入荷ドラフト | 未実装 | `receipt-drafts` API |
| マスタ CRUD | 画面あり | API のみ（React で再実装） |

## 移行ステップ

### Step 1 — DB（完了）

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_drafts.sql
```

`inv_grgi` に `inv_receipt_draft_id` 列を追加（未追加の場合）:

```sql
ALTER TABLE inv_grgi
  ADD COLUMN inv_receipt_draft_id INT UNSIGNED NULL AFTER movetyps_id;
```

### Step 2 — FastAPI 起動

`backend/README.md` 参照。

### Step 3 — 動作確認（curl / Swagger）

1. マスタに品目が無ければ PHP 画面または SQL で登録
2. Swagger で `POST /api/v1/receipt-drafts` 作成
3. `POST .../approve` で在庫反映
4. PHP の Current Stock / Lot Trace でロット確認

### Step 4 — React フロント（完了）

`frontend/` を参照。

```powershell
cd frontend
npm install
npm run dev
```

http://localhost:5180 — 入荷一覧・新規登録・承認 / キャンセル

### Step 5 — PDF 取込（Phase 4）

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_pdf.sql
```

http://localhost:5180/drafts/import-pdf

### 一括検証

API 起動後:

```powershell
cd backend
.\.venv\Scripts\python.exe ..\scripts\verify_all.py
```

### Step 6 — PHP 廃止判断

以下が React で揃ったら PHP を参照専用または削除:

- 入荷ドラフト・承認
- マスタメンテ
- ロット追跡

## データ移行

既存 `inv_grgi` / `inv_currents` はそのまま利用。ドラフトテーブルは新規のため移行データなし。

## 開発時の起動

1. XAMPP: MySQL（3306）、必要なら Apache
2. ターミナル1: `uvicorn app.main:app --reload --port 8000`
3. ターミナル2（後日）: `npm run dev`（React）
