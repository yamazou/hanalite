# hanalite アーキテクチャ

## 全体構成（目標）

```
┌─────────────┐     HTTP/JSON    ┌──────────────┐     SQL      ┌─────────┐
│   React     │ ◄──────────────► │   FastAPI    │ ◄──────────► │  MySQL  │
│  (Vite)     │   /api/v1/...    │   (Python)   │   hanalite   │         │
└─────────────┘                  └──────────────┘              └─────────┘
```

## データの役割分担

| テーブル | 役割 |
|----------|------|
| `m_itemtyps` | 品目種別マスタ（RM, WIP, FG など） |
| `m_suppliers` | 仕入先マスタ |
| `m_items` | 品目マスタ（`item_cd` + 仕入先5件まで） |
| `m_itemprocs` / `m_itemproc_inputs` | 品目工程マスタ（FG → 工程・投入品目） |
| `m_movetyps` | 移動種別マスタ（GR / GI / CAN） |
| `pch_receipt_draft` | 入荷リスト**ドラフト**（承認前） |
| `pch_receipt_draft_lines` | ドラフト明細 |
| `inv_grgi` | **確定後**の受払履歴（監査・ロット追跡） |
| `inv_currents` | 現在庫（品目 × ロット） |
| `inv_balances` | 月次残高スナップショット |

**ドラフトは在庫に触れない。** `approve` のときだけ `inv_grgi` / `inv_currents` を更新する。

ER 図: [ER_DIAGRAM.md](./ER_DIAGRAM.md)

## API パス（FastAPI `/api/v1`）

| リソース | パス |
|----------|------|
| 入荷ドラフト | `/pch-receipt-drafts` |
| マスタ | `/masters/items`, `/masters/suppliers`, … |
| 品目工程 | `/masters/items/{id}/processes` |
| 在庫 | `/inventory/currents`, `/inventory/grgi`, `/inventory/balances` |

## 承認・キャンセル

### Approve（registered → approved）

各明細行に対して:

1. `movetyps = GR`, `move_qty = +qty`
2. `inv_currents` を加算
3. `inv_grgi.inv_receipt_draft_id` にドラフト ID を記録

### Cancel（registered）

- ステータスを `cancelled` に変更（在庫・`inv_grgi` 変更なし）

### Cancel（approved）

各明細行に対して:

1. `movetyps = CAN`, `move_qty = -qty`（マイナス記録）
2. `inv_currents` を減算

その後ステータスを `registered` に戻し、`approved_at` をクリア（`cancelled` にはしない）

## レイヤー（FastAPI）

```
routers/     … HTTP・バリデーション・HTTPException
schemas/     … Pydantic 入出力
services/    … トランザクション・業務ルール
models/      … SQLAlchemy ORM
```
