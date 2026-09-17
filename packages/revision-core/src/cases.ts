import type {
  DecisionCase,
  ImpactLevel,
  IssueItem,
  RevisionOption,
  ScriptData,
} from "./types";

const IMPACT_RANK: Record<ImpactLevel, number> = {
  cao: 3,
  vua: 2,
  thap: 1,
};

function doIntervalsOverlapOrTouch(ns1: number[], ns2: number[]): boolean {
  if (ns1.length === 0 || ns2.length === 0) return false;
  const min1 = Math.min(...ns1);
  const max1 = Math.max(...ns1);
  const min2 = Math.min(...ns2);
  const max2 = Math.max(...ns2);

  // Chồng lấn hoặc liền kề: khoảng cách giữa [min1, max1] và [min2, max2] <= 1
  return !(max1 + 1 < min2 || max2 + 1 < min1);
}

export function buildDecisionCases(
  issues: IssueItem[],
  script: ScriptData,
): DecisionCase[] {
  const sentenceMap = new Map(script.cau.map((c) => [c.n, c]));

  // Tách 3 nhóm issue:
  // 1. Kỹ thuật -> kt-<issueId>
  // 2. Chưa định vị -> cx-<issueId>
  // 3. Đã định vị, không phải kỹ thuật -> gom vùng rg-<from>-<to>
  const techIssues: IssueItem[] = [];
  const unlocatedIssues: IssueItem[] = [];
  const locatedContentIssues: IssueItem[] = [];

  for (const issue of issues) {
    if (issue.category === "loi-ky-thuat") {
      techIssues.push(issue);
    } else if (issue.location.status === "can-xac-nhan") {
      unlocatedIssues.push(issue);
    } else {
      locatedContentIssues.push(issue);
    }
  }

  // 1. Gom vùng liên thông cho locatedContentIssues (C3-CASE-01)
  const n = locatedContentIssues.length;
  const visited = new Array<boolean>(n).fill(false);
  const regionGroups: IssueItem[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const group: IssueItem[] = [locatedContentIssues[i]];
    const queue: IssueItem[] = [locatedContentIssues[i]];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (let j = 0; j < n; j++) {
        if (!visited[j]) {
          const candidate = locatedContentIssues[j];
          if (
            doIntervalsOverlapOrTouch(
              current.location.sentenceNs,
              candidate.location.sentenceNs,
            )
          ) {
            visited[j] = true;
            group.push(candidate);
            queue.push(candidate);
          }
        }
      }
    }
    regionGroups.push(group);
  }

  const cases: DecisionCase[] = [];

  // Tạo các hồ sơ vùng (C3-CASE-01)
  for (const group of regionGroups) {
    const allSentenceNs = Array.from(
      new Set(group.flatMap((iss) => iss.location.sentenceNs)),
    ).sort((a, b) => a - b);

    const fromN = allSentenceNs[0] || 1;
    const toN = allSentenceNs[allSentenceNs.length - 1] || fromN;
    const caseId = `rg-${fromN}-${toN}`;

    const firstSentence = sentenceMap.get(fromN);
    const lastSentence = sentenceMap.get(toN);
    const tuGiay = firstSentence ? firstSentence.batDauGiay : 0;
    const denGiay = lastSentence ? lastSentence.ketThucGiay : tuGiay;

    const allOptions: RevisionOption[] = group.flatMap((iss) => iss.options);
    const hasDisagreement = group.some((iss) => iss.hasDisagreement);

    // Đếm số người độc lập tối đa của 1 issue trong vùng
    const maxSendersInOneIssue = Math.max(
      ...group.map((iss) => iss.independentSenders),
      0,
    );
    // Một góp ý có thể nằm trong nhiều vấn đề của cùng vùng: đếm không trùng.
    const totalMentions = new Set(group.flatMap((iss) => iss.feedbackIds)).size;
    const impactRank = { cao: 0, vua: 1, thap: 2 } as const;
    const leadIssue = [...group].sort(
      (a, b) =>
        impactRank[a.impact.level] - impactRank[b.impact.level] ||
        b.independentSenders - a.independentSenders,
    )[0];

    const flags: string[] = [];
    if (hasDisagreement) flags.push("Trái chiều");

    cases.push({
      id: caseId,
      type: "vung",
      title: leadIssue?.summary ?? `Vùng sửa câu ${fromN}–${toN}`,
      issueIds: group.map((iss) => iss.id),
      sentenceNs: allSentenceNs,
      tuGiay,
      denGiay,
      issues: group,
      options: allOptions,
      hasDisagreement,
      independentSenders: maxSendersInOneIssue,
      mentions: totalMentions,
      flags,
    });
  }

  // Tạo các hồ sơ cần xác nhận vị trí (C3-CASE-02)
  for (const issue of unlocatedIssues) {
    const caseId = `cx-${issue.id}`;
    const sentenceNs = issue.location.sentenceNs;
    let tuGiay = 0;
    let denGiay = script.thoiLuongDuKienGiay;

    if (sentenceNs.length > 0) {
      const minN = Math.min(...sentenceNs);
      const maxN = Math.max(...sentenceNs);
      const s1 = sentenceMap.get(minN);
      const s2 = sentenceMap.get(maxN);
      if (s1) tuGiay = s1.batDauGiay;
      if (s2) denGiay = s2.ketThucGiay;
    }

    const flags: string[] = ["Cần xác nhận vị trí"];
    if (issue.hasDisagreement) flags.push("Trái chiều");

    cases.push({
      id: caseId,
      type: "can-xac-nhan",
      title: `Cần xác nhận: ${issue.summary}`,
      issueIds: [issue.id],
      sentenceNs,
      tuGiay,
      denGiay,
      issues: [issue],
      options: issue.options,
      hasDisagreement: issue.hasDisagreement,
      independentSenders: issue.independentSenders,
      mentions: issue.mentions,
      flags,
    });
  }

  // Tạo các hồ sơ kỹ thuật (C3-CASE-02)
  for (const issue of techIssues) {
    const caseId = `kt-${issue.id}`;
    const sentenceNs = issue.location.sentenceNs;
    let tuGiay = 0;
    let denGiay = script.thoiLuongDuKienGiay;

    if (sentenceNs.length > 0) {
      const minN = Math.min(...sentenceNs);
      const maxN = Math.max(...sentenceNs);
      const s1 = sentenceMap.get(minN);
      const s2 = sentenceMap.get(maxN);
      if (s1) tuGiay = s1.batDauGiay;
      if (s2) denGiay = s2.ketThucGiay;
    }

    cases.push({
      id: caseId,
      type: "ky-thuat",
      title: `Kỹ thuật: ${issue.summary}`,
      issueIds: [issue.id],
      sentenceNs,
      tuGiay,
      denGiay,
      issues: [issue],
      options: issue.options,
      hasDisagreement: issue.hasDisagreement,
      independentSenders: issue.independentSenders,
      mentions: issue.mentions,
      flags: ["Kỹ thuật"],
    });
  }

  // C3-CASE-04: Sắp xếp theo thứ tự:
  // Hồ sơ vùng -> Cần xác nhận -> Kỹ thuật
  // Trong từng nhóm: ảnh hưởng cao nhất -> số người độc lập lớn nhất -> n nhỏ nhất
  const TYPE_RANK: Record<DecisionCase["type"], number> = {
    vung: 3,
    "can-xac-nhan": 2,
    "ky-thuat": 1,
  };

  cases.sort((a, b) => {
    if (TYPE_RANK[a.type] !== TYPE_RANK[b.type]) {
      return TYPE_RANK[b.type] - TYPE_RANK[a.type];
    }

    const aMaxImpact = Math.max(
      ...a.issues.map((iss) => IMPACT_RANK[iss.impact.level]),
      0,
    );
    const bMaxImpact = Math.max(
      ...b.issues.map((iss) => IMPACT_RANK[iss.impact.level]),
      0,
    );
    if (aMaxImpact !== bMaxImpact) {
      return bMaxImpact - aMaxImpact;
    }

    if (a.independentSenders !== b.independentSenders) {
      return b.independentSenders - a.independentSenders;
    }

    const aMinN = a.sentenceNs[0] || 999;
    const bMinN = b.sentenceNs[0] || 999;
    return aMinN - bMinN;
  });

  return cases;
}

/**
 * R0.3: Lập hồ sơ vùng trước khi có phương án.
 * Khởi tạo các case với options = [] và status = "dang-lap-phuong-an".
 */
export function lapHoSoVung(
  issues: IssueItem[],
  script: ScriptData,
): DecisionCase[] {
  const cases = buildDecisionCases(issues, script);
  for (const c of cases) {
    c.options = [];
    c.status = "dang-lap-phuong-an";
  }
  return cases;
}
