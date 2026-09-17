# AI SPEC - C5 FeedbackRadar · Nhóm Nedora · Zone C2

Hướng: [ ] A - VLearn  [ ] B - Trợ lý Học viên  [x] C - Làn mở / C5 FeedbackRadar
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

## §1. User & Job

- Job executor + workflow: người phụ trách sửa video bài giảng sau khi nhận góp ý từ học viên. Workflow hiện tại: đọc nhiều góp ý rời rạc -> mở lại video/kịch bản -> đoán đoạn bị phàn nàn -> quyết định sửa gì -> giao việc thu âm, dựng hình, phụ đề cho bản v2.
- Core JTBD: khi nhận nhiều phản hồi sau khi phát hành bài học, tôi muốn biết chính xác đoạn nào cần sửa và sửa theo cách nào ít tốn công nhất, để bản sau cải thiện đúng vấn đề mà không làm lại thừa.
- Problem statement: người phụ trách phải biến những lời phàn nàn chưa rõ nguyên nhân thành quyết định sửa có căn cứ, trong khi mỗi quyết định sai đều tốn công thu âm, dựng hình và kiểm tra lại.
- Evidence:
  - Nguồn dữ liệu trong repo: `apps/www/src/data/kich-ban-d1.json`, `apps/www/src/data/cau-timecode-d1.csv`, `apps/www/src/data/gop-y-mau.json`, `apps/www/src/data/khao-sat-mau.csv`.
  - Video mẫu D1 có 40 câu, thời lượng khoảng 4 phút 11 giây, có timecode từng câu.
  - Bộ góp ý D1 có 22 góp ý sau khi gộp dữ liệu JSON và khảo sát, từ khoảng 20 người gửi độc lập.
  - Quote 1, `gy-002`: "Phần phân biệt mô hình ngôn ngữ lớn với ứng dụng trò chuyện em xem hai lần vẫn thấy lẫn."
  - Quote 2, `gy-003`: "Em nhắn lại về đoạn ứng dụng trò chuyện với mô hình ngôn ngữ lớn, vẫn chưa rõ lắm ạ."
  - Quote 3, `gy-005`: "Năm giây suy nghĩ ngắn quá, em chưa kịp nghĩ đã thấy đáp án."
  - Quote 4, `gy-006`: "Khoảng dừng để suy nghĩ hơi dài, em thấy sốt ruột, rút ngắn lại được không ạ."
  - Quote 5, `gy-010`: "Chữ trên màn hình ở đoạn ba thẻ ứng dụng bị nhỏ, xem trên điện thoại không đọc được."
  - Quote 6, `gy-015`: "Chỗ giải thích mô hình học máy nằm bên trong bộ lọc em nghe ba lần mới hiểu."
  - Quote 7, `gy-017`: "Phụ đề có chỗ chạy nhanh hơn giọng đọc một chút."

## §2. Impact & Quyết Định Chọn

| Ứng viên | Bằng chứng | Tần suất / người | Tốn gì mỗi lần nếu làm thủ công | Khả thi CP3 | Quyết định |
|---|---:|---:|---|---|---|
| Phân biệt ứng dụng trò chuyện và mô hình phía sau | `gy-002`, `gy-003`, `gy-018`, `gy-022` | 4 góp ý, 2 người độc lập | Xem lại đoạn 20-23, viết lại lời, xác định câu thu âm lại | Cao | Chọn làm happy path |
| Khoảng dừng 5 giây ở câu 35 | `gy-005`, `gy-006` | 2 góp ý, 2 người độc lập nhưng trái chiều | Cần quyết định sư phạm, có thể phải đổi nhịp dựng | Trung bình | Dùng làm case trái chiều |
| Chữ/hình khó đọc trên điện thoại | `gy-010` | 1 góp ý | Cần xem video thủ công, sửa chữ màn hình hoặc dựng lại cảnh | Trung bình | Dùng làm case cần xác nhận |
| Lỗi phụ đề/âm thanh kỹ thuật | `gy-008`, `gy-017` | 2 góp ý | Cần kiểm tra file video/phụ đề, không chỉ sửa kịch bản | Thấp cho CP3 | Hoãn khỏi lát cắt chính |

- Ứng viên đã loại khỏi lát cắt chính:
  - Lỗi kỹ thuật âm thanh/phụ đề vì cần kiểm tra media và pipeline phụ đề, không phù hợp với lát cắt một agent một quyết định.
  - Thay đổi khoảng dừng vì có ý kiến trái chiều, cần người duyệt quyết định sau khi xem bối cảnh sư phạm.
  - Góp ý quá chung hoặc không định vị được vì rủi ro sửa sai cao.
- Ứng viên chọn: vùng câu 21-22, nơi người học nhầm giữa "ứng dụng" và "mô hình". Lý do: có nhiều bằng chứng nhất trong pack, gắn được câu/timecode, có thể sửa bằng một patch lời đọc rõ ràng và tính được chi phí v2.

## §3. Giải Pháp Tương Tự Đã Nghiên Cứu

- Google Forms + Sheets: dễ thu thập phản hồi, nhưng không tự nối phản hồi với câu trong kịch bản, không tính được phạm vi thu âm/dựng lại.
- Frame.io / công cụ review video theo timestamp: mạnh ở bình luận gắn thời điểm, nhưng không hiểu cấu trúc kịch bản theo câu và không tạo gói sửa v2.
- Descript / công cụ sửa video theo transcript: mạnh ở sửa transcript và media, nhưng không giải quyết bước tổng hợp nhiều góp ý thành quyết định sửa có bằng chứng.
- Khác biệt của FeedbackRadar: đặt "góp ý -> vấn đề -> câu/timecode -> phương án sửa -> gói việc v2" vào cùng một luồng, có validator và trace để không sửa dựa trên cảm giác.

## §4. Thiết Kế

- Lát cắt một câu: người phụ trách sửa video chọn video D1 và bộ góp ý, hệ thống phân tích vùng gây khó hiểu tại câu 21-22, đề xuất một sửa lời đọc có bằng chứng, người phụ trách duyệt để nhận gói việc bản v2.
- Canvas CP1: https://docs.google.com/document/d/1b4JB1_1DdvT_NqlZ77gfm0GU42DOHuIq_PSmgP1yWCQ/edit?tab=t.0
- Non-goals:
  - Không tự dựng video v2 hoàn chỉnh.
  - Không tự sửa file mp4, file âm thanh, hoặc phụ đề thật.
  - Không chèn/xóa câu trong kịch bản ở CP3.
  - Không thay database/đăng nhập/Slack thành luồng sản phẩm chính.
  - Không dùng kết quả mẫu tĩnh để giả làm kết quả model khi nộp AI thật.
- Mức prototype nhắm tới: Working prototype.
  - Thật: đọc kịch bản/timecode/góp ý, sanitize, ghi run trace, validate output, gom hồ sơ quyết định, lưu quyết định localStorage, tính phạm vi thu âm/dựng/phụ đề, xuất `kich-ban-v2.json`, `kich-ban-v2.md`, `viec-can-lam.csv`, `truy-vet.json`.
  - AI thật: có đường gọi model qua `packages/ai/src/agents/revision` khi cấu hình `REVISION_MODEL` và API key.
  - Mock/fallback: khi chưa có API key, API có `mock-agent` để demo UI trung thực là giả lập; phần này không dùng để khai "AI thật".
- Automation: [x] augment  [x] conditional  [ ] automate.
  - Lý do: chi phí sửa sai cao vì patch sai có thể làm thu âm/dựng lại thừa. Hệ thống chỉ đề xuất và tính tác động; người duyệt vẫn bấm chọn/hoãn/bỏ trước khi xuất.

### §4b. Nguyên Tắc Đã Áp Dụng

| Nguyên tắc | Áp cụ thể vào prototype |
|---|---|
| Human-in-the-loop cho hành động rủi ro | Patch không áp vào kịch bản v2 cho tới khi người duyệt chọn phương án. |
| Hiển thị bằng chứng và nguồn | Mỗi hồ sơ có feedback IDs, câu liên quan, timecode, lý do và trace run. |
| Tách phần xác suất và phần xác định | Model chỉ đề xuất; code kiểm schema, ID, câu, before/after, conflict và xuất file. |
| Fail fast khi cấu hình hoặc dữ liệu hỏng | Thiếu model/API key ở chế độ thật trả lỗi; cấu trúc kịch bản/timecode sai thì chặn. |
| Giảm rủi ro rò rỉ | Sanitize PII, cách ly prompt injection/công kích, chạy `check:leaks`. |
| Cho phép sửa quyết định | Người duyệt có thể chọn, hoãn, bỏ hoặc reset quyết định theo từng hồ sơ. |

## §5. Kiểu Lỗi

| Lớp | Kịch bản lỗi | Ví dụ / case | Cách prototype xử lý | Tiêu chí đạt |
|---|---|---|---|---|
| ① Không căn cứ | Góp ý khen hoặc chỉ chấm điểm nhưng bị biến thành vấn đề | `gy-004`, `gy-019` | Gán nhãn không tạo issue | Không xuất hiện trong hồ sơ sửa |
| ① Không căn cứ | Model trích feedback ID không tồn tại | fixture `H-01` | Validator báo `UNKNOWN_FEEDBACK_ID` | Không crash, có finding |
| ② Low-confidence | Góp ý chung chung, không nói rõ đoạn nào | `K-01` | Hồ sơ `can-xac-nhan`, không ép thành vùng chắc chắn | UI hiện cần xác nhận |
| ② Low-confidence | Vị trí trải quá rộng hơn 5 câu | `gy-010` | Hạ độ chắc, yêu cầu xem lại video | Không gom bừa thành patch rộng |
| ③ Ngoài phạm vi | Đề xuất chèn/xóa câu hoặc đổi khoảng dừng | `unsupportedOperation: chen-cau` | Gắn `ngoai-pham-vi`, disable chọn | Không xuất patch giả |
| ③ Ngoài phạm vi | Lỗi kỹ thuật âm thanh/phụ đề cần xử lý media | `gy-008`, `gy-017` | Tạo việc kỹ thuật / cần xác nhận | Không sửa lời để che lỗi kỹ thuật |
| ④ Đặc thù domain | Đổi lời câu n cần thu lại thêm câu n-1 và n+1 | case câu 21 | Release engine mở rộng ngữ cảnh | Việc thu âm gồm câu 20-22 |
| ④ Đặc thù domain | Gặp câu khoảng lặng 5 giây | câu 35, `H-02` | Không tự sửa lời cho câu im lặng; cảnh báo/hoãn | Không phá cấu trúc 40 câu |
| ④ Đặc thù domain | Hai phương án cùng sửa khác nội dung vào một trường | `H-04` | Chặn xuất vì conflict | Trả lỗi conflict, không xuất sai |
| ④ Đặc thù domain | `before` không khớp kịch bản gốc | fixture `H-01` | Báo `PATCH_STALE` | Patch không hợp lệ |

## §6. Bốn Đường Đi Của Trải Nghiệm

- Happy path: mở video D1 -> xem góp ý -> bấm phân tích -> hệ thống tạo vùng sửa câu 21-22 -> người duyệt xem bằng chứng và phương án A -> đồng ý -> tab bàn giao tính câu thu lại/dựng/phụ đề -> tải 4 file.
- Low-confidence (②): góp ý không chỉ rõ câu hoặc trải rộng nhiều câu -> hệ thống đưa vào nhóm cần xác nhận, hiện lý do và không bắt người dùng chọn patch cứng.
- Failure / không căn cứ (①): góp ý là khen, chỉ chấm điểm, ID lỗi, hoặc không đủ bằng chứng -> không tạo hồ sơ sửa; validator ghi finding nếu output model sai.
- Correction: người duyệt đổi ý từ chọn sang hoãn/bỏ/reset; gói v2 tính lại theo quyết định mới và không giữ patch cũ.
- Khi bị đòi ngoài phạm vi (③): chèn câu, xóa câu, đổi khoảng dừng, xử lý file âm thanh/phụ đề thật -> hiện ngoài phạm vi hoặc việc kỹ thuật, không giả vờ đã áp dụng.
- Case đặc thù domain (④): đổi lời một câu kéo theo thu âm câu trước/sau; câu khoảng lặng 35 là ranh giới cần xử lý riêng; xung đột patch cùng field bị chặn trước khi xuất.

## §7. Kiểm Thử

- Chiều chất lượng:
  - Định vị: vấn đề phải gắn đúng câu hoặc đánh dấu cần xác nhận.
  - Bằng chứng: mọi issue phải truy về feedback ID hợp lệ, không dùng góp ý cách ly/khen/chỉ chấm điểm làm bằng chứng.
  - Patch: before khớp kịch bản gốc, after hợp lệ, không sửa câu không tồn tại.
  - Release: chỉ patch đã duyệt được áp dụng; tính đúng việc thu âm/dựng/phụ đề; không xuất khi conflict.
  - An toàn: không rò rỉ PII/canary/prompt injection vào bundle, trace hoặc file xuất.
- Golden set:
  - File: `eval/golden-set.v1.json`.
  - Cơ cấu hiện có: 20 case gồm 8 thường, 8 khó, 4 hiếm; 17 pipeline, 1 validator, 2 engine.
  - Trace chính thức/mock: `eval/runs/cp3-run-001/` và `eval/runs/c5-smoke-mock/`.
- Quality bar chốt cho CP3/CP4:
  - Đạt khi ít nhất 80% case golden set pass.
  - Bắt buộc thêm: 0 lỗi build/typecheck, 0 rò rỉ canary, export self-check đạt, không dùng `ket-qua-mau.json` trên đường chạy chính.
  - Để khai "AI thật" trong form CP3: cần ít nhất một lượt chạy có `REVISION_MODEL` + API key thật, có video quay màn hình và trace run tương ứng. 
- Kết quả hiện tại:

| Lượt chạy / kiểm tra | Chế độ | Kết quả | Ghi chú |
|---|---|---:|---|
| `corepack pnpm --filter www typecheck` | code | Đạt | TypeScript sạch sau khi sửa |
| `corepack pnpm --filter www build` | code | Đạt | Next build qua |
| `corepack pnpm --filter www check:leaks` | code | Đạt | 0 canary leak, 0 import mock data ở đường chạy chính |
| `eval/runs/cp3-run-001` | mock-agent | 20/20 | Chỉ dùng làm smoke/golden mock, không gọi model thật |
| `eval/golden/golden-set.v1.json` | model thật | 19/20 | Kết quả khi test với việc gọi model AI thật

## §8. Phân Công & Kế Hoạch

- Phân công có tên:
  - Spec: Vũ Quang Tiến
  - Evidence/dữ liệu: Nguyễn Hoàng Duy
  - Prompt/schema/agent: Nguyễn Đức Anh
  - Code UI/API/release engine: Nguyễn Đặng Nam Khánh
  - Demo/video/form CP3: Nguyễn Đặng Nam Khánh
- Willing users:
  - Ngô Minh Trí
  - Nguyễn Thanh Dương
  - Trần Quốc Bảo Long
  - Đào Thanh Trường
- Kế hoạch validation tiếp:
  - Vòng 1: 2 người trong nhóm thao tác happy path trên D1, ghi lại nơi bị kẹt.
  - Vòng 2: 2 người ngoài nhóm đưa góp ý tự nhiên cho một đoạn video, đo xem hệ thống định vị đúng/không.
  - Vòng 3: chạy lại golden set sau mỗi lần đổi prompt/model, so sánh với quality bar.
- Multi-prototype:
  - Phương án A: bảng 3 cột trong ngữ cảnh video, ưu tiên duyệt nhanh theo vùng sửa.
  - Phương án B: các trang rời `/van-de`, `/gop-y`, `/xuat`, ưu tiên báo cáo và truy vết.
  - Chọn A làm demo chính vì người duyệt thấy ngay video, góp ý, hồ sơ quyết định và gói v2 trong cùng một workflow.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
| 2026-09-17 | Chọn lát cắt C5 FeedbackRadar thay vì tài liệu CP3 cũ | Repo hiện là `FeedbackRadar (C5) - Nedora`, cần nộp đúng hướng |
| 2026-09-17 | Bổ sung working flow video D1 -> góp ý -> phân tích -> duyệt -> bàn giao v2 | Phù hợp yêu cầu quay màn hình thao tác |
| 2026-09-17 | Sửa thiếu export `resolveRevisionModelId` | Build lỗi khi `service.ts` import từ package AI |
| 2026-09-17 | Sửa payload phân tích từ trang video | UI gửi sai field nên API trả lỗi input |
| 2026-09-17 | Thêm fallback `mock-agent` khi thiếu API key | Để demo local không cần `.env`, đồng thời vẫn ghi rõ mock |
| 2026-09-17 | Chạy typecheck, build, check leaks và golden mock | Tạo bằng chứng kỹ thuật trước khi quay/nộp |
