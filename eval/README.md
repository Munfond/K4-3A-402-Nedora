# Đánh giá & Kiểm thử Golden Set (Checkpoint 3)

Tài liệu hướng dẫn phương pháp đánh giá, quy trình chạy bộ kiểm chuẩn Golden Set, phân định rõ ràng giữa thành phần AI thật và code tự động, cùng tuyên bố trung thực về giới hạn dữ liệu và mức độ đáp ứng tiêu chí Rubric R4.

---

## 1. Bộ Golden Set chuẩn & Cấu trúc thư mục `eval/`

> [!IMPORTANT]
> **Bộ kiểm chuẩn chính thức (Canonical):**
> - Chuẩn chính thức hiện tại là `eval/golden/golden-set.v1.json` (20 test cases với góp ý tổng hợp riêng từng case, `expected` có cấu trúc và `passCriteria` máy kiểm được).
> - File `eval/golden-set.v0-pack.json` là bộ cũ dựa trên pack ban đầu, **không còn là chuẩn**.
> - `expected` và `passCriteria` là dữ liệu dành riêng cho bộ chấm eval; **tuyệt đối không bao giờ được gửi cho model**.

```text
eval/
  README.md                     # Tài liệu này: hợp nhất hướng dẫn, chuẩn golden set, trạng thái R4
  golden/                       # BỘ KIỂM CHUẨN CHÍNH THỨC
    golden-set.v1.json          # 20 test cases chuẩn (8 thường · 8 khó · 4 hiếm) kèm passCriteria
    COVERAGE-v1.md              # Ma trận độ phủ, hard gates và ngưỡng chất lượng CP3
    batches.json                # Lịch sử batch / kịch bản kiểm thử
    pool.json                   # Pool case kiểm thử
  ingestion-cases.v1.json       # Ca kiểm thử nạp dữ liệu (JSON + CSV) cho server
  golden-set.v0-pack.json       # [DEPRECATED] Bộ case v0 cũ theo pack, không còn là chuẩn
  fixtures/
    validator/
      h01-id-sai.json           # Fixture kiểm thử validator: ID sai, patch lỗi, chữ quá dài
    engine/
      h03-cau-bien.json         # Fixture kiểm thử engine: mở rộng câu biên 1 và 40
      h04-xung-dot.json         # Fixture kiểm thử engine: xung đột ghi đè CONFLICT_SAME_FIELD
  runs/
    _templates/                 # Mẫu artifact chuẩn cho các đợt chạy (manifest, results, summary)
    cp3-run-001/                # Lượt chạy benchmark chính thức (bất biến)
      manifest.json             # Model, prompt hash, schema, policy, commit SHA, hash golden set
      results.jsonl             # Kết quả chi tiết từng case trên từng tiêu chí máy kiểm
      summary.md                # Báo cáo tổng hợp, bảng phân bổ và danh sách lỗi theo hậu quả
      traces/                   # Vết chạy chi tiết từng case đã làm sạch
```

---

## 2. Cách chạy kiểm thử

### A. Kiểm tra bảo mật và chống rò rỉ canary (`check:leaks`)

Trước khi xuất bản artifact hoặc quay video demo, bắt buộc chạy kiểm tra tĩnh và quét rò rỉ:

```bash
pnpm --filter www check:leaks
```

- **Canary quét:** Tìm các chuỗi nhạy cảm (PII: email, SĐT giả lập; nội dung cách ly: câu lệnh prompt injection, từ ngữ công kích) trong `.next/static`, `.data/revision-runs`, `eval/runs/`.
- **Kiểm tra tĩnh:** Đảm bảo 100% không có file nào trong pipeline nghiệp vụ (`src/lib/revision/`, `src/app/api/revisions/`, `eval-cp3.ts`) import file dữ liệu mẫu cũ (`ket-qua-mau.json`).
- **Điều kiện đạt:** 0 rò rỉ canary, 0 import dữ liệu mẫu.

### B. Chạy kiểm chuẩn Golden Set (`eval:cp3`)

#### 1. Chạy với mô hình AI thật (Môi trường chuẩn)

Yêu cầu cấu hình biến môi trường `REVISION_MODEL` (ví dụ: `openai/gpt-4o-mini`, `google/gemini-2.5-flash`) và khóa API tương ứng (`AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, hoặc `GEMINI_API_KEY`).

```bash
# Mặc định chạy và lưu vào eval/runs/cp3-run-001/
pnpm --filter www eval:cp3

# Nếu sửa lỗi và muốn chạy lượt kế tiếp (tuân thủ quy tắc bất biến C3-EVAL-08):
pnpm --filter www eval:cp3 -- --run-dir=cp3-run-002
```

> [!IMPORTANT]
> **Quy tắc bất biến C3-EVAL-08:** Runner từ chối ghi đè vào thư mục đã tồn tại. Nếu cần chạy lại, bắt buộc tăng mã lượt chạy (`cp3-run-002`, `cp3-run-003`).

#### 2. Chạy thử nghiệm giả lập (`--mock`)

Dùng để xác thực toàn bộ hệ thống tiêu chí máy kiểm, cấu trúc thư mục và báo cáo khi chưa cấu hình API key:

```bash
pnpm --filter www eval:cp3 -- --run-dir=test-mock-run --mock
```

---

## 3. Phân định thành phần THẬT và MOCK / CODE

| Thành phần | Cơ chế thực thi | Vai trò | Ghi chú |
|---|---|---|---|
| **Pipeline Agent** (`kind: pipeline`) | **AI Model THẬT** | Đọc góp ý, hiểu ngữ cảnh video, phân loại nhãn, phát hiện mâu thuẫn, giả thuyết nguyên nhân, đề xuất phương án A/B | Chạy qua pipeline chuẩn của hệ thống; có kiểm tra patch trong từng vùng và retry ≤2. |
| **Sanitizer & PII Redactor** | **Code thuần (Deterministic)** | Làm sạch NFC, lọc ký tự vô hình, ẩn email, SĐT VN, dãy số dài, cách ly lệnh tiêm và công kích | Chạy trước khi dữ liệu gửi tới prompt template; đảm bảo không rò rỉ canary vào prompt. |
| **Validator** (`kind: validator`) | **Code thuần (Deterministic)** | Kiểm tra ràng buộc kỹ thuật: tính toàn vẹn ID, câu tồn tại, before verbatim, không chứa chữ số trong lời mới, chữ màn hình ≤ 40 ký tự | Đánh giá fixture `h01-id-sai.json` để kiểm tra khả năng bắt lỗi của hệ thống. |
| **Release Engine** (`kind: engine`) | **Code thuần (Deterministic)** | Gom vùng liên thông, mở rộng ngữ cảnh thu âm $\pm 1$ câu, đếm ký tự trên bản nháp mới, phát hiện xung đột `CONFLICT_SAME_FIELD` | Đánh giá fixture `h03-cau-bien.json` (mở rộng biên 1 và 40) và `h04-xung-dot.json` (chặn xuất khi có xung đột). |
| **Export Generator** | **Code thuần (Deterministic)** | Sinh 4 file xuất (`kich-ban-v2.json`, `kich-ban-v2.md`, `viec-can-lam.csv`, `truy-vet.json`) kèm `selfCheckExport` | Đảm bảo chỉ những thay đổi đã được người dùng bấm chọn mới được cập nhật. |

---

## 4. Giới hạn dữ liệu và an toàn hệ thống

1. **Không mở/đọc trực tiếp file video (`.mp4`):**
   - Video có kích thước lớn và gây nghẽn tài nguyên. Hệ thống chỉ làm việc với siêu dữ liệu timecode (`cau-timecode-d1.csv`) và hiển thị video player khi người dùng bấm phát tại câu cần xem.
2. **Giới hạn đầu vào (C3-IN-04):**
   - Tối đa 60 góp ý mỗi lượt phân tích; tối đa 20 góp ý mới từ người dùng. Vượt quá sẽ trả về lỗi `400 INPUT_INVALID`.
3. **Ẩn danh thông tin cá nhân (PII):**
   - Email, số điện thoại Việt Nam (`+84` hoặc `0`), dãy số định danh ($\ge 7$ chữ số), liên kết URL và `@handle` đều được thay thế tự động bằng nhãn giữ chỗ.
   - *Giới hạn đã biết:* Tên riêng tiếng Việt chưa có bộ nhận diện NER chuyên biệt, tạm thời dựa vào quy tắc ẩn danh mã người gửi (`ng-<hash8>`).
4. **Cách ly an toàn (Quarantine):**
   - Góp ý có dấu hiệu cài lệnh hoặc công kích cá nhân bị cách ly lập tức tại lớp luật; không bao giờ được gửi vào prompt model, không hiển thị nội dung gốc trên giao diện và không xuất hiện trong file xuất công khai.

---

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

Đối chiếu trung thực với các tiêu chí trong Rubric R4 của cuộc thi:

| Tiêu chí Rubric R4 | Trạng thái hiện tại | Đánh giá & Kế hoạch |
|---|---|---|
| **≥ 20 test cases** | **20 / 20 case** đã thiết kế hoàn chỉnh trong `golden/golden-set.v1.json` (8 thường, 8 khó, 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | **0 case**. Tài liệu đề thi hiện tại chưa định nghĩa bộ phân loại 4 lớp này; toàn bộ case trong golden set tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (sẽ cập nhật ngay khi BTC ban hành định nghĩa 4 lớp) |
| **≥ 10 cases từ chatlog thật** | **0 case**. Mọi case do nhóm phát triển đều được ghi nhận trung thực xuất xứ là `synthetic` (tự viết mô phỏng) hoặc `pack` (từ gói dữ liệu đề thi D1), tuyệt đối không mạo nhận là chatlog thực tế | **CHƯA ĐÁP ỨNG** (chờ bổ sung dữ liệu người học thực tế trong CP4) |
