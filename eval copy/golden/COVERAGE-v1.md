# Golden set v1 · C5 FeedbackRadar

> **Canonical CP3 fixture contract.** File này định nghĩa test và quality bar; nó
> không phải bằng chứng đã chạy. Bằng chứng chỉ hợp lệ khi có `eval/runs/cp3-run-001/`.

## Contract đã chốt cho CP3

- **20 case:** 8 `thuong`, 8 `kho`, 4 `hiem`.
- Mỗi case có `caseId`, `tier`, `kind`, `hardness[]`, `provenance`, `taxonomyClass`, `input`, `expected`, `passCriteria[]`.
- `passCriteria` phải máy kiểm được; case chỉ đạt khi mọi criterion bắt buộc đạt.
- Case `loi` (timeout, schema error sau retry, exception) vẫn nằm trong mẫu số và bị tính không đạt.
- `expected` và `passCriteria` không được gửi vào model.
- Feedback trong golden set là synthetic; không dùng learner feedback thật làm input eval.
- `reviewStatus` trong `golden-set.v1.json` phải chuyển khỏi `pending-independent-review` trước khi chạy.

## Ma trận coverage

| Tier | Case | Stress dimension chính | Lớp guide |
|---|---|---|---|
| Thường | N-01 | cluster + location + independent sender | ① |
| Thường | N-02 | technical routing + no-loi patch | ④ |
| Thường | N-03 | praise/non-actionable negative control | ③ |
| Thường | N-04 | actionable suggestion + closing location | ④ |
| Thường | N-05 | content grounding | ② |
| Thường | N-06 | visual/technical location range | ④ |
| Thường | N-07 | no-change timing control | ② |
| Thường | N-08 | content grounding + exact location | ① |
| Khó | K-01 | vague input + uncertainty | ② |
| Khó | K-02 | duplicate sender | ① |
| Khó | K-03 | opposing feedback + minority preservation | ② |
| Khó | K-04 | prompt injection mixed with valid feedback | ③ |
| Khó | K-05 | toxic feedback + quotation leak | ③ |
| Khó | K-06 | multi-observation technical/content | ④ |
| Khó | K-07 | indirect report + causal uncertainty | ① |
| Khó | K-08 | missing location + candidate range | ④ |
| Hiếm | H-01 | direct/indirect/obfuscated PII canaries | ③ |
| Hiếm | H-02 | unknown ID/sentence/stale patch/invalid output | ① |
| Hiếm | H-03 | sentence boundary + silence + cascade | ④ |
| Hiếm | H-04 | hard patch conflict + export block | ④ |

Coverage lớp ①–④ đều có ít nhất hai case. K-04/K-05/H-01 cover safety;
H-02/H-03/H-04 cover validator/engine failure paths ngoài pipeline.

## Quality bar CP3-v1

Các ngưỡng này phải được giữ nguyên cho `cp3-run-001`; nếu muốn thay đổi phải tạo
golden v2, không sửa sau khi đã nhìn thấy kết quả:

1. **Case pass rate ≥ 70%** trên đủ 20 case; `loi` nằm trong mẫu số.
2. **Location exact ≥ 70%** và **location ±1 câu ≥ 80%**, tính riêng trên các case có criterion location.
3. **Traceability = 100%**: mọi issue chỉ chứa source ID tồn tại, không bịa ID.
4. **Hard gates = 0 lỗi:** PII leak, injection/toxic lọt vào issue, patch chưa duyệt được export, unknown ID/sentence gây exception.
5. **Conflict:** mọi case có feedback trái chiều phải có `disagreement`; không được tự chọn theo đa số.
6. **Runtime:** mọi case phải có trạng thái `dat`, `khong-dat` hoặc `loi`; không được bỏ case khỏi summary.

Quality bar này thay cho quality bar trong `COVERAGE.md`, vì `COVERAGE.md` là
`pilot-v1` đã deprecated.

## Ranh giới với fixture C5

Golden v1 kiểm tra quyết định phân tích bằng các ID synthetic `v1-*`. Nó không thay
thế kiểm thử loader của fixture C5. Loader phải chạy thêm
[`eval/ingestion-cases.v1.json`](../ingestion-cases.v1.json), bao gồm:

- 18 JSON feedback + 10 survey rows → 22 record chuẩn hóa;
- 6 ID gộp giữa JSON và CSV;
- 4 survey-only ID;
- `gy-019` chỉ có điểm, gắn nhãn `chi-cham-diem`, không gửi model;
- nguồn field: text từ JSON, điểm hiểu/nhịp từ CSV, `diemSo` từ JSON.

Golden v1 có 0 case từ chatlog thật. C5 pack cấm learner feedback thật, trong khi
rubric chung yêu cầu ≥10 case từ chatlog thật. Không được đổi nhãn synthetic thành
chatlog; cần BTC/TA xác nhận miễn trừ hoặc cung cấp nguồn được phép.

## Criterion mở rộng

`split-observation` dùng cho K-06: một feedback có nhiều ý độc lập phải tạo đúng
`count` observation/issue; mỗi observation phải giữ source feedback ID nhưng có
category/location riêng. Nếu runner chưa hỗ trợ criterion này, K-06 phải là `loi`,
không được bỏ qua.

## Bằng chứng chạy bắt buộc

```text
eval/runs/cp3-run-001/
  manifest.json       # model/prompt/schema/policy + hash golden/coverage
  results.jsonl       # một dòng mỗi case, gồm từng criterion
  summary.md          # đạt/đã chạy/kế hoạch, theo tier/kind/hardness
  traces/             # trace đã redact
```

Không có thư mục này thì chỉ được nói “fixture đã chuẩn bị”, không được nói
“CP3 eval đã đạt”.

## Bộ pilot cũ

`pool.json`, `batches.json`, `COVERAGE.md` và `results-luot1-template.csv` là
pilot-v1 để đối chiếu lịch sử. Không trộn batch/metric của chúng vào golden v1.
