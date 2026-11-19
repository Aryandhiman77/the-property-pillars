import assert from "node:assert/strict";
import {test} from "node:test";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {googleRoleSchema} from "../src/schemas/auth.schema.js";

test("sign-in preserves an internal localized task and its selection", () => {
  const next = "/hi/properties/enquire?kind=project&record=project_42#public-task-title";
  assert.equal(safeLoginReturn(next), next);
  assert.equal(safeLoginReturn("/ar/dashboard?view=billing"), "/ar/dashboard?view=billing");
});

test("sign-in rejects external, malformed and looping return addresses", () => {
  for (const next of ["https://example.com", "//example.com/hi", "/\\example.com/en", "/en//tasks",
    "/en/%2fexample.com", "/en/properties/../login", "/api/v1/auth/session", ["/en/dashboard"]]) {
    assert.equal(safeLoginReturn(next, "pa"), "/pa/dashboard");
  }
});

test("Google onboarding accepts member roles and rejects privileged or unknown fields", () => {
  assert.equal(googleRoleSchema.safeParse({role: "OWNER"}).success, true);
  assert.equal(googleRoleSchema.safeParse({role: "ADMIN"}).success, false);
  assert.equal(googleRoleSchema.safeParse({role: "OWNER", email: "owner@example.invalid"}).success, false);
});
