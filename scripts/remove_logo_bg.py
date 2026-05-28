"""Remove solid background from hanalite logo (flood-fill from corners)."""
from __future__ import annotations

import collections
import sys
from pathlib import Path

from PIL import Image


def color_close(a: tuple[int, ...], b: tuple[int, ...], tolerance: int) -> bool:
    return all(abs(x - y) <= tolerance for x, y in zip(a[:3], b[:3]))


def remove_background(path: Path, tolerance: int = 28) -> None:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()

    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg_samples = [px[x, y][:3] for x, y in corners]

    visited: set[tuple[int, int]] = set()
    queue: collections.deque[tuple[int, int]] = collections.deque(corners)

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        cur = px[x, y][:3]
        if not any(color_close(cur, bg, tolerance) for bg in bg_samples):
            continue
        px[x, y] = (*cur, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    im.save(path)


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('frontend/public/hanalite-logo.png')
    remove_background(target.resolve())
    print(f'Updated {target}')
