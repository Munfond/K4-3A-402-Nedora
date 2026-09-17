import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadD1RawFeedback } from "../src/lib/revision/load";

type JsonRecord = Record<string, string | number | undefined>;

function parseCsvRows(raw: string): JsonRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...values] = rows.filter((candidate) => candidate.length > 0);
  return values.map((value) =>
    Object.fromEntries(header.map((key, index) => [key, value[index] || ""])),
  );
}

function sameItems(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  );
}

function main(): void {
  const workspaceRoot = resolve(process.cwd());
  const repoRoot = existsSync(resolve(workspaceRoot, "eval"))
    ? workspaceRoot
    : resolve(workspaceRoot, "../..");
  const dataDir = resolve(repoRoot, "apps/www/src/data");
  const contract = JSON.parse(
    readFileSync(resolve(repoRoot, "eval/ingestion-cases.v1.json"), "utf8"),
  );
  const json = JSON.parse(
    readFileSync(resolve(dataDir, "gop-y-mau.json"), "utf8"),
  ) as { gopY: JsonRecord[] };
  const csv = parseCsvRows(
    readFileSync(resolve(dataDir, "khao-sat-mau.csv"), "utf8"),
  );
  const jsonIds = json.gopY.map((item) => String(item.id));
  const csvIds = csv.map((item) => String(item.ma_gop_y || item.id));
  const mergedIds = csvIds.filter((id) => jsonIds.includes(id));
  const surveyOnlyIds = csvIds.filter((id) => !jsonIds.includes(id));
  const records = loadD1RawFeedback(dataDir);
  const gy001 = records.find((item) => item.id === "gy-001");
  const gy019 = records.find((item) => item.id === "gy-019");
  const sourceJson = json.gopY.find((item) => item.id === "gy-001");
  const sourceCsv = csv.find((item) => item.ma_gop_y === "gy-001");
  const modelRecords = records.filter((item) => item.id !== "gy-019");
  const sourceTextById = new Map<string, string>();
  for (const item of json.gopY) {
    sourceTextById.set(String(item.id), String(item.noiDung || ""));
  }
  for (const item of csv) {
    const id = String(item.ma_gop_y || item.id);
    if (!sourceTextById.has(id)) {
      sourceTextById.set(id, String(item.y_kien_them || ""));
    }
  }

  const actual = {
    normalizedCount: records.length,
    modelInputCount: modelRecords.length,
    independentSenderCount: new Set(records.map((item) => item.sender)).size,
    channelCounts: records.reduce<Record<string, number>>((counts, item) => {
      counts[item.channel] = (counts[item.channel] || 0) + 1;
      return counts;
    }, {}),
    mergedIds,
    surveyOnlyIds,
    noTextIds: records
      .filter((item) => !sourceTextById.get(item.id)?.trim())
      .map((item) => item.id),
    gy001Text: gy001?.rawText,
    gy001DeHieu: gy001?.survey?.deHieu,
    gy001NhipDo: gy001?.survey?.nhipDo,
    gy001DiemSo: gy001?.survey?.diemSo,
    gy019Label: gy019?.label,
    allModelRecordsHaveText: modelRecords.every((item) =>
      Boolean(sourceTextById.get(item.id)?.trim()),
    ),
  };

  const expected = contract.cases;
  const checks = [
    actual.normalizedCount === expected[0].expected.normalizedCount,
    actual.modelInputCount === expected[0].expected.modelInputCount,
    actual.independentSenderCount === expected[0].expected.independentSenderCount,
    Object.entries(expected[0].expected.channelCounts).every(
      ([channel, count]) => actual.channelCounts[channel] === count,
    ),
    sameItems(actual.mergedIds, expected[0].expected.mergedIds),
    sameItems(actual.surveyOnlyIds, expected[0].expected.surveyOnlyIds),
    sameItems(actual.noTextIds, expected[0].expected.noTextIds),
    actual.gy001Text === sourceJson?.noiDung,
    actual.gy001DeHieu === Number(sourceCsv?.de_hieu_1_5),
    actual.gy001NhipDo === Number(sourceCsv?.nhip_do_1_5),
    actual.gy001DiemSo === sourceJson?.diemSo,
    actual.gy019Label === "chi-cham-diem",
    actual.allModelRecordsHaveText,
  ];

  console.log(
    `ingestion: ${checks.filter(Boolean).length}/${checks.length} checks passed`,
  );
  if (!checks.every(Boolean)) {
    console.error(JSON.stringify(actual, null, 2));
    process.exitCode = 1;
  }
}

main();
