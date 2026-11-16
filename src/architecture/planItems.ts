import * as path from "node:path";
import {
  checkEnums,
  checkHeading,
  checkKeys,
  checkLinks,
  collectMarkdownFiles,
  readFrontmatter,
  readLinks,
  type ItemFile,
  type ItemViolation,
} from "./markdownItems";

const PLAN = "plan.md";
const ITEM_NAME = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const TICKET_NAME = /^T-\d+-/;
const ENUMS = { status: ["open", "claimed"], final_check: [true, false] };
const KEYS = ["status", "blocked_by", "closes"];
const OPTIONAL_KEYS = ["final_check"];
const DEVICE_CRITERION = /^\s*- \[[ xX]\] Device:/m;
const CODE_FENCE =
  /^[ \t]*(?:(`{3,})[^`\n]*\n[\s\S]*?^[ \t]*\1`*|(~{3,})(?!~)[^\n]*\n[\s\S]*?^[ \t]*\2~*)[ \t]*$/gm;

interface ParsedItem {
  file: string;
  name: string;
  number: string;
  blockedBy: string[];
  finalCheck: boolean;
  hasDeviceCriterion: boolean;
}

/** Every item `final` waits on, directly or through the items it waits on. */
function blockersOf(final: ParsedItem, items: readonly ParsedItem[]) {
  const byName = new Map(items.map((i) => [i.name, i]));
  const reached = new Set<string>();
  const queue = [...final.blockedBy];
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (reached.has(name)) continue;
    reached.add(name);
    queue.push(...(byName.get(name)?.blockedBy ?? []));
  }
  return reached;
}

/** A plan's device criteria live in its one final check, which every other item blocks. */
function findFinalCheckViolations(
  folder: string,
  items: readonly ParsedItem[],
): ItemViolation[] {
  const violations: ItemViolation[] = [];
  const report = (file: string, problem: string) =>
    violations.push({ file, problem });
  const finals = items.filter((i) => i.finalCheck);
  for (const i of finals) {
    if (!i.hasDeviceCriterion) {
      report(i.file, "final_check is set on an item with no Device: criterion");
    }
  }
  if (!items.some((i) => i.hasDeviceCriterion)) return violations;
  for (const i of items) {
    if (i.hasDeviceCriterion && !i.finalCheck) {
      report(
        i.file,
        "a Device: criterion lives only in the plan's final_check item",
      );
    }
  }
  if (finals.length !== 1) {
    report(
      folder,
      `a plan with Device: criteria has exactly one final_check item, found ${finals.length}`,
    );
    return violations;
  }
  const [final] = finals;
  if (items.some((i) => i.number > final.number)) {
    report(
      final.file,
      `the final check [[${final.name}]] is numbered last, with the plan's highest item number`,
    );
  }
  const blockers = blockersOf(final, items);
  for (const i of items) {
    if (i === final) continue;
    if (!blockers.has(i.name)) {
      report(
        i.file,
        `does not reach the final check [[${final.name}]] through blocked_by; every other item blocks it`,
      );
    }
    if (i.blockedBy.includes(final.name)) {
      report(
        i.file,
        `is blocked by the final check [[${final.name}]], which runs last`,
      );
    }
  }
  return violations;
}

export function collectPlanFiles(
  dir: string = "docs/design/plans",
  rootDir: string = process.cwd(),
): ItemFile[] {
  return collectMarkdownFiles(dir, rootDir);
}

/** `openTickets` are the worklist's file basenames; an item's `closes` must name one. */
export function findPlanViolations(
  files: ItemFile[],
  openTickets: readonly string[],
): ItemViolation[] {
  const violations: ItemViolation[] = [];
  const tickets = new Set(openTickets.filter((name) => TICKET_NAME.test(name)));
  const inFolders = files.filter((f) => f.path.includes("/"));
  const folders = new Set(inFolders.map((f) => f.path.split("/")[0]));
  const parsedItems = new Map<string, ParsedItem[]>();

  for (const folder of folders) {
    if (!inFolders.some((f) => f.path === `${folder}/${PLAN}`)) {
      violations.push({
        file: folder,
        problem: `a plan folder holds a ${PLAN}`,
      });
    }
  }

  for (const file of inFolders) {
    const report = (problem: string) =>
      violations.push({ file: file.path, problem });
    const segments = file.path.split("/");
    const [folder, name] = [segments[0], segments[segments.length - 1]];
    if (name === PLAN && segments.length === 2) continue;

    if (segments.length !== 2) {
      report("an item lives directly in its plan folder");
    }
    const number = ITEM_NAME.exec(name)?.[1];
    if (!number) {
      report(`file name must be NN-<kebab-slug>.md (or ${PLAN})`);
      continue;
    }
    const siblings = inFolders.filter(
      (f) =>
        f !== file &&
        f.path.split("/").length === 2 &&
        f.path.startsWith(`${folder}/`) &&
        ITEM_NAME.test(path.basename(f.path)),
    );
    if (
      siblings.some(
        (f) =>
          ITEM_NAME.exec(path.basename(f.path))?.[1] === number &&
          f.path < file.path,
      )
    ) {
      report(`number ${number} is already used in ${folder}`);
    }

    const parsed = readFrontmatter(file.content, report);
    if (!parsed) continue;
    checkKeys(parsed.fields, KEYS, report, OPTIONAL_KEYS);
    checkEnums(parsed.fields, ENUMS, report);
    const items = new Set(siblings.map((f) => path.basename(f.path, ".md")));
    checkLinks(
      parsed.fields,
      "blocked_by",
      items,
      `an item of ${folder}`,
      report,
    );
    checkLinks(parsed.fields, "closes", tickets, "an open ticket", report);
    checkHeading(parsed.body, number, report);
    if (segments.length !== 2) continue;
    const plan = parsedItems.get(folder) ?? [];
    plan.push({
      file: file.path,
      name: path.basename(file.path, ".md"),
      number,
      blockedBy: readLinks(parsed.fields, "blocked_by"),
      finalCheck: parsed.fields.final_check === true,
      hasDeviceCriterion: DEVICE_CRITERION.test(
        parsed.body.replace(CODE_FENCE, ""),
      ),
    });
    parsedItems.set(folder, plan);
  }

  for (const [folder, items] of parsedItems) {
    violations.push(...findFinalCheckViolations(folder, items));
  }
  return violations;
}
