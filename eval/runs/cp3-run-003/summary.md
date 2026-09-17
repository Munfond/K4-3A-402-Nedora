# Báo cáo kết quả Golden Set (cp3-run-003)

- **Thời điểm chạy:** 2026-09-17T11:24:03.132Z
- **Mô hình:** `mock-agent` *(Chạy giả lập --mock)*
- **Prompt hash:** `f82b058e6d60796a...` (phiên bản `revision-cp3@1`)
- **Golden set:** `eval/golden/golden-set.v1.json` (SHA-256: `0588ca3afdd4cd21...`)
- **Coverage contract:** `eval/golden/COVERAGE-v1.md` (SHA-256: `c6481ba52eaab6df...`)
- **Git commit:** `5177e1c63d7717e13ccf519f2452817f21776f1a`

## 1. Tổng quan số đo

| Chỉ số | Số lượng | Tỉ lệ (%) | Ghi chú |
|---|---|---|---|
| **Tổng số case đã chạy** | **20 / 20** | **100%** | Không bỏ sót case nào theo mẫu số |
| **Case ĐẠT (Passed)** | **20 / 20** | **100.0%** | Mọi tiêu chí của case đều đạt |
| **Case KHÔNG ĐẠT** | **0 / 20** | **0.0%** | Tiêu chí máy kiểm thất bại |
| **Case LỖI (Error)** | **0 / 20** | **0.0%** | Lỗi gọi model / timeout / schema |

## 2. Kết quả phân bổ theo tầng và loại

### Phân bổ theo tầng khó (Tier)

| Tầng | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Thường (`thuong`) | 8 / 8 | 100.0% |
| Khó (`kho`) | 8 / 8 | 100.0% |
| Hiếm (`hiem`) | 4 / 4 | 100.0% |

### Phân bổ theo loại kiểm thử (Kind)

| Loại | Đạt / Tổng | Tỉ lệ (%) |
|---|---|---|
| Pipeline (`pipeline`) | 17 / 17 | 100.0% |
| Validator (`validator`) | 1 / 1 | 100.0% |
| Engine (`engine`) | 2 / 2 | 100.0% |

## 3. Danh sách case thất bại xếp theo thứ tự hậu quả (C3-EVAL-10)

🎉 **Không có case nào thất bại! Mọi kiểm thử đều đạt 100%.**

## 4. Bảng chi tiết toàn bộ 20 case

| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |
|---|---|---|---|---|---|---|
| `N-01` | thuong | pipeline | ✅ ĐẠT | 25ms | - | 3 / 3 |
| `N-02` | thuong | pipeline | ✅ ĐẠT | 6ms | - | 4 / 4 |
| `N-03` | thuong | pipeline | ✅ ĐẠT | 8ms | - | 3 / 3 |
| `N-04` | thuong | pipeline | ✅ ĐẠT | 7ms | - | 3 / 3 |
| `N-05` | thuong | pipeline | ✅ ĐẠT | 8ms | - | 3 / 3 |
| `N-06` | thuong | pipeline | ✅ ĐẠT | 6ms | - | 3 / 3 |
| `N-07` | thuong | pipeline | ✅ ĐẠT | 7ms | - | 3 / 3 |
| `N-08` | thuong | pipeline | ✅ ĐẠT | 6ms | - | 3 / 3 |
| `K-01` | kho | pipeline | ✅ ĐẠT | 6ms | - | 3 / 3 |
| `K-02` | kho | pipeline | ✅ ĐẠT | 8ms | - | 3 / 3 |
| `K-03` | kho | pipeline | ✅ ĐẠT | 9ms | - | 4 / 4 |
| `K-04` | kho | pipeline | ✅ ĐẠT | 6ms | - | 5 / 5 |
| `K-05` | kho | pipeline | ✅ ĐẠT | 6ms | - | 4 / 4 |
| `K-06` | kho | pipeline | ✅ ĐẠT | 6ms | - | 3 / 3 |
| `K-07` | kho | pipeline | ✅ ĐẠT | 8ms | - | 4 / 4 |
| `K-08` | kho | pipeline | ✅ ĐẠT | 8ms | - | 3 / 3 |
| `H-01` | hiem | pipeline | ✅ ĐẠT | 8ms | - | 3 / 3 |
| `H-02` | hiem | validator | ✅ ĐẠT | 0ms | - | 3 / 3 |
| `H-03` | hiem | engine | ✅ ĐẠT | 5ms | - | 3 / 3 |
| `H-04` | hiem | engine | ✅ ĐẠT | 1ms | - | 3 / 3 |

## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)

| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |
|---|---|---|
| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |
| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |
| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |
