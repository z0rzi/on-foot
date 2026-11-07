import * as path from "node:path";
import {
  checkEnums,
  checkHeading,
  checkKeys,
  checkLinks,
  collectMarkdownFiles,
  readFrontmatter,
  type ItemFile,
  type ItemViolation,
} from "./markdownItems";

const PLAN = "plan.md";
const ITEM_NAME = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const TICKET_NAME = /^T-\d+-/;
const ENUMS = { status: ["open", "claimed"] };
const KEYS = ["status", "blocked_by", "closes"];

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
    checkKeys(parsed.fields, KEYS, report);
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
  }
  return violations;
}
