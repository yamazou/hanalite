#!/usr/bin/env python3
"""hanalite end-to-end verification (API + DB). Run with FastAPI on :8000."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime
from io import BytesIO

API = "http://127.0.0.1:8000/api/v1"
PASS = 0
FAIL = 0


def ok(name: str) -> None:
    global PASS
    PASS += 1
    print(f"  OK  {name}")


def fail(name: str, detail: str = "") -> None:
    global FAIL
    FAIL += 1
    print(f"  FAIL {name}" + (f": {detail}" if detail else ""))


def req(method: str, path: str, data=None, headers: dict | None = None) -> tuple[int, dict | bytes]:
    url = f"{API}{path}"
    h = headers or {}
    body = None
    if data is not None:
        if isinstance(data, bytes):
            body = data
        else:
            body = json.dumps(data).encode()
            h.setdefault("Content-Type", "application/json")
    r = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            raw = res.read()
            if res.headers.get_content_type() == "application/json":
                return res.status, json.loads(raw.decode()) if raw else {}
            return res.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw.decode())
        except Exception:
            return e.code, {"detail": raw.decode()[:500]}


def multipart_import(path: str, file_bytes: bytes, filename: str, extra: dict) -> tuple[int, dict]:
    import uuid

    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for key, val in extra.items():
        if val is None:
            continue
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{val}\r\n".encode()
        )
    parts.append(
        (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
        + file_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return req("POST", path, data=body, headers=headers)  # type: ignore


def main() -> int:
    print("hanalite verification\n")

    code, body = req("GET", "/health")
    if code == 200 and body.get("status") == "ok":
        ok("health")
    else:
        fail("health", str(body))
        print("\nStart API: uvicorn app.main:app --host 127.0.0.1 --port 8000")
        return 1

    code, raw = req("GET", "/pch-receipt-drafts/template")
    if code == 200 and isinstance(raw, bytes) and len(raw) > 1000:
        ok("excel template download")
    else:
        fail("excel template", f"code={code}")

    code, locations = req("GET", "/masters/locations")
    if code == 200 and isinstance(locations, list) and len(locations) > 0:
        ok("masters locations list")
        location_id = locations[0]["location_id"]
    else:
        fail("masters locations list", str(locations))
        location_id = 1

    receipt_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    code, draft = req(
        "POST",
        "/pch-receipt-drafts",
        {
            "receipt_at": receipt_at,
            "reference_no": "VERIFY-MANUAL",
            "lines": [
                {
                    "item_id": 1,
                    "location_id": location_id,
                    "lot": f"LOT-V-M-{datetime.now().strftime('%H%M%S')}",
                    "qty": 10,
                    "line_no": 1,
                }
            ],
        },
    )
    if code == 201:
        ok("manual draft create")
        manual_id = draft["inv_receipt_draft_id"]
    else:
        fail("manual draft create", str(draft))
        manual_id = None

    if isinstance(raw, bytes):
        code, excel_draft = multipart_import(
            "/pch-receipt-drafts/import",
            raw,
            "hanalite_receipt_template.xlsx",
            {"receipt_at": receipt_at, "reference_no": "VERIFY-EXCEL"},
        )
        if code == 201 and excel_draft.get("source_type") == "excel":
            ok("excel import")
            excel_id = excel_draft["inv_receipt_draft_id"]
        else:
            fail("excel import", str(excel_draft))
            excel_id = None
    else:
        excel_id = None

    try:
        from fpdf import FPDF

        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", size=10)
        pdf.cell(0, 8, "Receipt List", ln=True)
        cols = ["item_id", "item_nm", "lot", "qty", "line_no"]
        pdf.cell(0, 6, " | ".join(cols), ln=True)
        pdf.cell(0, 6, "1 | Test Material A | LOT-V-PDF-001 | 25 | 1", ln=True)
        pdf_bytes = pdf.output()
    except Exception as e:
        fail("pdf fixture build", str(e))
        pdf_bytes = None

    if pdf_bytes:
        code, pdf_draft = multipart_import(
            "/pch-receipt-drafts/import-pdf",
            pdf_bytes if isinstance(pdf_bytes, bytes) else bytes(pdf_bytes),
            "verify_receipt.pdf",
            {"receipt_at": receipt_at, "reference_no": "VERIFY-PDF"},
        )
        if code == 201 and pdf_draft.get("source_type") == "pdf":
            ok("pdf import")
            pdf_id = pdf_draft["inv_receipt_draft_id"]
            if pdf_draft.get("has_attachment"):
                ok("pdf attachment saved")
            else:
                fail("pdf attachment flag")
        else:
            fail("pdf import", str(pdf_draft))
            pdf_id = None
    else:
        pdf_id = None

    approve_id = excel_id or manual_id
    if approve_id:
        code, approved = req("POST", f"/pch-receipt-drafts/{approve_id}/approve")
        if code == 200 and approved.get("status") == "approved":
            ok("approve draft")
        else:
            fail("approve", str(approved))

    if manual_id:
        code, listed = req("GET", "/pch-receipt-drafts")
        if code == 200 and isinstance(listed, list) and len(listed) > 0:
            ok("list drafts")
        else:
            fail("list drafts")

    code, currents = req("GET", "/inventory/currents")
    if code == 200 and isinstance(currents, list):
        ok("inventory currents")
    else:
        fail("inventory currents", str(currents))

    code, grgi_list = req("GET", "/inventory/grgi?limit=5")
    if code == 200 and isinstance(grgi_list, list):
        ok("inventory grgi list")
    else:
        fail("inventory grgi list", str(grgi_list))

    stock_lot: str | None = None
    code, movetyps = req("GET", "/inventory/movetyps")
    if code == 200 and isinstance(movetyps, list) and len(movetyps) >= 1:
        ok("inventory movetyps")
        gr_id = next((m["movetyps_id"] for m in movetyps if m.get("movetyps_cd") == "GR"), movetyps[0]["movetyps_id"])
        trace_lot = f"LOT-INV-{datetime.now().strftime('%H%M%S')}"
        code, grgi = req(
            "POST",
            "/inventory/grgi",
            {
                "item_id": 1,
                "location_id": location_id,
                "lot": trace_lot,
                "move_qty": 5,
                "movetyps_id": gr_id,
                "actual_at": receipt_at,
            },
        )
        if code == 201:
            ok("inventory manual GR")
            stock_lot = trace_lot
        else:
            fail("inventory manual GR", str(grgi))

        code, trace = req("GET", f"/inventory/trace?lot={trace_lot}")
        if code == 200 and trace.get("lot") == trace_lot:
            ok("inventory lot trace")
        else:
            fail("inventory lot trace", str(trace))
    else:
        fail("inventory movetyps", str(movetyps))

    print("\nDelivery drafts (sls-delivery-drafts)")

    code, raw_dlv_tpl = req("GET", "/sls-delivery-drafts/template")
    if code == 200 and isinstance(raw_dlv_tpl, bytes) and len(raw_dlv_tpl) > 1000:
        ok("delivery excel template download")
    else:
        fail("delivery excel template", f"code={code}")

    delivery_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    delivery_lot = stock_lot or f"LOT-DLV-{datetime.now().strftime('%H%M%S')}"
    code, delivery_draft = req(
        "POST",
        "/sls-delivery-drafts",
        {
            "delivery_at": delivery_at,
            "reference_no": "VERIFY-DELIVERY-MANUAL",
            "lines": [
                {
                    "item_id": 1,
                    "location_id": location_id,
                    "lot": delivery_lot,
                    "qty": 2,
                    "line_no": 1,
                }
            ],
        },
    )
    if code == 201:
        ok("delivery manual draft create")
        delivery_manual_id = delivery_draft["sls_delivery_draft_id"]
    else:
        fail("delivery manual draft create", str(delivery_draft))
        delivery_manual_id = None

    if isinstance(raw_dlv_tpl, bytes) and stock_lot:
        code, delivery_excel = multipart_import(
            "/sls-delivery-drafts/import",
            raw_dlv_tpl,
            "hanalite_delivery_template.xlsx",
            {"delivery_at": delivery_at, "reference_no": "VERIFY-DELIVERY-EXCEL"},
        )
        if code == 201 and delivery_excel.get("source_type") == "excel":
            ok("delivery excel import")
            delivery_excel_id = delivery_excel["sls_delivery_draft_id"]
        else:
            fail("delivery excel import", str(delivery_excel))
            delivery_excel_id = None
    else:
        delivery_excel_id = None

    code, delivery_list = req("GET", "/sls-delivery-drafts")
    if code == 200 and isinstance(delivery_list, list):
        ok("delivery list drafts")
    else:
        fail("delivery list drafts", str(delivery_list))

    if delivery_manual_id:
        code, delivery_detail = req("GET", f"/sls-delivery-drafts/{delivery_manual_id}")
        if code == 200 and delivery_detail.get("sls_delivery_draft_id") == delivery_manual_id:
            ok("delivery get draft")
        else:
            fail("delivery get draft", str(delivery_detail))

    delivery_approve_id = delivery_manual_id if stock_lot else None
    if delivery_approve_id:
        code, delivery_approved = req("POST", f"/sls-delivery-drafts/{delivery_approve_id}/approve")
        if code == 200 and delivery_approved.get("status") == "approved":
            ok("delivery approve draft (GI)")
        else:
            fail("delivery approve draft", str(delivery_approved))

        code, delivery_cancelled = req("POST", f"/sls-delivery-drafts/{delivery_approve_id}/cancel")
        if code == 200 and delivery_cancelled.get("status") == "cancelled":
            ok("delivery cancel approved draft")
        else:
            fail("delivery cancel approved draft", str(delivery_cancelled))
    elif delivery_manual_id:
        fail("delivery approve draft", "no stock lot from inventory GR; skipped GI test")

    if delivery_excel_id:
        code, delivery_pending_cancel = req("POST", f"/sls-delivery-drafts/{delivery_excel_id}/cancel")
        if code == 200 and delivery_pending_cancel.get("status") == "cancelled":
            ok("delivery cancel registered draft")
        else:
            fail("delivery cancel registered draft", str(delivery_pending_cancel))

    period = datetime.now().strftime("%Y%m")
    code, bal = req("POST", f"/inventory/balances?period={period}")
    if code == 201 and bal.get("rows_saved", 0) >= 0:
        ok("inventory period balance")
    else:
        fail("inventory period balance", str(bal))

    code, itemtyps = req("GET", "/masters/itemtyps")
    if code == 200 and isinstance(itemtyps, list):
        ok("masters itemtyps list")
    else:
        fail("masters itemtyps list", str(itemtyps))

    suffix = datetime.now().strftime("%H%M%S")
    code, created_typ = req(
        "POST",
        "/masters/itemtyps",
        {"itemtyp_cd": f"VT{suffix}", "itemtyp_nm": f"Verify Type {suffix}"},
    )
    if code == 201 and created_typ.get("itemtyp_id"):
        ok("masters itemtyp create")
        req("DELETE", f"/masters/itemtyps/{created_typ['itemtyp_id']}")
    else:
        fail("masters itemtyp create", str(created_typ))

    code, items = req("GET", "/masters/items")
    if code == 200 and isinstance(items, list):
        ok("masters items list")
    else:
        fail("masters items list", str(items))

    print(f"\nResult: {PASS} passed, {FAIL} failed")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
