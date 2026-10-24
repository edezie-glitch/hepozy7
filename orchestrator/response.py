import re

_TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?[\s:|-]+\|?\s*$")


def _cells(row: str) -> int:
    """How many columns a table row has: '| a | b |' -> 2."""
    return row.strip().strip("|").count("|") + 1


def _drop_cut_table_row(reply: str) -> str:
    """
    If the answer was cut off in the middle of a table (the model ran out of room), the last
    row is broken, for example a lone '|' or '| Feature | Claude'. A broken row makes the whole
    table look messy, so it is removed. If too little of the table is left to be a table
    (no header, no separator line, or no rows), the unfinished table is removed completely.
    Answers that do not end inside a table, or whose last row is complete, are not touched.
    """
    lines = reply.rstrip().split("\n")
    end = len(lines)
    start = end
    while start > 0 and lines[start - 1].lstrip().startswith("|"):
        start -= 1
    if start == end:
        return reply  # the answer does not end inside a table

    block = lines[start:end]
    if len(block) >= 3:
        last = block[-1].strip()
        complete = len(last) >= 3 and last.endswith("|") and _cells(last) >= _cells(block[0])
        if complete:
            return reply  # the last row is whole, nothing to repair
        block = block[:-1]  # drop the broken row
    if len(block) < 3 or not _TABLE_SEPARATOR_RE.match(block[1]):
        block = []  # not enough left to be a table: drop it entirely
    return "\n".join(lines[:start] + block).rstrip()


def format_response(reply: str, output_type: str) -> str:
    # CHANGED: the "Instructions:", "Examples:" and "Workflow:" labels that used to be put in
    # front of some answers are gone. The answer is shown exactly as the model wrote it.
    # output_type is still accepted so main.py does not need to change.
    return _drop_cut_table_row(reply)


# ADDED: answers saved BEFORE this fix still have the old "**Workflow:**" style label in front
# of them, and some were cut off in the middle of a table. This cleans them when they are read
# back, so old conversations look as good as new ones. The saved data itself is not changed.
_OLD_LABEL_RE = re.compile(r"^\s*\*\*(Workflow|Instructions|Examples):\*\*\s*", re.IGNORECASE)


def tidy_stored_reply(text: str) -> str:
    return _drop_cut_table_row(_OLD_LABEL_RE.sub("", text or "", count=1))