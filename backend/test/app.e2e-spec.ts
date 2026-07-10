import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * End-to-end tests run against the configured database (see ../.env → DATABASE_URL).
 * They create fresh random tenants/users each run so they are self-contained and
 * do not depend on prior seed state.
 */
describe('AI Commerce Platform (e2e)', () => {
  let app: INestApplication;
  let http: any;
  const rnd = Math.floor(Math.random() * 1e9);

  const t1 = { email: `e2e_t1_${rnd}@x.com`, username: `e2e_t1_${rnd}`, password: 'Passw0rd!' };
  const t2 = { email: `e2e_t2_${rnd}@x.com`, username: `e2e_t2_${rnd}`, password: 'Passw0rd!' };

  let t1Token: string;
  let t2Token: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let customerId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers tenant 1 and logs in', async () => {
    await request(http).post('/api/v1/auth/register').send(t1).expect(201);
    const res = await request(http).post('/api/v1/auth/login').send({ email: t1.email, password: t1.password }).expect(200);
    t1Token = res.body.data.access_token;
    expect(t1Token).toBeDefined();
  });

  it('rejects wrong password with 401', async () => {
    await request(http).post('/api/v1/auth/login').send({ email: t1.email, password: 'nope' }).expect(401);
  });

  it('blocks unauthenticated access with 401', async () => {
    await request(http).get('/api/v1/products').expect(401);
  });

  it('creates a category and product with auto-score', async () => {
    const cat = await request(http)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ name: `Cat ${rnd}` })
      .expect(201);
    categoryId = cat.body.data.id;

    const prod = await request(http)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ sku: `E2E-${rnd}`, name: 'E2E Product', category_id: categoryId, cost_price: 40000, retail_price: 100000, tags: ['trending'] })
      .expect(201);
    productId = prod.body.data.id;
    expect(Number(prod.body.data.productScore)).toBeGreaterThan(0);
  });

  it('adds a variant with stock', async () => {
    const v = await request(http)
      .post(`/api/v1/products/${productId}/variants`)
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ size: 'M', color: 'Blue', stock_quantity: 10, retail_price: 100000 })
      .expect(201);
    variantId = v.body.data.id;
    expect(v.body.data.stockQuantity).toBe(10);
  });

  it('creates a customer', async () => {
    const c = await request(http)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ phone: `09${rnd}`.slice(0, 11), first_name: 'E2E' })
      .expect(201);
    customerId = c.body.data.id;
  });

  it('creates an order and decrements stock', async () => {
    const o = await request(http)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ customer_id: customerId, items: [{ variant_id: variantId, quantity: 3 }], shipping_address: 'HCMC', shipping_cost: 20000 })
      .expect(201);
    orderId = o.body.data.id;
    expect(o.body.data.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/);
    expect(Number(o.body.data.totalAmount)).toBe(100000 * 3 + 20000);

    const detail = await request(http).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${t1Token}`).expect(200);
    const v = detail.body.data.variants.find((x: any) => x.id === variantId);
    expect(v.stockQuantity).toBe(7);
  });

  it('prevents overselling with 400', async () => {
    await request(http)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ customer_id: customerId, items: [{ variant_id: variantId, quantity: 100000 }], shipping_address: 'x' })
      .expect(400);
  });

  it('confirms then ships the order', async () => {
    await request(http).patch(`/api/v1/orders/${orderId}/confirm`).set('Authorization', `Bearer ${t1Token}`).expect(200);
    const s = await request(http).post(`/api/v1/orders/${orderId}/shipments`).set('Authorization', `Bearer ${t1Token}`).send({ shipping_method: 'GHN' }).expect(201);
    expect(s.body.data.trackingNumber).toBeDefined();
  });

  it('enforces tenant isolation (cross-tenant read -> 404)', async () => {
    await request(http).post('/api/v1/auth/register').send(t2).expect(201);
    const login = await request(http).post('/api/v1/auth/login').send({ email: t2.email, password: t2.password }).expect(200);
    t2Token = login.body.data.access_token;

    // Tenant 2 must NOT see tenant 1's product.
    await request(http).get(`/api/v1/products/${productId}`).set('Authorization', `Bearer ${t2Token}`).expect(404);

    // Tenant 2's product list is empty.
    const list = await request(http).get('/api/v1/products').set('Authorization', `Bearer ${t2Token}`).expect(200);
    expect(list.body.data.length).toBe(0);

    // Tenant 2 cannot create an order referencing tenant 1's customer/variant.
    await request(http)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${t2Token}`)
      .send({ customer_id: customerId, items: [{ variant_id: variantId, quantity: 1 }], shipping_address: 'x' })
      .expect(400);
  });

  it('serves executive dashboard from real data', async () => {
    const res = await request(http).get('/api/v1/dashboards/executive/summary').set('Authorization', `Bearer ${t1Token}`).expect(200);
    expect(res.body.data.products.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.orders.new_today).toBeGreaterThanOrEqual(1);
  });

  it('AI content generation degrades gracefully without a provider (no fabricated output)', async () => {
    const res = await request(http)
      .post('/api/v1/ai/content/generate-description')
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ product_id: productId })
      .expect(201);
    expect(res.body.data.provider_configured).toBe(false);
    expect(res.body.data.variations.length).toBe(0);
  });

  it('trend hunter analyzes opportunities from real data', async () => {
    const res = await request(http)
      .post('/api/v1/ai/trends/analyze')
      .set('Authorization', `Bearer ${t1Token}`)
      .expect(201);
    expect(res.body.data.window_days).toBe(30);
    expect(Array.isArray(res.body.data.rising_products)).toBe(true);
    expect(Array.isArray(res.body.data.rising_categories)).toBe(true);
  });

  it('lists tenant members (users/roles screen backend)', async () => {
    const res = await request(http).get('/api/v1/users').set('Authorization', `Bearer ${t1Token}`).expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].role).toBeDefined();
  });

  it('change-password: new works, old rejected, wrong current rejected', async () => {
    const email = `pw_${rnd}@x.com`;
    await request(http).post('/api/v1/auth/register').send({ email, username: `pw_${rnd}`, password: 'OldPass1!' }).expect(201);
    const login = await request(http).post('/api/v1/auth/login').send({ email, password: 'OldPass1!' }).expect(200);
    const token = login.body.data.access_token;

    await request(http)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'OldPass1!', new_password: 'NewPass1!' })
      .expect(200);

    await request(http).post('/api/v1/auth/login').send({ email, password: 'OldPass1!' }).expect(401);
    const relogin = await request(http).post('/api/v1/auth/login').send({ email, password: 'NewPass1!' }).expect(200);

    await request(http)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${relogin.body.data.access_token}`)
      .send({ current_password: 'WRONGCURRENT', new_password: 'Another1!' })
      .expect(401);
  });
});
