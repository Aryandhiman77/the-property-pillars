import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import request from 'supertest';

import { app } from '../src/app.js';
import { disconnectDatabase } from '../src/database/prisma.js';

after(async () => {
  await disconnectDatabase();
});

describe('API infrastructure', () => {
  it('returns liveness without requiring a database connection', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-request-id', 'health-test-request');

    assert.equal(response.status, 200);
    assert.equal(response.headers['x-request-id'], 'health-test-request');
    assert.equal(response.body.data.status, 'ok');
    assert.equal(response.body.data.service, 'the-property-pillar-api');
    assert.equal(response.body.meta.requestId, 'health-test-request');
    assert.equal(response.body.error, undefined);
  });

  it('returns the standard error envelope for an unknown route', async () => {
    const response = await request(app).get('/not-a-real-route');

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(typeof response.body.meta.requestId, 'string');
    assert.equal(response.body.data, undefined);
  });

  it('returns 401 when no browser session exists', async () => {
    const response = await request(app).get('/api/v1/auth/session');

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(typeof response.body.meta.requestId, 'string');
  });
});
