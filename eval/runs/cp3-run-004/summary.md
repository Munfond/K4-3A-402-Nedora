# Báo cáo kết quả Golden Set (cp3-run-004)

- **Thời điểm chạy:** 2026-09-17T11:30:01.467Z
- **Mô hình:** `openai/gpt-4o-mini`
- **Prompt hash:** `f82b058e6d60796a...` (phiên bản `revision-cp3@1`)
- **Golden set:** `eval/golden/golden-set.v1.json` (SHA-256: `0588ca3afdd4cd21...`)
- **Coverage contract:** `eval/golden/COVERAGE-v1.md` (SHA-256: `c6481ba52eaab6df...`)
- **Git commit:** `5177e1c63d7717e13ccf519f2452817f21776f1a`

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
| Cấp 4 | `N-01` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-02` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-03` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-04` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-05` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-06` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-07` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `N-08` | thuong · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-01` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-02` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-03` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-04` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-05` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-06` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-07` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `K-08` | kho · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |
| Cấp 4 | `H-01` | hiem · pipeline | (4) Run lỗi (schema, timeout, exception) | Không có khóa dùng được cho model openai/gpt-4o-mini: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/… |

## 4. Bảng chi tiết toàn bộ 20 case

| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |
|---|---|---|---|---|---|---|
| `N-01` | thuong | pipeline | ⚠️ LỖI | 21ms | - | 0 / 3 |
| `N-02` | thuong | pipeline | ⚠️ LỖI | 3ms | - | 2 / 4 |
| `N-03` | thuong | pipeline | ⚠️ LỖI | 3ms | - | 1 / 3 |
| `N-04` | thuong | pipeline | ⚠️ LỖI | 5ms | - | 0 / 3 |
| `N-05` | thuong | pipeline | ⚠️ LỖI | 5ms | - | 1 / 3 |
| `N-06` | thuong | pipeline | ⚠️ LỖI | 5ms | - | 1 / 3 |
| `N-07` | thuong | pipeline | ⚠️ LỖI | 4ms | - | 1 / 3 |
| `N-08` | thuong | pipeline | ⚠️ LỖI | 3ms | - | 0 / 3 |
| `K-01` | kho | pipeline | ⚠️ LỖI | 4ms | - | 1 / 3 |
| `K-02` | kho | pipeline | ⚠️ LỖI | 4ms | - | 0 / 3 |
| `K-03` | kho | pipeline | ⚠️ LỖI | 5ms | - | 1 / 4 |
| `K-04` | kho | pipeline | ⚠️ LỖI | 4ms | - | 2 / 5 |
| `K-05` | kho | pipeline | ⚠️ LỖI | 4ms | - | 2 / 4 |
| `K-06` | kho | pipeline | ⚠️ LỖI | 4ms | - | 1 / 3 |
| `K-07` | kho | pipeline | ⚠️ LỖI | 4ms | - | 0 / 4 |
| `K-08` | kho | pipeline | ⚠️ LỖI | 3ms | - | 1 / 3 |
| `H-01` | hiem | pipeline | ⚠️ LỖI | 4ms | - | 2 / 3 |
| `H-02` | hiem | validator | ✅ ĐẠT | 2ms | - | 3 / 3 |
| `H-03` | hiem | engine | ✅ ĐẠT | 5ms | - | 3 / 3 |
| `H-04` | hiem | engine | ✅ ĐẠT | 0ms | - | 3 / 3 |

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |
|---|---|---|
| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |
| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |
