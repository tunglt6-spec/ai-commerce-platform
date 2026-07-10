import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * E2E for increment 2: returns, content, faq/sales, notifications, analyze.
 */
describe('Increment 2 (e2e)', () => {
  let app: INestApplication;
  let http: any;
  const rnd = Math.floor(Math.random() * 1e9);
  const u = { email: `inc2_${rnd}@x.com`, username: `inc2_${rnd}`, password: 'Passw0rd!' };
  let token: string;
  let productId: string;
  let variantId: string;
  let customerId: string;
  let orderId: string;
  let contentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();

    await request(http).post('/api/v1/auth/register').send(u).expect(201);
    const login = await request(http).post('/api/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
    token = login.body.data.access_token;

    const cat = await request(http).post('/api/v1/categories').set('Authorization', `Bearer ${token}`).send({ name: `C${rnd}` }).expect(201);
    const prod = await request(http).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({ sku: `S${rnd}`, name: 'P', category_id: cat.body.data.id, cost_price: 40000, retail_price: 100000 }).expect(201);
    productId = prod.body.data.id;
    const v = await request(http).post(`/api/v1/products/${productId}/variants`).set('Authorization', `Bearer ${token}`).send({ size: 'M', stock_quantity: 20 }).expect(201);
    variantId = v.body.data.id;
    const c = await request(http).post('/api/v1/customers').set('Authorization', `Bearer ${token}`).send({ phone: `08${rnd}`.slice(0, 11), first_name: 'T' }).expect(201);
    customerId = c.body.data.id;
    const o = await request(http).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send({ customer_id: customerId, items: [{ variant_id: variantId, quantity: 4 }], shipping_address: 'HCMC' }).expect(201);
    orderId = o.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns flow: request -> approve -> refund restores stock', async () => {
    // Move order to shippable state.
    await request(http).patch(`/api/v1/orders/${orderId}/confirm`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(http).post(`/api/v1/orders/${orderId}/shipments`).set('Authorization', `Bearer ${token}`).send({ shipping_method: 'GHN' }).expect(201);

    const before = await request(http).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${token}`).expect(200);
    const stockBefore = before.body.data.variants.find((x: any) => x.id === variantId).stockQuantity; // 20-4=16

    const ret = await request(http).post(`/api/v1/orders/${orderId}/returns`).set('Authorization', `Bearer ${token}`).send({ reason: 'quality' }).expect(201);
    const returnId = ret.body.data.id;

    await request(http).patch(`/api/v1/returns/${returnId}`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' }).expect(200);
    const refunded = await request(http).patch(`/api/v1/returns/${returnId}`).set('Authorization', `Bearer ${token}`).send({ status: 'refunded' }).expect(200);
    expect(refunded.body.data.status).toBe('refunded');

    const after = await request(http).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${token}`).expect(200);
    const stockAfter = after.body.data.variants.find((x: any) => x.id === variantId).stockQuantity;
    expect(stockAfter).toBe(stockBefore + 4); // stock restored

    const orderAfter = await request(http).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(orderAfter.body.data.status).toBe('returned');
    expect(orderAfter.body.data.paymentStatus).toBe('refunded');
  });

  it('content flow: create -> submit -> approve -> schedule', async () => {
    const created = await request(http).post('/api/v1/content').set('Authorization', `Bearer ${token}`).send({ content_type: 'caption', platform: 'tiktok', title: 'T', content: 'Hello world' }).expect(201);
    contentId = created.body.data.id;
    expect(created.body.data.status).toBe('draft');

    await request(http).patch(`/api/v1/content/${contentId}/submit`).set('Authorization', `Bearer ${token}`).expect(200);
    const approved = await request(http).patch(`/api/v1/content/${contentId}/approve`).set('Authorization', `Bearer ${token}`).send({ approved: true }).expect(200);
    expect(approved.body.data.status).toBe('approved');

    await request(http).post(`/api/v1/content/${contentId}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduled_date: '2026-08-01' }).expect(201);
    const cal = await request(http).get('/api/v1/content-calendar').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cal.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('faq + sales AI: create faq, search, sales respond returns faq answer (no provider)', async () => {
    await request(http).post('/api/v1/faq').set('Authorization', `Bearer ${token}`).send({ category: 'shipping', question: 'Giao hàng mất bao lâu?', answer: 'Thường 2-3 ngày.', priority: 10 }).expect(201);
    const search = await request(http).get('/api/v1/faq/search?q=giao').set('Authorization', `Bearer ${token}`).expect(200);
    expect(search.body.data.length).toBeGreaterThanOrEqual(1);

    const resp = await request(http).post('/api/v1/ai/sales/respond').set('Authorization', `Bearer ${token}`).send({ question: 'giao hàng bao lâu' }).expect(201);
    expect(resp.body.data.from_provider).toBe(false);
    expect(resp.body.data.matched_faq.length).toBeGreaterThanOrEqual(1);
    expect(resp.body.data.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('notifications derived from real state', async () => {
    const res = await request(http).get('/api/v1/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
  });

  it('analyze AI insights returns real metrics + insights', async () => {
    const res = await request(http).post('/api/v1/ai/analyze/insights').set('Authorization', `Bearer ${token}`).expect(201);
    expect(res.body.data.metrics).toBeDefined();
    expect(typeof res.body.data.metrics.revenue).toBe('number');
    expect(res.body.data.insights.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.ai_narrative_from_provider).toBe(false);
  });
});
