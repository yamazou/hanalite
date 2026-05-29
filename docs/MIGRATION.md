# データベース・環境セットアップ

UI は **React + FastAPI** のみです。

## 新規インストール

```bat
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_drafts.sql
C:\xampp82\mysql\bin\mysql.exe -u root hanalite < sql\schema_delivery_drafts.sql
```

## 既存 DB のマイグレーション

`README.md` の「既存 DB のマイグレーション」に列挙された SQL を順に適用してください。

## 起動・検証

```bat
start-hanalite.bat
```

- React UI: http://localhost:5180
- Swagger: http://127.0.0.1:8000/docs

API 起動後:

```powershell
cd backend
.\.venv\Scripts\python.exe ..\scripts\verify_all.py
```

## 開発時の起動

1. MySQL（3306）を起動
2. `start-hanalite.bat`（FastAPI + Vite）または手動で uvicorn / `npm run dev`

詳細: [ARCHITECTURE.md](./ARCHITECTURE.md)
