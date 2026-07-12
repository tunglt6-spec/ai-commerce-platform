import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * Security regression suite. Exercises real controls end-to-end:
 * authn rejection, malformed token, SSRF egress guard, and auth-endpoint throttling.
 */
describe('Security controls (e2e)', () => {
  let app: INestApplication;
  let http: any;
  const rnd = Math.floor(Math.random() * 1e9);
  const admin = { email: `sec_${rnd}@x.com`, username: `sec_${rnd}`, password: 'Passw0rd!' };
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();

    await request(http).post('/api/v1/auth/register').send(admin).expect(201);
    const res = await request(http).post('/api/v1/auth/login').send({ email: admin.email, password: admin.password }).expect(200);
    token = res.body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to a protected resource', async () => {
    await request(http).get('/api/v1/products').expect(401);
  });

  it('rejects a malformed/garbage bearer token', async () => {
    await request(http).get('/api/v1/products').set('Authorization', 'Bearer not.a.real.jwt').expect(401);
    await request(http).get('/api/v1/products').set('Authorization', 'Bearer ').expect(401);
  });

  it('sets Cache-Control: no-store on token responses', async () => {
    const res = await request(http).post('/api/v1/auth/login').send({ email: admin.email, password: admin.password }).expect(200);
    expect(String(res.headers['cache-control'])).toContain('no-store');
  });

  it('blocks SSRF via integration verify_url to the cloud-metadata address', async () => {
    // ADMIN membership is granted to the registering user on their tenant.
    const res = await request(http)
      .post('/api/v1/integrations/website/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ api_key: 'dummy', config: { verify_url: 'http://169.254.169.254/latest/meta-data/' } })
      .expect(201);
    expect(res.body.data.status).toBe('error');
    expect(String(res.body.data.last_error)).toMatch(/block|SSRF/i);
  });

  it('blocks SSRF via integration verify_url to a private/loopback host', async () => {
    const res = await request(http)
      .post('/api/v1/integrations/website/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ api_key: 'dummy', config: { verify_url: 'http://127.0.0.1:5432/' } })
      .expect(201);
    expect(res.body.data.status).toBe('error');
    expect(String(res.body.data.last_error)).toMatch(/block|SSRF/i);
  });

  it('throttles a burst of login attempts (429)', async () => {
    // login limit is 10/min per IP; a burst must eventually be rejected.
    let sawThrottle = false;
    for (let i = 0; i < 16; i += 1) {
      const res = await request(http).post('/api/v1/auth/login').send({ email: admin.email, password: 'wrong' });
      if (res.status === 429) {
        sawThrottle = true;
        break;
      }
    }
    expect(sawThrottle).toBe(true);
  });
});
