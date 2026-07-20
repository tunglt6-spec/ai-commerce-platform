# Tối ưu đĩa VPS (shared AICP + PickleFund, 38G)

Mục tiêu: **dọn & giữ đĩa gọn dài hạn** mà **KHÔNG ảnh hưởng PickleFund**. Không đổi
kiến trúc (AICP giữ nguyên trên VPS). User chạy lệnh trên VPS (Claude không SSH).

> Nguyên tắc vàng: **đo trước, dọn sau, không bao giờ đụng volume dữ liệu.**
> TUYỆT ĐỐI không dùng `docker system prune --volumes` (xoá DB!).

---

## B0 — ĐO xem đĩa đang đi đâu (chạy trước, để so sánh)

```bash
df -h /                       # tổng quan phân vùng gốc
docker system df              # images / containers / volumes / build cache
docker system df -v | head -60

# Top thư mục ngốn đĩa toàn máy:
sudo du -xhd1 / 2>/dev/null | sort -h | tail -15
sudo du -xhd1 /var/lib/docker 2>/dev/null | sort -h

# Log container (thủ phạm hay bị bỏ quên — json-file mặc định KHÔNG xoay vòng):
sudo du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -h | tail

# Kho image GHCR đang giữ (nhiều tag :sha dồn lại):
docker images 'ghcr.io/tunglt6-spec/*' | sort -k2
```

Ghi lại con số `Avail` của `df -h /` và mục "RECLAIMABLE" của `docker system df`.

---

## B1 — Reclaim an toàn NGAY (không đụng container đang chạy)

```bash
# 1) Build cache — an toàn tuyệt đối, thường thu hồi nhiều nhất:
docker builder prune -af

# 2) Image không gắn với container nào (giữ nguyên image đang chạy của CẢ 2 app):
docker image prune -af

# 3) Network mồ côi:
docker network prune -f

# ĐO lại:
docker system df ; df -h /
```
`-a` xoá cả image có tag nhưng không container nào dùng → gồm các `:sha` cũ của AICP
lẫn PickleFund. **An toàn**: image đang chạy không bị xoá; compose dùng `:latest`/tag
nên nếu cần vẫn pull lại được. **Không** dùng `--volumes`.

Nếu vẫn chật, xoá thủ công tag cũ (giữ bản đang chạy + latest):
```bash
docker images 'ghcr.io/tunglt6-spec/ai-commerce-*' --format '{{.Repository}}:{{.Tag}} {{.ID}}'
docker rmi <IMAGE_ID_cũ> ...        # docker từ chối xoá image đang dùng → an toàn
```

---

## B2 — Log & rác hệ điều hành (an toàn)

```bash
# Cắt gọn container log đang phình (không xoá container):
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log

# systemd journal → giữ 200MB:
sudo journalctl --vacuum-size=200M

# APT cache + gói/kernel thừa:
sudo apt-get clean
sudo apt-get autoremove --purge -y
```

---

## B3 — Fix GỐC để không đầy lại (durable)

### (a) Docker log rotation toàn máy — chống log phình cho CẢ 2 app
Tạo/sửa `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```
```bash
sudo systemctl restart docker      # ⚠ restart CẢ 2 app (downtime ngắn) → làm lúc vắng
```
> Đã áp sẵn ở mức compose cho AICP (`deploy/compose.vps.yml` có khối `logging:`) →
> tự có hiệu lực khi recreate AICP, **không cần** restart docker toàn máy. daemon.json
> là để phủ luôn PickleFund + mọi container khác; làm trong cửa sổ bảo trì.

### (b) PickleFund deploy auto-prune (KHOẢNG TRỐNG đã biết)
AICP đã tự dọn image cũ sau deploy (commit c2ad733). **PickleFund `deploy.yml` CHƯA có**
→ mỗi commit push image mới, tích dần. Thêm vào nhánh success của
`.github/workflows/deploy.yml` (repo PickleFund), sau khi health OK:
```yaml
      - name: Prune old images
        run: docker image prune -af --filter "until=72h" || true
```

### (c) Watchdog đã có
`deploy/security/disk-alert.sh` (cron */15) cảnh báo ≥85%, tự prune ≥92%. Giữ nguyên.

---

## B4 — Giải pháp dài hạn (nghiên cứu — chọn thay cho move-laptop)

| Phương án | Chi phí | Ảnh hưởng PickleFund | Độ ổn định | Ghi chú |
|---|---|---|---|---|
| **Gắn Hetzner Volume (block storage)** rồi chuyển Docker data-root hoặc để backups sang volume | ~€0.44/10GB/tháng | Không (tách I/O) | Cao | **Khuyến nghị**: mở rộng đĩa mà không đổi kiến trúc; churn image không còn ép root disk |
| **Resize server type** (lên bậc RAM/disk lớn hơn) | Tăng theo bậc | Không | Cao | Đơn giản nhất, nhưng trả nhiều hơn cho cả RAM |
| **Tách AICP sang 1 VPS rẻ riêng** (CX22 ~€4/th) | ~€4/tháng | Cách ly hẳn | Cao | PickleFund độc lập hoàn toàn; xem `docs/deploy/MIGRATE-TO-NEW-VPS.md` |
| **Slim image backend** (chỉ prod deps trong runtime) | 0 | Không | TB | Giảm dung lượng image; RỦI RO thiếu runtime dep (bài học undici) → cần test kỹ |
| Move AICP → laptop + Cloudflare Tunnel | 0 | Giải phóng hẳn | **Thấp** (laptop 24/7) | **Đã tạm dừng** theo yêu cầu; file scaffold còn trong repo (chưa commit) |

**Đề xuất:** làm B1–B3 trước (thu hồi ngay + chặn đầy lại). Nếu sau khi dọn vẫn sát
ngưỡng → **gắn Hetzner Volume** cho Docker data-root (dài hạn, rủi ro thấp nhất, không
đụng PickleFund). Tách VPS riêng là bước sau nếu muốn cách ly triệt để.

---

## Cách gắn Hetzner Volume cho Docker (nếu chọn B4-Volume)

```bash
# Sau khi tạo + attach Volume ở Hetzner Console (vd /dev/sdb, đã format ext4, mount /mnt/docker):
sudo systemctl stop docker
sudo rsync -aP /var/lib/docker/ /mnt/docker/
# /etc/docker/daemon.json thêm:  "data-root": "/mnt/docker"
sudo systemctl start docker
docker ps      # xác minh cả 2 app chạy lại từ data-root mới
# Chỉ xoá /var/lib/docker cũ sau khi chắc chắn ổn.
```

---
_Liên quan: `deploy/security/disk-alert.sh`, `docs/deploy/MIGRATE-TO-NEW-VPS.md`,
`docs/deploy/MOVE-AICP-TO-LAPTOP.md` (đã tạm dừng)._
