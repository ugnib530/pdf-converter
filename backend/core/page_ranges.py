"""
core/page_ranges.py
Parse human-readable page-range strings into 0-indexed page number lists.

Supported syntax (1-indexed, as users think of pages):
  "1"       → [0]
  "1-3"     → [0, 1, 2]
  "1-3, 5"  → [0, 1, 2, 4]
  "7-"      → [6, 7, 8, ... total_pages-1]
  "-3"      → [0, 1, 2]
  ""        → [] (caller decides meaning: all pages or error)

Raises ValueError with a user-friendly message on bad input.
"""
from __future__ import annotations


def parse_page_ranges(ranges_str: str, total_pages: int) -> list[int]:
    """
    Convert a range string to a sorted, de-duplicated list of 0-indexed page numbers.

    Args:
        ranges_str:   The raw string from the user (e.g. "1-3, 5, 7-").
        total_pages:  Total number of pages in the document (upper bound).

    Returns:
        Sorted list of valid 0-indexed page indices.

    Raises:
        ValueError: If the string is malformed or all specified pages are out of range.
    """
    if not ranges_str.strip():
        return []

    pages: set[int] = set()

    for raw_part in ranges_str.split(","):
        part = raw_part.strip()
        if not part:
            continue

        if "-" in part:
            sides = part.split("-", 1)
            start_s = sides[0].strip()
            end_s   = sides[1].strip()

            try:
                start = (int(start_s) - 1) if start_s else 0
                end   = (int(end_s)   - 1) if end_s   else total_pages - 1
            except ValueError:
                raise ValueError(
                    f"Invalid page range '{part}'. "
                    "Use numbers and dashes, e.g. '1-3, 5, 7-'."
                )

            if start > end:
                raise ValueError(
                    f"Range '{part}' has a start page greater than its end page."
                )
            pages.update(range(start, end + 1))
        else:
            try:
                pages.add(int(part) - 1)
            except ValueError:
                raise ValueError(
                    f"'{part}' is not a valid page number."
                )

    # Filter to valid range
    valid = sorted(p for p in pages if 0 <= p < total_pages)
    if not valid:
        raise ValueError(
            f"No valid pages found in '{ranges_str}'. "
            f"This document has {total_pages} page(s)."
        )
    return valid


def invert_pages(selected: list[int], total_pages: int) -> list[int]:
    """
    Return every page index NOT in `selected` — used by delete-pages
    (user specifies pages to remove; we keep the rest).
    """
    selected_set = set(selected)
    return [i for i in range(total_pages) if i not in selected_set]
