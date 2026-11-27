import assert from "node:assert/strict";
import {test} from "node:test";
import {propertyGalleryLimit} from "@the-property-pillar/contracts";
import {collectionSchemas} from "../src/workspace/config.js";
import {validateTransitionReadiness} from "../src/workspace/validation.js";
import {validateSpecifications} from "../src/properties/domain.js";

const media = (index: number, kind: "webp" | "mp4") => `/api/v1/uploads/${index.toString(16).padStart(64, "0")}.${kind}`;
const photos = Array.from({length: propertyGalleryLimit - 2}, (_, index) => media(index, "webp"));
const firstVideo = media(100, "mp4");
const secondVideo = media(101, "mp4");

test("property gallery sections have independent limits, including legacy categories and video URLs", () => {
  const sections = [["Interior", 10], ["Building", 10], ["Floor plan", 10], ["Videos", 5]] as const;
  const galleryDetails = sections.flatMap(([category, limit], group) => Array.from({length: limit}, (_, i) => ({
    category, url: media(group * 20 + i, category === "Videos" ? "mp4" : "webp"),
  })));
  const mediaUrls = galleryDetails.map(file => file.url);
  assert.doesNotThrow(() => validateSpecifications({mediaUrls, galleryDetails}));
  for (const [category] of sections) {
    const url = media(99, category === "Videos" ? "mp4" : "webp");
    const overLimit = {mediaUrls: [...mediaUrls, url], galleryDetails: [...galleryDetails, {url, category: category === "Videos" ? "Interior" : category}]};
    assert.throws(() => validateSpecifications(overLimit), /allows up to/);
    assert.doesNotThrow(() => validateSpecifications(overLimit, overLimit));
  }
});

test("property galleries enforce one 40-item cap across photo and video references", () => {
  const gallery = [...photos, firstVideo, secondVideo];
  assert.deepEqual(collectionSchemas.properties.parse({mediaUrls: gallery}).mediaUrls, gallery);
  assert.equal(collectionSchemas.properties.safeParse({mediaUrls: [...gallery, media(102, "mp4")]}).success, false);
  assert.equal(collectionSchemas.properties.safeParse({mediaUrls: gallery, videoUrl: media(102, "mp4")}).success, false);
});

test("legacy property videos are carried into the gallery once", () => {
  assert.deepEqual(collectionSchemas.properties.parse({mediaUrls: photos, videoUrl: firstVideo}).mediaUrls, [...photos, firstVideo]);
  assert.deepEqual(collectionSchemas.properties.parse({mediaUrls: [firstVideo], videoUrl: firstVideo}).mediaUrls, [firstVideo]);
});

test("a property with a video can be submitted for review", () => {
  validateTransitionReadiness("properties", "PENDING_REVIEW", {
    countryCode: "GB", city: "London", listingIntent: "SALE", propertyCategory: "RESIDENTIAL", propertyType: "APARTMENT",
    price: 500_000, currency: "GBP", areaValue: 80, areaUnit: "SQM", bedrooms: 2, constructionStatus: "READY_TO_MOVE",
    mediaUrls: [firstVideo], consentAccepted: true,
  }, "A two-bedroom flat with a video walkthrough and a private terrace in London.");
});
