import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/** E2E for increment 3: fulfillment, video AI, workflows, integrations. */
describe('Increment 3 (e2e)', () => {
  let app: INestApplication;
  let http: any;
  const rnd = Math.floor(Math.random() * 1e9);
  const u = { email: `inc3_${rnd}@x.com`, username: `inc3_${rnd}`, password: 'Passw0rd!' };
  let token: string;
  let productId: string;
  let variantId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();

    await request(http).post('/api/v1/auth/register').send(u).expect(201);
    token = (await request(http).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200)).body.data.access_token;
    const cat = await request(http).post('/api/v1/categories').set('Authorization', `Bearer ${token}`).send({ name: `C${rnd}` }).expect(201);
    const prod = await request(http).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({ sku: `S${rnd}`, name: 'P', category_id: cat.body.data.id, cost_price: 40000, retail_price: 100000, tags: ['trending'] }).expect(201);
    productId = prod.body.data.id;
    const v = await request(http).post(`/api/v1/products/${productId}/variants`).set('Authorization', `Bearer ${token}`).send({ size: 'M', stock_quantity: 10 }).expect(201);
    variantId = v.body.data.id;
    const c = await request(http).post('/api/v1/customers').set('Authorization', `Bearer ${token}`).send({ phone: `07${rnd}`.slice(0, 11) }).expect(201);
    const o = await request(http).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send({ customer_id: c.body.data.id, items: [{ variant_id: variantId, quantity: 2 }], shipping_address: '12 Nguyen Hue, HCMC' }).expect(201);
    orderId = o.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('fulfillment: check -> confirm -> ship -> deliver -> complete', async () => {
    const check = await request(http).get(`/api/v1/orders/${orderId}/fulfillment-check`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(check.body.data.ready).toBe(true);
    expect(check.body.data.suggested_shipping).toBeDefined();

    await request(http).patch(`/api/v1/orders/${orderId}/confirm`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(http).post(`/api/v1/orders/${orderId}/shipments`).set('Authorization', `Bearer ${token}`).send({}).expect(201);
    const delivered = await request(http).patch(`/api/v1/orders/${orderId}/deliver`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(delivered.body.data.status).toBe('delivered');
    const completed = await request(http).patch(`/api/v1/orders/${orderId}/complete`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(completed.body.data.status).toBe('completed');
    expect(completed.body.data.paymentStatus).toBe('paid');
  });

  it('rejects invalid fulfillment transition (complete before deliver)', async () => {
    // order already completed; completing again should conflict
    await request(http).patch(`/api/v1/orders/${orderId}/complete`).set('Authorization', `Bearer ${token}`).expect(409);
  });

  it('video AI: generates template plan (no provider) and saves asset', async () => {
    const res = await request(http).post('/api/v1/ai/video/generate').set('Authorization', `Bearer ${token}`).send({ product_id: productId, video_type: 'unboxing', save: true }).expect(201);
    expect(res.body.data.plan.from_provider).toBe(false);
    expect(res.body.data.plan.is_template).toBe(true);
    expect(res.body.data.plan.scenes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.saved_asset_id).toBeTruthy();
  });

  it('workflows: list, run rescore + low_stock + kpi snapshot, history recorded', async () => {
    const defs = await request(http).get('/api/v1/workflows').set('Authorization', `Bearer ${token}`).expect(200);
    expect(defs.body.data.length).toBeGreaterThanOrEqual(3);
    expect(defs.body.data.every((w: any) => w.schedule_type === 'manual')).toBe(true);

    const r1 = await request(http).post('/api/v1/workflows/product_rescore_all/run').set('Authorization', `Bearer ${token}`).expect(201);
    expect(r1.body.data.status).toBe('completed');
    expect(r1.body.data.outputData.products_rescored).toBeGreaterThanOrEqual(1);

    const r2 = await request(http).post('/api/v1/workflows/low_stock_scan/run').set('Authorization', `Bearer ${token}`).expect(201);
    expect(r2.body.data.outputData).toHaveProperty('low_stock_count');

    const r3 = await request(http).post('/api/v1/workflows/daily_kpi_snapshot/run').set('Authorization', `Bearer ${token}`).expect(201);
    expect(r3.body.data.outputData).toHaveProperty('snapshot_id');

    const hist = await request(http).get('/api/v1/workflow-executions?limit=10').set('Authorization', `Bearer ${token}`).expect(200);
    expect(hist.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('workflows: unknown workflow -> 404', async () => {
    await request(http).post('/api/v1/workflows/does_not_exist/run').set('Authorization', `Bearer ${token}`).expect(404);
  });

  it('integrations: list providers, connect requires credentials, secrets never returned', async () => {
    const list = await request(http).get('/api/v1/integrations').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(10);
    expect(list.body.data.every((p: any) => p.status === 'not_configured')).toBe(true);

    // Missing credentials -> 400
    await request(http).post('/api/v1/integrations/shopee/connect').set('Authorization', `Bearer ${token}`).send({}).expect(400);

    // With credentials -> connected, no secret in response
    const conn = await request(http).post('/api/v1/integrations/shopee/connect').set('Authorization', `Bearer ${token}`).send({ api_key: 'super-secret-key-123' }).expect(201);
    expect(conn.body.data.status).toBe('connected');
    expect(conn.body.data.has_credentials).toBe(true);
    expect(JSON.stringify(conn.body)).not.toContain('super-secret-key-123');

    const after = await request(http).get('/api/v1/integrations').set('Authorization', `Bearer ${token}`).expect(200);
    const shopee = after.body.data.find((p: any) => p.provider === 'shopee');
    expect(shopee.status).toBe('connected');

    const disc = await request(http).post('/api/v1/integrations/shopee/disconnect').set('Authorization', `Bearer ${token}`).expect(201);
    expect(disc.body.data.status).toBe('disabled');
  });

  it('unknown integration provider -> 400', async () => {
    await request(http).post('/api/v1/integrations/not_a_provider/connect').set('Authorization', `Bearer ${token}`).send({ api_key: 'x' }).expect(400);
  });
});
