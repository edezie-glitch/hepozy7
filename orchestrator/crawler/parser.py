from bs4 import BeautifulSoup


def parse_html(html: str) -> str:
    """Strips boilerplate (script/style/nav/footer) and returns clean text."""
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    return " ".join(text.split())  # collapse repeated whitespace


# ADDED
def parse_title(html: str) -> str | None:
    """The page <title>, used as the search result title."""
    soup = BeautifulSoup(html, "html.parser")
    if soup.title and soup.title.string:
        t = " ".join(soup.title.string.split())
        return t[:300] or None
    return None