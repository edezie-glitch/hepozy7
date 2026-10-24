"""What KIND of document does the query ask for? "literature review of X" wants review/survey papers about X,
not any paper or abstract that merely mentions X. This module (1) reads the intent out of the query and
(2) scores a page/paper for that intent from its own text. No tokens used."""

import difflib
import re

_REVIEW_PHRASE = re.compile(
    r"\b(rrl|related\s+(literature|studies)|literature\s+review|lit\s+review|review\s+of\s+(the\s+)?literature|systematic\s+review|"
    r"systematic\s+mapping|survey\s+(paper|of)|state[- ]of[- ]the[- ]art|overview\s+of)\b", re.I)
_REVIEW_WORDS = {"review", "reviews", "survey", "surveys", "overview", "literature"}

TITLE_RE = re.compile(
    r"\b(review|survey|overview|state[- ]of[- ]the[- ]art|systematic mapping|meta-analysis|taxonomy|"
    r"literature|a decade of|advances in|recent advances|progress in|roadmap)\b", re.I)
BODY_RE = re.compile(
    r"\b(this (paper|article|survey|review|work|chapter|study) (reviews|surveys|summari[sz]es|synthesi[sz]es|"
    r"presents (a|an) (comprehensive |systematic |extensive |brief )?(review|survey|overview)|"
    r"provides (a|an) (comprehensive |systematic |extensive |brief )?(review|survey|overview))|"
    r"we (review|survey|summari[sz]e the (literature|existing)|synthesi[sz]e)|"
    r"(systematic|comprehensive|critical|narrative) (literature )?(review|survey)|"
    r"literature review|state of the art|existing (approaches|methods|literature|work) (are|is) (reviewed|discussed|classified)|"
    r"taxonomy of|open (problems|challenges) and future)\b", re.I)
ANTI_RE = re.compile(
    r"\b(we propose|we introduce|we present a (novel|new)|novel (method|approach|algorithm|framework)|"
    r"our (proposed )?(method|approach|algorithm)|experimental results (show|demonstrate|indicate)|"
    r"outperforms?)\b", re.I)


def _parse_review(q: str) -> tuple[str | None, str]:
    """Returns (intent, topic_query). intent is "review" or None. topic_query is the query without the
    intent words ("literature riview fro deterministic finite automata" -> "deterministic finite automata")."""
    low = q.lower()
    tokens = re.findall(r"\w+", low)
    is_review = bool(_REVIEW_PHRASE.search(low))
    typo = [t for t in tokens if t not in _REVIEW_WORDS and difflib.get_close_matches(t, ["review", "literature", "survey"], n=1, cutoff=0.78)]
    if typo or any(t in _REVIEW_WORDS for t in tokens) and ("literature" in tokens or "review" in tokens or "survey" in tokens or typo):
        is_review = True
    if not is_review:
        return None, q
    drop = _REVIEW_WORDS | set(typo) | {"of", "on", "for", "about", "a", "an", "the", "fro", "rrl", "related", "studies", "systematic", "state", "art", "paper", "papers", "research"}
    topic = " ".join(t for t in tokens if t not in drop)
    return "review", (topic or q)


def review_score(title: str, text: str) -> tuple[int, bool]:
    """(score, passes). A real review has review wording in its title or says it reviews the field in its own
    text, and does not read like a paper that proposes one new method."""
    title = title or ""
    text = text or ""
    title_hit = bool(TITLE_RE.search(title))
    body_hits = len(set(m.group(0).lower() for m in BODY_RE.finditer(text)))
    anti = len(set(m.group(0).lower() for m in ANTI_RE.finditer(text)))
    words = len(text.split())
    score = (2 if title_hit else 0) + min(body_hits, 3) - min(anti, 2)
    if words > 5000:
        score += 1
    if len(re.findall(r"\[\d{1,3}\]", text)) > 40:
        score += 1  # long reference list: reviews cite dozens of works
    passes = score >= 2 and (title_hit or body_hits >= 2)
    return score, passes


# ---------------------------------------------------------------------------------------------
# Other kinds of document the user can ask for. Each: words that ask for it, and a text check.
# ---------------------------------------------------------------------------------------------
_ASK = [
    ("thesis", re.compile(r"\b(thesis|theses|dissertation|capstone)\b", re.I)),
    ("dataset", re.compile(r"\b(dataset|datasets|data\s+set|corpus|corpora)\b", re.I)),
    ("tutorial", re.compile(r"\b(tutorial|tutorials|how\s+to|beginner'?s?\s+guide|introduction\s+to|explained|primer|getting\s+started)\b", re.I)),
]
_ASK_DROP = {
    "thesis": {"thesis", "theses", "dissertation", "capstone", "rrl", "related", "literature", "studies", "of", "on", "for", "about", "a", "the", "in"},
    "dataset": {"dataset", "datasets", "data", "set", "corpus", "corpora", "of", "on", "for", "about", "a", "the"},
    "tutorial": {"tutorial", "tutorials", "how", "to", "beginner", "beginners", "guide", "introduction", "explained", "primer", "getting", "started", "of", "on", "for", "about", "a", "the", "s"},
}
_THESIS = re.compile(r"\b(thesis|dissertation|submitted in partial fulfil\w+|degree of|doctor of philosophy|master of|bachelor of|candidate for the degree)\b", re.I)
_DATASET_T = re.compile(r"\b(dataset|data set|corpus|benchmark)\b", re.I)
_DATASET_B = re.compile(r"\b(dataset|data set|csv|download|records|variables|samples|annotated|collected)\b", re.I)
_TUT_T = re.compile(r"\b(tutorial|introduction|intro|guide|how to|explained|basics|beginner|primer|getting started|fundamentals)\b", re.I)
_TUT_B = re.compile(r"\b(step \d|for example|let'?s|first,|next,|tutorial|exercise|in this (guide|tutorial|article))\b", re.I)


_NEWS = re.compile(r"\b(news|latest|breaking|headlines?|today|yesterday|this week|just in|updates? (on|about))\b", re.I)
_ACADEMIC = re.compile(
    r"\b(papers?|research|study|studies|journal|abstract|theorem|lemma|algorithms?|automata|automaton|complexity|proof|"
    r"equation|hypothesis|methodology|peer[- ]reviewed|preprint|arxiv|doi|citations?|quantum|neural|genome|genomic|protein|"
    r"regression|entropy|bayesian|stochastic|enzyme|molecular|polymer|cryptography|compiler|semantics)\b", re.I)


def parse_intent(q: str) -> tuple[str | None, str]:
    """(intent, topic_query). intent is one of review, thesis, dataset, tutorial, news, academic, or None (an
    ordinary topic: person, place, thing, event, definition). The intent decides WHICH sources are asked."""
    got = _parse_review(q)
    if got[0]:
        # "rrl" / "related literature" means a literature review written in a thesis: ask for reviews, keep thesis sources too
        return got
    for name, rx in _ASK:
        if rx.search(q):
            tokens = re.findall(r"\w+", q.lower())
            topic = " ".join(t for t in tokens if t not in _ASK_DROP[name])
            return name, (topic or q)
    if _NEWS.search(q):
        drop = {"news", "latest", "breaking", "headline", "headlines", "today", "yesterday", "this", "week", "just", "in",
                "update", "updates", "on", "about", "the", "of"}
        topic = " ".join(t for t in re.findall(r"\w+", q.lower()) if t not in drop)
        return "news", (topic or q)
    if _ACADEMIC.search(q):
        return "academic", q
    return None, q


def kind_score(intent: str, title: str, text: str) -> tuple[int, bool]:
    if intent == "review":
        return review_score(title, text)
    title, text = title or "", text or ""
    if intent == "thesis":
        n = len(set(m.group(0).lower() for m in _THESIS.finditer(title + " " + text[:6000])))
        return n, n >= 1
    if intent == "dataset":
        t = bool(_DATASET_T.search(title))
        b = len(_DATASET_B.findall(text))
        return (2 if t else 0) + min(b, 3), t or b >= 2
    if intent == "tutorial":
        t = bool(_TUT_T.search(title))
        b = len(_TUT_B.findall(text))
        return (2 if t else 0) + min(b, 3), t or b >= 2
    return 0, True


LABEL = {"review": "Literature review", "thesis": "Thesis", "dataset": "Dataset", "tutorial": "Tutorial", "news": "News"}


def stem(w: str) -> str:
    return w[:6] if len(w) > 6 else w  # "automata" and "automaton" both become "automa"


def centrality(topic: list[str], title: str, text: str) -> tuple[bool, float, bool]:
    """Is the document ABOUT the topic, or does it only mention it? Returns (about, density, in_title).
    in_title: the topic words are in the title. density: how often the topic phrase (the topic words close
    together, in order) appears per 1000 words of the text. about = in_title or density >= 1.0.
    Short texts (an abstract page) count as about when the phrase appears at all."""
    st = [stem(w) for w in topic]
    if not st:
        return True, 0.0, True
    gap = r"\W+(?:\w+\W+){0,1}"
    pat = re.compile(r"\b" + gap.join(re.escape(x) + r"\w*" for x in st), re.I)
    in_title = bool(pat.search(title or "")) or (sum(x in (title or "").lower() for x in st) / len(st) >= 0.6)
    words = max(1, len(text.split()))
    hits = len(pat.findall(text or ""))
    dens = hits / words * 1000
    about = in_title or dens >= 1.0 or (words < 600 and hits >= 1)
    return about, dens, in_title