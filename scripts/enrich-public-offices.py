"""Read publishers' own contact pages and keep source URLs beside public business details."""
import concurrent.futures
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.blocks = []
        self.ld = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "iframe" and attrs.get("src"):
            self.links.append(attrs["src"])
        if tag == "script":
            self.ld = attrs.get("type") == "application/ld+json"

    def handle_endtag(self, tag):
        if tag == "script":
            self.ld = False

    def handle_data(self, data):
        if self.ld:
            try:
                self.blocks.append(json.loads(data))
            except ValueError:
                pass

def host(url):
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")

def fetch(url, domain):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; PropertyPillar BusinessDirectory/1.0)"})
    with urlopen(req, timeout=8) as response:
        if host(response.url) != domain or "html" not in response.headers.get("Content-Type", ""):
            raise ValueError("External redirect or non-HTML page")
        page = Page()
        page.feed(response.read(1800000).decode("utf-8", "replace"))
        return response.url, page

def organizations(blocks):
    for b in blocks:
        if isinstance(b, list):
            yield from organizations(b)
        elif isinstance(b, dict):
            yield from organizations(b.get("@graph", []))
            if re.search(r"RealEstateAgent|Organization|LocalBusiness|HomeAndConstructionBusiness|Corporation", str(b.get("@type","")), re.I):
                yield b

def collect(profile):
    site = profile["website"]
    domain = host(site)
    found = {}
    def keep(field, value, source):
        if value and field not in found:
            found[field] = {"value": value, "source": source}
    try:
        root, home = fetch(re.sub("^http:", "https:", site), domain)
    except Exception:
        try:
            root, home = fetch(site, domain)
        except Exception:
            return profile["id"], found
    links = [urljoin(root, link).split("#")[0] for link in home.links]
    contacts = [url for url in dict.fromkeys(links) if host(url)==domain and re.search(r"/contact(?:-us)?/?(?:\.html?)?$", urlsplit(url).path, re.I)]
    pages = []
    for url in contacts[:2]:
        try:
            pages.append(fetch(url, domain))
        except Exception:
            pass
    for url, page in [*pages, (root, home)]:
        for link in page.links:
            link = unquote(link.strip())
            if link.lower().startswith("tel:"):
                digits = re.sub(r"[^0-9+]", "", link[4:])
                if re.fullmatch(r"(?:\+?91|0)?[6-9]\d{9}", digits) and profile.get("market") != "New York City":
                    keep("mobileNumber", "+91"+digits[-10:], url)
                if re.fullmatch(r"\+[1-9]\d{7,14}", digits):
                    keep("contactPhone", digits, url)
            if link.lower().startswith("mailto:"):
                email = link[7:].split("?")[0].strip().lower()
                if re.fullmatch(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", email) and not re.search(r"example|sentry|wixpress|webmaster",email):
                    keep("contactEmail", email, url)
            if host(link) in {"google.com","maps.google.com"} and "/maps/embed" in link and "!1d" in link:
                keep("officeEmbed",link,url)
        for org in organizations(page.blocks):
            address = org.get("address")
            if isinstance(address, dict) and address.get("streetAddress"):
                keep("address", ", ".join(str(address[k]) for k in ("streetAddress","addressLocality","addressRegion","postalCode") if address.get(k)), url)
                geo = org.get("geo")
                if isinstance(geo,dict):
                    try:
                        lat,lon = float(geo["latitude"]),float(geo["longitude"])
                        if abs(lat)<=90 and abs(lon)<=180 and (lat or lon):
                            keep("officeCoordinates", [lat,lon], url)
                    except (ValueError,KeyError,TypeError):
                        pass
    return profile["id"], found

if __name__ == "__main__":
    profiles = [r["profile"] for r in json.loads((ROOT/"seed-data/registration.json").read_text("utf-8-sig"))["registrations"]]
    verified = {r["name"]:r for r in json.loads((ROOT/"seed-data/business-source-pages.json").read_text("utf-8"))}
    for profile in profiles:
        entry = verified.get(profile["displayName"])
        if entry:
            profile["website"] = entry.get("website", profile.get("website") or entry["source"])
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = dict(pool.map(collect, [p for p in profiles if p.get("website")]))
    for p in profiles:
        entry = verified.get(p["displayName"])
        if entry:
            data = results.setdefault(p["id"], {})
            if p.get("website"):
                data["website"] = {"value":p["website"], "source":entry["source"]}
            for key in entry.keys() - {"name","source","website"}:
                data[key] = {"value":entry[key],"source":entry["source"]}
    (ROOT/"seed-data/office-sources.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Checked",len(results),"sites;",sum(bool(r) for r in results.values()),"returned details.")
