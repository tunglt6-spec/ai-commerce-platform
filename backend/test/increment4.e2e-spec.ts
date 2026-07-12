import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import * as http from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Increment 4 (e2e)', () => {
  let app: INestApplication;
  let http_: any;
  let receiver: http.Server;
  let receiverPort: number;
  const webhookHits: { body: string; signature: string | undefined }[] = [];

  const rnd = Math.floor(Math.random() * 1e9);
  const u = { email: `inc4_${rnd}@x.com`, username: `inc4_${rnd}`, password: 'Passw0rd!' };
  const SECRET = 'super-secret-key-abc';
  let token: string;
  let variantId: string;
  let customerId: string;
  let orderId: string;

  beforeAll(async () => {
    // Local receiver: /verify -> 200; /webhook -> records signed payload.
    receiver = http.createServer((req, res) => {
      if (req.url === '/verify') {
        res.writeHead(200).end('ok');
        return;
      }
      if (req.url === '/webhook' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          webhookHits.push({ body, signature: req.headers['x-commerce-signature'] as string });
          res.writeHead(200).end('ok');
        });
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => receiver.listen(0, resolve));
    receiverPort = (receiver.address() as any).port;

    // The SSRF egress guard blocks loopback by default; allow-list the local mock
    // receiver so this test can exercise the real verify/webhook HTTP path.
    process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1,localhost';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http_ = app.getHttpServer();

    await request(http_).post('/api/v1/auth/register').send(u).expect(201);
    token = (await request(http_).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200)).body.data.access_token;
    const cat = await request(http_).post('/api/v1/categories').set('Authorization', `Bearer ${token}`).send({ name: `C${rnd}` }).expect(201);
    const prod = await request(http_).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({ sku: `S${rnd}`, name: 'P', category_id: cat.body.data.id, cost_price: 40000, retail_price: 100000 }).expect(201);
    const v = await request(http_).post(`/api/v1/products/${prod.body.data.id}/variants`).set('Authorization', `Bearer ${token}`).send({ size: 'M', stock_quantity: 10 }).expect(201);
    variantId = v.body.data.id;
    const c = await request(http_).post('/api/v1/customers').set('Authorization', `Bearer ${token}`).send({ phone: `06${rnd}`.slice(0, 11), first_name: 'Fan' }).expect(201);
    customerId = c.body.data.id;
  });

  afterAll(async () => {
    delete process.env.SSRF_ALLOWED_HOSTS; // don't leak the allow-list into other specs
    await app.close();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  });

  it('uploads: accepts a PNG, rejects unsupported type', async () => {
    const ok = await request(http_)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_1x1, { filename: 'x.png', contentType: 'image/png' })
      .expect(201);
    expect(ok.body.data.url).toMatch(/^\/uploads\/.+\.png$/);

    await request(http_)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('integrations: real test-connection via verify_url; secret never returned', async () => {
    const verifyUrl = `http://127.0.0.1:${receiverPort}/verify`;
    const webhookUrl = `http://127.0.0.1:${receiverPort}/webhook`;
    const conn = await request(http_)
      .post('/api/v1/integrations/shopee/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ api_key: SECRET, config: { verify_url: verifyUrl, webhook_url: webhookUrl } })
      .expect(201);
    expect(conn.body.data.status).toBe('connected'); // real HTTP 200 from /verify
    expect(JSON.stringify(conn.body)).not.toContain(SECRET);

    const list = await request(http_).get('/api/v1/integrations').set('Authorization', `Bearer ${token}`).expect(200);
    const shopee = list.body.data.find((p: any) => p.provider === 'shopee');
    expect(shopee.status).toBe('connected');
    expect(shopee.has_credentials).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain(SECRET);
  });

  it('order.created dispatches a real, HMAC-signed webhook', async () => {
    webhookHits.length = 0;
    const o = await request(http_)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: customerId, items: [{ variant_id: variantId, quantity: 2 }], shipping_address: '1 Test, HCMC' })
      .expect(201);
    orderId = o.body.data.id;

    // Wait for fire-and-forget webhook.
    for (let i = 0; i < 30 && webhookHits.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(webhookHits.length).toBeGreaterThanOrEqual(1);
    const hit = webhookHits[0];
    const parsed = JSON.parse(hit.body);
    expect(parsed.event).toBe('order.created');
    expect(parsed.data.order_id).toBe(orderId);
    // Verify HMAC signature with the secret.
    const expected = 'sha256=' + createHmac('sha256', SECRET).update(hit.body).digest('hex');
    expect(hit.signature).toBe(expected);
  });

  it('raving fan: follow-up after delivery, segments, win-back, upsell', async () => {
    await request(http_).patch(`/api/v1/orders/${orderId}/confirm`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(http_).post(`/api/v1/orders/${orderId}/shipments`).set('Authorization', `Bearer ${token}`).send({}).expect(201);
    await request(http_).patch(`/api/v1/orders/${orderId}/deliver`).set('Authorization', `Bearer ${token}`).expect(200);

    const fu = await request(http_).post(`/api/v1/ai/raving-fan/follow-up/${orderId}`).set('Authorization', `Bearer ${token}`).expect(201);
    expect(fu.body.data.message.length).toBeGreaterThan(10);

    const seg = await request(http_).post('/api/v1/ai/raving-fan/recompute-segments').set('Authorization', `Bearer ${token}`).expect(201);
    expect(seg.body.data.total).toBeGreaterThanOrEqual(1);
    expect(seg.body.data.by_segment).toBeDefined();

    const wb = await request(http_).get('/api/v1/ai/raving-fan/win-back?days=30').set('Authorization', `Bearer ${token}`).expect(200);
    expect(typeof wb.body.data.count).toBe('number');

    const up = await request(http_).get(`/api/v1/ai/raving-fan/upsell/${customerId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(up.body.data.suggestions)).toBe(true);
  });

  it('customer_segmentation workflow runs', async () => {
    const r = await request(http_).post('/api/v1/workflows/customer_segmentation/run').set('Authorization', `Bearer ${token}`).expect(201);
    expect(r.body.data.status).toBe('completed');
    expect(r.body.data.outputData).toHaveProperty('by_segment');
  });
});
