import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SignJWT } from 'jose';
import request from 'supertest';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { authService } from '../src/services/auth.service.js';
import {
  createSessionToken,
  digestSessionToken,
  verifySessionToken,
} from '../src/utils/session-token.js';

const claims = {
  sessionId: 'session-jwt-test',
  userId: 'user-jwt-test',
  tenantId: 'tenant-jwt-test',
  role: 'BUYER' as const,
};

describe('JWT browser authentication', () => {
  it('issues and verifies a signed JWT with the expected identity claims', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const token = await createSessionToken({...claims, expiresAt});

    assert.equal(token.split('.').length, 3);
    assert.notEqual(digestSessionToken(token), token);
    const verified = await verifySessionToken(token);
    assert.ok(verified);
    assert.equal(verified.sessionId, claims.sessionId);
    assert.equal(verified.userId, claims.userId);
    assert.equal(verified.tenantId, claims.tenantId);
    assert.equal(verified.role, claims.role);
  });

  it('rejects tampered, expired, wrong-issuer and wrong-audience tokens before database lookup', async () => {
    const valid = await createSessionToken({
      ...claims,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    });
    const tokenParts = valid.split('.');
    const replacement = tokenParts[2].startsWith('a') ? 'b' : 'a';
    tokenParts[2] = replacement + tokenParts[2].slice(1);
    assert.equal(await verifySessionToken(tokenParts.join('.')), null);

    const expired = await createSessionToken({
      ...claims,
      expiresAt: new Date(Date.now() - 60_000),
    });
    assert.equal(await verifySessionToken(expired), null);

    const wrongIssuer = await new SignJWT({
      tenantId: claims.tenantId,
      role: claims.role,
    })
      .setProtectedHeader({alg: 'HS256', typ: 'JWT'})
      .setIssuer('not-the-property-pillar')
      .setAudience(env.JWT_AUDIENCE)
      .setSubject(claims.userId)
      .setJti(claims.sessionId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    assert.equal(await verifySessionToken(wrongIssuer), null);

    const wrongAudience = await new SignJWT({
      tenantId: claims.tenantId,
      role: claims.role,
    })
      .setProtectedHeader({alg: 'HS256', typ: 'JWT'})
      .setIssuer(env.JWT_ISSUER)
      .setAudience('not-the-property-pillar-web')
      .setSubject(claims.userId)
      .setJti(claims.sessionId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    assert.equal(await verifySessionToken(wrongAudience), null);
  });

  it('exposes no demo flag in the public auth context', () => {
    const publicSession = authService.toPublicSession({
      sessionId: claims.sessionId,
      userId: claims.userId,
      tenantId: claims.tenantId,
      role: claims.role,
      name: 'JWT Test Buyer',
    });

    assert.deepEqual(publicSession, {role: 'BUYER', name: 'JWT Test Buyer'});
    assert.equal('demo' in publicSession, false);
  });

  it('rejects and clears a legacy opaque session cookie', async () => {
    const response = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', `${env.SESSION_COOKIE_NAME}=legacy-opaque-session-token`);

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
    assert.match(response.headers['cache-control'], /no-store/i);
    const clearedCookie = response.headers['set-cookie']?.[0] ?? '';
    assert.match(clearedCookie, new RegExp(`^${env.SESSION_COOKIE_NAME}=`));
    assert.match(clearedCookie, /HttpOnly/i);
    assert.match(clearedCookie, /SameSite=Lax/i);
  });

  it('removes legacy demo and options routes', async () => {
    const [demo, options] = await Promise.all([
      request(app).post('/api/v1/auth/demo').send({role: 'BUYER'}),
      request(app).get('/api/v1/auth/options'),
    ]);

    assert.equal(demo.status, 404);
    assert.equal(demo.body.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(options.status, 404);
    assert.equal(options.body.error.code, 'ROUTE_NOT_FOUND');
  });

  it('allows credentialed CORS only for configured origins', async () => {
    const allowed = await request(app)
      .options('/api/v1/auth/session')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

    const denied = await request(app)
      .get('/api/v1/auth/session')
      .set('Origin', 'https://untrusted.example');
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'ORIGIN_NOT_ALLOWED');
  });
});
