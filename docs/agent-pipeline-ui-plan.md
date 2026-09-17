# Kế hoạch: pipeline agent theo node, màn chờ có tiến trình, màn đề xuất dạng đồ thị và màn debug cho kỹ sư

> **Đã có kế hoạch thay thế:** `docs/revision-service-debug-plan.md` (tách Revision service, pipeline node cố định kiểu Dify, debug/eval dùng chung pipeline). Mục 1 của kế hoạch đó sửa lại các đánh giá trạng thái sai trong file này; khi hai file khác nhau, **file mới thắng**.

Ngày: 17/09/2026. Bổ sung cho `docs/revision-planner-plan.md` và `docs/revision-planner-spec.md` (Phần A); không thay các yêu cầu C3 đã có. Tên node Dify/n8n dưới đây dùng làm đối chiếu thiết kế, lấy theo hiểu biết của đội, chưa tra lại tài liệu của hai công cụ.

## 0. Tóm tắt

| Việc | Vì sao | Kết quả mong muốn |
|---|---|---|
| Tách tab **Kịch bản chi tiết** thành dữ liệu nguồn thuần | Đồ thị đang hiện vùng sửa, "Đề xuất: …" và vị trí do AI suy ra trước khi người dùng mở tab phân tích | Tab này chỉ trả lời "video v1 đang có gì" |
| Chạy phân tích nền, phát sự kiện theo node | Một lời gọi model ~80 s, người dùng chỉ thấy đồng hồ đếm | Thấy tiến trình thật sau vài giây; thấy danh sách vùng trước khi phương án xong |
| Tách một lời gọi lớn thành đồ thị node | Không có kết quả từng phần, không song song được, một lỗi làm hỏng cả run | Kết quả xuất hiện dần; lỗi khoanh trong một node/vùng |
| Màn **Đề xuất chỉnh sửa** mượn ngôn ngữ hình ảnh của đồ thị kịch bản | Danh sách thẻ khó thấy quan hệ vùng ↔ câu ↔ góp ý ↔ phương án | Nhìn một vùng thấy ngay bằng chứng, câu v1, phương án và việc kéo theo |
| Màn **Debug agent** cho kỹ sư | Hiện chỉ đọc được file JSON trong `.data/revision-runs` | Xem node nối nhau, input/output, retry, thời gian, token, lỗi từng node |

## 1. Hiện trạng lúc lập plan (14:30 ngày 17/09)

Mục này giữ nguyên để đối chiếu. Trạng thái sau khi triển khai P0 ở **mục 6b**; các điểm 1, 2, 3, 5 dưới đây đã xử lý xong.

1. `kich-ban-chi-tiet-tab.tsx` và `script-graph-view.tsx` nhận `cases` của run và `feedbacks` đã được trang video gắn vị trí "AI đề xuất" → đồ thị hiện nút vùng sửa (`rg-35-35`), nhãn "Có vùng sửa", "Đề xuất: Phương án sửa", nối góp ý vào câu theo vị trí AI suy ra.
2. `script-graph-view.tsx:747` ghi cứng `sec.so === 4 ? "🚨 Có vùng sửa" : "Ổn định"`.
3. `POST /api/revisions/analyze` chờ đồng bộ tới khi model trả xong (70–80 s trên D1); trang chỉ hiện "Đang phân tích (79s)…". Tải lại trang giữa chừng là mất trạng thái.
4. Agent gồm **một** lời gọi model sinh toàn bộ nhãn, vấn đề, vị trí, phương án và patch (~15 nghìn token với model suy luận).
5. Link cũ có `run=run-2026[SĐT]-4c49`: `run.json` của các run tạo trước khi sửa bộ lọc PII chứa runId hỏng. Đường đọc đã tự lấy runId từ tên thư mục; cần thêm chuyển hướng khi `run` trong URL không tồn tại (mục 5.1).

## 2. Nguyên tắc tách lớp dữ liệu

| Lớp | Nguồn | Xuất hiện ở tab | Không được xuất hiện ở |
|---|---|---|---|
| **Nguồn v1** | Kịch bản, timecode, transcript, slide (có nhãn "tự sinh, chưa rà tay"), góp ý đã lưu, vị trí **do người gửi chọn** | Xem video, Kịch bản chi tiết, Góp ý | — |
| **Phân tích AI** | Output của run sau kiểm tra bằng code: nhãn, vấn đề, vị trí AI, vùng, phương án | Đề xuất chỉnh sửa, màn chờ, Debug | Xem video, Kịch bản chi tiết |
| **Quyết định người** | Chọn / hoãn / giữ nguyên, báo vị trí sai | Đề xuất chỉnh sửa, Bản sửa | Kịch bản chi tiết |
| **Kỹ thuật** | Prompt, output thô, retry, token, thời gian | Debug | Mọi tab của người dùng cuối (trừ runId, model, tổng thời gian) |

Quy tắc kiểm được: component của tab Xem video / Kịch bản chi tiết KHÔNG nhận prop kiểu `DecisionCase`, `RevisionRunResult` hay `StudioFeedback` có `locationSource = "ai-de-xuat"`. Trang video truyền `video.feedbacks` gốc cho các tab này, còn danh sách đã gắn vị trí AI chỉ truyền cho tab Góp ý (có nhãn nguồn) và tab Đề xuất.

## 3. Đồ thị node

### 3.1 Đối chiếu Dify / n8n

| Vai trò | Dify | n8n | Node ở đây |
|---|---|---|---|
| Bắt đầu / kết thúc | Start, End | Trigger, Respond to Webhook | N1, N11 |
| Bước tất định | Code, Template | Code, Set | N2, N3, N7, N9, N10, N12, N13 |
| LLM có output cấu trúc | LLM, Parameter Extractor, Question Classifier | Basic LLM Chain + Structured Output Parser, Text Classifier | N4, N6, N8 |
| Rẽ nhánh | IF/ELSE | IF, Switch | sau N3 |
| Lặp theo danh sách | Iteration | Loop Over Items | quanh N4, quanh N8 |
| Sửa theo lỗi | Loop | Auto-fixing Output Parser, Retry on Fail | V1→N4, V2→N8 |
| Gộp nhánh | Variable Aggregator | Merge | N10 |
| Chờ người | Human Input | Wait | H |

### 3.2 Sơ đồ

```text
N1 Bắt đầu đợt ─► N2 Nạp ngữ cảnh ─► N3 Làm sạch & chặn ─┬─► (bị loại, chỉ chấm điểm) ───────────────┐
                                                         ▼                                          │
                         ┌── Iteration: lô 8 góp ý, song song ≤3 ──┐                                │
                         │ N4 Phân loại ─► V1 Kiểm tra ─┐          │                                │
                         │      ▲ sửa theo lỗi ≤1 ◄─────┘          │                                │
                         └─────────────────────────────────────────┘                                │
                                                         ▼                                          │
                  N5 Định vị (code trước, LLM phần còn lại) ─► N6 Gom vấn đề ─► N7 Chia vùng ──► sự kiện `cases.ready`
                                                                                      ▼
                         ┌── Iteration: mỗi vùng, song song ≤3 ─────────────┐
                         │ N8 Lập phương án ─► V2 Kiểm tra patch ─┐          │
                         │      ▲ sửa theo lỗi ≤2 ◄───────────────┘          │ ──► sự kiện `options.ready {caseId}`
                         │ N9 Tính việc riêng của phương án                  │
                         └───────────────────────────────────────────────────┘
                                                         ▼
                                      N10 Gộp kết quả ─► N11 Kết thúc ◄────────────────────────────┘
                                                         ▼
                           H Người duyệt ─► N12 Engine bản sửa ─► N13 Xuất gói
                               └─ báo vị trí sai / thêm góp ý ─► chạy lại N4→N9 chỉ cho phần bị ảnh hưởng
```

### 3.3 Hợp đồng dữ liệu từng node

| Node | Loại | Vào | Ra | Khi lỗi |
|---|---|---|---|---|
| N1 Bắt đầu đợt | Code | `videoId, versionId, feedbackIds?, retryOf?` | `runId`, trả `202` ngay | 400 `VIDEO_NOT_ANALYZABLE` / `INPUT_INVALID` |
| N2 Nạp ngữ cảnh | Code | ID | `script`, mốc câu, trang transcript, góp ý của phiên bản | Chặn run nếu hỏng cấu trúc (C3-IN-01) |
| N3 Làm sạch & chặn | Code (luật) | Góp ý thô | `sach[]`, `biLoai[] {id, nhan, lyDo}`, `chiDiem[]`; PII đã ẩn | Nhóm bị loại không đi tiếp |
| N4 Phân loại | LLM nhanh, theo lô | Lô góp ý sạch (không gửi kịch bản) | `{id, nhan, khiaCanh, goiYViTri, note}` | Sau 1 lần sửa vẫn lỗi → `chua-phan-loai`, lô khác chạy tiếp |
| V1 Kiểm tra phân loại | Code | Output N4 | Thiếu/trùng ID, enum sai | Quay N4 kèm danh sách lỗi |
| N5 Định vị | Code, rồi LLM | Góp ý `gop-y` + mốc câu | `sentenceNs`, `status`, `nguon: nguoi-gui \| quy-doi-moc \| ai` | Không chắc → `can-xac-nhan` |
| N6 Gom vấn đề | LLM nhỏ + code đếm | Góp ý đã định vị | Vấn đề: tóm tắt, loại, `feedbackIds`, `stances`, `uncertainties`; code tính số người, trái chiều | ID lạ bị bỏ (C3-VAL) |
| N7 Chia vùng | Code | Vấn đề | Hồ sơ `rg-/cx-/kt-`, mốc phát, thứ tự | — |
| N8 Lập phương án | LLM, một lời gọi mỗi vùng | Câu của vùng ±2, vấn đề của vùng | 0–2 phương án mỗi vấn đề, có patch | Sau 2 lần sửa vẫn lỗi → phương án `khong-hop-le`, vùng khác không ảnh hưởng |
| V2 Kiểm tra patch | Code | Patch | `PATCH_STALE`, `LOI_INVALID`, `SCREEN_TEXT_TOO_LONG`… | Quay N8 kèm lỗi |
| N9 Tính việc | Code (engine) | Phương án | Thu lại, cảnh, phụ đề, ký tự | — |
| N10–N11 | Code | Mọi nhánh | `result.json`, `checks`, tổng kết | Run `xong` kể cả khi có vùng lỗi; ghi rõ vùng lỗi |
| H | Chờ người | Hồ sơ | Quyết định (localStorage theo `runId`) | — |
| N12–N13 | Code | Quyết định | Snapshot, 4 file xuất | 409 khi còn xung đột |

Mỗi node có `inputHash`; kết quả node được cache theo `(nodeType, promptHash, schemaVersion, inputHash)` để chạy lại một phần (giai đoạn P3).

### 3.4 Ba loại vòng lặp

1. **Lặp theo danh sách:** lô góp ý (N4), vùng (N8). Song song tối đa 3.
2. **Sửa theo lỗi:** LLM → validator → gọi lại kèm đúng lỗi; có trần; hết lần thì ghi lỗi và đi tiếp.
3. **Vòng người duyệt:** quyết định → N12 tính lại ngay, không gọi model. Báo vị trí sai / thêm góp ý → chạy lại N4→N9 cho phần bị ảnh hưởng; quyết định cũ của vùng đó thành "cần duyệt lại".

## 4. Sự kiện, lưu trữ và API

### 4.1 Kiểu sự kiện

```ts
type RunEvent =
  | { seq: number; at: string; type: "run.started"; runId: string; videoId: string; versionId: string; graphVersion: string }
  | { seq: number; at: string; type: "node.started"; nodeId: string; nodeType: NodeType; parentId?: string; iterationKey?: string; attempt: number }
  | { seq: number; at: string; type: "node.progress"; nodeId: string; done: number; total: number; label: string }
  | { seq: number; at: string; type: "node.finished"; nodeId: string; status: "xong" | "loi" | "bo-qua"; ms: number; tokens?: { input: number; output: number }; summary: string; errorCode?: string }
  | { seq: number; at: string; type: "partial"; kind: "feedback.labeled" | "cases.ready" | "options.ready"; payload: unknown }
  | { seq: number; at: string; type: "run.finished"; status: "xong"; ms: number; totalTokens: number }
  | { seq: number; at: string; type: "run.failed"; errorCode: string; message: string }
  | { seq: number; at: string; type: "heartbeat" };
```

- `summary` là câu tiếng Việt cho người dùng, ví dụ "19 gửi model · 2 bị loại · 1 chỉ chấm điểm". Không chứa nội dung góp ý bị cách ly hay PII.
- `payload` của `partial` là DTO đã redact, cùng dạng với `result.json`.

### 4.2 Lưu trữ

```text
.data/revision-runs/<runId>/
  run.json            # như hiện tại + graphVersion, trạng thái tổng
  events.jsonl        # mỗi dòng một RunEvent, chỉ ghi nối
  nodes/<nodeId>.json # input đã redact, output, validator findings, attempts, prompt hash, ms, tokens
  result.json         # khi xong
```

Mọi file đi qua `redactForPersist`. Prompt đầy đủ chỉ lưu dưới dạng `promptVersion + promptHash`; bản prompt đã render chỉ lưu khi `REVISION_DEBUG_TRACE=1`, vẫn qua redact.

### 4.3 API

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/revisions/analyze` | Tạo run, chạy nền, trả `202 { runId }` |
| GET | `/api/revisions/runs/[runId]/events?after=<seq>` | SSE; nối lại bằng `after`. Không hỗ trợ SSE thì trả JSON để client poll 1–2 s |
| POST | `/api/revisions/runs/[runId]/cancel` | Hủy (AbortController trong registry tiến trình); run thành `loi` mã `RUN_CANCELLED` |
| GET | `/api/revisions/runs/[runId]/nodes/[nodeId]` | Chi tiết một node cho màn Debug |
| GET | `/api/revisions/runs/[runId]` | Như hiện tại; khi chưa xong trả `status: "dang-chay"` và kết quả từng phần |

Giới hạn: chạy nền trong tiến trình Next chỉ bền khi chạy local/`next start` trên máy chủ giữ tiến trình. Deploy serverless cần hàng đợi/worker (câu hỏi mở Q1).

## 5. Màn hình người dùng

### 5.1 Tab Kịch bản chi tiết — chỉ dữ liệu nguồn

Giữ: gốc kịch bản → phần → nhóm slide (nhãn "tự sinh, chưa rà tay") → câu (mốc, lời, chữ màn hình, ý đồ hình, ảnh cuối câu, Phát, Chi tiết) → góp ý **có vị trí do người gửi chọn** (nhãn "Người gửi chọn"), số góp ý chưa xác định vị trí ghi chung ở gốc.

Bỏ khỏi tab này: nút/nhãn vùng sửa, "Có vùng sửa", "Đề xuất: …", cạnh nối góp ý theo vị trí AI, trạng thái "Ổn định" (không có cơ sở dữ liệu nào để khẳng định một phần ổn định).

Thay bằng một liên kết trung tính ở thanh công cụ khi video có run xong: "Có kết quả phân tích của đợt `<runId>` → mở tab Đề xuất chỉnh sửa". Không tô màu câu theo kết quả AI.

URL có `run` không tồn tại → bỏ tham số `run`, hiện thông báo "Không tìm thấy đợt phân tích `<runId>`; đã mở trạng thái mới nhất của video".

### 5.2 Màn chờ phân tích (tab Đề xuất chỉnh sửa, khi run `dang-chay`)

```text
┌ Đợt phân tích run-…-0d9b · openai/gpt-5.6-terra · bắt đầu 14:49:18 · 00:23 ─────── [Hủy] ┐
│ ✓ Nạp ngữ cảnh              40 câu · 22 góp ý                                0,1 s        │
│ ✓ Làm sạch & chặn           19 gửi model · 2 bị loại · 1 chỉ chấm điểm        0,2 s        │
│ ✓ Phân loại góp ý           19/19 · 14 góp ý · 4 khen · 1 nhiễu               6,8 s        │
│ ✓ Định vị & gom vấn đề      11 vấn đề · 3 cần xác nhận vị trí                 5,1 s        │
│ ◐ Lập phương án             3/7 vùng xong                                     đang chạy    │
│ ○ Tổng hợp                                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────┘
┌ Các vùng cần xem (hiện ngay khi có `cases.ready`) ┐ ┌ Hồ sơ ────────────────────────────────┐
│ Ứng dụng và mô hình vẫn dễ bị nhầm   ✓ 2 phương án│ │ A. Người học đang vướng gì  (đã có)   │
│ Câu 20–23 · 02:01–02:26 · 3 người                 │ │ B. Bằng chứng               (đã có)   │
│ Khoảng dừng câu 35          ◐ đang lập phương án  │ │ C. Ngữ cảnh v1              (đã có)   │
│ …                                                 │ │ D. Phương án   ░░░ đang lập…          │
└───────────────────────────────────────────────────┘ └───────────────────────────────────────┘
```

Con số và thời gian trong khung trên là minh họa, chưa đo.

Yêu cầu:
- Hiện bước và con số **thật** từ sự kiện; không thanh phần trăm giả; bước chưa biết tổng thì chỉ hiện thời gian đã chạy.
- Có `cases.ready` → danh sách vùng và phần A–C của hồ sơ dùng được ngay; phần D hiện khung chờ theo từng vùng. Nút chọn phương án chỉ bật khi vùng đó có `options.ready`.
- Tải lại trang hoặc chuyển tab rồi quay lại → nối lại từ `events.jsonl`, không mất tiến trình.
- Lỗi một node/vùng: hiện tại chỗ ("Vùng câu 35: lập phương án lỗi sau 2 lần sửa · OUTPUT_SCHEMA_INVALID") kèm nút "Chạy lại vùng này" (P3); run vẫn dùng được với các vùng khác.
- Lỗi cả run: mã, thông điệp, `runId`, nút Thử lại (run mới `retryOf`), liên kết "Xem chi tiết kỹ thuật" (chỉ khi bật debug).
- Hủy: hỏi xác nhận; run ghi `RUN_CANCELLED`.
- Hoàn tất: dải tiến trình thu gọn thành một dòng "Xong trong 42 s · 7 vùng · kiểm tra bằng code: đạt", bấm để mở lại.

**Giải pháp trung gian trước khi tách node (P0):** giữ một lời gọi nhưng chuyển sang stream output cấu trúc từng phần của AI SDK để phát `partial` khi từng vấn đề hoàn chỉnh trong JSON. Cần kiểm tra API partial output của `ai@6.0.5` trước khi cam kết; nếu không dùng được với `json_schema` chặt của OpenAI thì P0 chỉ có các bước tất định + đồng hồ "đang gọi model".

### 5.3 Tab Đề xuất chỉnh sửa sau khi xong — chế độ Đồ thị

Giữ chế độ **Danh sách** (ba cột hiện tại) và thêm công tắc **Đồ thị**, dùng lại ngôn ngữ hình ảnh của đồ thị kịch bản (nền lưới chấm, thẻ tối viền mảnh, cạnh cong có màu theo loại, thu phóng, tìm kiếm, "Thanh tra chi tiết").

Cột từ trái sang phải cho một vùng đang chọn (các vùng khác thu gọn thành nút ở cột trái):

```text
[Vùng sửa] ──► [Vấn đề 1..n] ──► [Bằng chứng: nhóm theo người gửi] 
                     │                          └─(cạnh vàng: trái chiều)
                     ├──► [Câu v1 liên quan: lời · chữ · ý đồ hình · Phát]
                     └──► [Phương án A | B: trước → sau] ──► [Việc kéo theo: thu lại / cảnh / phụ đề]
                                                                  └─(cạnh đỏ nét đứt: chạm vùng khác / xung đột)
```

Quy ước hiển thị:
- Màu cạnh: xám = thuộc về; vàng = ý kiến trái chiều; xanh = phương án đã chọn; đỏ nét đứt = cảnh báo chéo hoặc `CONFLICT_SAME_FIELD`. Luôn kèm chữ trên cạnh hoặc trong chú giải, không chỉ màu.
- Thẻ phương án: tiêu đề, trạng thái (`hop-le` / `khong-hop-le` / `ngoai-pham-vi`), diff trước → sau theo trường, "Tăng thêm trong gói", nút Chọn. Chọn xong, cạnh tới "Việc kéo theo" đổi thành xanh và cột phải "Đang chuẩn bị bản sửa v2" cập nhật.
- Thẻ vấn đề ghi nguồn vị trí: "Người gửi chọn" / "AI đề xuất" / "Cần xác nhận"; nút "Báo vị trí sai".
- Bấm câu v1 → phát đúng đoạn (chỉ tải video khi bấm).
- Vùng `cx-…` (chưa định vị) không có cột Câu v1; hiện thẻ "Vị trí chưa xác nhận" thay thế.
- Bộ lọc: Chờ duyệt · Đã chọn · Hoãn · Giữ nguyên · Có trái chiều · Có lỗi kiểm tra.
- Bố cục tự động theo cột, không cho kéo thả tự do (tránh lưu vị trí thẻ vô nghĩa).

## 6. Màn Debug agent cho kỹ sư

Đường dẫn: `/dev/runs` và `/dev/runs/[runId]`. Chỉ bật khi `REVISION_DEBUG_UI=1` ở server; tắt thì trả 404. Không có liên kết tới đây từ màn người dùng cuối trừ khi cờ bật.

```text
┌ run-…-0d9b · graph cp3-nodes@1 · prompt f82b05… · schema hackathon-revision-agent/2 · xong 42,1 s · 21 380 token ┐
│ [Đồ thị] [Dòng thời gian] [Sự kiện] [So sánh run]                                         lọc: lỗi · retry · chậm│
├───────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────┤
│  (N1)─►(N2)─►(N3)─┬─►(N4 ×3 lô)─►(V1)─►(N5)─►(N6)─►(N7)─┬─►…   │ Node: N8 · vùng rg-35-35 · lần 2/3              │
│                   └─►[bị loại 2]                        │     │ Trạng thái: lỗi → sửa → xong · 9,4 s · 3 120 tk │
│        (N8 rg-20-23 ✓ 7,1s)  (N8 rg-35-35 ⟳2 ✓ 9,4s) (N8 rg-10-10 ✓) │ [Vào] [Ra] [Prompt] [Kiểm tra] [Lần thử] [Thô] │
│                                                        ▼      │ V2: PATCH_STALE câu 35 (lần 1)                  │
│                                                     (N10)─►(N11)│ Vào: 1 vấn đề · câu 33–37 · 2 góp ý            │
└───────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

Thời gian, token và mã hash trong khung trên là minh họa.

Chức năng:
- **Đồ thị:** node theo `graphVersion`; màu + biểu tượng theo trạng thái (chờ, đang chạy, xong, lỗi, bỏ qua, đã sửa sau retry); nhãn thời gian, token, số lần thử. Iteration hiện dạng nhóm thu gọn, mở ra thành từng lô/vùng. Cập nhật trực tiếp khi run đang chạy (cùng luồng SSE).
- **Bảng thanh tra node:**
  - *Vào / Ra:* JSON đã redact, có nút sao chép.
  - *Prompt:* `promptVersion`, `promptHash`; bản render chỉ khi `REVISION_DEBUG_TRACE=1`.
  - *Kiểm tra:* findings của validator, mã và mức.
  - *Lần thử:* từng attempt với lỗi đã gửi lại cho model.
  - *Thô:* output model trước kiểm tra (đã redact).
- **Dòng thời gian:** dạng Gantt theo node để thấy node nào chặn, mức song song thực tế.
- **Sự kiện:** bảng `events.jsonl` có lọc theo loại/node.
- **So sánh run:** chọn hai run cùng `inputHash` → so node-by-node: thời gian, token, số vấn đề/vùng, patch khác nhau. Dùng khi đổi prompt/graph.
- **Liên kết golden set:** run có `caseId` hiện case, tiêu chí và kết quả đạt/không đạt.
- **Chạy lại một node (P3):** dùng input đã lưu, ghi thành run con `retryOf` + `replayOf nodeId`; không ghi đè run gốc.

Ràng buộc an toàn: không hiện nội dung góp ý bị cách ly, khóa API, header; run giả lập gắn nhãn **Giả lập** ở mọi chỗ.

Thư viện đồ thị: đồ thị kịch bản hiện tự vẽ (không dùng thư viện). Cho màn Debug nên dùng `@xyflow/react` (MIT) hoặc tái sử dụng bộ vẽ hiện có nếu tách được thành component chung; quyết định khi bắt đầu P1, ghi lý do.

## 6b. Hiện trạng đã kiểm chứng (17/09, 15:35)

Kiểm trực tiếp trên dev server đang chạy, run thật `run-20260917-153035-9b8e`. Mức: **Đạt** = đã chạy và kiểm được; **Một phần** = có code nhưng thiếu điều kiện của plan; **Chưa** = chưa có.

| Hạng mục | Mức | Bằng chứng |
|---|---|---|
| P0a Tab Kịch bản chi tiết chỉ còn dữ liệu nguồn | **Đạt** | Trang video truyền `rawSourceFeedbacks` (không gắn vị trí AI) và không truyền `cases` cho tab này; không còn chuỗi "Có vùng sửa", "Đề xuất:", "Ổn định" và dòng ghi cứng `sec.so === 4` trong `script-graph-view.tsx` |
| P0b Chạy nền, trả `202` | **Đạt** | `POST /analyze` trả `202 {runId, status:"dang-chay"}` trong **0,49 s** (trước đây chờ 70–90 s) |
| P0b Sự kiện theo node | **Đạt** | `events.jsonl` + SSE + fallback `?format=json`; log run thật: N1 10 ms · N2 10 ms "40 câu · 22 góp ý" · N3 1 ms "19 gửi model · 2 bị loại · 1 chỉ chấm điểm" · MODEL_PHAN_TICH 93,2 s · V_KIEM_TRA 4 ms "10 vùng" |
| Kết quả từng phần `cases.ready` | **Đạt** | Sự kiện `partial/cases.ready` phát trước `run.finished` |
| Hủy run | **Đạt (code)** | `POST /runs/[runId]/cancel` + `AbortController` trong `activeRuns`; chưa chạy thử trên run thật |
| P0c Màn chờ | **Đạt** | `analysis-progress-panel.tsx`: EventSource, nối lại bằng `after=<seq>`, đồng hồ chạy độc lập nên không đứng hình trong lúc model chạy |
| P0c Màn Debug | **Một phần** | `/dev/runs` có danh sách + `notFound()` khi `REVISION_DEBUG_UI≠1`; API `/nodes/[nodeId]` trả đủ `status, ms, attempts, promptHash, input, output`. **Thiếu trang `/dev/runs/[runId]`** mà hai nút trong danh sách đang trỏ tới |
| Typecheck | **Đạt (sau khi sửa)** | `dev-runs-client.tsx` làm hỏng `tsc` vì `typedRoutes` không chấp nhận href tới route chưa tồn tại; đã sửa như cách repo vẫn dùng, `tsc --noEmit` exit 0 |
| P1–P3 (tách N4/N6/N8, iteration song song, cache) | **Chưa** | Vẫn một node `MODEL_PHAN_TICH` gọi model một lần |

**Kiểm thử chấp nhận đã chạy:** AP-02 đạt (202 < 1 s; N2, N3 xong trong ~1 s). AP-06 đạt về bản chất — `/dev/runs` trả nội dung 404 của Next và không lộ dữ liệu run; ở chế độ dev Next trả mã HTTP 200 kèm trang 404, nên khi nghiệm thu phải nhìn nội dung trang, không nhìn mã HTTP. AP-09 không còn trang trắng. AP-01 mở được tab. Chưa chạy: AP-03, AP-04, AP-05, AP-07, AP-08, AP-10.

**Ba việc phải làm tiếp, theo thứ tự:**

1. **Tạo `/dev/runs/[runId]`** (5 tab: Đồ thị · Dòng thời gian · Sự kiện · Thanh tra node · So sánh run). Hiện hai nút "Mở thanh tra" trong danh sách dẫn tới trang chưa tồn tại. Sau khi có trang thật thì bỏ `as any` ở hai href đó.
2. **Khoảng lặng 93 giây trong `MODEL_PHAN_TICH`.** Sự kiện `heartbeat` đã khai báo trong kiểu `RunEvent` nhưng runner không phát; SSE chỉ có heartbeat mức vận chuyển (dòng `: heartbeat`) để giữ kết nối. Cần runner phát `node.progress` hoặc `heartbeat` mỗi 5–10 giây trong lúc chờ model, để màn chờ và màn Debug phân biệt được "đang chạy" với "đã treo". Đây cũng là lý do nên làm P1 sớm.
3. **Thời gian chạy đang tăng, sát trần.** Run 12:33 mất 73 s, run 14:44 mất 80 s, run 15:30 mất **93,2 s** — đã vượt mức 90 s của trần cũ; hiện an toàn chỉ vì trần đã nâng lên 150 s. Cần đo lại nhiều lần và ưu tiên P1 để cắt một lời gọi lớn thành nhiều lời gọi nhỏ chạy song song.

**Ngoài phạm vi plan này nhưng cần biết:** `eval/runs/cp3-run-005` và `cp3-run-007` mới tạo vẫn là `model: mock-agent`, `isMock: true`, 20/20. Không được dùng làm bằng chứng đo; golden set thật vẫn chưa chạy (CP3-4 trong spec).

### Kết quả P1–P3 (đo trên run thật, 17/09)

| Lần chạy | Thời gian | Ghi chú |
|---|---|---|
| Gốc, một lời gọi | 88 s | Thấy kết quả đầu tiên ở giây 88 |
| P1+P2 | 101 s | Phân loại xong ở giây 50; phương án hợp lệ tăng từ 3 lên 12 |
| P3, đầu vào không đổi | **0,2 s** | 13/13 node dùng lại cache, không gọi model |
| P3, thêm 1 góp ý | 72 s | **Chỉ 2/13 node gọi model**: N4 và đúng một vùng liên quan |

**Hai lỗi đã gặp và sửa trong lúc làm, ghi lại để không lặp:**
1. Gom nhiều vấn đề vào chung một lời gọi lập phương án thì model chỉ trả phương án cho một phần (gửi 6 vấn đề, chỉ 1 vấn đề có phương án). Đã đổi thành mỗi vấn đề một lời gọi.
2. Cache lưu `issueKey` do model tự đặt, mà key này đổi mỗi lần chạy, nên khi dùng lại cache thì ghép trượt và vùng mất sạch phương án (chỉ 1/11 vùng còn phương án, dù mọi node báo cache thành công). Đã đổi sang ghép theo vấn đề đang xử lý; cache key của N8 cũng chỉ còn dựa trên loại vấn đề, feedbackIds, câu và trạng thái định vị.

**Rút ra:** giá trị do model tự sinh (`key`, `summary`) không được dùng làm khóa ghép hay khóa cache. Số node báo "xong" không chứng minh kết quả đúng — phải kiểm cả số vùng có phương án.

### Debug: chạy lại node và so sánh run (bổ sung 17/09, sau khi nộp MVP)

| Tính năng | Trạng thái | Kiểm chứng |
|---|---|---|
| `POST /runs/[runId]/nodes/[nodeId]/replay` | **Đạt** | Gọi lại model bằng input đã lưu: 12,5 s, 2 593 token, `promptHash` khớp bản gốc, trả đúng phương án. Không ghi đè run gốc |
| Từ chối node không gọi model | **Đạt** | `N3_LAM_SACH_CHAN` → `NODE_NOT_REPLAYABLE` |
| Chặn khi thiếu input đã lưu | **Đạt** | Run cũ → `409 NODE_INPUT_NOT_STORED` kèm hướng dẫn chạy đợt mới |
| `GET /runs/compare?a=&b=` (AP-10) | **Đạt** | So 16 node: ms, token, trạng thái, node chỉ có ở một bên; cờ `cungInputHash`, `cungPromptHash`; run lạ → `404 RUN_NOT_FOUND` |
| Tab "Chạy lại node" và "So sánh run" trong Debug | **Đạt** | Có trong `run-inspector-client.tsx`; render khi mở đúng tab |
| Sơ đồ pipeline node (tab Đồ thị) | **Chưa đúng yêu cầu** (đánh giá lại) | `components/studio/pipeline-graph.tsx`: SVG, node nối bằng cạnh cong có mũi tên, nhánh N8 tỏa ra song song rồi hợp lại. Đo trên run 11 nhánh: 16 hộp, 26 cạnh. Bấm node mở thanh tra. Ban đầu mình dựng nhầm thành danh sách dọc nối gạch đứt, đã làm lại |
| Cổng `REVISION_DEBUG_UI` | **Đạt** | Cả trang Debug và API replay đều trả 404 khi chưa bật cờ |

Trong lúc làm phải sửa thêm: N4 và N8 trước đó chỉ lưu số đếm (`feedbackCount`) và tên vấn đề (`issueKeys`) nên không đủ dữ liệu chạy lại; nay lưu đủ `script`/`feedback` và `sentences`/`issues`. Node của các run cũ vẫn thiếu input, nên replay trên run cũ sẽ báo `409` — đúng thiết kế, không phải lỗi.

Ví dụ so sánh thật (cùng `inputHash`, cùng `promptHash`): run gốc 113,6 s và run dùng cache 0,1 s đều cho 11 vấn đề, 10 vùng, 11 phương án hợp lệ — cache không làm đổi kết quả.

## 7. Thứ tự triển khai

| Giai đoạn | Việc | Xong khi |
|---|---|---|
| **P0a** ✅ | Tab Kịch bản chi tiết chỉ nhận dữ liệu nguồn (mục 2, 5.1); bỏ `sec.so === 4`; xử lý `run` không tồn tại trong URL | Có run xong mà đồ thị kịch bản không hiện vùng sửa/đề xuất/vị trí AI; tìm chuỗi "Có vùng sửa", "Đề xuất:" trong hai component trả 0 |
| **P0b** ✅ | Chạy nền + `events.jsonl` + SSE cho pipeline hiện tại chia thành node thô: N2, N3, "Gọi model" (một node), kiểm tra, lập hồ sơ | Bấm phân tích: trong 2 s thấy bước Nạp/Làm sạch có số liệu; tải lại giữa chừng vẫn thấy tiến trình; hủy được |
| **P0c** ◐ (đánh giá lại) | Màn chờ hỏng sau P1: danh sách bước cứng vẫn là node cũ `MODEL_PHAN_TICH`. Màn chờ (5.2) + màn Debug bản đầu (đồ thị node thô, thanh tra Vào/Ra/Kiểm tra/Lần thử) | Kỹ sư mở `/dev/runs/<runId>` thấy từng node, thời gian, token, lỗi |
| **P1** ◐ (đánh giá lại) | Đã tách lời gọi, nhưng `cases.ready` vẫn phát sau khi mọi phương án xong nên **chưa đạt** tiêu chí "danh sách vùng xuất hiện trước". Tách N4 (phân loại) + N5/N6/N7 khỏi N8 (lập phương án), chạy tuần tự; phát `cases.ready` | Danh sách vùng xuất hiện trước khi phương án xong; golden set chạy lại, so với run trước |
| **P2** ◐ (đánh giá lại) | Có song song ≤3; **chưa có** vòng sửa theo lỗi V1/V2 (chỉ retry khi sai schema, validator chạy một lần ở cuối); màn Đồ thị đề xuất 5.3 chưa làm. Iteration song song theo vùng + vòng sửa theo lỗi V1/V2; `options.ready` theo vùng; màn Đồ thị đề xuất (5.3) | Lỗi một vùng không làm hỏng run; Debug hiện nhóm iteration và retry |
| **P3** ✅ | Cache node, chạy lại một phần khi báo vị trí sai/thêm góp ý, chạy lại một node trong Debug, so sánh run | Thêm một góp ý chỉ gọi model cho phần bị ảnh hưởng (đếm số lời gọi trong events) |

Mỗi giai đoạn đổi hành vi model (P1, P2) phải chạy lại golden set qua cùng service, lưu run mới, so số đo với run trước; không ghi đè run cũ.

## 8. Kiểm thử chấp nhận

| Mã | Tình huống | Kỳ vọng |
|---|---|---|
| AP-01 | Có run xong, mở tab Kịch bản chi tiết | Không có thẻ/nhãn vùng sửa, đề xuất, vị trí AI; góp ý chỉ nối khi người gửi chọn vị trí |
| AP-02 | Bấm Phân tích | `202` trong < 1 s; sự kiện `node.finished` của N2, N3 trong < 2 s |
| AP-03 | Tải lại trang giữa run | Tiến trình hiện lại đúng các bước đã xong, tiếp tục cập nhật |
| AP-04 | Hủy run | Dừng gọi model; run `loi` `RUN_CANCELLED`; nút Thử lại tạo run mới |
| AP-05 | Model giả trả patch sai cho một vùng hai lần (P2) | Vùng đó `khong-hop-le` kèm lỗi; các vùng khác chọn được; run `xong` |
| AP-06 | `REVISION_DEBUG_UI` tắt | `/dev/runs` trả 404 |
| AP-07 | Run K-04/K-05 mở trong Debug | Không có chuỗi canary cách ly trong mọi tab thanh tra |
| AP-08 | Đồ thị đề xuất: chọn phương án đổi lời câu 22 | Cạnh tới "Việc kéo theo" đổi trạng thái; cột bản sửa v2 cập nhật thu lại {21, 22, 23} |
| AP-09 | URL `run=` không tồn tại | Không trang trắng; thông báo và mở trạng thái mới nhất của video |
| AP-10 | Hai run cùng input trong So sánh run | Bảng khác biệt theo node hiển thị thời gian, token, số vấn đề/vùng |

## 9. Câu hỏi mở

| # | Câu hỏi | Mặc định đề xuất |
|---|---|---|
| Q1 | Demo chạy local hay deploy serverless? | Local/`next start`: chạy nền trong tiến trình. Serverless cần worker/hàng đợi trước P0b |
| Q2 | Model cho N4/N6 (phân loại, gom) có dùng model nhỏ hơn N8 không? | Cùng model ở P1 để so công bằng; thử model nhỏ ở P2 kèm golden set |
| Q3 | Có giữ một lời gọi (chỉ thêm sự kiện) cho CP3 và tách node sau CP3? | Có: P0 trước CP3; P1–P3 sau khi có số đo lượt đầu |
| Q4 | Màn Debug có cần cho giám khảo xem không? | Không mặc định; bật cờ khi demo phần kỹ thuật |
