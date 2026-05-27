import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Item } from '../types'
import { formatItemLabel } from '../utils/format'

export function AddDraftLineForm({
  draftId,
  onAdded,
}: {
  draftId: number
  onAdded: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState<number | ''>('')
  const [lot, setLot] = useState('')
  const [qty, setQty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!itemId || !lot.trim() || !qty) {
      setError('品目・ロット・数量を入力してください。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.addDraftLine(draftId, {
        item_id: Number(itemId),
        lot: lot.trim(),
        qty: parseFloat(qty),
        line_no: 1,
      })
      setLot('')
      setQty('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="add-line-form" onSubmit={handleSubmit}>
      <h3>明細を追加</h3>
      {error && <p className="alert-inline error">{error}</p>}
      <div className="line-row add-line-row">
        <label>
          品目
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value === '' ? '' : Number(e.target.value))}
            required
          >
            <option value="">選択</option>
            {items.map((item) => (
              <option key={item.item_id} value={item.item_id}>
                {formatItemLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          ロット
          <input value={lot} onChange={(e) => setLot(e.target.value)} required />
        </label>
        <label>
          数量
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          追加
        </button>
      </div>
    </form>
  )
}
