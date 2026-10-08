from bs4 import BeautifulSoup


def parse_html(html: str) -> str:
    """Strips boilerplate (script/style/nav/footer) and returns clean text."""
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    return " ".join(text.split())  # collapse repeated whitespace
