import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";

import { createLocationsRouter } from "../src/locations/router.js";
import {
  createPincodeLookupService,
  selectPincodeLocation,
} from "../src/locations/service.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";
import { notFoundMiddleware } from "../src/middleware/not-found.middleware.js";
import { requestIdMiddleware } from "../src/middleware/request-id.middleware.js";
import { ApiError } from "../src/utils/api-error.js";

function postalResponse(
  postOffices: unknown[],
  status = "Success",
  message = "Found",
) {
  return Response.json([
    { Status: status, Message: message, PostOffice: postOffices },
  ]);
}

function office(overrides: Record<string, unknown> = {}) {
  return {
    Name: "Example Sub Office",
    BranchType: "Sub Post Office",
    DeliveryStatus: "Delivery",
    District: "Khordha",
    Block: "Bhubaneswar",
    Division: "Bhubaneswar",
    Region: "Bhubaneswar HQ",
    State: "Orissa",
    Country: "India",
    Pincode: "751001",
    ...overrides,
  };
}

test("selects an exact-PIN delivery head office and canonicalizes GST state aliases", () => {
  const selected = selectPincodeLocation("751001", [
    office({
      Name: "Wrong PIN Head Office",
      BranchType: "Head Post Office",
      Pincode: "751002",
      District: "Wrong",
    }),
    office({
      Name: "Non Delivery Head Office",
      BranchType: "Head Post Office",
      DeliveryStatus: "Non-Delivery",
      District: "Non Delivery",
    }),
    office({ Name: "Delivery Sub Office", Block: "Delivery Sub" }),
    office({ Name: " Delivery Sub Office ", Block: "Delivery Sub" }),
    office({
      Name: "Delivery Head Office",
      BranchType: "Head Post Office",
      District: "Bhubaneswar",
    }),
  ]);

  assert.deepEqual(selected, {
    pincode: "751001",
    city: "Bhubaneswar",
    state: "Odisha",
    stateCode: "21",
    area: "Delivery Head Office",
    areas: [
      "Delivery Head Office",
      "Delivery Sub Office",
      "Non Delivery Head Office",
    ],
  });
});

test("normalizes known state aliases and retains unknown states with null GST code", () => {
  const aliases = [
    ["Uttaranchal", "Uttarakhand", "05"],
    ["Pondicherry", "Puducherry", "34"],
    ["Jammu & Kashmir", "Jammu and Kashmir", "01"],
    ["Andaman & Nicobar Islands", "Andaman and Nicobar Islands", "35"],
    ["NCT of Delhi", "Delhi", "07"],
    ["Dadra & Nagar Haveli", "Dadra and Nagar Haveli and Daman and Diu", "26"],
    ["Telengana", "Telangana", "36"],
  ] as const;

  for (const [raw, canonical, code] of aliases) {
    assert.deepEqual(
      selectPincodeLocation("751001", [office({ State: raw })]),
      {
        pincode: "751001",
        city: "Bhubaneswar",
        state: canonical,
        stateCode: code,
        area: "Example Sub Office",
        areas: ["Example Sub Office"],
      },
    );
  }
  assert.deepEqual(
    selectPincodeLocation("751001", [office({ State: "Example Territory" })]),
    {
      pincode: "751001",
      city: "Bhubaneswar",
      state: "Example Territory",
      stateCode: null,
      area: "Example Sub Office",
      areas: ["Example Sub Office"],
    },
  );
});

test("uses a specific city when available and falls back to district", () => {
  assert.equal(
    selectPincodeLocation("751001", [office({ Country: "Elsewhere" })]),
    null,
  );
  assert.equal(
    selectPincodeLocation("751001", [office({ State: null })]),
    null,
  );
  assert.deepEqual(selectPincodeLocation("751001", [office({ Block: "NA" })]), {
    pincode: "751001",
    city: "Khordha",
    state: "Odisha",
    stateCode: "21",
    area: "Example Sub Office",
    areas: ["Example Sub Office"],
  });
  assert.deepEqual(
    selectPincodeLocation("160055", [
      office({
        Pincode: "160055",
        District: "Rupnagar",
        Block: "S.A.S.Nagar (Mohali)",
        State: "Punjab",
      }),
    ]),
    {
      pincode: "160055",
      city: "Mohali",
      state: "Punjab",
      stateCode: "03",
      area: "Example Sub Office",
      areas: ["Example Sub Office"],
    },
  );
});

test("tolerates a usable PIN location with no named area", () => {
  assert.deepEqual(selectPincodeLocation("751001", [office({ Name: null })]), {
    pincode: "751001",
    city: "Bhubaneswar",
    state: "Odisha",
    stateCode: "21",
    area: null,
    areas: [],
  });
});

test("calls only the fixed postal endpoint and handles not-found responses", async () => {
  const calls: Array<{
    url: string;
    method: string | undefined;
    body: unknown;
  }> = [];
  const service = createPincodeLookupService({
    fetchImplementation: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: init?.body,
      });
      return postalResponse([office()]);
    },
  });
  assert.deepEqual(await service.lookup("751001"), {
    pincode: "751001",
    city: "Bhubaneswar",
    state: "Odisha",
    stateCode: "21",
    area: "Example Sub Office",
    areas: ["Example Sub Office"],
  });
  assert.deepEqual(calls, [
    {
      url: "https://api.postalpincode.in/pincode/751001",
      method: "GET",
      body: undefined,
    },
  ]);

  const notFound = createPincodeLookupService({
    fetchImplementation: async () =>
      postalResponse([], "Error", "No records found"),
  });
  await assert.rejects(
    () => notFound.lookup("751001"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.statusCode === 404 &&
      error.code === "PINCODE_NOT_FOUND",
  );
});

test("separates validation, timeout and malformed/upstream failures", async () => {
  let fetchCalls = 0;
  const validationService = createPincodeLookupService({
    fetchImplementation: async () => {
      fetchCalls += 1;
      return postalResponse([office()]);
    },
  });
  for (const invalid of ["012345", "12345", "1234567", "ABC123"]) {
    await assert.rejects(
      () => validationService.lookup(invalid),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 400 &&
        error.code === "INVALID_PINCODE",
    );
  }
  assert.equal(fetchCalls, 0);

  const timeout = createPincodeLookupService({
    fetchImplementation: async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    },
  });
  await assert.rejects(
    () => timeout.lookup("751001"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.statusCode === 504 &&
      error.code === "PINCODE_UPSTREAM_TIMEOUT",
  );

  const unavailableCases: Array<() => Promise<Response>> = [
    async () => {
      throw new Error("network failed");
    },
    async () => new Response("upstream failure", { status: 500 }),
    async () => new Response("<html>not JSON</html>"),
    async () => Response.json({ unexpected: true }),
    async () => postalResponse([], "Success", "Found"),
  ];
  for (const fetchImplementation of unavailableCases) {
    const service = createPincodeLookupService({ fetchImplementation });
    await assert.rejects(
      () => service.lookup("751001"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 502 &&
        error.code === "PINCODE_UPSTREAM_UNAVAILABLE",
    );
  }
});

test("public HTTP route returns the shared envelope and cache-safe location only", async () => {
  let fetchCalls = 0;
  const lookupService = createPincodeLookupService({
    fetchImplementation: async () => {
      fetchCalls += 1;
      return postalResponse([office()]);
    },
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use("/api/v1/locations", createLocationsRouter(lookupService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  const success = await request(app)
    .get("/api/v1/locations/pincode/751001")
    .expect(200);
  assert.deepEqual(success.body.data, {
    pincode: "751001",
    city: "Bhubaneswar",
    state: "Odisha",
    stateCode: "21",
    area: "Example Sub Office",
    areas: ["Example Sub Office"],
  });
  assert.equal(typeof success.body.meta.requestId, "string");
  assert.match(success.headers["cache-control"], /^public, max-age=86400/);

  for (const invalid of ["012345", "12345", "1234567", "ABC123"]) {
    const response = await request(app)
      .get(`/api/v1/locations/pincode/${invalid}`)
      .expect(400);
    assert.equal(response.body.error.code, "INVALID_PINCODE");
  }
  assert.equal(fetchCalls, 1);
});
