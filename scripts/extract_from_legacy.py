"""Extract structured data from the legacy index.html into JSON files."""
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path("/Users/lily/homepage/.dev/worktree/creative-mascarpone")
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

html = (ROOT / "index.html").read_text(encoding="utf-8")
soup = BeautifulSoup(html, "lxml")


def write(name: str, data) -> None:
    p = OUT / f"{name}.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  -> wrote {p.relative_to(ROOT)} ({len(json.dumps(data))} bytes)")


# ------------------------------------------------------------------ profile
print("Parsing profile...")
header_table = soup.find("body").find("div").find("table")
header_p = header_table.find("p")
header_text = header_p.get_text("\n", strip=False)

# Name from first <strong>
name_strong = header_p.find("strong")
full_name = name_strong.get_text(strip=True)
m = re.match(r"(?P<en>[^()]+?)\s*(?:\(\s*(?P<zh>.+?)\s*\))?$", full_name)
name_en = m.group("en").strip() if m else full_name
name_zh = m.group("zh").strip() if m and m.group("zh") else ""

# Lines: split <br>-separated content
parts = []
for child in header_p.children:
    if isinstance(child, NavigableString):
        s = str(child)
        if s.strip():
            parts.append(("text", s.strip()))
    elif child.name == "br":
        parts.append(("br", None))
    elif child.name in ("strong", "font"):
        parts.append(("text", child.get_text(strip=True)))
    elif child.name == "a":
        parts.append(("link", {"text": child.get_text(strip=True),
                                "href": child.get("href", "")}))

# Reconstruct lines
lines, current = [], []
for kind, val in parts:
    if kind == "br":
        if current:
            lines.append(current)
            current = []
    else:
        current.append((kind, val))
if current:
    lines.append(current)

# Build affiliation/contact list — skip the first line which is the name
affiliation = []
email = None
office = None
links = []
for line in lines[1:]:
    txt_parts = []
    for kind, val in line:
        if kind == "text":
            txt_parts.append(val)
        elif kind == "link":
            txt_parts.append(val["text"])
            href = val["href"]
            if href.startswith("mailto:"):
                email = href[7:]
            elif "scholar.google" in href:
                links.append({"label": "Google Scholar", "href": href})
            elif "dmcv.sjtu" in href:
                links.append({"label": "DMCV Lab", "href": href})
            else:
                links.append({"label": val["text"], "href": href})
    line_text = " ".join(t for t in txt_parts if t).strip()
    if not line_text or line_text in ("·",):
        continue
    if line_text.lower().startswith("e-mail:"):
        if not email:
            m2 = re.search(r"e-mail:\s*([^\s,]+@[^\s,]+)", line_text, re.I)
            if m2:
                email = m2.group(1)
        continue
    if line_text.lower().startswith("office:"):
        office = line_text[len("office:"):].strip()
        continue
    if line_text in ("Google Scholar", "DMCV Lab", "Email"):
        continue
    affiliation.append(line_text)

# Image
img_el = header_table.find("img")
photo = img_el.get("src", "") if img_el else ""

profile = {
    "name": name_en,
    "nameZh": name_zh,
    "title": affiliation[0] if affiliation else "",
    "titleEn": affiliation[1] if len(affiliation) > 1 else "",
    "affiliation": affiliation[2] if len(affiliation) > 2 else "",
    "email": email,
    "office": office,
    "photo": photo,
    "links": links,
}
write("profile", profile)

# ------------------------------------------------------------------ bio
print("Parsing bio...")
# The bio is the first <p> after the header table.
bio_h2 = soup.find("h2", string=re.compile(r"Biography"))
bio_p = bio_h2.find_next_sibling("p")
bio_text = bio_p.decode_contents().strip()
# Normalize whitespace
bio_text = re.sub(r"\s+", " ", bio_text).strip()
write("bio", {"htmlContent": bio_text})


# ------------------------------------------------------------------ news
print("Parsing news...")
news_h2 = soup.find("h2", string=lambda s: False) or None
# Find News heading more loosely
for h in soup.find_all("h2"):
    if h.find("font", attrs={"color": "red"}) and "News" in h.get_text():
        news_h2 = h
        break

news_ul = news_h2.find_next_sibling("ul") if news_h2 else None
news_items = []
for li in news_ul.find_all("li", recursive=False):
    raw_html = li.decode_contents().strip()
    text = li.get_text(" ", strip=True)
    # Detect date
    date_m = re.match(r"\[(\d{4}\.\d{2}\.\d{2})\]\s*(.+)", text)
    item = {"htmlContent": raw_html, "text": text}
    if date_m:
        item["date"] = date_m.group(1)
        item["summary"] = date_m.group(2)
    else:
        item["highlight"] = True
    news_items.append(item)
write("news", news_items)


# ------------------------------------------------------------------ interests
print("Parsing interests...")
int_h2 = soup.find("a", attrs={"name": "interests"})
int_h2 = int_h2.parent if int_h2 else None
interests = {"summary": "", "items": []}
if int_h2:
    p1 = int_h2.find_next_sibling("p")
    interests["summary"] = re.sub(r"\s+", " ", p1.get_text(" ", strip=True)).strip()
    # The <ul> may be wrapped in <p> (auto-closed by browser) — search forward.
    nxt = p1.find_next_sibling()
    while nxt and nxt.name != "h2":
        if nxt.name == "ul":
            for li in nxt.find_all("li", recursive=False):
                interests["items"].append(li.get_text(" ", strip=True))
            break
        if nxt.name == "p":
            inner_ul = nxt.find("ul")
            if inner_ul:
                for li in inner_ul.find_all("li", recursive=False):
                    interests["items"].append(li.get_text(" ", strip=True))
                break
        nxt = nxt.find_next_sibling()
write("interests", interests)


# ------------------------------------------------------------------ openings
print("Parsing openings...")
op_h2 = soup.find("a", attrs={"name": "openings"})
op_h2 = op_h2.parent if op_h2 else None
openings_paras = []
if op_h2:
    nxt = op_h2.find_next_sibling()
    while nxt and nxt.name == "p":
        openings_paras.append(re.sub(r"\s+", " ", nxt.decode_contents()).strip())
        nxt = nxt.find_next_sibling()
write("openings", {"paragraphs": openings_paras})


# ------------------------------------------------------------------ publications
print("Parsing publications...")

pub_h2 = soup.find("a", attrs={"name": "publications"})
pub_h2 = pub_h2.parent if pub_h2 else None
pub_table = pub_h2.find_next_sibling("table") if pub_h2 else None

publications = []
summary_text = ""
current_section = None  # "recent" or year as int

link_label_map = {
    "paper": "paper",
    "code": "code",
    "project": "project",
    "demo video": "demo",
    "demo": "demo",
    "arxiv": "arxiv",
    "blog(中文解读)": "blog",
    "blog": "blog",
    "dataset": "dataset",
    "dataset + code": "datasetCode",
    "code (jittor)": "codeJittor",
}

def normalize_link_label(t: str) -> str:
    t = t.strip().strip("[]").strip().lower()
    return link_label_map.get(t, t)


for tr in pub_table.find_all("tr", recursive=False):
    tds = tr.find_all("td", recursive=False)

    # Summary row (first tr now wrapped in td)
    if len(tds) == 1 and tds[0].find("small"):
        summary_text = re.sub(r"\s+", " ", tds[0].get_text(" ", strip=True)).strip()
        continue

    # Year/section row
    if len(tds) == 1:
        a = tds[0].find("a", attrs={"name": True})
        label = tds[0].get_text(strip=True)
        if a and a.get("name") == "pubA":
            current_section = "recent"
        else:
            m = re.match(r"(\d{4})", label)
            if m:
                current_section = int(m.group(1))
            else:
                current_section = label.lower()
        continue

    # Paper row
    if len(tds) != 2:
        continue

    img_td, content_td = tds
    img = img_td.find("img")
    image_src = img.get("src", "") if img else ""

    div = content_td.find("div")
    if div is None:
        div = content_td

    # Walk children of div
    children = list(div.children)
    # Title is leading text before the first <a>
    title_parts = []
    link_idx_start = None
    for i, ch in enumerate(children):
        if isinstance(ch, NavigableString):
            title_parts.append(str(ch))
        elif isinstance(ch, Tag) and ch.name == "br":
            link_idx_start = i
            break
        elif isinstance(ch, Tag) and ch.name == "a":
            link_idx_start = i
            break
        elif isinstance(ch, Tag) and ch.name in ("sup", "sub", "strong", "em", "i"):
            title_parts.append(ch.get_text(strip=False))
        elif isinstance(ch, Tag) and ch.name == "font":
            link_idx_start = i
            break
        else:
            title_parts.append(ch.get_text(strip=False))

    title = re.sub(r"\s+", " ", "".join(title_parts)).strip()

    # Links: collect all <a> tags before the first <br>
    links_list = []
    aliases = []
    consumed_until_br = False
    for ch in children[link_idx_start or 0:]:
        if isinstance(ch, Tag) and ch.name == "br":
            if not consumed_until_br:
                consumed_until_br = True
                continue
            else:
                break
        if isinstance(ch, Tag) and ch.name == "a":
            label = normalize_link_label(ch.get_text(strip=True))
            href = ch.get("href", "")
            links_list.append({"type": label, "href": href})
        if isinstance(ch, Tag) and ch.name == "font" and ch.get("color") == "gray":
            aliases.append(re.sub(r"\s+", " ", ch.get_text(" ", strip=True)).strip())

    # After first <br>, the next text is authors, then <br>, then <i>venue</i>...
    # Re-parse: split children into runs by <br>
    runs = []
    current = []
    for ch in children:
        if isinstance(ch, Tag) and ch.name == "br":
            if current:
                runs.append(current)
                current = []
        else:
            current.append(ch)
    if current:
        runs.append(current)

    # runs[0] = title + links + maybe gray alias
    # find run containing authors (run with no <i> and no leading [link])
    authors = ""
    venue_run = None
    for r in runs[1:]:
        txt = "".join((c.get_text() if isinstance(c, Tag) else str(c)) for c in r).strip()
        if not txt:
            continue
        # Has <i>? Then it's venue line
        has_italic = any(isinstance(c, Tag) and c.name == "i" for c in r)
        if has_italic:
            venue_run = r
            break
        else:
            if not authors:
                authors = re.sub(r"\s+", " ", txt).strip()
            # else: alias / extra description

    # Parse authors: split by comma, detect "Ran Yi" position with star
    authors_list = []
    me_role = None  # "first", "corresponding-first", "corresponding", "coauthor", "equal-first"
    if authors:
        # Replace bold markers
        # authors string here already has no HTML (we did get_text). We need bold info.
        # Re-extract from the authors run preserving <strong>
        bold_idxs = []
        plain_parts = []
        for c in runs[1] if len(runs) > 1 else []:
            if isinstance(c, Tag) and c.name == "strong":
                plain_parts.append(("strong", c.get_text(strip=True)))
            elif isinstance(c, Tag):
                plain_parts.append(("text", c.get_text(strip=True)))
            else:
                plain_parts.append(("text", str(c)))
        full_authors = "".join(p[1] for p in plain_parts)
        full_authors = re.sub(r"\s+", " ", full_authors).strip()
        # Identify "Ran Yi" with possible markers: *, #, " (equal contribution)"
        # We'll keep raw string and a parsed list.
        author_tokens = [a.strip() for a in re.split(r",\s*(?:and\s+)?", full_authors) if a.strip()]
        for tok in author_tokens:
            entry = {"name": tok, "isMe": False, "corresponding": False, "equal": False}
            if re.search(r"\bRan\s*Yi\b", tok):
                entry["isMe"] = True
                if "*" in tok:
                    entry["corresponding"] = True
                if "#" in tok:
                    entry["equal"] = True
                # Clean name
                clean = re.sub(r"[*#]", "", tok)
                clean = re.sub(r"\(equal contribution\)", "", clean, flags=re.I)
                clean = re.sub(r"\s+", " ", clean).strip()
                entry["display"] = clean
            else:
                if "*" in tok:
                    entry["corresponding"] = True
                if "#" in tok:
                    entry["equal"] = True
            authors_list.append(entry)
        authors_raw = full_authors
    else:
        authors_raw = ""

    # Venue parse
    venue_full = ""
    venue_short = ""
    year_pub = None
    tags = []
    oral = False
    is_spotlight = False
    notes = []
    if venue_run is not None:
        # Extract <i> for venue
        for c in venue_run:
            if isinstance(c, Tag) and c.name == "i":
                strong = c.find("strong")
                if strong:
                    venue_short = strong.get_text(strip=True).strip("()").strip()
                    # Full text of <i> minus the strong gives the long name
                    full = c.get_text(" ", strip=True)
                    # Strip the parenthetical short name from the end of full
                    full_clean = re.sub(r"\s*\([^)]*\)\s*$", "", full).strip()
                    venue_full = full_clean or venue_short
                else:
                    venue_full = c.get_text(strip=True)
                    venue_short = venue_full
            elif isinstance(c, Tag) and c.name == "font":
                color = c.get("color", "").lower()
                txt = c.get_text(" ", strip=True)
                tag_clean = txt.strip("[] ").strip()
                if color == "red":
                    if "oral" in tag_clean.lower():
                        oral = True
                    else:
                        tags.append(tag_clean)
                elif color == "green":
                    tags.append(tag_clean)
                elif color == "purple":
                    if "oral" in tag_clean.lower():
                        oral = True
                else:
                    notes.append(tag_clean)
            elif isinstance(c, NavigableString):
                s = str(c)
                ym = re.search(r"(20\d{2})", s)
                if ym and year_pub is None:
                    year_pub = int(ym.group(1))
                if re.search(r"\boral\b", s, re.I):
                    oral = True
                if re.search(r"spotlight", s, re.I):
                    is_spotlight = True

    # Detect oral / spotlight inside venue_short bracket too
    if venue_short:
        if re.search(r"\boral\b", venue_short, re.I):
            oral = True
        if re.search(r"spotlight", venue_short, re.I):
            is_spotlight = True

    # The section's year may override
    year_section = current_section if isinstance(current_section, int) else None
    year_final = year_pub or year_section

    pub_obj = {
        "section": "recent" if current_section == "recent" else "yearly",
        "year": year_final,
        "title": title,
        "image": image_src,
        "authors": authors_list,
        "authorsRaw": authors_raw,
        "venueShort": venue_short,
        "venueFull": venue_full,
        "tags": tags,
        "oral": oral,
        "spotlight": is_spotlight,
        "aliases": aliases,
        "notes": notes,
        "links": links_list,
    }
    publications.append(pub_obj)

write("publications", {"summary": summary_text, "items": publications})
print(f"  parsed {len(publications)} publications")


# ------------------------------------------------------------------ honors
print("Parsing honors...")
hon_h2 = soup.find("a", attrs={"name": "honors"})
hon_h2 = hon_h2.parent if hon_h2 else None
hon_ul = hon_h2.find_next_sibling("ul") if hon_h2 else None
honors = []
if hon_ul:
    for li in hon_ul.find_all("li", recursive=False):
        raw = li.decode_contents().strip()
        text = li.get_text(" ", strip=True)
        # Try to extract trailing date
        date = ""
        m = re.search(r"(\d{4}\.\d{2})\s*$", text)
        if m:
            date = m.group(1)
        honors.append({"htmlContent": raw, "text": text, "date": date})
write("awards", honors)


# ------------------------------------------------------------------ education
print("Parsing education...")
edu_h2 = soup.find("a", attrs={"name": "education"})
edu_h2 = edu_h2.parent if edu_h2 else None
edu_ul = edu_h2.find_next_sibling("ul") if edu_h2 else None
education = []
if edu_ul:
    for li in edu_ul.find_all("li", recursive=False):
        education.append({"htmlContent": re.sub(r"\s+", " ", li.decode_contents()).strip()})
write("education", education)


# ------------------------------------------------------------------ working
print("Parsing working...")
work_h2 = soup.find("a", attrs={"name": "working"})
work_h2 = work_h2.parent if work_h2 else None
work_ul = work_h2.find_next_sibling("ul") if work_h2 else None
working = []
if work_ul:
    for li in work_ul.find_all("li", recursive=False):
        working.append({"htmlContent": re.sub(r"\s+", " ", li.decode_contents()).strip()})
write("working", working)


# ------------------------------------------------------------------ courses
print("Parsing courses...")
crs_h2 = soup.find("a", attrs={"name": "course"})
crs_h2 = crs_h2.parent if crs_h2 else None
crs_ul = crs_h2.find_next_sibling("ul") if crs_h2 else None
courses = []
if crs_ul:
    for li in crs_ul.find_all("li", recursive=False):
        courses.append({"htmlContent": re.sub(r"\s+", " ", li.decode_contents()).strip()})
write("courses", courses)


# ------------------------------------------------------------------ activities
print("Parsing activities...")
act_h2 = soup.find("a", attrs={"name": "activities"})
act_h2 = act_h2.parent if act_h2 else None
act_ul = act_h2.find_next_sibling("ul") if act_h2 else None
activities = []
if act_ul:
    for li in act_ul.find_all("li", recursive=False):
        activities.append({"htmlContent": re.sub(r"\s+", " ", li.decode_contents()).strip()})
write("activities", activities)


print("\nDone.")
