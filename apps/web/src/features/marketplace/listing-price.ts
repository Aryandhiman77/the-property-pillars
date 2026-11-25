export function cost(item: {data: Record<string, unknown>}, locale: string) {
  if(item.data.priceMode==="ON_REQUEST")return "Price on request";
  const amount = item.data.price ?? item.data.priceAmount ?? item.data.indicativePrice ?? item.data.dailyRate ?? item.data.startingPrice;
  const currency = (typeof item.data.currency === "string" || typeof item.data.currency === "number" ? String(item.data.currency) : "") || "INR";
  if (typeof amount !== "number" || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return "";
  const formatter=new Intl.NumberFormat(locale === "en" && currency === "INR" ? "en-IN" : locale,{style:"currency",currency});
  const first=formatter.format(amount);
  if(item.data.priceMode==="RANGE"&&typeof item.data.maxPrice==="number")return first+" – "+formatter.format(item.data.maxPrice);
  return item.data.priceMode==="STARTING_FROM"?"From "+first:first;
}

export function compactPropertyPrice(item: {data: Record<string, unknown>}, locale: string) {
  if(["STARTING_FROM","ON_REQUEST","RANGE"].includes(String(item.data.priceMode)))return cost(item,locale);
  const price = item.data.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return "";
  const currency = (typeof item.data.currency === "string" || typeof item.data.currency === "number" ? String(item.data.currency) : "") || "INR";
  if (currency === "INR") {
    const [scale, unit] = price >= 10_000_000 ? [10_000_000, " Cr"] : price >= 100_000 ? [100_000, " L"] : [1, ""];
    const number = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {maximumFractionDigits: 2}).format(price / scale);
    return `₹ ${number}${unit}`;
  }
  return /^[A-Z]{3}$/.test(currency)
    ? new Intl.NumberFormat(locale, {style: "currency", currency, notation: "compact", maximumFractionDigits: 2}).format(price)
    : "";
}
