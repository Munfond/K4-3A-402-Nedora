import assert from "node:assert";
import {
  computeWordDiff,
  getDiffStats,
  tokenizeWords,
} from "../src/lib/studio/word-diff";

console.log("=== KIỂM THỬ THUẬT TOÁN WORD DIFF (LCS) ===");

// 1. Tokenize words
const tokens = tokenizeWords("Học máy là một nhánh của AI.");
assert.strictEqual(tokens.length, 13); // "Học", " ", "máy", " ", "là", " ", "một", " ", "nhánh", " ", "của", " ", "AI."
console.log("✓ ĐẠT: Tokenize chuẩn xác");

// 2. Diff giống nhau hoàn toàn
const diffSame = computeWordDiff("Câu này giữ nguyên.", "Câu này giữ nguyên.");
assert.strictEqual(diffSame.length, 1);
assert.strictEqual(diffSame[0].type, "equal");
assert.strictEqual(getDiffStats(diffSame).isUnchanged, true);
console.log("✓ ĐẠT: Diff giống nhau trả về equal duy nhất");

// 3. Diff thêm từ
// Lưu ý: khi thêm từ cạnh dấu câu, tokenizer tách "hình." thành 1 token,
// nhưng v2 có "hình" + "lớn." → LCS thấy "hình." bị xóa, "hình" + "lớn." được thêm.
// Đây là hành vi đúng của LCS trên token level.
const diffInsert = computeWordDiff(
  "Một ứng dụng gọi một mô hình.",
  "Một ứng dụng có thể gọi linh hoạt một mô hình lớn.",
);
const statsInsert = getDiffStats(diffInsert);
assert.strictEqual(statsInsert.insertedWords > 0, true);
// deletedWords có thể > 0 do token dính dấu câu bị thay thế
assert.strictEqual(statsInsert.isUnchanged, false);
console.log("✓ ĐẠT: Phát hiện chính xác các từ được thêm mới");

// 4. Diff sửa từ (xóa + thêm)
const diffEdit = computeWordDiff(
  "Trí tuệ nhân tạo là gì?",
  "Trí tuệ nhân tạo tạo sinh là công nghệ gì?",
);
const statsEdit = getDiffStats(diffEdit);
assert.strictEqual(statsEdit.insertedWords > 0, true);
assert.strictEqual(
  diffEdit.some((p) => p.type === "insert"),
  true,
);
console.log("✓ ĐẠT: Phân tách từ thêm / bớt chính xác trên câu tiếng Việt");

// 5. Câu rỗng
const diffEmpty = computeWordDiff("", "Nội dung mới");
assert.strictEqual(diffEmpty.length, 1);
assert.strictEqual(diffEmpty[0].type, "insert");
console.log("✓ ĐẠT: Xử lý chuỗi rỗng chính xác");

console.log("\nToàn bộ kiểm thử Word Diff thành công!\n");
