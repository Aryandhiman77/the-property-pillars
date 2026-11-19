"use client";

import {Globe2, MapPin, Search} from "lucide-react";
import {listingCountries} from "@/config/listing-geography";
import {useRouter} from "next/navigation";
import {useState, type FormEvent} from "react";

export function MarketSearch({locale, label, labels}: {
  locale: string;
  label: string;
  labels: {materials: string; services: string; jobs: string};
}) {
  const [category, setCategory] = useState("buy");
  const [country, setCountry] = useState("");
  const router = useRouter();
  const choices = [
    {id: "buy", label: "Buy", route: "properties", intent: "SALE"},
    {id: "rent", label: "Rent", route: "properties", intent: "RENT"},
    {id: "materials", label: labels.materials, route: "materials"},
    {id: "services", label: labels.services, route: "professionals"},
    {id: "jobs", label: labels.jobs, route: "jobs"},
  ];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const choice = choices.find((option) => option.id === category) ?? choices[0];
    const city = String(new FormData(event.currentTarget).get("city") ?? "").trim();
    const query = new URLSearchParams();
    if (city) query.set("city", city);
    if (choice.intent) query.set("intent", choice.intent);
    if (country && (choice.route === "properties" || choice.route === "jobs")) query.set("country", country);
    router.push("/" + locale + "/" + choice.route + (query.size ? "?" + query : ""));
  }

  return (
    <form className="market-search" onSubmit={onSubmit} aria-label={label}>
      <div className="market-search-tabs" role="group" aria-label="Search category">
        {choices.map(({id, label}) => (
          <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>
        ))}
      </div>
      <div className="market-search-row">
        {(category === "buy" || category === "rent" || category === "jobs") && <label className="market-search-country">
          <Globe2 size={18} aria-hidden="true" />
          <span><span className="market-search-label">Country</span>
            <select aria-label="Country or territory" value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="">All countries</option>
              {listingCountries.map(({value, label: countryLabel}) => <option key={value} value={value}>{countryLabel}</option>)}
            </select>
          </span>
        </label>}
        <label>
          <MapPin size={20} aria-hidden="true" />
          <span>
            <span className="market-search-label">Location</span>
            <input type="search" name="city" aria-label="City or locality" maxLength={80} placeholder="City or area" />
          </span>
        </label>
        <button className="market-button" type="submit"><Search size={18} aria-hidden="true" />{label}</button>
      </div>
    </form>
  );
}
