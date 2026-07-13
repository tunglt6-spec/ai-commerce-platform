# Di chuyển toàn bộ AICP sang VPS mới — Runbook

**Mục tiêu:** chuyển AI Commerce Platform (frontend + backend + PostgreSQL + uploads) sang **một VPS riêng**, tách khỏi VPS đang dùng chung với PickleFund, **giữ nguyên domain `store.picklefund.uk`** để không phải đăng ký lại Shopee/URL.

> Nguyên tắc vàng: **không xoá gì trên VPS cũ cho tới khi VPS mới đã chạy + kiểm chứng**. Cutover = đổi 1 bản ghi DNS ở Cloudflare; rollback = đổi ngược lại.

---

## 0. Kiến trúc đích (khuyến nghị)

**VPS riêng, standalone, KÉO image dựng sẵn từ GHCR (không build trên VPS), Caddy đứng trước.**

```
Internet → Cloudflare (proxied, cùng domain) → Caddy (TLS) → frontend:3000 / backend:3001
                                                              backend → postgres:5432 (nội bộ)
```

Lý do: (a) build trên VPS nhỏ từng gây OOM → dùng image GHCR như hiện tại; (b) tách proxy riêng, không phụ thuộc `picklefund-nginx`; (c) hết cảnh chung đĩa với PickleFund (đã gây sự cố 502 đầy đĩa).

### Chọn VPS
| Hạng mục | Hiện tại | Khuyến nghị VPS mới |
|---|---|---|
| RAM | 4 GB (chung 2 app) | **4–8 GB** (riêng AICP; 8 GB thoải mái cho pgvector + AI) |
| Đĩa | 38 GB, **đã đầy 100%** | **≥ 80 GB SSD** (đĩa là điểm nghẽn chính) |
| Ví dụ Hetzner | CX22 | **CX32 / CPX31** (4–8 GB, 80–160 GB) |
| Cùng vùng | Hel1 | Hel1/Nbg (giữ gần Cloudflare) |

---

## 1. Chuẩn bị VPS mới (một lần)
```bash
# SSH vào VPS mới (root)
apt-get update && apt-get -y install docker.io docker-compose-plugin git curl
systemctl enable --now docker
mkdir -p /opt/ai-commerce && cd /opt/ai-commerce
git clone https://github.com/tunglt6-spec/ai-commerce-platform.git .
```

## 2. Bí mật & môi trường (QUAN TRỌNG — làm đúng để không mất dữ liệu mã hoá)
Copy **nguyên xi** `deploy/.env.prod` từ VPS cũ sang VPS mới (KHÔNG gõ lại tay, KHÔNG dán vào chat):
```bash
# từ máy local, ví dụ:
scp root@<OLD_VPS>:/opt/ai-commerce/deploy/.env.prod /tmp/.env.prod
scp /tmp/.env.prod root@<NEW_VPS>:/opt/ai-commerce/deploy/.env.prod
rm /tmp/.env.prod
```
- **`INTEGRATION_ENC_KEY` PHẢI giống hệt** — nếu đổi, toàn bộ token tích hợp/Shopee đã mã hoá (AES-256-GCM) sẽ **không giải mã được** → user phải kết nối lại Shopee.
- `POSTGRES_USER/PASSWORD/DB` giữ nguyên để khớp bản dump.
- `JWT_ACCESS_SECRET/REFRESH_SECRET`: nếu giữ nguyên → phiên đăng nhập không đứt; nếu đổi → mọi user phải đăng nhập lại (chấp nhận được, nhưng nên giữ nguyên).
- `SHOPEE_REDIRECT_URL` theo **domain** (`store.picklefund.uk`) nên **không đổi** khi giữ domain → không cần đăng ký lại app Shopee.

## 3. Di chuyển DỮ LIỆU (DB + uploads)

### 3a. Backup trên VPS cũ
```bash
cd /opt/ai-commerce
# DB (tên container co-host là ai-commerce-db):
docker exec ai-commerce-db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /root/aicp_db.sql.gz
# Uploads (volume aic_uploads):
docker run --rm -v aic_uploads:/data -v /root:/backup alpine tar czf /backup/aicp_uploads.tar.gz -C /data .
ls -lh /root/aicp_db.sql.gz /root/aicp_uploads.tar.gz
```
> Nạp `$POSTGRES_*` bằng `set -a; source deploy/.env.prod; set +a` trước khi chạy.

### 3b. Chuyển sang VPS mới
```bash
scp root@<OLD_VPS>:/root/aicp_db.sql.gz  root@<NEW_VPS>:/root/
scp root@<OLD_VPS>:/root/aicp_uploads.tar.gz root@<NEW_VPS>:/root/
```

### 3c. Khôi phục trên VPS mới
```bash
cd /opt/ai-commerce
set -a; source deploy/.env.prod; set +a
export IMAGE_TAG=latest
# 1) Dựng riêng Postgres trước (compose đích ở mục 4):
docker compose --env-file deploy/.env.prod -f deploy/compose.newvps.yml up -d postgres
sleep 15
# 2) Nạp DB:
gunzip -c /root/aicp_db.sql.gz | docker exec -i commerce_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
# 3) Nạp uploads vào volume:
docker run --rm -v uploads:/data -v /root:/backup alpine sh -c "cd /data && tar xzf /backup/aicp_uploads.tar.gz"
```
> Tên container/volume ở compose standalone là `commerce_postgres` / `uploads` (khác co-host `ai-commerce-db` / `aic_uploads`).

## 4. Compose đích (standalone + GHCR + Caddy)
Dùng `deploy/compose.newvps.yml` (kéo image GHCR, không build). TLS 2 lựa chọn:
- **(Khuyến nghị) Cloudflare Origin cert** — giữ Cloudflare proxied, Caddy dùng cert Origin (`tls`), như hiện tại.
- **Let's Encrypt** — nếu để DNS-only, Caddy tự xin cert (Caddyfile hiện có sẵn).

Khởi động toàn bộ:
```bash
cd /opt/ai-commerce
export IMAGE_TAG=latest
docker compose --env-file deploy/.env.prod -f deploy/compose.newvps.yml pull
docker compose --env-file deploy/.env.prod -f deploy/compose.newvps.yml up -d
docker compose -f deploy/compose.newvps.yml ps
```
Backend chạy **Prisma migrate lúc boot** → schema tự khớp với image mới.

## 5. Kiểm chứng TRƯỚC khi đổi DNS (không downtime)
Test VPS mới bằng IP trực tiếp, giả lập domain:
```bash
# từ máy local:
curl -k --resolve store.picklefund.uk:443:<NEW_VPS_IP> https://store.picklefund.uk/api/v1/health
curl -k --resolve store.picklefund.uk:443:<NEW_VPS_IP> https://store.picklefund.uk/login -o /dev/null -w "%{http_code}\n"
```
Kiểm: health 200, login 200, đăng nhập thử, vài màn chính, dữ liệu hiển thị đúng (đơn/sản phẩm/khách hàng), Shopee status.

## 6. Cutover (giảm downtime tối đa)
Để **không mất dữ liệu** phát sinh giữa lúc backup và cutover, lấy dump lần cuối sát giờ đổi:
1. Đặt VPS cũ ở chế độ đọc/tạm dừng ghi (hoặc chấp nhận cửa sổ ngắn): `docker stop ai-commerce-api` trên VPS cũ (frontend vẫn hiện, nhưng chặn ghi mới).
2. Dump lần cuối (3a) → chuyển (3b) → nạp đè (3c) trên VPS mới.
3. **Cloudflare → DNS → sửa bản ghi A `store` → IP VPS mới** (giữ Proxied ☁️, TTL Auto). Lan truyền qua edge Cloudflare gần như tức thì.
4. Kiểm chứng như mục 5 nhưng bỏ `--resolve` (dùng DNS thật).
5. Giữ VPS cũ nguyên trạng **24–48h** để rollback.

**Downtime dự kiến:** chỉ vài phút (thời gian dump-cuối + đổi DNS). Nếu chấp nhận trùng dữ liệu = 0 mất mát nhưng có cửa sổ ghi ngắn.

## 7. Cập nhật CI/CD trỏ về VPS mới
GitHub → repo → **Settings → Secrets and variables → Actions**:
- `VPS_HOST` → IP/host VPS mới
- `VPS_USER`, `VPS_PASSWORD` (hoặc chuyển sang **SSH key** — khuyến nghị), `DEPLOY_PATH=/opt/ai-commerce`
- (Nếu dùng key: thêm `VPS_SSH_KEY` và sửa `deploy.yml` dùng `key:` thay `password:`.)

Sau đó `deploy/vps-deploy.sh` cần trỏ compose đích: đặt `COMPOSE_FILE=deploy/compose.newvps.yml` (biến môi trường) hoặc cập nhật mặc định. Chạy thử 1 deploy để xác nhận pipeline mới xanh.

## 8. Bảo mật/hạ tầng cần làm lại trên VPS mới
- **H21 Cloudflare-only ingress** (chống giả mạo IP throttle): chạy `deploy/security/gen-cloudflare-allow.sh` hoặc `docker-user-cloudflare.sh` — xem `docs/security/pentest/CLOUDFLARE-INGRESS-RUNBOOK.md`.
- **Firewall**: chỉ mở 22 (SSH, nên giới hạn IP), 80/443 (chỉ Cloudflare). DB không expose host.
- **Backup định kỳ**: cron `deploy/backup.sh` (đổi tên container về `commerce_postgres`).
- **Cảnh báo đĩa**: cron cảnh báo khi `/` > 85% (tránh lặp sự cố 502 đầy đĩa). Script `vps-deploy.sh` đã tự prune image cũ.

## 9. Dọn dẹp (chỉ sau khi ổn định vài ngày)
- Trên VPS cũ: `docker compose -f deploy/compose.vps.yml down` (giữ volume vài ngày), gỡ vhost `commerce.conf` khỏi `picklefund-nginx`, ngắt `commerce-net`.
- Xoá backup tạm `/root/aicp_*.gz` sau khi xác nhận.

---

## Checklist rủi ro
- [ ] `.env.prod` copy nguyên xi (đặc biệt `INTEGRATION_ENC_KEY`).
- [ ] Dump DB + uploads đầy đủ, kích thước hợp lý.
- [ ] VPS mới test OK bằng `--resolve` TRƯỚC khi đổi DNS.
- [ ] Cloudflare vẫn Proxied, TLS mode khớp (Full/Full-strict).
- [ ] VPS cũ giữ nguyên để rollback 24–48h.
- [ ] CI secrets đã trỏ VPS mới; deploy thử xanh.
- [ ] Bật lại H21 + firewall + backup cron + cảnh báo đĩa.
