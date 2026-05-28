"""Apply sql/schema_production_status_receipt.sql"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings  # noqa: E402

SKIP = ("Duplicate column", "already exists")


def main() -> None:
    raw = (ROOT / "sql" / "schema_production_status_receipt.sql").read_text(encoding="utf-8")
    statements: list[str] = []
    buf: list[str] = []
    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("--"):
            continue
        buf.append(line)
        if s.endswith(";"):
            statements.append("\n".join(buf))
            buf = []

    engine = create_engine(settings.database_url)
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
            print("OK")
        except Exception as ex:
            msg = str(ex)
            if any(m in msg for m in SKIP):
                print("SKIP:", msg[:80])
            else:
                raise
    print("done")


if __name__ == "__main__":
    main()
