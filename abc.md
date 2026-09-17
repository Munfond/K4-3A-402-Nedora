# Vấn đề
Vấn đề đáng giải quyết là: đội sản xuất phải biến những lời phàn nàn chưa rõ nguyên nhân thành quyết định sửa có căn cứ, trong khi mỗi quyết định sai đều làm tốn công thu âm và dựng lại. 

Khi chuẩn bị phiên bản tiếp theo, giúp người duyệt xác định những thay đổi có đủ bằng chứng, xử lý đúng trở ngại được phản ánh và có phạm vi làm lại rõ ràng.

**1. Revision Planner — Biến góp ý thành các phương án sửa có bằng chứng, rồi gom lại thành một gói sửa không trùng việc cho phiên bản sau**

**Lời hứa:** "Cho tôi biết cần sửa gì, vì sao, có những cách sửa nào, và nếu chọn thì cả phiên bản phải làm lại những gì."

Người phụ trách nạp phản hồi (bình luận, tin nhắn, bảng khảo sát), kịch bản và bảng câu ↔ timecode. Hệ thống làm việc ở hai tầng. Tầng hồ sơ quyết định là nơi người duyệt chọn phương án cho từng vùng sửa. Tầng gói phát hành là bức tranh cả phiên bản, do code tự tính lại sau mỗi lựa chọn.

**Bước nền: tìm và định vị vấn đề**

| Bước | Ai làm | Kết quả |
|---|---|---|
| Làm sạch | Code | Xóa thông tin cá nhân, gán ID, gộp theo người gửi |
| Hiểu và định vị | AI | Mỗi góp ý được gán câu hoặc khoảng câu, loại vấn đề, độ chắc; gắn cờ nhiễu, công kích, cài lệnh |
| Hình thành vấn đề | Code | Gom theo câu × loại, đếm người độc lập, gắn cờ trái chiều; lỗi nội dung sai được giữ dù chỉ một người nói |
| Chia vùng sửa | Code | Các vấn đề có khoảng câu chồng lấn hoặc liền kề được đưa vào cùng một vùng |

Góp ý bị gắn cờ không đi tiếp vào bước lập phương án. Lời công kích không được trích nguyên văn ở bất kỳ đâu.

**Tầng 1: Hồ sơ quyết định cho mỗi vùng sửa**

| Thành phần | Nội dung |
|---|---|
| Vấn đề | Người học vướng gì trong vùng này; câu và mốc thời gian, bấm vào là phát đúng đoạn |
| Bằng chứng | Góp ý gốc theo ID, số người độc lập, ý kiến trái chiều |
| Điều chưa rõ | Vị trí chưa chắc, nguyên nhân mới là giả thuyết, phần hình ảnh hệ thống không nhìn thấy |
| Phương án | Một hoặc hai cách sửa thực sự khác nhau; có thể đề nghị hoãn hoặc giữ nguyên |
| Vấn đề được giải | Mỗi phương án giải quyết vấn đề nào trong vùng, vấn đề nào còn lại |
| Phạm vi làm lại | Lời cần đổi, câu cần thu lại, cảnh và phụ đề cần cập nhật, ảnh hưởng dây chuyền sang câu liền kề |
| Quyết định | Chọn phương án, sửa tay, hoãn hoặc từ chối |

**Ví dụ minh họa** (số câu và số người là giả định): Vùng câu 14–17 có ba nhóm góp ý: "giải thích token dài" (2 người), "vẫn không hiểu token khác từ" (4 người), và "ví dụ ở đoạn token khó theo" (2 người).

Hệ thống không quyết định theo bên đông hơn, và cũng không mặc định gộp là tốt hơn. Phương án gộp luôn được đặt cạnh phương án sửa riêng, để người duyệt so trên cùng đơn vị công việc:

| Phương án | Cách xử lý | Vấn đề được giải | Phạm vi làm lại |
|---|---|---|---|
| A · Gộp | Thay đoạn định nghĩa ở câu 15–17 bằng một ví dụ chia token cụ thể | Cả ba | Thu lại 3 câu, cập nhật 2 cảnh |
| B · Sửa riêng | Rút gọn câu 15, thêm một câu phân biệt token với từ sau câu 16 | "Dài" và "không hiểu"; ví dụ khó theo vẫn còn | Thu lại 1 câu, thu mới 1 câu, dựng lại 2 cảnh |
| Hoãn | Chưa sửa, yêu cầu xác nhận đoạn hoặc nội dung đang vướng | Chưa giải | Không có |

Các phương án chỉ xuất hiện khi phù hợp với nội dung thực tế; không bắt vùng nào cũng phải có đủ hai lựa chọn. Nếu một phương án đề xuất sửa hình, hồ sơ luôn ghi rõ cần người xem lại đoạn video để xác nhận, vì hệ thống chỉ đọc được kịch bản và bản chép lời.

**Tầng 2: Gói phát hành cho cả phiên bản**

Mỗi khi người duyệt ra một quyết định, code tính lại toàn bộ gói:

| Nội dung | Đầu ra |
|---|---|
| Được xử lý | Các vấn đề đã có phương án được chọn, kèm bằng chứng |
| Chưa xử lý | Các vấn đề bị hoãn hoặc từ chối, kèm lý do |
| Thay đổi hợp nhất | Câu, cảnh, phụ đề thực sự cần làm, không đếm trùng giữa các vùng |
| Xung đột | Phương án ở vùng này làm thay đổi một câu đang có đề xuất khác ở vùng kia |
| Nguồn lực | Tổng việc so với giới hạn người duyệt tự đặt (ví dụ tối đa 8 câu thu lại), đơn vị tính tra theo bảng chi phí làm lại |
| Bàn giao | Kịch bản mới theo mẫu chung, danh sách thu âm, dựng hình và phụ đề |

**Luồng chạy:** Người duyệt chọn A ở vùng câu 14–17 → hệ thống áp dụng vào bản nháp → code phát hiện lời mới ở câu 17 dài hơn, kéo theo cảnh câu 18 phải dựng lại, trong khi câu 18 đang có đề xuất ở vùng bên cạnh → cảnh báo ngay để người duyệt điều chỉnh → gói phát hành cập nhật tổng việc → xuất kịch bản mới và danh sách việc cần làm.

**AI tạo giá trị ở đâu?** Hiểu góp ý mơ hồ và gắn vào đúng câu, giữ được bất đồng, đối chiếu kịch bản để nêu nguyên nhân giả thuyết, dựng các phương án thực sự khác nhau và nói rõ mỗi phương án giải được vấn đề nào.

Code đảm nhiệm phần còn lại: xóa thông tin cá nhân, đếm người, quản lý ID, chia vùng, tính phạm vi làm lại và ảnh hưởng dây chuyền, bắt xung đột, áp dụng thay đổi và xuất file. Người duyệt quyết định mọi thay đổi; AI không có quyền ghi vào kịch bản, nên góp ý cài lệnh không có đường để tác động.

**Vì sao chọn hướng này:** Revision Copilot mạnh ở từng quyết định nhưng chỉ thấy xung đột sau khi đã chọn. Release Planner thấy được cả phiên bản nhưng dễ neo người duyệt vào một kế hoạch do AI tự gộp, vừa khó kiểm chứng vừa dễ thành sửa rộng.

Bản hợp nhất giữ quyền chọn ở từng vùng, còn việc gộp, loại trùng và bắt xung đột do code làm liên tục. Nhờ vậy nó đánh thẳng vào nỗi đau gốc của đề: làm lại gần như cả video dù chỉ vài câu có vấn đề.

**Không làm:** không dựng video; không tự áp dụng thay đổi khi chưa được duyệt; không soát lại toàn bộ kịch bản; không tự quy đổi ra tiền ngoài bảng chi phí được cấp.

**Điểm phải chứng minh:** So với cùng model được prompt "đọc góp ý và kịch bản, lập kế hoạch sửa", chạy trên cùng bộ dữ liệu có đáp án, hệ thống phải:

- tìm đúng nhiều vấn đề hơn và bỏ sót ít hơn;
- định vị đúng câu nhiều hơn;
- đề xuất số câu thu lại sát đáp án hơn, tức ít sửa thừa;
- phát hiện được các xung đột đã cài sẵn trong dữ liệu;
- không đi theo phía đông người hơn ở các ca trái chiều mà không gắn cờ;
- có 100% đề xuất truy ngược được về góp ý gốc.

Thời gian duyệt đo được từ người dùng thử chỉ là bằng chứng bổ sung, không phải tuyên bố chính.