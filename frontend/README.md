# hanalite Frontend (React)

入荷ドラフトの一覧・登録・目検承認 UI（Phase 2）

## 前提

- Node.js 18+
- FastAPI が http://127.0.0.1:8000 で起動していること
- MySQL `hanalite` にマスタ（品目など）が登録されていること

## セットアップ

```powershell
cd c:\Users\lenovo\hanalite\frontend
npm install
npm run dev
```

ブラウザ: http://localhost:5180

開発時は Vite が `/api` を FastAPI (8000) にプロキシします。

## 画面

| パス | 内容 |
|------|------|
| `/` | 入荷ドラフト一覧（ステータスフィルタ） |
| `/drafts/new` | マニュアル入荷登録 |
| `/drafts/import` | Excel 入荷リスト取込 |
| `/drafts/import-pdf` | PDF 入荷リスト取込 |
| `/drafts/:id` | 詳細・PDF表示・明細追加・承認 / キャンセル |

## 本番ビルド

```powershell
npm run build
```

`dist/` を Web サーバーに配置。API は別ホストの場合 `.env` に設定:

```
VITE_API_BASE=http://127.0.0.1:8000
```

## 同時起動（開発）

ターミナル 1 — API:

```powershell
cd c:\Users\lenovo\hanalite\backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
```

ターミナル 2 — フロント:

```powershell
cd c:\Users\lenovo\hanalite\frontend
npm run dev
```
