export const discoveryMarkets = [
  {
    slug: "panchkula",
    name: "Panchkula",
    localities: [{slug: "sector-20", name: "Sector 20"}]
  },
  {slug: "chandigarh", name: "Chandigarh", localities: []},
  {slug: "delhi-ncr", name: "Delhi NCR", localities: []},
  {slug: "gurugram", name: "Gurugram", localities: []},
  {slug: "mumbai", name: "Mumbai", localities: []},
  {slug: "bengaluru", name: "Bengaluru", localities: []},
  {slug: "dubai", name: "Dubai", localities: []},
  {
    slug: "mohali",
    name: "Mohali",
    localities: [{slug: "airport-road", name: "Airport Road"}]
  }
] as const;

export type DiscoveryMarket = (typeof discoveryMarkets)[number];

export function getDiscoveryMarket(slug: string) {
  return discoveryMarkets.find((market) => market.slug === slug);
}

export function getDiscoveryLocality(
  market: DiscoveryMarket,
  slug: string
) {
  return market.localities.find((locality) => locality.slug === slug);
}
