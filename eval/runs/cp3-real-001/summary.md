# Báo cáo kết quả Golden Set (cp3-real-001)

- **Thời điểm chạy:** 2026-09-17T12:23:15.695Z
- **Mô hình:** `openai/gpt-4o-mini`
- **Prompt hash:** `f82b058e6d60796a...` (phiên bản `revision-cp3@1`)
- **Golden set:** `eval/golden/golden-set.v1.json` (SHA-256: `c90d4850c2020dfa...`)
- **Git commit:** `5177e1c63d7717e13ccf519f2452817f21776f1a`

## 1. Tổng quan số đo

| Chỉ số | Số lượng | Tỉ lệ (%) | Ghi chú |
|---|---|---|---|
| **Tổng số case đã chạy** | **20 / 20** | **100%** | Không bỏ sót case nào theo mẫu số |
| **Case ĐẠT (Passed)** | **16 / 20** | **80.0%** | Mọi tiêu chí của case đều đạt |
| **Case KHÔNG ĐẠT** | **4 / 20** | **20.0%** | Tiêu chí máy kiểm thất bại |
| **Case LỖI (Error)** | **0 / 20** | **0.0%** | Lỗi gọi model / timeout / schema |

## 2. Kết quả phân bổ theo tầng và loại

### Phân bổ theo tầng khó (Tier)

| Tầng | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Thường (`thuong`) | 7 / 8 | 87.5% |
| Khó (`kho`) | 6 / 8 | 75.0% |
| Hiếm (`hiem`) | 3 / 4 | 75.0% |

### Phân bổ theo loại kiểm thử (Kind)

| Loại | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Pipeline (`pipeline`) | 13 / 17 | 76.5% |
| Validator (`validator`) | 1 / 1 | 100.0% |
| Engine (`engine`) | 2 / 2 | 100.0% |

## 3. Danh sách case thất bại xếp theo thứ tự hậu quả (C3-EVAL-10)

| Mức hậu quả | Case ID | Tầng · Kind | Hậu quả phân loại | Chi tiết lỗi |
|---|---|---|---|---|
| Cấp 1 | `H-01` | hiem · pipeline | (1) Rò rỉ canary hoặc nội dung cách ly | Phát hiện rò rỉ 11 chuỗi canary bảo mật |
| Cấp 6 | `N-06` | thuong · pipeline | (6) Định vị sai hoặc đoán bừa | Định vị không khớp kỳ vọng |
| Cấp 7 | `K-02` | kho · pipeline | (7) Bỏ sót vấn đề cần xử lý | Không tìm thấy vấn đề thỏa mãn |
| Cấp 8 | `K-06` | kho · pipeline | (8) Phương án đề xuất kém hoặc tiêu chí phụ | Loại criterion chưa hỗ trợ: split-observation |

## 4. Bảng chi tiết toàn bộ 20 case

| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |
|---|---|---|---|---|---|---|
| `N-01` | thuong | pipeline | ✅ ĐẠT | 93ms | - | 3 / 3 |
| `N-02` | thuong | pipeline | ✅ ĐẠT | 66ms | - | 4 / 4 |
| `N-03` | thuong | pipeline | ✅ ĐẠT | 66ms | - | 3 / 3 |
| `N-04` | thuong | pipeline | ✅ ĐẠT | 78ms | - | 3 / 3 |
| `N-05` | thuong | pipeline | ✅ ĐẠT | 77ms | - | 3 / 3 |
| `N-06` | thuong | pipeline | ❌ KHÔNG ĐẠT | 58ms | - | 2 / 3 |
| `N-07` | thuong | pipeline | ✅ ĐẠT | 46ms | - | 3 / 3 |
| `N-08` | thuong | pipeline | ✅ ĐẠT | 61ms | - | 3 / 3 |
| `K-01` | kho | pipeline | ✅ ĐẠT | 60ms | - | 3 / 3 |
| `K-02` | kho | pipeline | ❌ KHÔNG ĐẠT | 49ms | - | 2 / 3 |
| `K-03` | kho | pipeline | ✅ ĐẠT | 62ms | - | 4 / 4 |
| `K-04` | kho | pipeline | ✅ ĐẠT | 62ms | - | 5 / 5 |
| `K-05` | kho | pipeline | ✅ ĐẠT | 46ms | - | 4 / 4 |
| `K-06` | kho | pipeline | ❌ KHÔNG ĐẠT | 62ms | - | 1 / 3 |
| `K-07` | kho | pipeline | ✅ ĐẠT | 59ms | - | 4 / 4 |
| `K-08` | kho | pipeline | ✅ ĐẠT | 61ms | - | 3 / 3 |
| `H-01` | hiem | pipeline | ❌ KHÔNG ĐẠT | 203ms | - | 1 / 3 |
| `H-02` | hiem | validator | ✅ ĐẠT | 12ms | - | 3 / 3 |
| `H-03` | hiem | engine | ✅ ĐẠT | 5ms | - | 3 / 3 |
| `H-04` | hiem | engine | ✅ ĐẠT | 0ms | - | 3 / 3 |

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |
|---|---|---|
| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |
| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |
