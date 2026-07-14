jest.mock('nodemailer');
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

const enc = {
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\(/, '').replace(/\)$/, ''),
} as any;

const CONFIG = {
  smtp_host: 'smtp.gmail.com',
  smtp_port: 465,
  smtp_secure: true,
  smtp_user: 'shop@gmail.com',
  from_email: 'shop@gmail.com',
  from_name: 'Cửa hàng',
};

function makeService(record: any = null) {
  const prisma = {
    integration: {
      findFirst: jest.fn().mockResolvedValue(record),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
  } as any;
  return { svc: new EmailService(prisma, enc), prisma };
}

describe('EmailService', () => {
  let sendMail: jest.Mock;
  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('rejects internal/loopback SMTP hosts on connect (fail-closed)', async () => {
    const { svc } = makeService();
    const base = { smtp_user: 'u', smtp_password: 'p', from_email: 'a@b.com' } as any;
    await expect(svc.connect('t1', { ...base, smtp_host: 'localhost' })).rejects.toThrow(/không hợp lệ/);
    await expect(svc.connect('t1', { ...base, smtp_host: '127.0.0.1' })).rejects.toThrow(/không hợp lệ/);
    await expect(svc.connect('t1', { ...base, smtp_host: '10.0.0.5' })).rejects.toThrow(/không hợp lệ/);
  });

  it('send() fails closed when SMTP not configured', async () => {
    const { svc } = makeService(null);
    await expect(svc.send('t1', { to: 'x@y.com', subject: 's', text: 'hi' })).rejects.toThrow(/Chưa cấu hình/);
  });

  it('send() requires text or html', async () => {
    const { svc } = makeService({ config: CONFIG, secretRef: 'enc(pass)' });
    await expect(svc.send('t1', { to: 'x@y.com', subject: 's' } as any)).rejects.toThrow(/text hoặc html/);
  });

  it('send() builds "Name <email>" from + calls nodemailer with decrypted password', async () => {
    const { svc } = makeService({ config: CONFIG, secretRef: 'enc(secretpass)' });
    const out = await svc.send('t1', { to: 'cust@x.com', subject: 'Đơn hàng', html: '<b>hi</b>' });
    expect(out).toEqual({ ok: true, messageId: 'msg-1' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'shop@gmail.com', pass: 'secretpass' } }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Cửa hàng <shop@gmail.com>', to: 'cust@x.com', subject: 'Đơn hàng', html: '<b>hi</b>' }),
    );
  });

  it('status() reports not_configured when no record', async () => {
    const { svc } = makeService(null);
    const st = await svc.status('t1');
    expect(st).toEqual(expect.objectContaining({ configured: false, connected: false, status: 'not_configured' }));
  });
});
