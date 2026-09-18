import assert from "node:assert/strict";

export class TestSuite {
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  constructor(public name: string) {
    console.log(`\n======================================================`);
    console.log(`TEST SUITE: ${name}`);
    console.log(`======================================================`);
  }

  assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ĐẠT: ${testName}`);
      this.passed++;
    } else {
      console.error(`  ✗ THẤT BẠI: ${testName}`);
      if (detail) console.error(`    Chi tiết: ${detail}`);
      this.failed++;
    }
  }

  skip(testName: string, reason: string) {
    console.log(`  ⊘ BỎ QUA (${reason}): ${testName}`);
    this.skipped++;
  }

  async run(testName: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ĐẠT: ${testName}`);
      this.passed++;
    } catch (err: any) {
      console.error(`  ✗ THẤT BẠI: ${testName}`);
      console.error(`    Lỗi: ${err?.message || err}`);
      this.failed++;
    }
  }

  summary(): boolean {
    console.log(`------------------------------------------------------`);
    console.log(
      `Tổng kết [${this.name}]: ${this.passed} Đạt | ${this.failed} Thất bại | ${this.skipped} Bỏ qua`,
    );
    if (this.failed > 0) {
      return false;
    }
    return true;
  }
}

export function skip(reason: string) {
  console.log(`\n  ⊘ BỎ QUA: ${reason}`);
}

export { assert };
