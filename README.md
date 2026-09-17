# FeedbackRadar (C5) — Nedora

Công cụ biến góp ý của người học thành kế hoạch sửa video bài giảng: gom góp ý thành
**vấn đề**, chỉ rõ vấn đề nằm ở **câu nào, phút nào**, rồi đề xuất cách sửa ít tốn nhất
và tính phải thu lại giọng, dựng lại cảnh những gì.

Đây là bản mock giao diện, fork từ
[`vercel-labs/oss-gtm-feedback`](https://github.com/vercel-labs/oss-gtm-feedback).
Chi tiết về dữ liệu, màn hình và logic: [`apps/www/README.md`](apps/www/README.md).

## Cách chạy

### 1. Cần cài sẵn

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| Node.js | 20 trở lên | `node --version` |
| pnpm | 10 | `pnpm --version` |

Chưa có pnpm thì cài một lần (không cần quyền admin):

```powershell
npm install -g pnpm@10.0.0
```

Cài xong, **mở terminal mới** để lệnh `pnpm` được nhận.

### 2. Cài thư viện

Chạy ở **thư mục gốc** của repo (thư mục chứa file này):

```powershell
pnpm install
```

### 3. Chạy app

```powershell
cd apps\www
pnpm dev
```

Mở http://localhost:3000.

**Không cần file `.env`.** Bản mock không gọi dịch vụ ngoài nào: không đăng nhập,
không database, không AI, không Slack.

### 4. Đi thử luồng demo

1. **Vấn đề** — xem danh sách vấn đề đã xếp ưu tiên.
2. Mở `vd-01` → bấm **Phát lại đoạn này** (video nhảy tới 2:01–2:26) → đọc các góp ý
   gốc tạo ra vấn đề.
3. Bấm **Đồng ý** ở một đề xuất sửa.
4. **Xuất kịch bản** — xem số câu phải thu lại giọng, số cảnh phải dựng lại, rồi bấm
   **Tải kịch bản v2**.

## Lỗi thường gặp

**`pnpm : The term 'pnpm' is not recognized`**
Chưa cài pnpm, hoặc vừa cài mà chưa mở terminal mới. Xem bước 1.

**`Cannot find module ...\node_modules\next\dist\bin\next`**
Thường gặp khi **copy cả thư mục project sang chỗ khác**. pnpm để thư viện ở
`node_modules\.pnpm` của thư mục gốc rồi tạo lối tắt tới từng app; khi copy trên
Windows các lối tắt này bị đứt. Cách sửa: chạy lại `pnpm install` ở thư mục gốc.
Nếu pnpm hỏi xoá `node_modules` để cài lại thì chọn **Y** — thư mục này tạo lại được,
không mất code.

Lần sau muốn chuyển project, chỉ copy code (hoặc `git clone`), **đừng copy
`node_modules`**, rồi chạy `pnpm install`.

**`Unable to acquire lock ... is another instance of next dev running?`**
Đang có một dev server khác chạy (có thể ở thư mục project cũ). Tắt nó
(`Ctrl + C` ở terminal đó) rồi chạy lại.

**Cổng 3000 đã bị chiếm**
Chạy ở cổng khác:

```powershell
pnpm exec next dev -p 3001
```

## Cấu trúc

```
K4-3A-402-Nedora/
├── apps/
│   ├── www/                  # App FeedbackRadar — phần duy nhất cần chạy
│   │   ├── public/video/     # Video d1.mp4 đang bị góp ý
│   │   ├── src/app/          # Các màn hình: van-de, gop-y, xuat
│   │   ├── src/components/c5 # Component riêng của C5
│   │   ├── src/data/         # Kịch bản, mốc thời gian, góp ý (JSON)
│   │   ├── src/lib/mock-data.ts  # Tầng dữ liệu và logic tính phạm vi làm lại
│   │   └── _removed/         # Code gốc của Vercel, giữ để tra cứu
│   └── slack-app/            # Không dùng trong bản mock
├── packages/                 # ai, database, redis — không dùng trong bản mock
└── data/                     # Gói dữ liệu ban tổ chức cấp (không commit)
```
