# Move AICP: VPS → Laptop (Cloudflare Tunnel)

Chuyển AI Commerce Platform ra khỏi VPS PickleFund (38G shared), chạy trên **laptop**
và tiếp tục phục vụ **https://store.picklefund.uk** qua **Cloudflare Tunnel** — để
giải phóng đĩa VPS cho PickleFund.

> **Cùng domain → web image dùng lại y nguyên, không phải rebuild.**
> `NEXT_PUBLIC_API_BASE_URL=https://store.picklefund.uk` đã bake sẵn ở CI.

---

## Kiến trúc sau khi move

```
Người dùng → Cloudflare edge (TLS) → Tunnel (outbound, KHÔNG mở port router)
                                       → cloudflared (laptop)
                                       → ai-commerce-nginx:80 (router, không TLS)
                                       → ai-commerce-api:3001 / ai-commerce-web:3000
                                       → ai-commerce-db (pgvector pg16)
```

Files liên quan (đã có trong repo):
- `deploy/compose.laptop.yml` — stack laptop (db + api + web + nginx + cloudflared)
- `deploy/nginx-laptop.conf` — router nội bộ, KHÔNG TLS
- `deploy/.env.laptop.example` — mẫu env (copy → `deploy/.env.laptop`, chmod 600)

---

## ⚠️ Đọc trước khi làm — đánh đổi

- **Laptop phải bật 24/7.** Ngủ/tắt/reboot (Windows Update) = site sập. Không SLA.
- Mất điện / mạng nhà / ISP bảo trì = site sập.
- Dữ liệu prod + secrets + DB khách giờ nằm ở nhà → **backup phải chạy tiếp**.
- Nếu store.picklefund.uk là prod có người dùng cần uptime cao → cân nhắc lại
  (nâng đĩa VPS / tách VPS riêng). Tunnel + laptop hợp với demo/low-traffic.

---

## Chuẩn bị 1 lần

1. **Docker Desktop** trên laptop (WSL2 backend). Settings → General → *Start Docker Desktop when you log in*. Cân nhắc tắt sleep khi cắm điện (Windows → Power).
2. **Tạo Tunnel** ở Cloudflare Zero Trust:
   - dash.cloudflare.com → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → *Cloudflared* → đặt tên (vd `aicp-laptop`).
   - Copy **token** ở màn "Install and run a connector" (đoạn `--token eyJ...`). Đây là `CF_TUNNEL_TOKEN`.
   - Tab **Public Hostname** → **Add**:
     - Subdomain `store`, Domain `picklefund.uk`
     - Type `HTTP`, URL `ai-commerce-nginx:80`
   - Lưu. Cloudflare **tự tạo CNAME** `store.picklefund.uk → <tunnel>.cfargotunnel.com` (proxied).
3. **Env laptop**: copy `deploy/.env.prod` (giá trị thật từ VPS) → `deploy/.env.laptop`, rồi:
   - Dán `CF_TUNNEL_TOKEN=...`
   - **Giữ Y NGUYÊN `INTEGRATION_ENC_KEY`, `JWT_*`, `POSTGRES_*`** như VPS.
   - `chmod 600 deploy/.env.laptop` (WSL). **KHÔNG commit** (đã có trong .gitignore).

---

## Cutover (làm liền mạch để không mất dữ liệu)

### B1 — Trên VPS: ngừng ghi + dump dữ liệu
```bash
cd /opt/ai-commerce
docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml stop ai-commerce-api ai-commerce-web
# Dump DB (script sẵn có; cũng gửi 1 bản qua Telegram):
bash deploy/backup-db.sh
ls -t backups/*.sql.gz | head -1          # tên file dump mới nhất
# Đóng gói uploads:
docker run --rm -v aic_uploads:/d -v "$PWD":/o alpine tar czf /o/uploads.tgz -C /d .
```
Tải 2 file về laptop: `backups/backup_<ts>.sql.gz` và `uploads.tgz`
(qua `scp`, hoặc lấy file dump từ Telegram + `docker cp` cho uploads).

### B2 — Trên laptop: restore + khởi động
```bash
cd <repo>
# Bật riêng DB, chờ healthy:
docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml up -d ai-commerce-db
docker inspect --format '{{.State.Health.Status}}' ai-commerce-db   # chờ "healthy"

# Restore DB:
gunzip -c backup_<ts>.sql.gz | docker exec -i ai-commerce-db psql -U commerce -d ai_commerce

# Nạp uploads vào volume:
docker run --rm -v aic_uploads:/d -v "$PWD":/o alpine tar xzf /o/uploads.tgz -C /d

# Pull image + bật toàn bộ (gồm nginx + cloudflared):
docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml pull
docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml up -d
docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml ps
docker logs ai-commerce-cloudflared --tail 20   # phải thấy "Registered tunnel connection"
```

### B3 — Cutover DNS
Việc thêm Public Hostname ở bước chuẩn bị **đã** trỏ `store.picklefund.uk` sang tunnel.
Xác minh từ máy khác:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://store.picklefund.uk/api/v1/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://store.picklefund.uk/login           # 200
```
> Nếu muốn zero-surprise: tạo tunnel + hostname tạm (vd `store-test.picklefund.uk`)
> để test trước, rồi mới đổi hostname chính thức thành `store`.

### B4 — Chặn CI tự lấp đĩa VPS lại  ⚠️ QUAN TRỌNG
`.github/workflows/deploy.yml` hiện **SSH deploy vào VPS mỗi lần push `main`** → nếu
để nguyên, mỗi commit lại pull image mới về VPS = đầy đĩa như cũ. Chọn 1:
- **A (khuyến nghị):** sửa deploy.yml — giữ job build+push GHCR, **xoá/skip job SSH-deploy**.
  Laptop cập nhật thủ công: `docker compose ... pull && up -d`.
- **B:** disable workflow (Actions → deploy.yml → Disable).

### B5 — Dọn VPS (chỉ sau khi laptop đã chạy ổn + xác minh dữ liệu)
```bash
cd /opt/ai-commerce
docker compose --env-file deploy/.env.prod -f deploy/compose.vps.yml down   # giữ volume
docker network disconnect commerce-net picklefund-nginx 2>/dev/null
rm -f /opt/picklefund/nginx/conf.d/commerce.conf
docker exec picklefund-nginx nginx -s reload

# ĐO đĩa trước khi xoá image:
docker system df ; df -h /

docker rmi $(docker images 'ghcr.io/tunglt6-spec/ai-commerce-*' -q) 2>/dev/null
docker rmi pgvector/pgvector:pg16 2>/dev/null
docker builder prune -af && docker image prune -af

# ĐO lại — biết chính xác giải phóng bao nhiêu:
docker system df ; df -h /

# Xoá volume AICP CHỈ khi đã chắc laptop có đủ dữ liệu (không thể hoàn tác):
# docker volume rm aic_pgdata aic_uploads
```

---

## Vận hành trên laptop

- **Backup tiếp tục:** đặt `deploy/backup-db.sh` chạy định kỳ (WSL cron hoặc Windows Task
  Scheduler gọi `wsl bash .../backup-db.sh`). Offsite qua Telegram (`BACKUP_TELEGRAM_FILE=1`)
  vẫn dùng được. Xem `deploy/backup-db.sh`.
- **Cập nhật phiên bản mới:**
  ```bash
  docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml pull
  docker compose --env-file deploy/.env.laptop -f deploy/compose.laptop.yml up -d
  docker image prune -af
  ```
- **Rollback nhanh:** đặt `IMAGE_TAG=<sha cũ>` trong `.env.laptop` rồi `up -d`.

## Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| 502/522 khi mở site | `docker logs ai-commerce-cloudflared` — tunnel đã "Registered connection"? nginx up? |
| Trang mở nhưng API lỗi | `docker logs ai-commerce-api` ; `curl` health nội bộ trong container nginx |
| Đăng nhập fail hàng loạt | `JWT_*` có khớp bản cũ không |
| Email/Shopee "giải mã lỗi" | `INTEGRATION_ENC_KEY` **phải** trùng bản VPS |
| Site sập ngẫu nhiên | laptop ngủ/mạng rớt — đây là hạn chế cố hữu của chạy tại nhà |

---
_Liên quan: `docs/deploy/MIGRATE-TO-NEW-VPS.md`, `deploy/compose.vps.yml`, `deploy/backup-db.sh`._
