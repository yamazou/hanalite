"""Apply sql/schema_production_order_lines.sql to the configured database."""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings  # noqa: E402

SKIP_MARKERS = (
    "Duplicate column",
    "Duplicate key name",
    "check that column/key exists",
    "already exists",
    "Duplicate entry",
    "Can't DROP",
)


def main() -> None:
    sql_path = ROOT / "sql" / "schema_production_order_lines.sql"
    raw = sql_path.read_text(encoding="utf-8")
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
            print("OK:", stmt.split("\n", 1)[0][:80])
        except Exception as ex:
            msg = str(ex)
            if any(m in msg for m in SKIP_MARKERS):
                print("SKIP:", msg[:100])
            else:
                raise
    print("done")


if __name__ == "__main__":
    main()
