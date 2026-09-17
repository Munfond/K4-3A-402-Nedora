# FeedbackRadar (C5) — bản mock giao diện

Bản mock cho đề **C5 · FeedbackRadar**: đưa vào góp ý của người học, nhận về danh
sách vấn đề đã chỉ rõ nằm ở câu nào, phút nào, và kế hoạch sửa cho phiên bản sau.

Fork từ [`vercel-labs/oss-gtm-feedback`](https://github.com/vercel-labs/oss-gtm-feedback).
Giữ lại layout, sidebar và bộ component giao diện; thay toàn bộ phần dữ liệu và
nghiệp vụ.

## Chạy

Cần Node.js 20+ và pnpm 10 (chưa có pnpm: `npm install -g pnpm@10.0.0`, rồi mở
terminal mới).

```powershell
# ở thư mục gốc repo
pnpm install

# chạy app
cd apps\www
pnpm dev
```

Mở http://localhost:3000. **Không cần file `.env`** — không có dịch vụ ngoài nào
được gọi.

Gặp lỗi khi chạy (không nhận lệnh `pnpm`, `Cannot find module ... next`, trùng
lock, trùng cổng): xem mục **Lỗi thường gặp** ở [README gốc](../../README.md).

## Đã tắt những gì

| Thành phần | Trạng thái |
|---|---|
| Đăng nhập Google (NextAuth) | Bỏ hẳn. Không có trang `/login`, không có session, không chặn route |
| Database (Postgres + Drizzle) | Bỏ hẳn. Dữ liệu đọc từ JSON tĩnh |
| AI agent (`packages/ai`) | Không gọi tới. Giữ nguyên trong repo để nối lại sau |
| Workflows, cron | Không gọi tới |
| Slack app | Không chạy |
| Upstash Redis / Vector | Không gọi tới |

Code cũ không bị xoá — được chuyển vào `apps/www/_removed/` để tra cứu khi nối lại
agent thật. Thư mục này nằm ngoài `src/app` nên Next không coi là route.

## Dữ liệu

Lấy từ gói `data/studio-pack/c5-feedbackradar/` của ban tổ chức, copy vào app:

| File trong app | Nguồn |
|---|---|
| `public/video/d1.mp4` | `video-mau/d1.mp4` — video thật đang bị góp ý, 4 phút 11 |
| `src/data/kich-ban-d1.json` | `video-mau/kich-ban-d1.json` — kịch bản 40 câu |
| `src/data/cau-timecode-d1.json` | chuyển từ `video-mau/cau-timecode-d1.csv` |
| `src/data/gop-y-mau.json` | `vi-du/gop-y-mau.json` — 18 góp ý mô phỏng |
| `src/data/khao-sat-d1.json` | chuyển từ `vi-du/khao-sat-mau.csv` |
| `src/data/ket-qua-mau.json` | `vi-du/ket-qua-mau.json` — 2 vấn đề mẫu |

**Vấn đề và kế hoạch sửa là dựng tay** (lấy nguyên từ `ket-qua-mau.json` của ban
tổ chức), chưa có agent nào sinh ra chúng.

Tổng **22 góp ý**: 18 góp ý văn bản, cộng 4 dòng chỉ có trong bảng khảo sát
(`gy-019` → `gy-022`).

## Bốn màn hình

1. **`/van-de`** — danh sách vấn đề, xếp theo mức nghiêm trọng rồi số người khác
   nhau nhắc tới.
2. **`/van-de/[id]`** — chi tiết: phát đúng đoạn video, câu trong kịch bản, góp ý
   gốc đã tạo ra vấn đề, và các đề xuất sửa kèm nút Đồng ý / Bỏ.
3. **`/gop-y`** và **`/gop-y/gan-co`** — toàn bộ góp ý theo trạng thái; góp ý bị
   gắn cờ chỉ hiện nhãn, không trích nguyên văn.
4. **`/xuat`** — đề xuất đã đồng ý, phạm vi làm lại, nút tải kịch bản v2.

Quyết định Đồng ý / Bỏ lưu ở `localStorage` (bản mock không có database).

## Hai phần có logic thật

Trong [`src/lib/mock-data.ts`](src/lib/mock-data.ts):

- **`demNguoiKhacNhau()`** — đếm người khác nhau từ `gopYIds`, không nhập tay.
  Một người nhắc ba lần vẫn là một người (`hv-011` gửi `gy-002`, `gy-003`,
  `gy-018` về cùng một chuyện).
- **`tinhPhamViLamLai()`** — đổi lời câu *n* thì phải thu lại giọng cả *n−1*, *n*,
  *n+1*, vì máy đọc lấy câu trước và câu sau làm ngữ cảnh. Đổi ý đồ hình thì chỉ
  dựng lại cảnh, không thu lại giọng.
- **`nhanDienCanhBao()`** — chặn góp ý cài lệnh ẩn (`gy-011`) và công kích cá nhân
  (`gy-012`) trước khi vào phân tích, bằng luật từ khoá.

## Bước tiếp theo

Nối lại agent trong `packages/ai` để tự sinh `vanDe` và `keHoachSua` từ góp ý thô,
thay cho `ket-qua-mau.json` dựng tay. Chữ ký hàm trong `mock-data.ts` giữ nguyên
thì giao diện không phải sửa.
