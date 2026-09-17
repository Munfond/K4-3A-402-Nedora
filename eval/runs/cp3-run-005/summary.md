# Báo cáo kết quả Golden Set (cp3-run-005)

- **Thời điểm chạy:** 2026-09-17T11:35:01.030Z
- **Mô hình:** `openai/gpt-4o-mini`
- **Prompt hash:** `f82b058e6d60796a...` (phiên bản `revision-cp3@1`)
- **Golden set:** `eval/golden/golden-set.v1.json` (SHA-256: `0588ca3afdd4cd21...`)
- **Coverage contract:** `eval/golden/COVERAGE-v1.md` (SHA-256: `c6481ba52eaab6df...`)
- **Git commit:** `5177e1c63d7717e13ccf519f2452817f21776f1a`

## 1. Tổng quan số đo

| Chỉ số | Số lượng | Tỉ lệ (%) | Ghi chú |
|---|---|---|---|
| **Tổng số case đã chạy** | **20 / 20** | **100%** | Không bỏ sót case nào theo mẫu số |
| **Case ĐẠT (Passed)** | **13 / 20** | **65.0%** | Mọi tiêu chí của case đều đạt |
| **Case KHÔNG ĐẠT** | **7 / 20** | **35.0%** | Tiêu chí máy kiểm thất bại |
| **Case LỖI (Error)** | **0 / 20** | **0.0%** | Lỗi gọi model / timeout / schema |

## 2. Kết quả phân bổ theo tầng và loại

### Phân bổ theo tầng khó (Tier)

| Tầng | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Thường (`thuong`) | 5 / 8 | 62.5% |
| Khó (`kho`) | 5 / 8 | 62.5% |
| Hiếm (`hiem`) | 3 / 4 | 75.0% |

### Phân bổ theo loại kiểm thử (Kind)

| Loại | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Pipeline (`pipeline`) | 10 / 17 | 58.8% |
| Validator (`validator`) | 1 / 1 | 100.0% |
| Engine (`engine`) | 2 / 2 | 100.0% |

## 3. Danh sách case thất bại xếp theo thứ tự hậu quả (C3-EVAL-10)

| Mức hậu quả | Case ID | Tầng · Kind | Hậu quả phân loại | Chi tiết lỗi |
|---|---|---|---|---|
| Cấp 6 | `N-02` | thuong · pipeline | (6) Định vị sai hoặc đoán bừa | Định vị không khớp kỳ vọng |
| Cấp 6 | `N-06` | thuong · pipeline | (6) Định vị sai hoặc đoán bừa | Định vị không khớp kỳ vọng |
| Cấp 7 | `N-01` | thuong · pipeline | (7) Bỏ sót vấn đề cần xử lý | Không tìm thấy vấn đề thỏa mãn |
| Cấp 7 | `K-02` | kho · pipeline | (7) Bỏ sót vấn đề cần xử lý | Không tìm thấy vấn đề thỏa mãn |
| Cấp 8 | `K-06` | kho · pipeline | (8) Phương án đề xuất kém hoặc tiêu chí phụ | Kỳ vọng 2 observation, nhận 1 |
| Cấp 8 | `K-08` | kho · pipeline | (8) Phương án đề xuất kém hoặc tiêu chí phụ | Thiếu giả thuyết và điểm chưa chắc chắn |
| Cấp 8 | `H-01` | hiem · pipeline | (8) Phương án đề xuất kém hoặc tiêu chí phụ | Có ID xuất hiện trong vấn đề |

## 4. Bảng chi tiết toàn bộ 20 case

| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |
|---|---|---|---|---|---|---|
| `N-01` | thuong | pipeline | ❌ KHÔNG ĐẠT | 9979ms | 7319 | 2 / 3 |
| `N-02` | thuong | pipeline | ❌ KHÔNG ĐẠT | 6276ms | 7148 | 3 / 4 |
| `N-03` | thuong | pipeline | ✅ ĐẠT | 4191ms | 6575 | 3 / 3 |
| `N-04` | thuong | pipeline | ✅ ĐẠT | 4524ms | 7023 | 3 / 3 |
| `N-05` | thuong | pipeline | ✅ ĐẠT | 4662ms | 7028 | 3 / 3 |
| `N-06` | thuong | pipeline | ❌ KHÔNG ĐẠT | 3934ms | 7024 | 2 / 3 |
| `N-07` | thuong | pipeline | ✅ ĐẠT | 1614ms | 6587 | 3 / 3 |
| `N-08` | thuong | pipeline | ✅ ĐẠT | 5341ms | 7056 | 3 / 3 |
| `K-01` | kho | pipeline | ✅ ĐẠT | 2215ms | 6729 | 3 / 3 |
| `K-02` | kho | pipeline | ❌ KHÔNG ĐẠT | 7325ms | 7287 | 2 / 3 |
| `K-03` | kho | pipeline | ✅ ĐẠT | 4796ms | 7148 | 4 / 4 |
| `K-04` | kho | pipeline | ✅ ĐẠT | 4382ms | 7070 | 5 / 5 |
| `K-05` | kho | pipeline | ✅ ĐẠT | 1292ms | 6591 | 4 / 4 |
| `K-06` | kho | pipeline | ❌ KHÔNG ĐẠT | 3515ms | 6953 | 2 / 3 |
| `K-07` | kho | pipeline | ✅ ĐẠT | 3851ms | 7049 | 4 / 4 |
| `K-08` | kho | pipeline | ❌ KHÔNG ĐẠT | 2359ms | 6701 | 2 / 3 |
| `H-01` | hiem | pipeline | ❌ KHÔNG ĐẠT | 5041ms | 7630 | 2 / 3 |
| `H-02` | hiem | validator | ✅ ĐẠT | 0ms | - | 3 / 3 |
| `H-03` | hiem | engine | ✅ ĐẠT | 3ms | - | 3 / 3 |
| `H-04` | hiem | engine | ✅ ĐẠT | 0ms | - | 3 / 3 |

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |
|---|---|---|
| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |
| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |
