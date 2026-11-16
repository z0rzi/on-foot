/**
 * @jest-environment node
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ItemFile } from "../markdownItems";
import { collectPlanFiles, findPlanViolations } from "../planItems";
import { collectTicketFiles } from "../tickets";

const frontmatter = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    status: "open",
    blocked_by: "[]",
    closes: "[]",
    ...overrides,
  };
  return Object.entries(fields)
    .map(([key, value]) => (value === "" ? `${key}:` : `${key}: ${value}`))
    .join("\n");
};

const plan = (folder = "2026-11-06-hiking-ux"): ItemFile => ({
  path: `${folder}/plan.md`,
  content: "# Hiking UX\n\n| # | item |\n",
});

const item = (
  file = "2026-11-06-hiking-ux/01-status-pill.md",
  fields: Record<string, string> = {},
  {
    heading = `# ${path.basename(file).slice(0, 2)}: a title`,
    body = "Body.",
  }: { heading?: string; body?: string } = {},
): ItemFile => ({
  path: file,
  content: `---\n${frontmatter(fields)}\n---\n${heading}\n\n${body}\n`,
});

const DEVICE = "- [ ] Device: the puck follows the walk";

const OPEN_TICKETS = ["T-14-hiking-ux-without-nav-bar"];
const problems = (files: ItemFile[], tickets = OPEN_TICKETS) =>
  findPlanViolations(files, tickets).map((v) => v.problem);

describe("plan work item conventions", () => {
  test("every plan folder in docs/design/plans follows the conventions", () => {
    const tickets = collectTicketFiles().map((f) =>
      path.basename(f.path, ".md"),
    );
    const violations = findPlanViolations(collectPlanFiles(), tickets);
    const report = violations
      .map((v) => `  ${v.file}: ${v.problem}`)
      .join("\n");
    expect(
      violations.length === 0
        ? ""
        : `\nPlan violations (see docs/agents/issue-tracker.md):\n${report}\n`,
    ).toBe("");
  });

  test("accepts a plan folder with its plan.md and well-formed items", () => {
    expect(
      findPlanViolations(
        [plan(), item(), item("2026-11-06-hiking-ux/02-sheet.md")],
        [],
      ),
    ).toEqual([]);
  });

  test("accepts a built plan: plan.md alone", () => {
    expect(findPlanViolations([plan()], [])).toEqual([]);
  });

  test("accepts no plan folders at all", () => {
    expect(findPlanViolations([], [])).toEqual([]);
  });

  test("ignores the flat plans at the root", () => {
    expect(
      findPlanViolations(
        [{ path: "2026-10-27-fix-gate.md", content: "# Plan\n" }],
        [],
      ),
    ).toEqual([]);
  });

  test("flags a plan folder with no plan.md", () => {
    expect(problems([item()])).toContainEqual(
      expect.stringContaining("plan.md"),
    );
  });

  test("flags a file in a plan folder that is neither plan.md nor an item", () => {
    const violations = findPlanViolations(
      [plan(), { path: "2026-11-06-hiking-ux/notes.md", content: "x" }],
      [],
    );
    expect(violations).toEqual([
      {
        file: "2026-11-06-hiking-ux/notes.md",
        problem: expect.stringContaining("file name"),
      },
    ]);
  });

  test.each(["1-x.md", "001-x.md", "01-Has_Caps.md", "01.md", "T-7-x.md"])(
    "flags the item name %s",
    (name) => {
      expect(
        problems([
          plan(),
          item(`2026-11-06-hiking-ux/${name}`, {}, { heading: "# 01: t" }),
        ]),
      ).toContainEqual(expect.stringContaining("file name"));
    },
  );

  test("flags an item nested below its plan folder", () => {
    expect(
      problems([plan(), item("2026-11-06-hiking-ux/issues/01-x.md")]),
    ).toContainEqual(expect.stringContaining("plan folder"));
  });

  test("flags two items sharing a number in one plan, not across plans", () => {
    const twice = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/01-b.md"),
    ];
    expect(problems(twice).filter((p) => p.includes("01"))).toHaveLength(1);
    const apart = [plan("a"), plan("b"), item("a/01-a.md"), item("b/01-b.md")];
    expect(findPlanViolations(apart, [])).toEqual([]);
  });

  test("flags an item with no frontmatter", () => {
    expect(
      problems([
        plan(),
        { path: "2026-11-06-hiking-ux/01-x.md", content: "# 01: t\n" },
      ]),
    ).toContainEqual(expect.stringContaining("frontmatter"));
  });

  test("flags an unknown key and a missing key", () => {
    const extra = item();
    extra.content = extra.content.replace(
      "closes: []",
      "closes: []\ntriage: ready-for-agent",
    );
    expect(problems([plan(), extra])).toContainEqual(
      expect.stringContaining("triage"),
    );
    const missing = item();
    missing.content = missing.content.replace("closes: []\n", "");
    expect(problems([plan(), missing])).toContainEqual(
      expect.stringContaining("closes"),
    );
  });

  test.each([
    ["status", ""],
    ["status", "done"],
    ["status", "ready-for-agent"],
    ["blocked_by", '"[[02-x]]"'],
    ["closes", '"T-14"'],
  ])("flags %s: %s", (key, value) => {
    expect(
      problems([plan(), item(undefined, { [key]: value })]),
    ).toContainEqual(expect.stringContaining(key));
  });

  test("accepts a claimed item", () => {
    expect(
      findPlanViolations([plan(), item(undefined, { status: "claimed" })], []),
    ).toEqual([]);
  });

  test("accepts blocked_by links to items in the same plan", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/02-b.md", { blocked_by: '["[[01-a]]"]' }),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test("flags a blocked_by link to plan.md or to a nested file", () => {
    const files = [plan(), item(undefined, { blocked_by: '["[[plan]]"]' })];
    expect(problems(files)).toContainEqual(expect.stringContaining("plan"));
    const nested = [
      plan(),
      item("2026-11-06-hiking-ux/issues/02-x.md"),
      item(undefined, { blocked_by: '["[[02-x]]"]' }),
    ];
    expect(problems(nested)).toContainEqual(expect.stringContaining("02-x"));
  });

  test("accepts two plans sharing a slug on different dates", () => {
    const files = [
      plan("2026-11-06-ux"),
      plan("2026-12-01-ux"),
      item("2026-11-06-ux/01-a.md"),
      item("2026-12-01-ux/01-a.md"),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test("flags a blocked_by link to an item of another plan or none", () => {
    const files = [
      plan("a"),
      plan("b"),
      item("a/01-a.md"),
      item("b/01-b.md", { blocked_by: '["[[01-a]]"]' }),
    ];
    expect(problems(files)).toContainEqual(expect.stringContaining("01-a"));
  });

  test("accepts closes links to open tracker tickets", () => {
    const files = [
      plan(),
      item(undefined, { closes: '["[[T-14-hiking-ux-without-nav-bar]]"]' }),
    ];
    expect(findPlanViolations(files, OPEN_TICKETS)).toEqual([]);
  });

  test("flags a closes link to a worklist file that is not a ticket", () => {
    const files = [plan(), item(undefined, { closes: '["[[README]]"]' })];
    expect(problems(files, ["README", "device-checks"])).toContainEqual(
      expect.stringContaining("README"),
    );
  });

  test("flags a closes link to a ticket that is not open", () => {
    const files = [plan(), item(undefined, { closes: '["[[T-3-gone]]"]' })];
    expect(problems(files)).toContainEqual(expect.stringContaining("T-3-gone"));
  });

  test("reads an absent final_check as false and accepts it set to false", () => {
    expect(
      findPlanViolations(
        [plan(), item(undefined, { final_check: "false" })],
        [],
      ),
    ).toEqual([]);
  });

  test("accepts final_check: true on the item holding the device criteria", () => {
    expect(
      findPlanViolations(
        [plan(), item(undefined, { final_check: "true" }, { body: DEVICE })],
        [],
      ),
    ).toEqual([]);
  });

  test("flags a device criterion in an item that is not the final check, naming it", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md", {}, { body: DEVICE }),
      item(
        "2026-11-06-hiking-ux/02-check.md",
        { final_check: "true", blocked_by: '["[[01-a]]"]' },
        { body: DEVICE },
      ),
    ];
    expect(findPlanViolations(files, [])).toEqual([
      {
        file: "2026-11-06-hiking-ux/01-a.md",
        problem: expect.stringContaining("Device:"),
      },
    ]);
  });

  test("flags two final_check items in one plan, not one in each of two plans", () => {
    const final = { final_check: "true" };
    const twice = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md", final, { body: DEVICE }),
      item("2026-11-06-hiking-ux/02-b.md", final, { body: DEVICE }),
    ];
    expect(problems(twice)).toContainEqual(
      expect.stringContaining("one final_check"),
    );
    const apart = [
      plan("a"),
      plan("b"),
      item("a/01-a.md", final, { body: DEVICE }),
      item("b/01-b.md", final, { body: DEVICE }),
    ];
    expect(findPlanViolations(apart, [])).toEqual([]);
  });

  test("flags a plan with device criteria and no final_check item", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md", {}, { body: DEVICE }),
    ];
    expect(findPlanViolations(files, [])).toContainEqual({
      file: "2026-11-06-hiking-ux",
      problem: expect.stringContaining("one final_check"),
    });
  });

  test("accepts device criteria only in the final check, which every other item blocks", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/02-b.md", { status: "claimed" }),
      item(
        "2026-11-06-hiking-ux/03-check.md",
        { final_check: "true", blocked_by: '["[[01-a]]", "[[02-b]]"]' },
        {
          body: `- [ ] \`npm run verify\` green\n${DEVICE}\n- [ ] Device: the sheet opens`,
        },
      ),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test("flags an item that does not reach the final check through blocked_by", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/02-b.md", { status: "claimed" }),
      item(
        "2026-11-06-hiking-ux/03-check.md",
        { final_check: "true", blocked_by: '["[[02-b]]"]' },
        { body: DEVICE },
      ),
    ];
    expect(findPlanViolations(files, [])).toEqual([
      {
        file: "2026-11-06-hiking-ux/01-a.md",
        problem: expect.stringContaining("03-check"),
      },
    ]);
  });

  test("accepts an item that reaches the final check through another item", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/02-b.md", { blocked_by: '["[[01-a]]"]' }),
      item(
        "2026-11-06-hiking-ux/03-check.md",
        { final_check: "true", blocked_by: '["[[02-b]]"]' },
        { body: DEVICE },
      ),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test("flags an item blocked by the final check", () => {
    const files = [
      plan(),
      item(
        "2026-11-06-hiking-ux/01-check.md",
        { final_check: "true" },
        { body: DEVICE },
      ),
      item("2026-11-06-hiking-ux/02-b.md", { blocked_by: '["[[01-check]]"]' }),
    ];
    expect(findPlanViolations(files, [])).toContainEqual({
      file: "2026-11-06-hiking-ux/02-b.md",
      problem: expect.stringContaining("blocked by the final check"),
    });
  });

  test("flags a final check that does not carry the plan's highest number, naming it", () => {
    const files = [
      plan(),
      item(
        "2026-11-06-hiking-ux/01-check.md",
        { final_check: "true", blocked_by: '["[[02-b]]"]' },
        { body: DEVICE },
      ),
      item("2026-11-06-hiking-ux/02-b.md"),
    ];
    expect(findPlanViolations(files, [])).toEqual([
      {
        file: "2026-11-06-hiking-ux/01-check.md",
        problem: expect.stringContaining("numbered last"),
      },
    ]);
  });

  test("flags a final_check item with no device criterion", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-check.md", { final_check: "true" }),
    ];
    expect(findPlanViolations(files, [])).toEqual([
      {
        file: "2026-11-06-hiking-ux/01-check.md",
        problem: expect.stringContaining("Device:"),
      },
    ]);
  });

  test.each([
    "- [ ] The `device-check` skill says the brief's claims are the scope",
    "- [ ] A device criterion is a checkbox line starting `Device:`",
    "Device: a prose line, not a checkbox",
    "```markdown\n- [ ] Device: quoted in a code block\n```",
    "- An example:\n\n  ```markdown\n  - [ ] Device: quoted in a list's code block\n  ```",
    "~~~markdown\n- [ ] Device: quoted in a tilde code block\n~~~",
  ])("reads %s as no device criterion", (line) => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md", {}, { body: line }),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test("reads a device criterion after a line opening on an inline code span", () => {
    const files = [
      plan(),
      item(
        "2026-11-06-hiking-ux/01-a.md",
        {},
        { body: `\`\`\`npm run verify\`\`\` stays green\n${DEVICE}\n\`\`\`\n` },
      ),
    ];
    expect(findPlanViolations(files, [])).toContainEqual({
      file: "2026-11-06-hiking-ux/01-a.md",
      problem: expect.stringContaining("Device:"),
    });
  });

  test("accepts a plan with no device criterion and no final_check item", () => {
    const files = [
      plan(),
      item("2026-11-06-hiking-ux/01-a.md"),
      item("2026-11-06-hiking-ux/02-b.md"),
    ];
    expect(findPlanViolations(files, [])).toEqual([]);
  });

  test.each(["", "yes", '"true"'])("flags final_check: %s", (value) => {
    expect(
      problems([plan(), item(undefined, { final_check: value })]),
    ).toContainEqual(expect.stringContaining("final_check"));
  });

  test("flags a heading that does not start with the number", () => {
    expect(
      problems([plan(), item(undefined, {}, { heading: "# 02: wrong" })]),
    ).toContainEqual(expect.stringContaining("heading"));
  });
});

describe("collectPlanFiles", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "plans-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("reads the .md files at the root and in plan folders, ignores the rest", () => {
    fs.mkdirSync(path.join(dir, "plans", "x"), { recursive: true });
    fs.writeFileSync(path.join(dir, "plans", "flat.md"), "f");
    fs.writeFileSync(path.join(dir, "plans", "plans.base"), "b");
    fs.writeFileSync(path.join(dir, "plans", "x", "plan.md"), "p");
    fs.writeFileSync(path.join(dir, "plans", "x", "01-a.md"), "i");
    expect(collectPlanFiles("plans", dir)).toEqual([
      { path: "flat.md", content: "f" },
      { path: "x/01-a.md", content: "i" },
      { path: "x/plan.md", content: "p" },
    ]);
  });

  test("throws when the folder is missing", () => {
    expect(() => collectPlanFiles("plans", dir)).toThrow(/plans/);
  });
});
