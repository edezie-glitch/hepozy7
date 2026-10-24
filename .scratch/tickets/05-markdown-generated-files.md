## Parent

Part of #2

## What to build

Upgrade assistant response bubbles to render formatted GitHub-flavored markdown using `react-markdown` and `remark-gfm`. Support headings, lists, blockquotes, inline formatting, and scrollable tables. Syntax-highlight code fences with languages indicated and include an accessible copy-to-clipboard button. If FastAPI returns `download_url` and `file_name` for generated documents (`.docx`, `.pdf`, `.xlsx`, `.csv`), render a prominent orange-styled download card that opens the download in a new tab.

## Acceptance criteria

- [ ] Markdown renders headings, ordered/unordered lists, blockquotes, and bold/italic formatting cleanly.
- [ ] Code blocks display formatted syntax highlighting with language label and a copy button that updates text on click.
- [ ] Markdown tables render with clean borders and horizontal scroll containers for mobile responsiveness.
- [ ] Generated file downloads display a dedicated download card with format icon, filename, and direct download link.
- [ ] Component integration tests verify markdown AST parsing, copy code action, and download link generation.

## Blocked by

#6
