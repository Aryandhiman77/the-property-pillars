import assert from "node:assert/strict";
import test from "node:test";
import {collectionSchemas} from "../src/workspace/config.js";
import {sanitizePropertyHtml} from "../src/workspace/property-content.js";
import {searchSuggestionCities} from "../src/locations/delivery-cities.js";

test("property HTML keeps text formatting while removing active markup and layout styles", () => {
  const html = sanitizePropertyHtml('<p onclick="ignore()"><span style="color:#345678;background-color:rgb(20,30,40);position:fixed">About</span><a href="javascript:ignore()">Link</a><script>ignore()</script></p>');
  assert.match(html, /color:#345678/);
  assert.match(html, /background-color:rgb\(20,30,40\)/);
  assert.doesNotMatch(html, /onclick|script|position|ignore/);
});

test("property content retains explicit zero room counts and recognized selections", () => {
  const record = collectionSchemas.properties.parse({
    countryCode: "IN", bedrooms: 0, halls: 1, bathrooms: 1, balconies: 0,
    kitchenType: " Open kitchen with island ", furnishing: "SEMI_FURNISHED", furnishingItems: ["BED", "BED"],
    instantDeliveryAvailable: true, instantDeliveryApps: ["OTHER"], instantDeliveryOther: "Local delivery",
  });
  assert.equal(record.bedrooms, 0);
  assert.equal(record.balconies, 0);
  assert.equal(record.kitchenType, "Open kitchen with island");
  assert.deepEqual(record.furnishingItems, ["BED"]);
  assert.equal(record.instantDeliveryOther, "Local delivery");
  assert.equal(collectionSchemas.properties.safeParse({countryCode: "IN", instantDeliveryAvailable: true, instantDeliveryApps: ["OTHER"]}).success, false);
});

test("property content drops furnishing and Indian delivery selections when they become inapplicable", () => {
  const record = collectionSchemas.properties.parse({
    countryCode: "GB", furnishing: "UNFURNISHED", furnishingItems: ["BED"],
    instantDeliveryAvailable: true, instantDeliveryApps: ["BLINKIT"],
  });
  assert.equal(record.furnishingItems, undefined);
  assert.equal(record.instantDeliveryAvailable, undefined);
  assert.equal(record.instantDeliveryApps, undefined);
});

test("property highlights and expanded amenities are validated while old manually entered places are ignored", () => {
  const listing = collectionSchemas.properties.parse({
    highlights: [" Corner unit ", "corner unit", "Wide access road"],
    amenities: ["LIFT", "SERVICE_LIFT", "RAINWATER_HARVESTING", "PARCEL_ROOM", "OTHER"], customAmenities: ["Reading lounge", "reading lounge"],
    nearbyPlaces: [{name: "Metro station", category: "TRANSIT"}, {name: "metro station", category: "TRANSIT"}],
  });
  assert.deepEqual(listing.highlights, ["Corner unit", "Wide access road"]);
  assert.deepEqual(listing.amenities, ["LIFT", "SERVICE_LIFT", "RAINWATER_HARVESTING", "PARCEL_ROOM", "OTHER"]);
  assert.deepEqual(listing.customAmenities, ["Reading lounge"]);
  assert.ok(!Object.hasOwn(listing, "nearbyPlaces"));
  assert.equal(collectionSchemas.properties.safeParse({amenities: ["OTHER"]}).success, false);
  assert.equal(collectionSchemas.properties.parse({amenities: ["LIFT"], customAmenities: ["Old value"]}).customAmenities, undefined);
});

test("legacy kitchen selections move to the separate field and explicit choices take priority", () => {
  assert.equal(collectionSchemas.properties.parse({amenities: ["KITCHEN"]}).kitchenType, "Available");
  const legacy = {amenities: ["KITCHEN", "LIFT"], furnishing: "SEMI_FURNISHED", furnishingItems: ["MODULAR_KITCHEN", "WARDROBE"]};
  const listing = collectionSchemas.properties.parse(legacy);
  assert.equal(listing.kitchenType, "Modular kitchen");
  assert.deepEqual(listing.amenities, ["LIFT"]);
  assert.deepEqual(listing.furnishingItems, ["WARDROBE"]);
  assert.equal(collectionSchemas.properties.parse({...legacy, kitchenType: "NO_KITCHEN"}).kitchenType, "No kitchen");
  assert.equal(collectionSchemas.properties.parse({...legacy, kitchenType: null}).kitchenType, undefined);
  assert.equal(collectionSchemas.properties.safeParse({kitchenType: "x".repeat(81)}).success, false);
});

test("property autocomplete finds city prefixes with or without a country filter", () => {
  assert.ok(searchSuggestionCities("hyde").some(({name, countryCode}) => name === "Hyderabad" && countryCode === "IN"));
  const matches = searchSuggestionCities("hyde", "IN");
  assert.ok(matches.some(({name}) => name === "Hyderabad"));
  assert.ok(matches.every(({countryCode}) => countryCode === "IN"));
});
