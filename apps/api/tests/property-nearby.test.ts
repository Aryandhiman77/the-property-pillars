import assert from "node:assert/strict";
import test from "node:test";
import {env} from "../src/config/env.js";
import {areaContainsLandmark, propertyNearbyArea, propertyNearbyPlaces, readNearbyResults} from "../src/workspace/property-nearby.js";

test("nearby places uses a rounded area and falls back to the resolved city centre", () => {
  const pin = {latitude: 30.375231, longitude: 76.778934};
  const area = propertyNearbyArea({mapLocation: pin, city: "Ambala", countryCode: "IN"});
  assert.equal(area?.basis, "area");
  assert.notDeepEqual(area?.centre, pin);
  assert.equal(propertyNearbyArea({city: "Ambala", state: "Haryana", countryCode: "IN"})?.basis, "city");
  assert.equal(propertyNearbyArea({city: "Unknown city", countryCode: "IN"}), null);
});

test("nearby results sort and deduplicate named public places", () => {
  const results = readNearbyResults([
    {lat: 30.39, lon: 76.78, tags: {name: "City Hospital", amenity: "hospital"}},
    {center: {lat: 30.37, lon: 76.78}, tags: {name: "Central Station", railway: "station"}},
    {lat: 30.40, lon: 76.78, tags: {name: "city hospital", amenity: "hospital"}},
    {lat: 30.37, lon: 76.78, tags: {name: "Private garden", leisure: "garden", access: "private"}},
  ], {latitude: 30.37, longitude: 76.78});
  assert.deepEqual(results, [{name: "Central Station", category: "TRANSIT"}, {name: "City Hospital", category: "HEALTHCARE"}]);
});

test("nearby lookup shares requests and returns place names without pin coordinates", async (t) => {
  const endpoint = env.NEARBY_PLACES_OVERPASS_URL;
  env.NEARBY_PLACES_OVERPASS_URL = "https://example.test/api/interpreter";
  t.after(() => {env.NEARBY_PLACES_OVERPASS_URL = endpoint;});
  const pin = {latitude: 26.917381, longitude: 75.817634};
  const fetch = t.mock.method(globalThis, "fetch", async (_: unknown, init?: RequestInit) => {
    const query = init?.body?.toString() ?? "";
    assert.doesNotMatch(query, /26\.917381|75\.817634/);
    return Response.json({elements: [{lat: 26.92, lon: 75.82, tags: {name: "Reading Park", leisure: "park"}}]});
  });
  const [first, second] = await Promise.all([propertyNearbyPlaces({mapLocation: pin}), propertyNearbyPlaces({mapLocation: pin})]);
  assert.deepEqual(first, {basis: "area", places: [{name: "Reading Park", category: "PARK"}], source: "osm"});
  assert.deepEqual(first, second);
  assert.deepEqual(first, await propertyNearbyPlaces({mapLocation: pin}));
  assert.equal(fetch.mock.callCount(), 1);
});

test("the bundled catalog supplies real places when a property has a known city and no pin", async () => {
  const places = await propertyNearbyPlaces({countryCode: "IN", state: "Haryana", city: "Ambala"});
  assert.equal(places.source, "geonames");
  assert.equal(places.basis, "city");
  assert.ok(places.places.some(({category}) => category === "TRANSIT"));
  assert.ok(places.places.every((place) => Object.keys(place).length === 2));
});

test("landmark results respect neighbourhood distance across the date line and skip unresolved places", () => {
  const area = propertyNearbyArea({mapLocation: {latitude: 0, longitude: 179.99}});
  assert.equal(areaContainsLandmark(area, {latitude: 0, longitude: -179.99}), true);
  assert.equal(areaContainsLandmark(area, {latitude: 0, longitude: -178.5}), false);
  assert.equal(areaContainsLandmark(null, {latitude: 0, longitude: 0}), false);
});
