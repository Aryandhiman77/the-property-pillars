"""Reconcile downloaded Maps results with published inventory and first-party contact pages."""
import hashlib
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1] / "seed-data"
def load(name):
    return json.loads((root / name).read_text(encoding="utf-8"))

def norm(value):
    return re.sub(r"[^a-z0-9]", "", (value or "").lower().replace("&", "and"))

def host(url):
    return (urlsplit(url or "").hostname or "").removeprefix("www.")

def fetch(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; PropertyPillarDirectory/1.0)"})
    with urlopen(request, timeout=7) as response:
        if host(response.url) != host(url): return None
        return BeautifulSoup(response.read(1_500_000), "html.parser")

def channels(profile):
    site = profile.get("website")
    if not site or urlsplit(site).scheme not in ("http", "https"): return
    try:
        if site.startswith("http://"): site="https://"+site[7:]
        soup = fetch(site)
        if not soup: return
        pages = [(site, soup)]
        contact = next((urljoin(site, a["href"]) for a in soup.select("a[href]") if
            "contact" in a["href"].lower() and host(urljoin(site, a["href"])) == host(site)), None)
        if contact and contact != site:
            try: pages.append((contact,fetch(contact)))
            except Exception: pass
        for url, page in pages:
            if not page: continue
            for a in page.select("a[href]"):
                href = html.unescape(a["href"]).strip()
                match = re.search(r"(?:wa\.me/|(?:api|web)\.whatsapp\.com/send/?\?[^#]*?phone=)(\+?\d{8,15})(?:[?&#/]|$)", href, re.I)
                if match and not profile.get("whatsapp"):
                    profile.update(whatsapp="+"+match[1].lstrip("+"),whatsappSource=url)
                email = href[7:].split("?")[0] if href.lower().startswith("mailto:") else ""
                if re.fullmatch(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", email) and not profile.get("contactEmail"):
                    profile.update(contactEmail=email,emailSource=url)
            if not profile.get("logoUrl"):
                for img in page.select("img[src]"):
                    if "logo" in (str(img.get("class",""))+" "+img.get("alt","")+" "+img["src"]).lower():
                        image=urljoin(site,img["src"])
                        if host(image)==host(site) and re.search(r"\.(?:webp|jpe?g|png|svg)(?:[?#]|$)",image,re.I):
                            profile["logoUrl"]=image
                            break
    except Exception: pass

entries = load("phone-listed/registration.json")["registrations"]
registered = load("registration.json")["registrations"]
raw = load("source-runs/qfi2JI1OeghIDJECM.json")
maps = load("source-runs/VnoTifhFgejcvpk0D.json") + load("source-runs/j3jDFTr0i7I3Vyp8n.json")
areas = {"Bihar":"Patna","Bengaluru":"Bangalore","Bangalore East":"Bangalore","Western Mumbai":"Mumbai"}
def market(name): return areas.get(name,name)
def match_place(p,m):
    if m.get("permanentlyClosed") or m.get("temporarilyClosed") or not (m.get("phoneUnformatted") or m.get("phone","").startswith("+")): return False
    prior=parse_qs(urlsplit(p.get("googleMapsUrl") or "").query).get("query_place_id",[])
    exact_place=m.get("placeId") in prior
    name=norm(p["displayName"])
    title=norm(m["title"])
    local=market(p["market"]).lower().replace("bangalore","bengaluru") in (str(m.get("address"))+" "+str(m.get("city"))).lower().replace("bangalore","bengaluru")
    query=norm(m.get("searchString"))
    aliases={"cresceragroup":"crescera","bhagwatiassociates":"bhagwatiassociate"}
    named=title==name or aliases.get(title)==name or (name=="mrpropadvisor" and title.startswith(name+"propertydealers"))
    same_office = host(p.get("website")) and host(p.get("website"))==host(m.get("website")) and (local or (p["market"]=="New York City" and m.get("city")=="New York"))
    return same_office or exact_place and (named or norm(p.get("contactPhone"))==norm(m.get("phoneUnformatted")) or (host(p.get("website")) and host(p["website"])==host(m.get("website")))) or (local and named and query.startswith(name))

def shape(p,m):
    pos=m.get("location") or {}
    return dict(id=p["id"],displayName=p["displayName"],role=p["role"],market=p["market"],phone=m.get("phoneUnformatted") or m["phone"],
        contactEmail=p.get("contactEmail"),logoUrl=p.get("logoUrl"),website=m.get("website") or p.get("website"),
        address=m.get("address"),coordinates=[pos["lat"],pos["lng"]] if "lat" in pos and "lng" in pos else None,
        mapUrl=m.get("url"),placeId=m.get("placeId"),scrapedAt=m.get("scrapedAt"),listings=[],existingListingIds=[])

batch={}
for e in entries:
    p=e["profile"]
    place=next((m for m in maps if match_place(p,m)),None)
    if not place:continue
    out=shape(p,place)
    out["existingListingIds"]=[x["id"] for x in e["listings"] if x.get("panelPublisherId")==p["id"] and x.get("panelAssignmentBasis") in ("listing broker","building leasing office assigned to dealer panel")]
    batch[p["id"]]=out

for row in raw:
    contact=row.get("contact_details",{})
    if contact.get("class_label") not in ("Dealer","Builder") or not contact.get("company_name"):continue
    name=contact["company_name"].strip()
    city=row["source_context"]["seed_value"]
    role=contact["class_label"].lower()
    p=next((e["profile"] for e in entries if e["profile"]["role"]==role and norm(e["profile"]["displayName"])==norm(name) and market(e["profile"]["market"])==city),None)
    existing=next((e["profile"] for e in registered if e["profile"]["role"]==role and e["profile"]["displayName"].casefold()==name.casefold() and market(e["profile"]["market"])==city and any(x.get("id")=="99acres-"+str(row["record_id"]) and x.get("panelPublisherId")==e["profile"]["id"] for x in e["listings"])),None)
    if existing:p=existing
    if not p:p={"displayName":name,"market":city,"role":role,"id":role+"-"+hashlib.sha256((name.casefold()+"|"+city.casefold()).encode()).hexdigest()[:16]}
    m=next((m for m in reversed(maps) if match_place(p,m)),None)
    if not m:continue
    out=batch.setdefault(p["id"],shape(p,m))
    l=row["listing"];geo=row["location"];pr=row.get("pricing",{});spec=row.get("property",{});area=spec.get("area",{});media=row.get("media",{})
    source=row["source_context"].get("canonical_url") or l.get("details_url")
    if not source or not l.get("title"):continue
    kind=l.get("property_type","")
    images=list(dict.fromkeys(x for x in [media.get("main_image"),*(media.get("photos") or [])] if isinstance(x,str) and x.startswith("https://")))
    facts=dict(listingIntent="RENT" if "rent" in str(l.get("deal_type","")).lower() else "SALE",listingKind="Individual property",countryCode="IN",currency=pr.get("currency"),price=pr.get("min_price"),maxPrice=pr.get("max_price"),
        city=geo.get("city"),state=geo.get("state_name"),locality=geo.get("locality_without_city") or geo.get("locality_name"),projectOrSociety=geo.get("society_name"),areaValue=area.get("super_sqft") or area.get("carpet_sqft"),areaUnit="SQFT",propertyType=kind,
        propertyCategory="PLOT_LAND" if "land" in kind.lower() else "RESIDENTIAL",floorNumber=spec.get("floor_number"),totalFloors=spec.get("total_floors"),bedrooms=spec.get("bedrooms"),bathrooms=spec.get("bathrooms"),balconies=spec.get("balconies"),furnishing=spec.get("furnishing"),mediaUrls=images)
    attrs=row.get("attributes",{});compliance=attrs.get("compliance",{});tags=attrs.get("tags_and_signals",{}).get("secondary_tags",[])
    is_land="land" in kind.lower()
    sqft=re.match(r"([\d,]+(?:\.\d+)?)(?:\s*[-–]\s*([\d,]+(?:\.\d+)?))?\s*(?:sq\.?\s*ft|sqft)",area.get("display_area",""),re.I)
    if sqft and not facts.get("areaValue"):facts["areaValue"]=float(sqft[1].replace(",",""))
    if sqft and sqft[2]:facts["areaDisplay"]=area.get("display_area")
    facts.update(reraNumber=compliance.get("project_rera_registration_id"),ownership=spec.get("ownership_label"),pricePerSqft=pr.get("price_sqft"),carpetArea=area.get("carpet_sqft"),superBuiltUpArea=area.get("super_sqft"),
        constructionStatus=next((k for t,k in [("READY TO MOVE","READY_TO_MOVE"),("UNDER CONSTRUCTION","UNDER_CONSTRUCTION")] if t in tags),None),
        closeByLandmarks=geo.get("landmarks"),sourcePropertyDetails=spec,sourceAvailability=row.get("availability"),
        sourcePricing=pr,sourceCoordinates=geo.get("coordinates"),sourceAttributes=attrs.get("compliance"))
    if is_land:
        for key in ("floorNumber","totalFloors","bedrooms","bathrooms","balconies","furnishing"):facts.pop(key,None)
    for key in ("bedrooms","bathrooms","balconies"):
        if facts.get(key)==0: facts.pop(key,None)
    out["listings"].append(dict(id="99acres-"+str(row["record_id"]),title=l["title"],description=l.get("description"),sourceUrl=source,sourceDataset="qfi2JI1OeghIDJECM",data={k:v for k,v in facts.items() if v is not None}))
# The two commercial offers are on the broker's own live inventory page.
for p in batch.values():
    if norm(p["displayName"])!="patnapropertywwale":continue
    url="https://patnapropertywwale.com/properties/"
    soup=fetch(url)
    for a in soup.select('a[href*="wa.me"]') if soup else []:
        card=a.find_parent(class_="elementor-widget-wrap")
        if not card:continue
        body=card.get_text(" ",strip=True)
        for slug,area,title,kind,size,intents in [
            ("dak-bungalow","Dak Bungalow","Ground-floor showroom in Dak Bungalow","Showroom",2600,["SALE","RENT"]),
            ("didarganj","Didarganj Highway","Godown and showroom on Didarganj Highway","Warehouse",4000,["RENT"])]:
            if area not in body or len(body)>680:continue
            photos=list(dict.fromkeys(urljoin(url,img.get("data-src") or img.get("src","")) for img in card.select("img") if "placeholder" not in str(img).lower() and img.get("alt") and "photo " in img["alt"].lower()))
            p.update(whatsapp="+"+urlsplit(a["href"]).path.strip("/"),whatsappSource=url)
            for intent in intents:
                p["listings"].append(dict(id="patna-"+slug+"-"+intent.lower(),title=title,sourceUrl=url,description="2,600 sq ft of ground-floor commercial space. Price on request." if size==2600 else "Highway-facing space across two adjacent buildings with a goods lift. Approximately 4,000 to 25,000 sq ft available. Rent on request.",data=dict(listingIntent=intent,listingKind="Individual property",propertyCategory="COMMERCIAL",propertyType=kind,countryCode="IN",currency="INR",city="Patna",state="Bihar",locality=area,areaValue=size,areaUnit="SQFT",mediaUrls=photos)))
for p in batch.values():
    if host(p.get("website"))!="iconmanhattan.com": continue
    url="https://www.iconmanhattan.com/availability"
    page=fetch(url)
    if not page: continue
    for tag in page.select("script"):
        text=(tag.string or "").replace(chr(92)+chr(34),chr(34))
        marker='"units":'
        if marker not in text:continue
        try: units,_=json.JSONDecoder().raw_decode(text.split(marker,1)[1])
        except ValueError:continue
        for unit in units:
            if unit.get("status")!="available":continue
            label=unit["unit_number"]
            pid="nyc-"+hashlib.sha256(("Icon Manhattan"+label).casefold().encode()).hexdigest()[:16]
            facts=dict(listingIntent="RENT",listingKind="Individual property",propertyCategory="RESIDENTIAL",propertyType="APARTMENT",city="New York City",state="New York",countryCode="US",currency="USD",price=unit.get("price_gross"),areaValue=unit.get("square_feet"),areaUnit="SQFT",bedrooms=unit.get("bedrooms"),bathrooms=unit.get("bathrooms"),projectOrSociety="Icon Manhattan",mediaUrls=[],floorPlanUrls=unit.get("floor_plans") or [],priceFrequency="MONTHLY")
            p["listings"].append(dict(id=pid,title="Icon Manhattan · "+label,sourceUrl=url,description="Apartment "+label+" at 306 West 48th Street, New York. Listed by the building leasing office.",data={k:v for k,v in facts.items() if v is not None}))
        break
with ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(channels,batch.values()))
def apply_contact_evidence(profiles):
    official={r["domain"]:r for r in load("source-runs/official-contact-evidence.json")}
    rendered={r["domain"]:r for r in load("source-runs/rendered-business-channels.json")}
    for p in profiles:
        domain=host(p.get("website"))
        contact=official.get(domain)
        if contact:
            p.update(contactEmail=contact["contactEmail"],emailSource=contact["source"])
            if contact.get("businessMobile"):p.update(businessMobile=contact["businessMobile"],mobileSource=contact["source"])
        observed=rendered.get(domain,{})
        for link in observed.get("whatsappLinks",[]):
            parsed=urlsplit(link)
            value=parsed.path.strip("/") if host(link)=="wa.me" else parse_qs(parsed.query).get("phone",[""])[0]
            digits=re.sub(r"[^0-9]","",value)
            if 8<=len(digits)<=15:
                p.update(whatsapp="+"+digits,whatsappSource=observed["source"])
                break
        logo=observed.get("logo")
        if logo and host(logo)==domain:p.update(logoUrl=logo,logoSource=observed["source"])

apply_contact_evidence(batch.values())
out={"sourceDatasets":["VnoTifhFgejcvpk0D","j3jDFTr0i7I3Vyp8n","qfi2JI1OeghIDJECM"],"registrations":list(batch.values())}
(root/"source-runs"/"market-registrations.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Matched profiles",len(batch),"newly observed offers",sum(len(p["listings"]) for p in batch.values()),"explicit WhatsApp",sum(bool(p.get("whatsapp")) for p in batch.values()))

