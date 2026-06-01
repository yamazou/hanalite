# hanalite Frontend (React)

Purchase Receipt / Sales Delivery / Inventory / Masters の Web UI。  
**Receipt・Delivery・Inventory の画面表記はすべて英語**です（メニュー・ラベル・バリデーション・日付表示）。

## 前提

- Node.js 18+
- FastAPI が http://127.0.0.1:8000 で起動していること
- MySQL `hanalite` にマスタ（品目・ロケーションなど）が登録されていること

## セットアップ

```powershell
cd c:\Users\lenovo\hanalite\frontend
npm install
npm run dev
```

ブラウザ: http://localhost:5180

開発時は Vite が `/api` を FastAPI (8000) にプロキシします。

## API クライアント

`src/api/client.ts` 経由でバックエンドを呼び出します。

| 用途 | パス |
|------|------|
| Receipt Drafts | `/api/v1/pch-receipt-drafts` |
| Delivery Drafts | `/api/v1/sls-delivery-drafts` |
| Locations など Masters | `/api/v1/masters/*` |
| Inventory | `/api/v1/inventory/*` |

Receipt / Delivery は `DraftKind`（`'receipt' \| 'delivery'`）で同じコンポーネントから切り替えます。  
ページ文言は `src/config/draftPages.ts` の `getDraftPageCopy()` で管理しています。

## サイドメニュー（英語）

```
Purchase
  Receipt
    Receipt Drafts
    New Receipt
    Excel Import
    PDF Import
Sales
  Delivery
    Delivery Drafts
    New Delivery
    Excel Import
Inventory
  Current Stock
  GR/GI Movements
  Lot Trace
  Period Balances
Masters
  Item Types / Suppliers / Move Types / Locations / Items / Item Processes
```

## 画面ルート

### Purchase — Receipt

| パス | 画面 | 説明 |
|------|------|------|
| `/` | Receipt Drafts | 一覧（ステータス filter） |
| `/drafts/new` | New Receipt | 手入力（明細に **Location** 必須） |
| `/drafts/import` | Excel Import | Excel 取込（location 列対応） |
| `/drafts/import-pdf` | PDF Import | PDF 取込（Receipt のみ） |
| `/drafts/:id` | Draft Detail | 明細・PDF 表示・行追加・Approve / Cancel |

### Sales — Delivery

| パス | 画面 | 説明 |
|------|------|------|
| `/delivery` | Delivery Drafts | 一覧 |
| `/delivery/new` | New Delivery | 手入力（Location 必須） |
| `/delivery/import` | Excel Import | Excel 取込 |
| `/delivery/:id` | Draft Detail | 明細・Approve / Cancel（PDF なし） |

### Inventory（英語 UI）

| パス | 画面 | 説明 |
|------|------|------|
| `/inventory/currents` | Current Stock | ロケーション filter、ロット別現在庫 |
| `/inventory/grgi` | GR/GI Movements | 手動 GR/GI、**Location Transfer (MV)**、履歴 |
| `/trace` | Lot Trace | ロット追跡（Location filter 可） |
| `/inventory/balances` | Period Balances | 月次残高（Location filter 可） |

### Masters

| パス | 画面 |
|------|------|
| `/masters/itemtyps` | Item Types |
| `/masters/suppliers` | Suppliers |
| `/masters/movetyps` | Move Types |
| `/masters/locations` | Locations |
| `/masters/items` | Items |
| `/masters/item-processes` | Item Processes |

## ロケーション入力

Receipt / Delivery の新規登録・明細追加フォームでは、各行に **Location** ドロップダウン（`m_locations`）が必須です。  
Excel 取込では `location_id` / `location_cd` / `location_nm` 列に対応しています。

Inventory 各画面でも Location で filter または選択できます。

## 本番ビルド

```powershell
npm run build
```

`dist/` を Web サーバーに配置。API が別ホストの場合 `.env` に設定:

```
VITE_API_BASE=http://127.0.0.1:8000
```

## 同時起動（開発）

リポジトリルートの `start-hanalite.bat` を使うか、別ターミナルで:

**API**

```powershell
cd c:\Users\lenovo\hanalite\backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend**

```powershell
cd c:\Users\lenovo\hanalite\frontend
npm run dev
```
