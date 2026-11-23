import assert from "node:assert/strict";
import test from "node:test";
import {propertyVisitorHash} from "../src/workspace/property-views.js";

test("property views deduplicate canonical IPv4 and IPv6 addresses without linking properties or tenants", () => {
  const hash = (ip: string) => propertyVisitorHash("tenant-a", "property-a", ip);
  assert.equal(hash("192.0.2.1"), hash("::ffff:192.0.2.1"));
  assert.equal(hash("192.0.2.1"), hash("::FFFF:C000:0201"));
  assert.equal(hash("2001:0DB8:0:0:0:0:0:1"), hash("2001:db8::1"));
  assert.notEqual(hash("192.0.2.1"), hash("192.0.2.2"));
  assert.notEqual(hash("192.0.2.1"), propertyVisitorHash("tenant-a", "property-b", "192.0.2.1"));
  assert.notEqual(hash("192.0.2.1"), propertyVisitorHash("tenant-b", "property-a", "192.0.2.1"));
  assert.equal(hash("unknown"), undefined);
});
