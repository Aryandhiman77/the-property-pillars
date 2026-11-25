"use client";

import {ArrowRight, ChevronDown, LocateFixed, Mic, Search, X} from "lucide-react";
import {constructionStatuses, propertyTypeKey, propertyTypesByCategory} from "@the-property-pillar/contracts";
import {useSiteLocation} from "@/features/location/site-location";
import {countryName, currencyForCountry, listingCurrencies} from "@/config/listing-geography";
import {apiRequest} from "@/lib/api/client";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent} from "react";
import {createPortal} from "react-dom";
import type {ReactNode} from "react";
import {directoryFilterOptions, marketplaceSearchScopes, type MarketplaceSearchScope} from "./search-scopes";
import styles from "./market-search.module.css";

const typesForSegment = {
  RESIDENTIAL: [...propertyTypesByCategory.RESIDENTIAL, "Residential Plot", "Other"],
  COMMERCIAL: [...propertyTypesByCategory.COMMERCIAL, "Commercial Plot", "Industrial Plot", "Other"],
  PLOT_LAND: [...propertyTypesByCategory.PLOT_LAND, "Other"],
};
type Segment = keyof typeof typesForSegment;
type Suggestion = {kind: "state" | "city" | "locality" | "project" | "listing"; value: string; country: string; context: string; id: string | null};
type Recognition = {
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

const scopeOrder = ["properties", "materials", "professionals", "dealers", "jobs", "workers", "projects"] as const satisfies readonly MarketplaceSearchScope[];
type SearchTab = typeof scopeOrder[number];

export function MarketSearch({locale, children, compact = false}: {locale: string; children?: ReactNode; compact?: boolean}) {
  const t = useTranslations("Site");
  const {countryOptions, place, status, locate} = useSiteLocation();
  const router = useRouter();
  const listId = useId();
  const panelId = useId();
  const filtersId = useId();
  const input = useRef<HTMLInputElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const searchForm = useRef<HTMLFormElement>(null);
  const restoreFocus = useRef(false);
  const budgetPanel = useRef<HTMLDetailsElement>(null);
  const voice = useRef<Recognition | null>(null);
  const [intent, setIntent] = useState("SALE");
  const [scope, setScope] = useState<SearchTab>("properties");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [places, setPlaces] = useState<Suggestion[]>([]);
  const [directoryFilters, setDirectoryFilters] = useState<Record<string, string>>({});
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [pinned, setPinned] = useState(false);
  const [heldHeight, setHeldHeight] = useState(0);
  const [segment, setSegment] = useState<Segment>("RESIDENTIAL");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(typesForSegment.RESIDENTIAL);
  const [typeOpen, setTypeOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<{term: string; country: string; directory: string; items: Suggestion[]} | null>(null);
  const [suggestionFailure, setSuggestionFailure] = useState("");
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [currency, setCurrency] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [construction, setConstruction] = useState("");
  const [postedBy, setPostedBy] = useState("");
  const [featured, setFeatured] = useState(false);
  const [budgetError, setBudgetError] = useState(false);

  const q = term.trim();
  const preferredCountry = place?.countryCode;
  const currentScope = marketplaceSearchScopes[scope];
  const propertySearch = scope === "properties";
  const searchLabel = propertySearch || scope === "projects" ? t("searchPlaces") : t("searchKeyword");
  const hasBudget = propertySearch || scope === "materials" || scope === "workers";
  const matches = suggestions?.term === q && suggestions.country === country && suggestions.directory === currentScope.route ? suggestions.items : [];
  const expanded = filtersOpen && focused && !selected && matches.length > 0;
  const availableTypes = typesForSegment[segment];
  const currencyCode = currency || currencyForCountry(country || places[0]?.country || place?.countryCode || "") || "INR";
  const scopeFilters = directoryFilterOptions(scope, facets);

  useEffect(() => {
    const element = host.current;
    if (compact || !element || !("IntersectionObserver" in window)) return;
    let docked = false;
    const observer = new IntersectionObserver(([entry]) => {
      const next = !entry.isIntersecting && entry.boundingClientRect.bottom < 90;
      if (next === docked) return;
      if (next) setHeldHeight(entry.boundingClientRect.height);
      restoreFocus.current = document.activeElement === input.current;
      docked = next;
      setPinned(next);
    }, {rootMargin: "-80px 0px 0px"});
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    input.current?.focus({preventScroll: true});
  }, [pinned]);

  useEffect(() => {
    if (!filtersOpen) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !searchForm.current?.contains(event.target)) setFiltersOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [filtersOpen]);

  useEffect(() => {
    if (!budgetError || !filtersOpen || !budgetPanel.current) return;
    budgetPanel.current.open = true;
    budgetPanel.current.querySelector("input")?.focus();
  }, [budgetError, filtersOpen]);

  useEffect(() => {
    setFacets({});
    if (!filtersOpen || scope === "properties") return;
    const abort = new AbortController();
    void apiRequest<Record<string, string[]>>(`/public/${currentScope.route}/facets`, {signal: abort.signal})
      .then((result) => {if (!abort.signal.aborted) setFacets(result);}, () => {});
    return () => abort.abort();
  }, [filtersOpen, scope, currentScope.route]);

  useEffect(() => {
    if (q.length < 2 || selected || !focused || !filtersOpen) return;
    const controller = new AbortController();
    const params = new URLSearchParams({q});
    if (country) params.set("country", country);
    else if (preferredCountry) params.set("preferred", preferredCountry);
    const timeout = window.setTimeout(() => {
      void apiRequest<Suggestion[]>(`/public/properties/suggestions?${params}&directory=${currentScope.route}`, {signal: controller.signal})
        .then((items) => {if (!controller.signal.aborted) {setSuggestionFailure(""); setSuggestions({term: q, country, directory: currentScope.route, items});}})
        .catch(() => {if (!controller.signal.aborted) {setSuggestions(null); setSuggestionFailure(q);}});
    }, 220);
    return () => {window.clearTimeout(timeout); controller.abort();};
  }, [q, selected, focused, filtersOpen, country, preferredCountry, currentScope.route]);

  useEffect(() => {
    if (!locationRequested || status === "loading") return;
    if (place && status === "ready") {
      const value = place.city || place.area || place.state;
      if (value) {
        const nearby: Suggestion = {kind: place.city ? "city" : place.area ? "locality" : "state", value, country: place.countryCode ?? "",
          context: place.city ? place.state : "", id: null};
        setPlaces((current) => current.some((item) => item.kind === nearby.kind && item.value === value && item.country === nearby.country) ? current : [...current.slice(0, 7), nearby]);
        setTerm("");
        setSelected(null);
      }
      setFeedback("");
    } else setFeedback(t("searchLocationUnavailable"));
    setLocationRequested(false);
  }, [locationRequested, place, status, t]);

  useEffect(() => () => {
    const recognition = voice.current;
    voice.current = null;
    recognition?.abort();
  }, []);

  function setSearchText(value: string) {
    setTerm(value.slice(0, 120));
    setSelected(null);
    setActive(-1);
    setFocused(true);
    setFiltersOpen(true);
  }

  function chooseSuggestion(suggestion: Suggestion) {
    if (suggestion.kind === "project" || suggestion.kind === "listing") {
      setSelected(suggestion);
      setTerm(suggestion.value);
    } else {
      setPlaces((current) => current.some((item) => item.kind === suggestion.kind && item.value === suggestion.value && item.country === suggestion.country && item.context === suggestion.context)
        ? current : [...current.slice(0, 7), suggestion]);
      setTerm("");
      setSelected(null);
    }
    setActive(-1);
    setFocused(false);
  }

  function chooseSegment(value: Segment, open = false) {
    setSegment(value);
    setSelectedTypes(typesForSegment[value]);
    setTypeOpen(open);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      setFocused(false);
    }
    if (!expanded) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => event.key === "ArrowDown" ? (index + 1) % matches.length : index <= 0 ? matches.length - 1 : index - 1);
    } else if (event.key === "Enter" && active >= 0 && matches[active]) {
      event.preventDefault();
      chooseSuggestion(matches[active]);
    }
  }

  function toggleVoice() {
    if (voice.current) {
      const recognition = voice.current;
      voice.current = null;
      setVoiceActive(false);
      recognition.abort();
      return;
    }
    const browser = window as typeof window & {SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition};
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Speech) {setFeedback(t("searchVoiceUnavailable")); return;}
    const recognition = new Speech();
    voice.current = recognition;
    recognition.lang = locale === "en" && (country || place?.countryCode) ? `en-${country || place?.countryCode}` : locale;
    function finishListening() {
      if (voice.current !== recognition) return;
      voice.current = null;
      setVoiceActive(false);
    }
    function handleVoiceError() {
      if (voice.current !== recognition) return;
      finishListening();
      setFeedback(t("searchVoiceUnavailable"));
    }
    recognition.onstart = () => {
      if (voice.current === recognition) setVoiceActive(true);
    };
    recognition.onresult = (event) => {
      if (voice.current !== recognition) return;
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {input.current?.focus(); setSearchText(transcript); setFeedback("");}
    };
    recognition.onerror = handleVoiceError;
    recognition.onend = finishListening;
    setFeedback("");
    try {recognition.start();} catch {handleVoiceError();}
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected?.id && (selected.kind === "project" || selected.kind === "listing")) {
      router.push(`/${locale}/${selected.kind === "project" ? "projects" : currentScope.route}/${encodeURIComponent(selected.id)}`);
      return;
    }
    if ([min, max].some((value) => value && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e15)) ||
      (min && max && Number(min) > Number(max))) {
      setBudgetError(true);
      setFiltersOpen(true);
      return;
    }
    const params = new URLSearchParams(currentScope.fixed);
    if (propertySearch) {params.set("intent", intent); params.set("segment", segment);}
    if (propertySearch && selectedTypes.length && selectedTypes.length !== availableTypes.length) {
      params.set("types", selectedTypes.map(propertyTypeKey).join(","));
    }
    if (q) params.set("q", q);
    if (propertySearch && featured) params.set("featured", "1");
    if (country) params.set("country", country);
    if (hasBudget && (min || max)) params.set("currency", currencyCode);
    for (const {kind, value, country: code, context} of places) params.append("place", JSON.stringify({kind, value, country: code || undefined, context: context || undefined}));
    const selectedFilters = {
      ...directoryFilters, ...(hasBudget ? {minPrice: min, maxPrice: max} : {}), ...(propertySearch ? {bedrooms, construction, postedBy} : {}),
    };
    for (const [key, value] of Object.entries(selectedFilters)) if (value) params.set(key, value);
    router.push(`/${locale}/${currentScope.route}?${params}`);
  }

  const segmentLabel = {RESIDENTIAL: t("searchResidential"), COMMERCIAL: t("searchCommercial"), PLOT_LAND: t("land")};
  const kindLabels = {state: t("searchState"), city: t("searchCity"), locality: t("searchLocality"), project: t("searchProject"), listing: t("listingTitle")};
  const scopeLabels: Record<SearchTab, string> = {
    properties: t("properties"), materials: t("materials"), professionals: t("professionals"), dealers: t("dealers"),
    jobs: t("jobs"), workers: t("workers"), projects: t("projects"),
  };
  const target = pinned ? document.getElementById("market-header-search") : null;
  const headerSearch = compact || Boolean(target);

  const scopeBar = <div className={styles.scopeBar} role="group" aria-label="Search categories">
    {scopeOrder.map((key) => <button type="button" key={key} aria-pressed={scope === key} onClick={() => {
      if (key !== scope) {
        setScope(key); setDirectoryFilters({}); setTypeOpen(false);
        setMin(""); setMax(""); setBudgetError(false); setSelected(null); setActive(-1);
      }
      setFiltersOpen(true);
    }}>{scopeLabels[key]}</button>)}
  </div>;

  const locationTool = <button className={styles.iconButton} type="button" title={t("useLocation")} aria-label={t("useLocation")} disabled={locationRequested}
    onClick={() => {setFiltersOpen(true); setLocationRequested(true); if (!place) locate();}}><LocateFixed size={19} aria-hidden="true" /></button>;

  const filterPanel = filtersOpen ? <div className={styles.filtersPanel} id={filtersId} role="group" aria-label="Search filters">
      {expanded && <ul role="listbox" id={listId} className={styles.suggestions} aria-label={t("searchSuggestions")}>
        {matches.map((suggestion, index) => <li key={`${suggestion.kind}:${suggestion.country}:${suggestion.value}:${suggestion.context}:${suggestion.id ?? ""}`}
          role="option" id={`${listId}-${index}`} aria-selected={active === index}
          onPointerDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}>
          <span>{suggestion.value}{(suggestion.context || suggestion.country) && <small>{[suggestion.context, countryName(suggestion.country, countryOptions)].filter(Boolean).join(", ")}</small>}</span>
          <span>{kindLabels[suggestion.kind]}</span>
        </li>)}
      </ul>}
      {!expanded && focused && !selected && q.length >= 2 && (suggestionFailure === q || (suggestions?.term === q &&
        suggestions.country === country && suggestions.directory === currentScope.route && !suggestions.items.length)) &&
        <p className={styles.suggestionMessage} role="status">{suggestionFailure === q ? "Suggestions are temporarily unavailable. You can still search." : "No suggestions found. Press Search to see matching results."}</p>}
      {headerSearch && <div className={styles.panelMenu}>{scopeBar}<div className={styles.panelTools}>{locationTool}</div></div>}
      {propertySearch && <div className={styles.intent} role="group" aria-label={t("listingType")}>
        <button type="button" aria-pressed={intent === "SALE"} onClick={() => setIntent("SALE")}>{t("buy")}</button>
        <button type="button" aria-pressed={intent === "RENT"} onClick={() => setIntent("RENT")}>{t("rent")}</button>
        {headerSearch && <button type="button" aria-expanded={typeOpen} aria-controls={panelId} onClick={() => setTypeOpen(!typeOpen)}>
          {segmentLabel[segment]} <ChevronDown size={15} aria-hidden="true" />
        </button>}
      </div>}
      {typeOpen && propertySearch && <div className={styles.typePanel} id={panelId}>
        <div className={styles.panelHead}>
          <div role="group" aria-label={t("propertyTypes")}>
            {(Object.keys(segmentLabel) as Segment[]).map((key) => <button type="button" key={key} aria-pressed={segment === key} onClick={() => chooseSegment(key, true)}>{segmentLabel[key]}</button>)}
          </div>
          <button type="button" onClick={() => setSelectedTypes([])}>{t("clearFilters")}</button>
        </div>
        <div className={styles.typeGrid}>
          {availableTypes.map((label) => <label key={label}><input type="checkbox" checked={selectedTypes.includes(label)}
            onChange={(event) => setSelectedTypes(event.target.checked ? [...selectedTypes, label] : selectedTypes.filter((type) => type !== label))} />{label}</label>)}
        </div>
      </div>}
      <div className={styles.filters}>
        {hasBudget && <details name={panelId} ref={budgetPanel} className={styles.budget}>
          <summary data-active={Boolean(min || max)}>{t("searchBudget")} <ChevronDown size={15} aria-hidden="true" /></summary>
          <div className={styles.budgetPanel}>
            <label>{t("currency")}<select value={currencyCode} onChange={(event) => setCurrency(event.target.value)}>
              {listingCurrencies.map(({value}) => <option key={value}>{value}</option>)}
            </select></label>
            <label>{t("searchMinBudget")}<input type="number" min="0" max="1000000000000000" step="any" value={min} aria-invalid={budgetError} aria-describedby={budgetError ? `${panelId}-budget` : undefined} onChange={(event) => {setMin(event.target.value); setBudgetError(false);}} /></label>
            <label>{t("searchMaxBudget")}<input type="number" min="0" max="1000000000000000" step="any" value={max} aria-invalid={budgetError} aria-describedby={budgetError ? `${panelId}-budget` : undefined} onChange={(event) => {setMax(event.target.value); setBudgetError(false);}} /></label>
            {budgetError && <p className={styles.budgetError} id={`${panelId}-budget`} role="alert">{t("searchBudgetError")}</p>}
          </div>
        </details>}
        {propertySearch && <><label className={styles.filterSelect}><select aria-label={t("searchBedrooms")} value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
          <option value="">{t("searchBedrooms")}</option>{["0", "1", "2", "3", "4", "5+"].map((value) => <option key={value} value={value}>{value} · {t("searchBedrooms")}</option>)}
        </select><ChevronDown size={15} aria-hidden="true" /></label>
        <label className={styles.filterSelect}><select aria-label={t("searchConstruction")} value={construction} onChange={(event) => setConstruction(event.target.value)}>
          <option value="">{t("searchConstruction")}</option>{constructionStatuses.map((value, index) => <option key={value} value={value}>{t((["searchReady", "searchUnderConstruction", "searchNewLaunch"] as const)[index])}</option>)}
        </select><ChevronDown size={15} aria-hidden="true" /></label>
        <label className={styles.filterSelect}><select aria-label={t("listedBy")} value={postedBy} onChange={(event) => setPostedBy(event.target.value)}>
          <option value="">{t("listedBy")}</option><option value="OWNER">{t("propertyPosterOwner")}</option><option value="DEALER">{t("propertyPosterDealer")}</option><option value="BUILDER">{t("propertyPosterBuilder")}</option>
        </select><ChevronDown size={15} aria-hidden="true" /></label>
        <label className={styles.filterCheck}><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />{t("featuredProperties")}</label></>}
        {scopeFilters.map(({key, label, options}) => <label className={styles.filterSelect} key={key}>
          <select aria-label={label} value={directoryFilters[key] ?? ""} onChange={(event) => setDirectoryFilters((current) => ({...current, [key]: event.target.value}))}>
            <option value="">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select><ChevronDown size={15} aria-hidden="true" /></label>)}
        <label className={`${styles.filterSelect} ${styles.country}`}><select aria-label={t("country")} value={selected?.country || country} onChange={(event) => {setCountry(event.target.value); setSelected(null); setActive(-1);}}>
          <option value="">{t("allCountries")}</option>{countryOptions.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
        </select><ChevronDown size={15} aria-hidden="true" /></label>
        <button type="button" onClick={() => {setFiltersOpen(false); setTypeOpen(false);}}>Close filters</button>
      </div>
  </div> : null;

  const form = <form className={headerSearch ? styles.headerSearch : styles.search} ref={searchForm} noValidate onSubmit={onSubmit} aria-label={t("search")}
    onBlur={(event) => {if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setFiltersOpen(false);}}
    onKeyDown={(event) => {if (event.key === "Escape" && !event.defaultPrevented && filtersOpen) {
      event.preventDefault();
      input.current?.focus();
      setFiltersOpen(false);
    }}}>
    {!headerSearch && scopeBar}
    <div className={styles.searchRow}>
      {!headerSearch && propertySearch && <button className={styles.category} type="button" aria-expanded={filtersOpen && typeOpen} aria-controls={panelId}
        onClick={() => {setFiltersOpen(true); setTypeOpen(!filtersOpen || !typeOpen);}}>
        {segmentLabel[segment]} <ChevronDown size={17} aria-hidden="true" />
      </button>}
      <div className={styles.searchField}>
        <Search size={18} aria-hidden="true" />
        <div className={styles.searchEntry}>
          {places.length > 0 && <ul className={styles.placeChips} role="list" aria-label="Selected locations">{places.map((item) =>
            <li key={JSON.stringify(item)}>
              <button type="button" aria-label={"Remove " + item.value} title={item.value} onClick={() => {
                setPlaces((current) => current.filter((other) => other !== item));
                input.current?.focus({preventScroll: true});
              }}><span>{item.value}</span><X size={14} aria-hidden="true" /></button>
            </li>)}</ul>}
          <input ref={input} type="search" value={term} aria-label={searchLabel}
            placeholder={places.length ? t("search") : searchLabel}
            maxLength={120} autoComplete="off" role="combobox"
            aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-details={filtersOpen ? filtersId : undefined}
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            onFocus={() => {setFocused(true); setFiltersOpen(true);}}
            onClick={() => {setFocused(true); setFiltersOpen(true);}}
            onBlur={() => setFocused(false)} onKeyDown={onSearchKey} onChange={(event) => setSearchText(event.target.value)} />
        </div>
      </div>
      <div className={styles.controls}>
        {!headerSearch && locationTool}
        <button className={`${styles.iconButton} ${styles.voiceButton}`} type="button" title={t("searchVoice")} aria-label={t("searchVoice")}
          aria-pressed={voiceActive} onClick={toggleVoice}><Mic size={19} aria-hidden="true" /></button>
        <button className={`market-button ${styles.submit}`} type="submit" aria-label={t("search")}>{headerSearch ? <ArrowRight size={17} aria-hidden="true" /> : t("search")}</button>
      </div>
    </div>
    {!headerSearch && children}
    {filterPanel}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
  </form>;
  return <div ref={host} style={target ? {minHeight: heldHeight || 112} : undefined}>
    {target ? createPortal(form, target) : form}
  </div>;
}
