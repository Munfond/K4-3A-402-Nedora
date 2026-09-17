# Báo cáo kết quả Golden Set (cp3-run-002)

- **Thời điểm chạy:** 2026-09-17T10:58:28.603Z
- **Mô hình:** `openai/gpt-4o-mini`
- **Prompt hash:** `f82b058e6d60796a...` (phiên bản `revision-cp3@1`)
- **Golden set:** `eval/golden/golden-set.v1.json` (SHA-256: `0588ca3afdd4cd21...`)
- **Coverage contract:** `eval/golden/COVERAGE-v1.md` (SHA-256: `c6481ba52eaab6df...`)
- **Git commit:** `2edd5c2e48817fc5be3713e640d5b26792ae72b0`

## 1. Tổng quan số đo

| Chỉ số | Số lượng | Tỉ lệ (%) | Ghi chú |
|---|---|---|---|
| **Tổng số case đã chạy** | **20 / 20** | **100%** | Không bỏ sót case nào theo mẫu số |
| **Case ĐẠT (Passed)** | **3 / 20** | **15.0%** | Mọi tiêu chí của case đều đạt |
| **Case KHÔNG ĐẠT** | **0 / 20** | **0.0%** | Tiêu chí máy kiểm thất bại |
| **Case LỖI (Error)** | **17 / 20** | **85.0%** | Lỗi gọi model / timeout / schema |

## 2. Kết quả phân bổ theo tầng và loại

### Phân bổ theo tầng khó (Tier)

| Tầng | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Thường (`thuong`) | 0 / 8 | 0.0% |
| Khó (`kho`) | 0 / 8 | 0.0% |
| Hiếm (`hiem`) | 3 / 4 | 75.0% |

### Phân bổ theo loại kiểm thử (Kind)

| Loại | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Pipeline (`pipeline`) | 0 / 17 | 0.0% |
| Validator (`validator`) | 1 / 1 | 100.0% |
| Engine (`engine`) | 2 / 2 | 100.0% |

## 3. Danh sách case thất bại xếp theo thứ tự hậu quả (C3-EVAL-10)

| Mức hậu quả | Case ID | Tầng · Kind | Hậu quả phân loại | Chi tiết lỗi |
|---|---|---|---|---|
| Cấp 4 | `N-01` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-02` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-03` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-04` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-05` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-06` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-07` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `N-08` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-01` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-02` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-03` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-04` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-05` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-06` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-07` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `K-08` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |
| Cấp 4 | `H-01` | hiem · pipeline | (4) Run lỗi (schema, timeout, exception) | Dữ liệu đầu ra của model không khớp schema quy định: Invalid schema for response_format 'response': In context=('properties', 'issues', 'items', 'properties', 'causeHypothesis', 'anyOf', '0'), 'additionalProperties' is required to be supplied and to be false. |

## 4. Bảng chi tiết toàn bộ 20 case

| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |
|---|---|---|---|---|---|---|
| `N-01` | thuong | pipeline | ⚠️ LỖI | 1497ms | - | 0 / 3 |
| `N-02` | thuong | pipeline | ⚠️ LỖI | 856ms | - | 2 / 4 |
| `N-03` | thuong | pipeline | ⚠️ LỖI | 1161ms | - | 1 / 3 |
| `N-04` | thuong | pipeline | ⚠️ LỖI | 631ms | - | 0 / 3 |
| `N-05` | thuong | pipeline | ⚠️ LỖI | 734ms | - | 1 / 3 |
| `N-06` | thuong | pipeline | ⚠️ LỖI | 812ms | - | 1 / 3 |
| `N-07` | thuong | pipeline | ⚠️ LỖI | 695ms | - | 1 / 3 |
| `N-08` | thuong | pipeline | ⚠️ LỖI | 644ms | - | 0 / 3 |
| `K-01` | kho | pipeline | ⚠️ LỖI | 619ms | - | 1 / 3 |
| `K-02` | kho | pipeline | ⚠️ LỖI | 976ms | - | 0 / 3 |
| `K-03` | kho | pipeline | ⚠️ LỖI | 648ms | - | 1 / 4 |
| `K-04` | kho | pipeline | ⚠️ LỖI | 707ms | - | 2 / 5 |
| `K-05` | kho | pipeline | ⚠️ LỖI | 705ms | - | 2 / 4 |
| `K-06` | kho | pipeline | ⚠️ LỖI | 696ms | - | 1 / 3 |
| `K-07` | kho | pipeline | ⚠️ LỖI | 648ms | - | 0 / 4 |
| `K-08` | kho | pipeline | ⚠️ LỖI | 730ms | - | 1 / 3 |
| `H-01` | hiem | pipeline | ⚠️ LỖI | 666ms | - | 2 / 3 |
| `H-02` | hiem | validator | ✅ ĐẠT | 4ms | - | 3 / 3 |
| `H-03` | hiem | engine | ✅ ĐẠT | 11ms | - | 3 / 3 |
| `H-04` | hiem | engine | ✅ ĐẠT | 1ms | - | 3 / 3 |

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |
|---|---|---|
| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |
| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |
