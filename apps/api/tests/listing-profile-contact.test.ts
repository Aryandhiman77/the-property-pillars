import assert from "node:assert/strict";
import test from "node:test";
import { listingContactChannels } from "../src/workspace/listing-profile.js";

test("listing contact details are shared only with an enquirer when enabled", () => {
  const listing = {
    contactPhone: "+1 (202) 555-0140",
    whatsappPhone: "+1 202 555 0141",
    shareContactWithEnquirers: true,
  };
  assert.equal(
    listingContactChannels("owner", listing, [], false).phone,
    undefined,
  );
  assert.deepEqual(listingContactChannels("owner", listing, [], true), {
    phone: "+12025550140",
    whatsapp: "+12025550141",
  });
  assert.deepEqual(
    listingContactChannels(
      "owner",
      { ...listing, shareContactWithEnquirers: false },
      [],
      true,
    ),
    {},
  );
});

test("imported contacts match the publisher and distinguish a mobile from a landline", () => {
  const contacts = [
    {
      profileId: "dealer-a",
      phone: "+1-202-555-0100",
      evidence: ["public directory"],
    },
  ];
  assert.equal(
    listingContactChannels("seed-account-dealer-b", {}, contacts, true).phone,
    undefined,
  );
  assert.deepEqual(
    listingContactChannels("seed-account-dealer-a", {}, contacts, false),
    { phone: "+12025550100", whatsapp: undefined },
  );
  assert.equal(
    listingContactChannels(
      "seed-account-dealer-a",
      { shareContactWithEnquirers: false },
      contacts,
      false,
    ).phone,
    undefined,
  );
});
