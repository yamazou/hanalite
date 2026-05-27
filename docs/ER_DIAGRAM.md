# hanalite ER 図

MySQL データベース `hanalite` の主要テーブル関係（2026-05 時点）。

## 命名規則

| プレフィックス | 意味 | 例 |
|--------------|------|-----|
| `m_` | マスタ | `m_items`, `m_suppliers` |
| `pch_` | 購買（Purchase）トランザクション | `pch_receipt_draft` |
| `inv_` | 在庫（Inventory）トランザクション | `inv_grgi`, `inv_currents` |

## ER 図（Mermaid）

```mermaid
erDiagram
    m_itemtyps ||--o{ m_items : "itemtyp_id"
    m_suppliers ||--o{ m_items : "supplier1..5"
    m_items ||--o{ m_boms : "p_item_id (parent)"
    m_items ||--o{ m_boms : "c_item_id (child)"
    m_items ||--o{ inv_currents : "item_id"
    m_items ||--o{ inv_grgi : "item_id"
    m_items ||--o{ inv_balances : "item_id"
    m_movetyps ||--o{ inv_grgi : "movetyps_id"
    m_suppliers ||--o{ pch_receipt_draft : "suppliers_id"
    pch_receipt_draft ||--o{ pch_receipt_draft_lines : "inv_receipt_draft_id"
    m_items ||--o{ pch_receipt_draft_lines : "item_id"
    pch_receipt_draft ||--o{ inv_grgi : "inv_receipt_draft_id (audit)"

    m_itemtyps {
        int itemtyp_id PK
        varchar itemtyp_nm
    }

    m_suppliers {
        int suppliers_id PK
        varchar suppliers_nm
    }

    m_movetyps {
        int movetyps_id PK
        varchar movetyps_nm
    }

    m_items {
        int item_id PK
        varchar item_cd UK
        varchar item_nm
        int itemtyp_id FK
        int supplier1_id FK
    }

    m_boms {
        int bom_id PK
        int p_item_id FK
        int c_item_id FK
        decimal c_req_qty
    }

    pch_receipt_draft {
        int inv_receipt_draft_id PK
        enum status
        enum source_type
        datetime receipt_at
        int suppliers_id FK
        varchar reference_no
        varchar attachment_path
    }

    pch_receipt_draft_lines {
        int inv_receipt_draft_line_id PK
        int inv_receipt_draft_id FK
        int line_no
        int item_id FK
        varchar lot
        decimal qty
    }

    inv_grgi {
        int inv_grgi_id PK
        int item_id FK
        int movetyps_id FK
        int inv_receipt_draft_id FK
        varchar lot
        decimal move_qty
        decimal qty
        datetime actual_at
    }

    inv_currents {
        int inv_current_id PK
        int item_id FK
        varchar lot
        decimal qty
    }

    inv_balances {
        int inv_balance_id PK
        char period_year_month
        int item_id FK
        varchar lot
        decimal qty
        datetime beg_at
        decimal beg_qty
    }
```

## データフロー（入荷）

```
pch_receipt_draft (registered)
        │
        │ approve
        ▼
inv_grgi (GR) ──► inv_currents
        │
        └── inv_receipt_draft_id でドラフトと紐付け
```

承認前のドラフトは在庫テーブルに触れません。詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。

## 対応 API

| テーブル | REST API |
|----------|----------|
| `pch_receipt_draft` / `pch_receipt_draft_lines` | `/api/v1/pch-receipt-drafts` |
| `m_items`, `m_itemtyps`, `m_suppliers`, `m_movetyps` | `/api/v1/masters/*` |
| `m_boms` | `/api/v1/boms` |
| `inv_currents`, `inv_grgi`, `inv_balances` | `/api/v1/inventory/*` |
