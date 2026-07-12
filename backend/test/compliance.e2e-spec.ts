import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * Compliance & Policy Guard e2e — exercises the runtime enforcement guarantees
 * (Policy Guard decisions, Execution Gateway, approvals, kill switch, audit,
 * tenant isolation) against the configured database.
 */
describe('Compliance & Policy Guard (e2e)', () => {
  let app: INestApplication;
  let http: any;
  const rnd = Math.floor(Math.random() * 1e9);
  const t1 = { email: `cmp_t1_${rnd}@x.com`, username: `cmp_t1_${rnd}`, password: 'Passw0rd!' };
  const t2 = { email: `cmp_t2_${rnd}@x.com`, username: `cmp_t2_${rnd}`, password: 'Passw0rd!' };
  let token1: string;
  let token2: string;
  let productId: string;
  let customerId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();

    await request(http).post('/api/v1/auth/register').send(t1).expect(201);
    token1 = (await request(http).post('/api/v1/auth/login').send({ email: t1.email, password: t1.password }).expect(200)).body.data.access_token;
    await request(http).post('/api/v1/auth/register').send(t2).expect(201);
    token2 = (await request(http).post('/api/v1/auth/login').send({ email: t2.email, password: t2.password }).expect(200)).body.data.access_token;

    const cat = await request(http).post('/api/v1/categories').set(auth(token1)).send({ name: `Cat ${rnd}` }).expect(201);
    const prod = await request(http).post('/api/v1/products').set(auth(token1)).send({ sku: `CMP-${rnd}`, name: 'Compliant Product', category_id: cat.body.data.id, cost_price: 40000, retail_price: 100000 }).expect(201);
    productId = prod.body.data.id;
    const cust = await request(http).post('/api/v1/customers').set(auth(token1)).send({ phone: `09${rnd}`.slice(0, 11), first_name: 'CMP' }).expect(201);
    customerId = cust.body.data.id;

    // Mark the product allowed so publish flows are not blocked by product compliance.
    await request(http).post('/api/v1/compliance/product-compliance').set(auth(token1))
      .send({ productId, complianceClass: 'ALLOWED', sellPermission: 'ALLOWED', advertisePermission: 'ALLOWED', status: 'ACTIVE' }).expect(201);
  });

  afterAll(async () => { await app.close(); });

  const propose = (token: string, body: any) => request(http).post('/api/v1/compliance/proposals').set(auth(token)).send(body);

  it('ALLOWS a clean content draft (risk 1)', async () => {
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'generate_content_draft', payload: { content: 'Áo thun cotton thoáng mát.' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('ALLOW');
    expect(res.body.data.proposal.status).toBe('ALLOWED');
  });

  it('requires EDIT for a draft with an absolute claim, flags the claim, and gateway refuses to execute it', async () => {
    // A DRAFT action would otherwise ALLOW; the absolute claim escalates it to REQUIRE_EDIT
    // deterministically (no platform/agent-approval escalation on drafts).
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'generate_content_draft', payload: { content: 'Sản phẩm TỐT NHẤT thị trường, tuyệt đối an toàn' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('REQUIRE_EDIT');
    expect(res.body.data.proposal.status).toBe('EDIT_REQUIRED');
    expect(res.body.data.decision.requiredEdits.length).toBeGreaterThan(0);
    // Gateway must refuse execution of a non-executable proposal.
    await request(http).post(`/api/v1/compliance/proposals/${res.body.data.proposal.id}/execute`).set(auth(token1)).expect(403);
  });

  it('BLOCKS a publish that contains prohibited content (fake review) regardless of approval path', async () => {
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'publish_content', platform: 'website', payload: { product_id: productId, content: 'Đăng thêm review giả để tăng uy tín' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('BLOCK');
  });

  it('BLOCKS marketing to a customer whose consent was withdrawn', async () => {
    const consent = await request(http).post('/api/v1/compliance/consent').set(auth(token1)).send({ customerId, channel: 'EMAIL', purpose: 'MARKETING' }).expect(201);
    await request(http).patch(`/api/v1/compliance/consent/${consent.body.data.id}/withdraw`).set(auth(token1)).expect(200);
    const res = await propose(token1, { agentId: 'raving_fan_ai', actionType: 'send_marketing', platform: 'email', payload: { customer_id: customerId, channel: 'EMAIL', message: 'Ưu đãi tháng này' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('BLOCK');
  });

  it('BLOCKS advertising a LICENSE_REQUIRED product with no verified license', async () => {
    await request(http).post('/api/v1/compliance/product-compliance').set(auth(token1)).send({ productId, complianceClass: 'LICENSE_REQUIRED', status: 'ACTIVE' }).expect(201);
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'publish_content', platform: 'website', payload: { product_id: productId, content: 'Thực phẩm bảo vệ sức khỏe' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('BLOCK');
    // restore to allowed for later tests
    await request(http).post('/api/v1/compliance/product-compliance').set(auth(token1)).send({ productId, complianceClass: 'ALLOWED', sellPermission: 'ALLOWED', advertisePermission: 'ALLOWED', status: 'ACTIVE' }).expect(201);
  });

  it('always BLOCKS a prohibited action (risk 5)', async () => {
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'fake_review', payload: { content: 'x' } }).expect(201);
    expect(res.body.data.decision.decision).toBe('BLOCK');
    // Gateway bypass attempt -> forbidden.
    await request(http).post(`/api/v1/compliance/proposals/${res.body.data.proposal.id}/execute`).set(auth(token1)).expect(403);
  });

  it('requires APPROVAL for a discount and blocks requester self-approval of a financial action', async () => {
    const res = await propose(token1, { agentId: 'product_ai', actionType: 'apply_discount', targetType: 'product', targetId: productId, payload: { product_id: productId, discount_percent: 40 } }).expect(201);
    expect(res.body.data.decision.decision).toBe('REQUIRE_APPROVAL');
    expect(res.body.data.proposal.status).toBe('APPROVAL_REQUIRED');
    const approvalId = res.body.data.proposal.approvalRequestId;
    // Requester (creator) cannot self-approve a financial action (separation of duties).
    await request(http).patch(`/api/v1/compliance/approvals/${approvalId}`).set(auth(token1)).send({ approved: true }).expect(403);
  });

  it('happy path: approval-required publish is approved then executed through the gateway with a receipt + audit', async () => {
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'publish_content', platform: 'website', payload: { product_id: productId, content: 'Áo thun mới về, nhiều màu.' } }).expect(201);
    expect(res.body.data.proposal.status).toBe('APPROVAL_REQUIRED');
    const proposalId = res.body.data.proposal.id;
    const approvalId = res.body.data.proposal.approvalRequestId;
    // Non-financial action -> requester (manager+) may approve.
    await request(http).patch(`/api/v1/compliance/approvals/${approvalId}`).set(auth(token1)).send({ approved: true }).expect(200);
    const exec = await request(http).post(`/api/v1/compliance/proposals/${proposalId}/execute`).set(auth(token1)).expect(201);
    expect(exec.body.data.status).toBe('EXECUTED');
    expect(exec.body.data.receiptId).toBeDefined();
  });

  it('kill switch ALL_EXTERNAL blocks execution in realtime', async () => {
    // Approve a publish first.
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'publish_content', platform: 'website', payload: { product_id: productId, content: 'Bộ sưu tập mùa hè.' } }).expect(201);
    const proposalId = res.body.data.proposal.id;
    await request(http).patch(`/api/v1/compliance/approvals/${res.body.data.proposal.approvalRequestId}`).set(auth(token1)).send({ approved: true }).expect(200);
    // Activate kill switch, then execution must be blocked.
    await request(http).post('/api/v1/compliance/kill-switches').set(auth(token1)).send({ scope: 'ALL_EXTERNAL', active: true, reason: 'e2e' }).expect(201);
    await request(http).post(`/api/v1/compliance/proposals/${proposalId}/execute`).set(auth(token1)).expect(403);
    // Deactivate.
    await request(http).post('/api/v1/compliance/kill-switches').set(auth(token1)).send({ scope: 'ALL_EXTERNAL', active: false }).expect(201);
  });

  it('records immutable audit entries and exposes no delete route', async () => {
    const res = await request(http).get('/api/v1/compliance/audit?limit=50').set(auth(token1)).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((a: any) => a.action === 'EXECUTION')).toBe(true);
    // There is intentionally no DELETE endpoint for the audit log.
    await request(http).delete('/api/v1/compliance/audit').set(auth(token1)).expect(404);
  });

  it('dashboard metrics report blocked actions and pending approvals', async () => {
    const res = await request(http).get('/api/v1/compliance/dashboard/metrics').set(auth(token1)).expect(200);
    expect(res.body.data.kpis.actions_blocked).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.data.kpis.active_policies).toBe('number');
  });

  it('policy versioning: create draft -> activate', async () => {
    const created = await request(http).post('/api/v1/compliance/policies').set(auth(token1))
      .send({ code: `POL_${rnd}`, name: 'E2E Policy', policyType: 'CONTENT', enforcementMode: 'BLOCK' }).expect(201);
    expect(created.body.data.status).toBe('DRAFT');
    const activated = await request(http).patch(`/api/v1/compliance/policies/${created.body.data.id}/status`).set(auth(token1)).send({ status: 'ACTIVE' }).expect(200);
    expect(activated.body.data.status).toBe('ACTIVE');
  });

  it('push_product routes through the gateway + executor and fails-closed without a Shopee connection', async () => {
    const res = await propose(token1, {
      agentId: 'product_ai',
      actionType: 'push_product',
      platform: 'shopee',
      targetType: 'product',
      targetId: productId,
      payload: { product_id: productId, shopee_item_id: '123456', price: 120000, stock: 10 },
    }).expect(201);
    expect(res.body.data.proposal.status).toBe('APPROVAL_REQUIRED');
    const approvalId = res.body.data.proposal.approvalRequestId;
    // push_product is not a financial action -> requester (manager+) may approve.
    await request(http).patch(`/api/v1/compliance/approvals/${approvalId}`).set(auth(token1)).send({ approved: true }).expect(200);
    const exec = await request(http).post(`/api/v1/compliance/proposals/${res.body.data.proposal.id}/execute`).set(auth(token1)).expect(201);
    // Executor runs but Shopee is not connected in CI -> fails closed (no fake success).
    expect(exec.body.data.status).toBe('FAILED');
    expect(exec.body.data.receiptId).toBeDefined();
  });

  it('create_listing (add_item) routes through the gateway + executor and fails-closed without a Shopee connection', async () => {
    const res = await propose(token1, {
      agentId: 'product_ai',
      actionType: 'create_listing',
      platform: 'shopee',
      targetType: 'product',
      targetId: productId,
      payload: {
        product_id: productId,
        category_id: 100182,
        price: 850000,
        stock: 12,
        weight_kg: 0.25,
        logistics: [{ logistic_id: 90003, enabled: true }],
        image_urls: ['https://cdn.example/pic.jpg'],
      },
    }).expect(201);
    expect(res.body.data.proposal.status).toBe('APPROVAL_REQUIRED');
    const approvalId = res.body.data.proposal.approvalRequestId;
    await request(http).patch(`/api/v1/compliance/approvals/${approvalId}`).set(auth(token1)).send({ approved: true }).expect(200);
    const exec = await request(http).post(`/api/v1/compliance/proposals/${res.body.data.proposal.id}/execute`).set(auth(token1)).expect(201);
    // Executor runs but Shopee is not connected in CI -> fails closed (no fake listing created).
    expect(exec.body.data.status).toBe('FAILED');
    expect(exec.body.data.receiptId).toBeDefined();
  });

  it('enforces tenant isolation on proposals', async () => {
    const res = await propose(token1, { agentId: 'content_ai', actionType: 'generate_content_draft', payload: { content: 'isolation test' } }).expect(201);
    await request(http).get(`/api/v1/compliance/proposals/${res.body.data.proposal.id}`).set(auth(token2)).expect(404);
  });
});
