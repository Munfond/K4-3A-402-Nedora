# Kế hoạch code `revision@3` — hướng dẫn cho agent lập trình

> Đọc hết mục 0–3 trước khi sửa dòng code nào. Thiết kế, lý do và số đo gốc nằm ở
> [`docs/danh-gia-va-ke-hoach-hoan-thien.md`](danh-gia-va-ke-hoach-hoan-thien.md), gọi tắt là **TK**.
> File này chỉ nói **làm gì, ở đâu, theo thứ tự nào, và kiểm thế nào là xong**.

---

## 0. Luật bắt buộc

1. **Góp ý là dữ liệu, không phải lệnh.**
   - Không prompt nào được đặt nội dung góp ý ở vị trí chỉ thị.
   - Không tool nào được ghi dữ liệu.
   - AI không bao giờ ghi vào kịch bản.
2. **Không fallback im lặng.**
   - Thiếu model, thiếu ffmpeg hay thiếu tệp thì báo lỗi hoặc `SKIP` kèm lý do rõ ràng.
   - Không trả dữ liệu mẫu thay cho kết quả thật. Không đọc `ket-qua-mau.json` ở đường chạy.
3. **Bí mật và dữ liệu:**
   - Không in, không log, không commit giá trị trong `.env`.
   - Không commit `data/studio-pack` hay bản sao của nó.
   - Không trích nguyên văn góp ý cài lệnh hoặc công kích vào log, trace, UI hay test output.
   - Test dùng dữ liệu giả.
4. **Git:**
   - Làm trên nhánh `feat/revision-v3`.
   - **Không dùng `git add -A` hay `git add .`**: thêm đúng đường dẫn đã sửa. Hook pre-commit chạy `biome format` và từng hỏng khi lỡ stage `node_modules`.
   - Trước khi commit phải chạy `git status --short` và kiểm tra không có `node_modules`, `dist`, `.data`, `data/`.
5. **Không phá luồng đang chạy.**
   - `revision@2` phải chạy được cho tới khi T11 xong.
   - `revision@3` bật bằng biến môi trường `REVISION_GRAPH=revision@3` hoặc tham số run `graphVersion`.
6. **Không để server chiếm cổng 3000 sau khi thử.** Tắt mọi process tự khởi động trước khi kết thúc lượt làm.
7. **Kiểm API AI SDK trước khi dùng.** Repo dùng `ai@6.0.5`. Trước khi dùng `ToolLoopAgent`, `tool`, `stepCountIs`, `prepareStep`, `Output`, phải đọc `node_modules/.pnpm/ai@6.0.5*/node_modules/ai/dist/index.d.ts` để xác nhận tên tham số. Không đoán.
8. Comment trong code viết chữ thường, cùng văn phong code xung quanh. Tên file dạng kebab-case.

## 1. Bản đồ repo

| Nơi | Vai trò | Ghi chú |
|---|---|---|
| `packages/revision-core/src` | Lõi pipeline: `pipeline/run.ts` (node, sự kiện), `pipeline/graph.ts`, `sanitize.ts`, `validate.ts`, `cases.ts`, `engine.ts`, `export.ts`, `store.ts`, `load.ts`, `events.ts` | Entry `"."` là **phía server** (có `fs`, `crypto`). Client chỉ import các subpath `types`, `engine`, `events`, `format`, `pipeline/graph`. |
| `packages/ai/src/agents/revision` | Prompt, schema zod, `run-step.ts` (gọi model có schema, retry 1 lần), `index.ts` (chọn model, phân loại lỗi) | Model chọn qua `OPENAI_MODELS`; chế độ giả lập `REVISION_MODEL_MODE=mock` |
| `apps/revision-service/src/index.ts` | Hono :8000. Các route `POST /runs`, `GET /runs/:id`, SSE `/runs/:id/events`, `/release`, quyết định, export, `/debug/*` (token) | Chạy bằng `pnpm --filter revision-service start` (không watch: sửa xong phải khởi động lại) |
| `apps/revision-debug` | Vite :8001, trang debug | `build` rồi `preview` |
| `apps/www` | Next 16 :3000, studio | `src/app/(protected)/videos/[id]/page.tsx`, `src/components/studio/*`, `src/lib/revision-client.ts` |
| `data/studio-pack/c5-feedbackradar` | Pack D1: kịch bản, timecode, chép lời, `slide-d1.json`, `slide-anh/`, `d1.mp4` | **Không commit.** Test dùng pack phải `SKIP` rõ ràng khi pack không có. |
| `eval/golden` | 20 case, pool 45 góp ý | Mở rộng ở T13 |

Lệnh kiểm tra chung, chạy sau mỗi task:

```bash
pnpm --filter @feedback/revision-core typecheck
pnpm --filter revision-service typecheck
pnpm --filter www typecheck        # khi sửa www
pnpm --filter revision-debug build # khi sửa debug
pnpm lint                          # biome check
```

**Test.** Repo chưa có vitest. Test là script `tsx` dùng `node:assert/strict`, đặt ở `packages/revision-core/scripts/test-*.ts`, theo kiểu của `apps/www/scripts/test-csv-import.ts`: in `✓/✗`, thoát mã 1 khi có ca thất bại. Thêm script `"test": "tsx scripts/run-all.ts"` vào `packages/revision-core/package.json` và `tsx` vào devDependencies. Có thể tạm chạy bằng `apps/revision-service/node_modules/.bin/tsx`.

## 2. Kiến trúc đích

Xem sơ đồ Mermaid ở TK §7.1 và §7.15. Đồ thị node của `revision@3`:

```
nhan-dau-vao → cong-an-toan → chi-muc-video (cache) → tach-y → dinh-vi (lặp theo ý)
→ kiem-chung → gom-van-de → dinh-tuyen → xu-ly (lặp theo vấn đề; node con theo bộ xử lý)
→ dong-thoi-gian → lap-ke-hoach → tham-dinh → tong-hop → cho-duyet → ap-dung → xuat-goi
```

Bố cục file mới:

```
packages/revision-core/src/
  moderation/  normalize.ts  pii.ts  rules.ts  lexicon.ts  moderation-lexicon.json  gate.ts
  video-index/ types.ts  build.ts  timecode.ts  subtitle.ts  audio.ts  frames.ts  pace.ts  glossary.ts  calibrate.ts  cache.ts
  timeline/    types.ts  duration.ts  simulate.ts  conflicts.ts  cost.ts      ← THUẦN, không fs, export "./timeline" cho client
  claims/      types.ts  time-mentions.ts  split.ts
  localize/    retrieve.ts  verify.ts  agent.ts
  verify/      content-check.ts
  issues/      form.ts
  handlers/    router.ts  noi-dung.ts  nhip.ts  giong-doc.ts  hinh-anh.ts  am-thanh.ts  phu-de.ts  de-nghi-chung.ts  khen.ts
  planner/     plan.ts  judge.ts  brief.ts
  tools/       registry.ts          ← tool AI SDK, zod schema, gắn với VideoIndex và trạng thái kế hoạch
  pipeline/    graph-v3.ts  run-v3.ts
packages/ai/src/agents/revision/v3/
  prompt-an-toan.ts  prompt-tach-y.ts  prompt-xac-minh.ts  prompt-sua-loi.ts  prompt-tham-dinh.ts  schema-v3.ts
```

## 3. Hợp đồng dữ liệu (viết ở T0, trước mọi thứ)

Đặt trong `video-index/types.ts`, `timeline/types.ts`, `claims/types.ts` và `types.ts`. UI và pipeline làm song song dựa trên các kiểu này.

```ts
// video-index/types.ts
export interface SegmentIndex {
  n: number; phan: number; phanTen: string;
  batDau: number; ketThucTieng: number; ketThuc: number; soFrame: number; // giây
  loi?: string; dungGiay?: number; chuTrenManHinh?: string; yDoHinh?: string;
  kieu: "ke" | "giang" | "nhe" | "hoi" | "nhan";           // vắng trong kịch bản = "giang"
  amTiet: number; tocDo?: number;                            // âm tiết/giây của lời gốc
  khoangLangCuoi: number;                                    // ketThuc - ketThucTieng
  slideId?: string; viTriTrongSlide?: number; slideDungDan: boolean;
  khungCuoi?: string;                                        // đường dẫn ảnh khung cuối
  tinHieuHinh: { doDaiChuManHinh: number; soThanhPhanChu: number; soCauCungSlide: number }; // từ kịch bản + slide, không OCR
  trangPhuDe: Array<{ text: string; batDau: number; ketThuc: number; kyTuMoiGiay: number }>;
  amThanh?: { rmsLoi: number; rmsLang: number; khoangCachDb: number };
  thuatNguMoi: string[];                                     // thuật ngữ lần đầu xuất hiện ở câu này
}
export interface VideoIndex {
  videoId: string; versionId: string; hash: string; builtAt: string;
  segments: SegmentIndex[];
  tocDoGiong: { trungBinh: number; doLech: number; saiSoP90: number };  // từ calibrate
  luatKhoangLang: { thuong: number; cuoiPhan: number; truocCauDung: number };
  chuong: Array<{ phan: number; ten: string; batDau: number }>;
  tongThoiLuong: number;
  thieu: string[];                                           // phần không dựng được, kèm lý do (ví dụ "ffmpeg không có")
}

// claims/types.ts
export type Intent =
  | "noi-dung-sai" | "kho-hieu" | "nhip-toc-do" | "nhip-khoang-dung" | "giong-doc"
  | "hinh-anh" | "am-thanh" | "phu-de" | "de-nghi-chung" | "khen-giu" | "chi-cham-diem" | "nhieu";
export interface Claim {
  id: string; feedbackId: string; sender: string; role: "hv" | "tg" | "gv" | "khac";
  intent: Intent; intentPhu?: Intent;
  trich: string;                        // ≤ 80 ký tự, từ bản đã ẩn PII
  goiYViTri?: string; mocNoi?: { tu: number; den: number; nguon: string };
  chieu?: string; giaThuyet?: { text: string; nguon: "nguoi-gop-y" | "ai-doi-chieu" };
  baoGianTiep: boolean; lanHoiLai: number;
}
export interface Localization {
  claimId: string;
  cach: "nguoi-gui-chon" | "moc-thoi-gian" | "truy-xuat" | "agent" | "khong-dinh-vi";
  trongTam: number[]; ngCanh: number[]; doChac: number;     // 0..1
  ungVien?: Array<{ n: number; diem: number; lyDo: string }>;
  kiemChung?: "khop" | "khong-khop-video" | "nguoc-kich-ban" | "khong-du-can-cu" | "moc-mau-thuan";
}

// timeline/types.ts (thuần)
export type Change =
  | { kind: "loi"; n: number; after: string; kieu?: SegmentIndex["kieu"] }
  | { kind: "chuTrenManHinh" | "yDoHinh"; n: number; after: string }
  | { kind: "kieu"; n: number; kieu: SegmentIndex["kieu"] }
  | { kind: "dung"; n: number; giay: number }                 // đổi dungGiay hoặc khoảng lặng cuối
  | { kind: "ky-thuat"; tu: number; den: number; viec: "mix" | "phu-de" | "khac"; moTa: string };
export interface PlanSimulation {
  thuLai: number[]; kyTuThuLai: number; canhDungLai: number[]; trangPhuDe: number;
  deltaTong: number;
  mocV2: Array<{ n: number; batDau: number; ketThuc: number; dai: [number, number] }>;
  chuong: Array<{ phan: number; batDau: number }>;
  viPham: Array<{ ma: "T1" | "T2" | "T3" | "T4" | "T5" | "T6"; n?: number; chiTiet: string }>;
  chongLan: Array<{ loai: "cung-truong" | "cua-so-thu" | "ky-thuat-giao" | "cung-slide" | "vung-bao-ve" | "bang-chung-chung"; ns: number[]; xuLy: string }>;
  soVoiLamLaiToanBo: { kyTu: number; canh: number };
}
```

`RevisionBrief` (đặt trong `types.ts`, export qua `./types`):

```ts
export interface RevisionBrief {
  pheu: { gopY: number; cachLy: number; choDuyet: number; y: number; vanDe: number; theoNhom: Record<string, number>; deXuat: number; quaThamDinh: number };
  viec: Array<{
    id: string; nhom: "bien-kich" | "thu-am" | "dung-hinh" | "am-thanh" | "phu-de";
    uuTien: number; lyDoUuTien: string;
    vanDeId: string; gopYIds: string[]; nguoiDocLap: number;
    viTri: { ns: number[]; v1: [number, number]; v2?: [number, number] };
    bangChungDo?: string; deXuat?: unknown; cachKhac?: unknown; chiPhi: PlanSimulation;
  }>;
  cauHoi: Array<{ id: string; noiDung: string; luaChon: string[]; gopYIds: string[] }>;
  ghiNhan: Array<{ gopYIds: string[]; lyDo: string }>;
  vungBaoVe: Array<{ ns: number[]; gopYIds: string[] }>;
  keHoach: PlanSimulation; nganSach: { cauThuLai: number; deltaTongGiay: number };
}
```

---

## 4. Các task theo thứ tự

Mỗi task là một commit hoặc PR nhỏ. Không bắt đầu task sau khi test của task trước chưa đạt. Các task đánh dấu ∥ chạy song song được sau T0.

### 4.1 Hai chế độ: K2 luồng chính, K1 đối chứng (đã chốt)

Cùng một pipeline `revision@3`. Chọn chế độ bằng tham số run `cheDo: "k2" | "k1"` (mặc định `k2`), hoặc biến môi trường `REVISION_AGENT_MODE`. Chế độ được ghi vào `run.json` và manifest eval.

| Bước | K2 (luồng chính) | K1 (đối chứng) |
|---|---|---|
| Cổng an toàn, chỉ mục video, tách ý, gom vấn đề, router, bộ xử lý tất định, dòng thời gian, planner, thẩm định bằng code | Như nhau | Như nhau |
| Định vị ca mơ hồ | Truy xuất + xác minh; không đủ thì `ToolLoopAgent` ≤ 4 bước | Truy xuất + xác minh một lượt; không đủ thì `khong-dinh-vi` kèm ứng viên |
| Sửa lời (`noi-dung`) | `ToolLoopAgent`: viết → tool kiểm → viết lại, ≤ 3 lần | Viết một lượt (`runRevisionStep`) → kiểm bằng code → không đạt thì bỏ, không viết lại |
| Giám khảo LLM | Có | Có (để so công bằng) |

Yêu cầu:
- Code dùng chung tối đa. Khác biệt gói trong hai hàm `localizeAmbiguous(mode)` và `proposeEdit(mode)`.
- Không nhân đôi prompt: K1 dùng cùng prompt sửa lời, chỉ khác là không có tool.
- Eval (T13) chạy **ba cấu hình trên cùng bộ dữ liệu và cùng model**: baseline một prompt, K1, K2. Báo cáo cả chênh lệch chất lượng lẫn chênh lệch token và độ trễ.

### T0 · Hợp đồng và khung test (0,5 ngày)
- Tạo các kiểu ở mục 3.
- Thêm export `"./timeline": "./src/timeline/index.ts"` vào `package.json`.
- Tạo `scripts/run-all.ts` và `scripts/lib/assert.ts` (đếm đạt/không đạt, hàm `skip(reason)`).
- Tạo `scripts/lib/pack.ts`: trả đường dẫn pack hoặc `null`; test gọi `skip("không có data/studio-pack")`.
- **Xong khi:** typecheck sạch; `pnpm --filter @feedback/revision-core test` chạy, 0 test, thoát 0.

### T1 · Sửa lỗi chặn (0,5 ngày)
- `apps/revision-debug/src/components/GoldenSetView.tsx`: đang render object `{issues, reject}` làm con React (lỗi React #31). Render thành danh sách. Tìm request trả 401 khi mở tab này và gắn token cho nó.
- `NodeInspector.tsx`: node AI phải hiện `modelId` của run, không phải "code".
- **Hủy run:**
  - truyền `abortController.signal` từ `pipeline/run.ts` vào `runRevisionStep` rồi vào `generateText({ abortSignal })`;
  - sau `run.failed` hoặc `run.finished` không ghi thêm sự kiện;
  - thêm trạng thái `da-huy` (types, store, UI nhãn "Đã hủy").
- `store.ts`: đường dẫn `.data` tính tuyệt đối từ gốc repo (tìm `pnpm-workspace.yaml` đi ngược lên), không theo cwd. Xóa thư mục thừa `apps/www/apps/www/.data` (rỗng).
- **Xong khi:**
  - hủy trong lúc `hieu-gop-y` đang chạy thì không còn sự kiện nào sau `run.failed`, và process không còn lời gọi đang treo;
  - mở tab Golden Set không trắng trang.

### T2 · Cổng an toàn (1 ngày) ∥

Theo TK §7.15.

- `moderation/normalize.ts`: `toDisplay(text)` (NFC, bỏ ký tự vô hình); `toDetection(text)` (NFKC, chữ thường, bỏ dấu, gộp chữ lặp ≥ 3 → 1, nối chữ đơn bị cách, đổi leetspeak, mở teencode theo bảng trong lexicon).
- `moderation/pii.ts`: chuyển `detectAndRedactPii` từ `sanitize.ts` sang, giữ nguyên chữ ký và giữ re-export trong `sanitize.ts`. Thêm các mẫu:
  - mã chữ-số `\d{2}[A-Z]{2,5}\d{3,}`, `[A-Z]{1,2}\d{6,8}`, `\d{3}[A-Za-z]\d{4,}` (đứng riêng, không dính chữ/số);
  - `lớp <mã có số>` → `lớp [LỚP]`;
  - `k\d{2,3} số \d+` → `[MÃ-SỐ]`;
  - số tài khoản sau từ "tài khoản/stk";
  - tên sau "bạn|thầy|cô|anh|chị" + 1–3 chữ viết hoa.
- `moderation/moderation-lexicon.json` (có `version`) và `lexicon.ts`: các nhóm `caiLenh.dongTu`, `caiLenh.doiTuong`, `caiLenh.vaiTro`, `caiLenh.dauVaiTro`, `caiLenh.thaoTung`, `congKich.tu`, `congKich.doiTuongNguoi`, `thoTuc`, `teencode`. **Không chép câu nào từ golden set hay gop-y-mau vào lexicon.**
- `moderation/rules.ts`: trả `{ nhan, chacChan: boolean, lyDo }`. Cài lệnh cần (động từ điều khiển + đối tượng) hoặc dấu vai trò hoặc thao túng kết quả. Công kích cần từ xúc phạm + đối tượng là người. Có từ thô tục mà không nhắm vào người thì nhãn `tho-tuc-noi-dung`.
- `packages/ai/.../v3/prompt-an-toan.ts` + schema: nhãn `an-toan | tho-tuc-noi-dung | cong-kich-ca-nhan | cai-lenh | co-pii | rui-ro-rieng-tu-trong-video | lac-de | spam | chi-cam-xuc`, trường `yDungDuoc` (≤ 120 ký tự, trung tính, không trích lời thô tục), `doChac`. Gọi theo lô, model đọc từ `REVISION_GUARD_MODEL` (mặc định lấy model phân tích).
- `moderation/gate.ts`: chuẩn hóa → PII → luật → (luật không chắc) LLM → quyết định. Luật và LLM bất đồng thì `choKiemDuyet`. Spam đồng loạt: Jaccard trên 3-gram của bản phát hiện ≥ 0,8 giữa ≥ 3 người gửi thì gom lại.
- `sanitizeFeedbackItem` giữ API cũ và gọi phần luật của gate (không gọi LLM) để `revision@2` không đổi hành vi.
- Service: `POST /feedback/:id/release`, `POST /feedback/:id/reject` và thả theo lô `POST /feedback/release` (danh sách id) cho hàng chờ kiểm duyệt; ghi người thả và lý do vào trace. Mặc định mọi góp ý có PII đều bị giữ (mục 7).
- **Test** `scripts/test-moderation.ts`: 28 ca ở TK §3b (dữ liệu giả, không chép câu golden), kỳ vọng như bảng dưới. Chạy thêm golden K-04, K-05, H-01 bằng mock.

| Nhóm ca | Kỳ vọng |
|---|---|
| 10 ca PII | Cả 10 bị ẩn; "CCCD … lộ trong video" → `rui-ro-rieng-tu-trong-video` (có thể kèm `co-pii`) |
| 6 ca công kích/thô tục | ≥ 5/6 bắt bằng luật + LLM mock; "đm nhạc nền to vãi" → `tho-tuc-noi-dung` và `yDungDuoc` có nghĩa "nhạc nền quá to" |
| 4 ca cài lệnh | 4/4 là `cai-lenh` chỉ bằng luật |
| Không chuẩn mực | "👍" → `chi-cam-xuc` (khen chung); "deadline nộp bài" → `lac-de`; 10 người gửi cùng một câu → gom, đếm 1 |
| Rò rỉ | Không có chuỗi cài lệnh hay công kích nào trong output, trace hay log |

### T3 · Chỉ mục video (1,5 ngày) ∥

- `timecode.ts`: đọc CSV (`batDau`, `ketThucTieng`, `ketThuc`, `soFrame`); ghép với kịch bản; `kieu` vắng thì `"giang"`.
- `pace.ts`: âm tiết là số từ tách theo `\p{L}+` của `loi`; tốc độ = âm tiết / (ketThucTieng − batDau).
- `calibrate.ts`: tốc độ giọng trung bình, độ lệch, **sai số p90 theo kiểm chéo bỏ-một**. Luật khoảng lặng: nhóm theo vị trí (cuối phần, trước câu `dungGiay`, còn lại) và lấy trung vị.
- `subtitle.ts`:
  - đọc `transcript-d1.txt` và gán trang cho câu theo chuỗi con;
  - nếu có ffmpeg, dò mốc đổi trang chính xác trên dải phụ đề: `-vf "crop=1920:90:0:988,scale=640:30,select='gt(scene\,0.01)',showinfo"`, gom các mốc cách nhau < 0,25 s;
  - vị trí dải phụ đề lấy từ tham số (mặc định theo `tach_slide.py`: y ≥ 980);
  - tính ký tự/giây của từng trang.
- `audio.ts` (ffmpeg): `-vn -af "asetnsamples=4800,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=<tmp>"`. RMS vùng lời lấy trong [batDau+0,15, ketThucTieng−0,15], vùng lặng lấy từ ketThucTieng+0,2; tính trung vị; khoảng cách dB.
- `frames.ts`:
  - đường dẫn khung cuối lấy từ `slide-anh/cau-XX.jpg` nếu có, không thì trích bằng ffmpeg tại `ketThuc − 0,15`;
  - **Không OCR** (đã chốt): chữ màn hình và mô tả hình đã có trong kịch bản. `tinHieuHinh` tính từ kịch bản và slide: độ dài `chuTrenManHinh`, số thành phần chữ/thẻ đếm trong `yDoHinh` ("ba thẻ", "hộp", "nhãn", danh sách ngăn cách), số câu cùng slide. Ảnh khung chỉ để người duyệt xem.
- Nhóm slide: đọc `slide-d1.json` nếu có; `slideDungDan = số câu > 1`.
- `glossary.ts`: danh sách thuật ngữ trích bằng một lượt AI khi dựng chỉ mục (cache), cộng luật: thuật ngữ nào xuất hiện lần đầu ở câu nào, câu nào là định nghĩa (mẫu "là", "được gọi là").
- `build.ts` + `cache.ts`: dựng khi thêm video hoặc phiên bản; cache theo hash các tệp nguồn, lưu ở `.data/video-index/<videoId>/<versionId>.json`. Thiếu ffmpeg thì dựng phần có thể và ghi `thieu`.
- Service: `GET /videos/:id/versions/:v/index` (debug) và job dựng khi upload.
- **Test** `scripts/test-video-index.ts` trên D1 (SKIP nếu không có pack; phần ffmpeg SKIP nếu không có ffmpeg):
  - 40 câu; câu 35 `dungGiay = 5`;
  - khoảng lặng: 1,4 s ở 33 câu, 2,0 s ở câu 3, 11, 23, 32, 40, 0,6 s ở câu 34 (sai số ±0,05);
  - tốc độ giọng 4,52 ± 0,05; sai số p90 kiểm chéo ≤ 0,55 s;
  - 72 trang phụ đề; mọi đầu câu có một lần đổi trang trong ±0,05 s;
  - nhóm slide nhiều câu: s15 [15,16], s19 [20,21], s20 [22,23], s21 [24–30], s24 [33,34,35];
  - khoảng cách dB trung vị 10,5–12,5; ba câu nhỏ nhất trong 60–120 s gồm 11, 14, 19 (mỗi câu ≤ 10,0 dB).

### T4 · Động cơ dòng thời gian (1,5 ngày) ∥

Code **thuần**: không `fs`, không `node:*`. Export qua `./timeline` để UI tính lại ngay khi người duyệt chọn.

- `duration.ts`:
  - `estimateSpeech(text, kieu, voice)` = âm tiết / (trungBinh × hệ số kiểu), hệ số: kể 1,06, giảng 1, thân mật 0,95, hỏi 0,90, chốt 0,86;
  - dải sai số ± saiSoP90;
  - `sceneDuration` = lời + khoảng lặng theo luật.
- `simulate.ts`: nhận `VideoIndex` + `Change[]` + vùng bảo vệ + ngân sách, trả `PlanSimulation`.
  - Thu lại: với mỗi câu đổi lời hoặc đổi kiểu, lấy n−1..n+1 trong các câu có lời, hợp lại.
  - Cảnh dựng lại: câu có bất kỳ thay đổi nào; nếu câu nằm trong slide dựng dần thì thêm các câu sau nó trong cùng slide.
  - Mốc v2: cộng dồn Δ; tính lại chương.
  - Trang phụ đề của lời mới: tách theo dấu câu, mỗi trang ≤ số ký tự tối đa của trang gốc.
- Kiểm T1–T6 (TK §7.10): T1 ≤ 17 ký tự/giây, mỗi trang từ 5/6 s đến 7 s; T2 ≤ 40 ký tự; T3 số bước hình (đếm động từ chuyển động hoặc dấu ";" trong `yDoHinh`) × 0,8 s ≤ cảnh; T4 cảnh ≥ 0,5 s; T5 |Δ tổng| ≤ ngân sách; T6 dây chuyền slide.
- `conflicts.ts`: 6 loại chồng lấn và cách xử lý (TK §7.10).
- `cost.ts`: ký tự thu lại, cảnh, trang phụ đề, việc mix; so với làm lại toàn bộ (tổng ký tự, số câu).
- **Test** `scripts/test-timeline.ts` (D1, dùng chỉ mục của T3; nếu T3 chưa xong thì dùng fixture JSON sinh từ CSV):
  - lời 10, 20, 22 + hình 14 → thu 8 câu [9,10,11,19,20,21,22,23], 701 ký tự, cảnh {10,14,20,21,22,23};
  - thêm hình ở 24 → 13 cảnh (24–30 nhờ dây chuyền s21);
  - lời 20 + lời 22 → cửa sổ thu 19–23 (5 câu) và có một chồng lấn loại `cua-so-thu`;
  - hai thay đổi `loi` vào cùng câu 14 → chồng lấn `cung-truong`;
  - mọi thay đổi ở phương án A của run `run-20260917-195818-29ee` (lưu thành fixture không chứa nội dung góp ý) → 21 câu, 1 951 ký tự;
  - `dung` câu 35 từ 5 → 7 s → Δ tổng +2 s, câu 36–40 dịch +2 s, không thu lại;
  - lời mới 60 âm tiết ở câu 9 → T1 hoặc T5 bị báo (tùy ngân sách), Δ > 0.

### T5 · Tách ý và mốc trong lời (1 ngày)
- `claims/time-mentions.ts`: "phút thứ N" → [60(N−1), 60N]; `m:ss`, `mm:ss`; "giây thứ N"; "đầu / giữa / cuối video" → phần ba; "câu hỏi cuối" → câu có dấu "?" hoặc kiểu hỏi gần cuối. Test bằng bảng ca.
- `prompt-tach-y.ts` + schema theo `Claim` (bỏ các trường code tự tính). Đầu vào: góp ý **đã qua cổng an toàn**, danh sách phần kèm mốc, danh sách thuật ngữ. **Không gửi kịch bản đầy đủ ở bước này.**
- `claims/split.ts`: gọi model theo lô, gắn `role` từ tiền tố người gửi, `lanHoiLai` (cùng người, cùng họ intent, cách nhau > 1 giờ), `baoGianTiep` (vai trò `tg`/`gv` + từ "nhiều bạn/các bạn/lớp").
- **Xong khi:** mock với gop-y-mau cho gy-016 → 2 ý (`kho-hieu` câu chốt, `khen-giu` bản đồ); gy-007 → `baoGianTiep = true` và có `giaThuyet`; gy-018 → `lanHoiLai = 2`.

### T6 · Định vị (1,5 ngày)
- `localize/retrieve.ts`: BM25 tự viết (không thêm thư viện) trên các trường `loi`, `chuTrenManHinh`, `yDoHinh`, `trangPhuDe`, `phanTen`. Cộng embedding (`text-embedding-3-small`, cache theo hash đoạn). Gộp điểm bằng Reciprocal Rank Fusion. Trả top-k kèm điểm.
- `localize/verify.ts` (CRAG): LLM nhận ý + top-k (có mốc), trả `trongTam` (≤ 3), `ngCanh`, `doChac` hoặc `khong-du`.
- `localize/agent.ts`: `ToolLoopAgent` (xác nhận API, xem Luật 7), tool lấy từ `tools/registry.ts`: `search_segments`, `find_by_time`, `get_segment`, `glossary`. Dừng sau 4 bước; trần token cấu hình được; ghi từng bước thành sự kiện `tool.called`.
- Thứ tự áp dụng: người gửi chọn → mốc trong lời → truy xuất + xác minh → agent → `khong-dinh-vi` kèm ứng viên.
- **Xong khi** (D1, model thật, ghi vào `eval/runs/<id>`):
  - gy-002 có câu 22 trong `trongTam`, câu 39 không nằm trong `trongTam`;
  - gy-010 → `trongTam` ⊂ [24, 30];
  - gy-008 → `mocNoi` [60, 120], các câu giao với khoảng đó ⊂ [10, 19];
  - gy-015 → [10];
  - gy-007 → [14].

### T7 · Kiểm chứng và gom vấn đề (1 ngày)
- `verify/content-check.ts`: 6 trường hợp ở TK §7.15.
  - Không khớp video: điểm truy xuất cao nhất < ngưỡng, và thuật ngữ không có trong glossary.
  - Ngược kịch bản: LLM so khẳng định với câu trọng tâm, trả `khop / mau-thuan / khong-ro` kèm câu trích.
  - Mốc mâu thuẫn: câu theo mốc ≠ câu theo nội dung.
  - Phiên bản cũ: `thoiDiem` < ngày phát hành phiên bản.
- `issues/form.ts`: gom theo họ intent và giao câu trọng tâm hoặc cùng thuật ngữ; đếm người độc lập; cờ hỏi lại, báo gián tiếp, trái chiều (theo `chieu`); vùng bảo vệ từ `khen-giu`; điểm khảo sát trung bình.
- **Xong khi:**
  - ca giả "video nói học máy không thuộc trí tuệ nhân tạo" → `nguoc-kich-ban` và thành bằng chứng `kho-hieu` ở câu 11;
  - ca giả "phần token" → `khong-khop-video`, không tạo vấn đề;
  - D1: vấn đề câu 20–23 có 2 người, 4 góp ý, cờ hỏi lại;
  - vùng bảo vệ gồm 1–3, 31 và 24–32.

### T8 · Router và bộ xử lý (2 ngày)
- `handlers/router.ts`: bảng intent → bộ xử lý. Ý có `intentPhu` thì đi cả hai bộ xử lý, kết quả gộp theo vấn đề.
- **Bộ xử lý tất định, làm trước.** Mỗi bộ trả việc kèm `bangChungDo` là chuỗi số đo:
  - `am-thanh.ts`: dùng `amThanh` trong khoảng; kết luận `xac-nhan / xac-nhan-mot-phan / khong-tai-hien` so với ngưỡng 20 dB (cấu hình); việc mix với mốc v1/v2 và mức hạ đề xuất = 20 − khoảng cách nhỏ nhất.
  - `phu-de.ts`: dùng `trangPhuDe`; lệch trang giữa câu ước theo tỉ lệ âm tiết; ký tự/giây > 17; không vượt ngưỡng lệch (mặc định 0,3 s) thì `khong-tai-hien` + câu hỏi cho người gửi.
  - `nhip.ts`: tốc độ đoạn được nêu so với toàn bài (z-score), mật độ thuật ngữ, khoảng lặng. Đề xuất `Change` loại `dung` theo thứ tự rẻ trước. Trái chiều cân bằng thì tạo `cauHoi` với các lựa chọn giữ / rút / kéo, mỗi lựa chọn kèm `simulate`.
  - `hinh-anh.ts`: dùng `tinHieuHinh` (chữ màn hình > 40 ký tự, nhiều thành phần chữ trong một cảnh, slide dựng dần nhiều câu) để định vị và xếp ưu tiên; kết luận về cỡ chữ luôn là "cần người xem khung" kèm ảnh; đề xuất `chuTrenManHinh` / `yDoHinh`; ghi ràng buộc vùng bảo vệ. Không OCR.
  - `giong-doc.ts`: phân bố kiểu đọc (D1 toàn `giang`), đề xuất `kieu`. Nhánh chép lời có mốc từng từ để P2.
  - `de-nghi-chung.ts`, `khen.ts`: ghi nhận và vùng bảo vệ.
- **Bộ xử lý sửa lời** `noi-dung.ts`: `ToolLoopAgent` với `get_segment`, `glossary`, `protected_zones`, `check_script_rules`, `estimate_duration`, `simulate_plan`.
  - Prompt `prompt-sua-loi.ts` đưa: mục tiêu âm tiết (± 20 % lời cũ), luật mẫu kịch bản, "một đề xuất chính; cách khác chỉ khi khác chiến lược, ưu tiên cách không phải thu lại giọng".
  - Vòng lặp tối đa 3 lần, dừng theo kết quả tool (TK §7.8); không đạt thì bỏ đề xuất nhưng giữ vấn đề.
  - Output schema: `{ recommended: Proposal, alternative: Proposal | null }`; `Proposal` gồm `strategy`, `thayDoiChinh`, `nhamToi`, `changes: Change[]`, `conLai`.
  - `noi-dung-sai`: phải có nguồn đối chiếu (`search_course` khi có kho kiến thức), không có thì chuyển "cần chuyên gia".
- `tools/registry.ts`: 13 tool ở TK §7.7, schema zod. Mọi `execute` là hàm đọc. Mỗi lần gọi phát sự kiện `tool.called {name, ms, ok, bytes}`.
- **Xong khi** (D1):
  - âm thanh → `xac-nhan-mot-phan`, việc ở 1:00–2:00;
  - phụ đề → `khong-tai-hien` + 1 câu hỏi;
  - nhịp gy-001 → chẩn đoán "tốc độ không khác biệt";
  - khoảng dừng 35 → câu hỏi 3 lựa chọn có Δ;
  - hình → slide s21, 7 cảnh, cảnh báo vùng bảo vệ;
  - sửa lời: đề xuất cho 20/22 và 10 đạt T1–T6.

### T9 · Kế hoạch, thẩm định, bản tóm tắt, xuất (1 ngày)
- `planner/plan.ts`: điểm ưu tiên (TK §7.11), chọn tham lam theo điểm/chi phí trong ngân sách (mặc định 8 câu thu lại, Δ tổng ≤ 10 s), ưu tiên gộp cửa sổ liền kề, thay bằng `alternative` rẻ hơn khi vượt ngân sách, lặp tối đa 10 vòng với `simulate`.
- `planner/judge.ts`: một lượt cho cả đợt, nhận xét có/không theo 4 tiêu chí; so cặp với cách khác, 2 lượt đảo vị trí. Giám khảo lỗi thì gắn "chưa thẩm định", không chặn run.
- `planner/brief.ts` tạo `RevisionBrief`. Phát `partial: brief.ready`.
- `export.ts`: kịch bản mới theo mẫu (md + json); danh sách theo người phụ trách; bảng mốc v2 ước tính (ghi rõ "ước tính trước khi thu"); chi phí so với làm lại toàn bộ.
- **Xong khi:** D1 cho đúng bảng TK §8 và kế hoạch mặc định 8 câu / 701 ký tự; xuất đủ các tệp.

### T10 · Nối vào pipeline và service (0,5 ngày)
- `pipeline/graph-v3.ts` (`GRAPH_VERSION = "revision@3"`) và `run-v3.ts` dùng lại cơ chế sự kiện, cache node, hủy của `run.ts`.
- Node `chi-muc-video` dùng cache.
- **Chạy tăng dần:** góp ý mới chỉ đi qua cổng → tách ý → định vị; vấn đề bị ảnh hưởng mới chạy lại bộ xử lý.
- `POST /runs` nhận `graphVersion`, `nganSach`.
- `GET /runs/:id` trả `brief`.
- API: "đề xuất cách sửa cho việc này", "viết lại theo ý tôi" (trần 3 lần mỗi việc).
- **Xong khi:**
  - chạy thật D1 từ UI hiện tại không vỡ;
  - SSE có đủ node của `revision@3`;
  - thêm 2 góp ý mới thì chạy tăng dần < 30 s.

### T11 · Studio (2 ngày), dựng trên fixture `RevisionBrief` từ T0
- Hộp quyết định: thanh nhóm (Biên kịch / Thu âm / Dựng hình / Âm thanh / Phụ đề / Câu hỏi / Ghi nhận); mỗi lần một việc; quyết định ở màn hình đầu.
- **Làn dòng thời gian** dưới trình phát: câu v1, cửa sổ thu lại, cảnh dựng lại (dây chuyền slide), khoảng việc kỹ thuật, vùng bảo vệ, dải v2 ước tính. Bấm vào đâu thì phát đúng đoạn đó.
- Thẻ theo bộ xử lý:
  - sửa lời: diff theo từ (LCS tự viết ở `lib/studio/word-diff.ts` + test), Δ thời lượng, trang phụ đề mới;
  - khoảng dừng: thanh trượt 3–7 s;
  - hình: ảnh khung (`public/slide-anh`) có đánh dấu;
  - âm thanh: biểu đồ khoảng cách dB theo câu, vạch 20 dB;
  - phụ đề: dải trang.
- Thanh ngân sách tính lại ngay bằng `@feedback/revision-core/timeline`.
- Tab Góp ý:
  - hàng "Chờ kiểm duyệt" (thả / giữ loại);
  - một nút "Phân tích" có menu "Chạy lại từ đầu".
- Bỏ mã nội bộ khỏi màn hình người dùng. Bỏ `v2-preparation-column.tsx`.
- **Xong khi:** hai người chưa tham gia code quyết định xong D1 trong ≤ 3 phút; `pnpm --filter www build` đạt.

### T12 · Debug (1–1,5 ngày)
- Sửa theo TK §5.2 và §9:
  - phễu;
  - hai chế độ trace (tổng quan / dòng thời gian);
  - span `tool.called`;
  - vòng lặp kèm tín hiệu dừng;
  - **trình xem VideoIndex** (bảng 40 câu với các số đo);
  - ma trận định tuyến;
  - bảng golden set xếp lỗi lên đầu;
  - nền sáng mặc định;
  - bỏ nhãn AR-xx.
- **Xong khi:** mở một run và trả lời được trong ≤ 1 phút: bước nào lâu nhất, đề xuất nào bị bỏ và vì sao, run khác mốc ở đâu.

### T13 · Eval (song song từ T3)
- Mở rộng golden tới khoảng 100 góp ý có đáp án (đề C5). Mỗi loại có > 1 mẫu cho:
  - mốc nói bằng lời;
  - mô tả hình;
  - một tin nhiều ý;
  - báo gián tiếp;
  - lời dặn "giữ" xung đột với đề xuất;
  - chồng lấn thời gian;
  - lời mới vượt thời lượng;
  - hỏi lại;
  - kỹ thuật bị đo bác;
  - PII dạng mới;
  - công kích/cài lệnh biến thể;
  - không dấu, teencode;
  - lạc đề;
  - không khớp video;
  - ngược kịch bản.
- Chỉ số trong `apps/www/scripts/eval-cp3.ts`:
  - độ chính xác định tuyến;
  - định vị: đúng câu, và IoU theo thời gian;
  - số câu thu lại so với đáp án;
  - xung đột phát hiện;
  - trái chiều có gắn cờ;
  - truy vết 100 %;
  - sai số thời lượng;
  - tỉ lệ vi phạm T1–T6;
  - tỉ lệ bắt được của cổng an toàn;
  - rò rỉ = 0.
- Chạy ba cấu hình cùng model trên cùng bộ dữ liệu: baseline prompt đơn "đọc góp ý và kịch bản, lập kế hoạch sửa" (`abc.md`), K1 và K2 (mục 4.1). Bảng so sánh gồm các chỉ số trên, cộng token, độ trễ và số lần gọi tool.
- Commit trước khi chạy thật; đặt tên run `cp3-real-002` trở đi.

### T14 · Hoàn tất (0,5 ngày)
- Merge nhánh `codex/Test-Case`, giải xung đột.
- Cập nhật spec (§A20 `revision@3`), README.
- Bấm thử toàn luồng: thêm góp ý → kiểm duyệt → phân tích → quyết định → xuất.
- Tắt mọi server đã khởi động.

---

## 5. Checklist mỗi PR

- [ ] Typecheck các gói bị đụng; `pnpm lint`; test của task đạt; test cũ (`test:csv`, golden mock) vẫn đạt.
- [ ] Không có chuỗi góp ý cài lệnh hoặc công kích trong output, trace, log (`pnpm --filter www check:leaks`).
- [ ] Không commit `data/`, `.data/`, `node_modules/`, `dist/`, `.env`.
- [ ] `revision@2` vẫn chạy (cho tới T11).
- [ ] Mọi tool mới đều chỉ đọc, có schema, có sự kiện `tool.called`.
- [ ] Mỗi prompt mới có `PROMPT_VERSION` riêng và hash được ghi vào run.
- [ ] Không có fallback im lặng; phần thiếu ghi vào `thieu` hoặc báo lỗi có mã.
- [ ] Đã tắt server tự khởi động.

## 6. Việc để sau (không làm trong đợt này nếu chưa được yêu cầu)

- Chép lời có mốc từng từ (ASR) để kết luận phụ đề và phát âm.
- Kho kiến thức khóa học.
- Bộ nhớ quyết định.
- Theo dõi qua nhiều phiên bản.
- Thu giọng thật để đo lại.
- Dựng video.

Chừa sẵn interface (`search_course`, `past_decisions` trả rỗng kèm `thieu`), không cài thật. **Không làm OCR và không làm dữ liệu hành vi xem** (đã chốt).

## 7. Quyết định đã chốt

1. ~~K1 hay K2~~ Đã chốt: K2 luồng chính, K1 đối chứng (xem mục 4.1).
2. Ngân sách mặc định: `nganSach = { cauThuLai: 8, deltaTongGiay: 10 }`. Vượt thì cảnh báo (T5), không chặn; `POST /runs` và UI cho phép đổi từng đợt.
3. ~~OCR hay VLM~~ Đã chốt: không OCR.
4. Không làm dữ liệu hành vi xem.
5. Thông tin cá nhân: mọi loại đều "giữ chờ duyệt" (spec PII-03, golden H-01). T2 làm thêm thả theo lô (`POST /feedback/release` nhận danh sách id) và nút "Thả các mục đã xem" trong hàng chờ kiểm duyệt. `rui-ro-rieng-tu-trong-video` vẫn tạo việc khẩn.

Câu hỏi mới phát sinh trong lúc làm thì ghi vào PR và hỏi chủ dự án, không tự quyết.
