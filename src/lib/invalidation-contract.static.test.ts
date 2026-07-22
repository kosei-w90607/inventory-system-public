import { readFileSync, readdirSync } from "node:fs";
import { extname, join, posix, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  ASSIGNED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE,
  ASSIGNED_HELPER_ALIAS_SOURCE,
  ASSIGNED_INVALIDATE_ALIAS_SOURCE,
  BOUND_INVALIDATE_ALIAS_SOURCE,
  COMPUTED_INVALIDATE_SURVIVOR_SOURCE,
  COMPUTED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE,
  DESTRUCTURED_INVALIDATE_ALIAS_SOURCE,
  HELPER_CONCAT_SURVIVOR_SOURCE,
  HELPER_CONDITIONAL_SOURCE,
  HELPER_IMPORT_ALIAS_SOURCE,
  HELPER_SPREAD_SOURCE,
  HELPER_WRAPPER_SOURCE,
  REEXPORT_SURVIVOR_FILES,
} from "@/test/invalidation-contract-static-fixtures";

const SOURCE_ROOT = join(process.cwd(), "src");
const ALLOWED_DIRECT_CALL_FILES = new Set([
  "features/backup-restore/BackupRestorePage.tsx",
  "features/stocktake/stocktake-error-invalidation.ts",
  "lib/invalidation-contract.ts",
]);
const ALLOWED_CONTRACT_IMPORT_TEST_FILES = new Set([
  "lib/invalidation-contract.meta.test.ts",
  "lib/invalidation-contract.static.test.ts",
]);
const CONTRACT_PATH = "lib/invalidation-contract.ts";

function sourceFiles(dir: string, includeTests = false): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, includeTests);
    if (
      ![".ts", ".tsx"].includes(extname(entry.name)) ||
      (!includeTests && entry.name.includes(".test."))
    )
      return [];
    return [path];
  });
}

function parseSource(repoPath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    repoPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    repoPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function sourceLine(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function variableInitializers(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const initializers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      initializers.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return initializers;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function staticString(
  expression: ts.Expression,
  initializers: ReadonlyMap<string, ts.Expression>,
  resolving = new Set<string>(),
): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isStringLiteralLike(unwrapped)) return unwrapped.text;
  if (ts.isNoSubstitutionTemplateLiteral(unwrapped)) return unwrapped.text;
  if (ts.isIdentifier(unwrapped)) {
    if (resolving.has(unwrapped.text)) return undefined;
    const initializer = initializers.get(unwrapped.text);
    if (initializer === undefined) return undefined;
    const nextResolving = new Set(resolving).add(unwrapped.text);
    return staticString(initializer, initializers, nextResolving);
  }
  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticString(unwrapped.left, initializers, resolving);
    const right = staticString(unwrapped.right, initializers, resolving);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (
    ts.isCallExpression(unwrapped) &&
    ts.isPropertyAccessExpression(unwrapped.expression) &&
    unwrapped.expression.name.text === "join" &&
    ts.isArrayLiteralExpression(unwrapExpression(unwrapped.expression.expression))
  ) {
    const array = unwrapExpression(unwrapped.expression.expression) as ts.ArrayLiteralExpression;
    const separator =
      unwrapped.arguments.length === 0
        ? ","
        : staticString(unwrapped.arguments[0], initializers, resolving);
    if (separator === undefined || unwrapped.arguments.length > 1) return undefined;
    const parts = array.elements.map((element) =>
      ts.isSpreadElement(element) ? undefined : staticString(element, initializers, resolving),
    );
    return parts.some((part) => part === undefined)
      ? undefined
      : (parts as string[]).join(separator);
  }
  return undefined;
}

function calledMemberName(
  expression: ts.LeftHandSideExpression,
  initializers: ReadonlyMap<string, ts.Expression>,
): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(unwrapped)) return unwrapped.name.text;
  if (ts.isElementAccessExpression(unwrapped)) {
    return staticString(unwrapped.argumentExpression, initializers);
  }
  return undefined;
}

function resolvesInvalidateCallable(
  expression: ts.Expression,
  initializers: ReadonlyMap<string, ts.Expression>,
  aliases: ReadonlySet<string>,
  resolving = new Set<string>(),
): boolean {
  const unwrapped = unwrapExpression(expression);
  if (
    (ts.isPropertyAccessExpression(unwrapped) || ts.isElementAccessExpression(unwrapped)) &&
    calledMemberName(unwrapped, initializers) === "invalidateQueries"
  ) {
    return true;
  }
  if (ts.isIdentifier(unwrapped)) {
    if (aliases.has(unwrapped.text)) return true;
    if (resolving.has(unwrapped.text)) return false;
    const initializer = initializers.get(unwrapped.text);
    if (initializer === undefined) return false;
    return resolvesInvalidateCallable(
      initializer,
      initializers,
      aliases,
      new Set(resolving).add(unwrapped.text),
    );
  }
  return (
    ts.isCallExpression(unwrapped) &&
    ts.isPropertyAccessExpression(unwrapped.expression) &&
    unwrapped.expression.name.text === "bind" &&
    resolvesInvalidateCallable(unwrapped.expression.expression, initializers, aliases, resolving)
  );
}

function destructuredInvalidateBindings(
  sourceFile: ts.SourceFile,
  initializers: ReadonlyMap<string, ts.Expression>,
): ts.BindingElement[] {
  const bindings: ts.BindingElement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      for (const element of node.name.elements) {
        const property = element.propertyName;
        const propertyName =
          property === undefined
            ? element.name.getText(sourceFile)
            : ts.isComputedPropertyName(property)
              ? staticString(property.expression, initializers)
              : property.text;
        if (propertyName === "invalidateQueries") bindings.push(element);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings;
}

function isDirectContractArguments(
  firstArgument: ts.Expression,
  keyExpression: ts.Expression,
): boolean {
  if (ts.isSpreadElement(keyExpression)) return false;
  const unwrappedFirst = unwrapExpression(firstArgument);
  const unwrappedKey = unwrapExpression(keyExpression);
  const contractCallee = ts.isCallExpression(unwrappedKey)
    ? unwrapExpression(unwrappedKey.expression)
    : undefined;
  return (
    ts.isIdentifier(unwrappedFirst) &&
    unwrappedFirst.text === "queryClient" &&
    contractCallee !== undefined &&
    ts.isPropertyAccessExpression(contractCallee) &&
    ts.isIdentifier(contractCallee.expression) &&
    contractCallee.expression.text === "invalidationContract"
  );
}

function directCallLocations(repoPath: string, source: string): string[] {
  const sourceFile = parseSource(repoPath, source);
  const initializers = variableInitializers(sourceFile);
  const destructuredBindings = destructuredInvalidateBindings(sourceFile, initializers);
  const aliases = new Set(
    destructuredBindings
      .map((element) => element.name)
      .filter((name): name is ts.Identifier => ts.isIdentifier(name))
      .map((name) => name.text),
  );
  const locations = new Set(
    destructuredBindings.map((element) => `${repoPath}:${String(sourceLine(sourceFile, element))}`),
  );
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      calledMemberName(node, initializers) === "invalidateQueries"
    ) {
      locations.add(`${repoPath}:${String(sourceLine(sourceFile, node))}`);
    }
    if (
      ts.isCallExpression(node) &&
      resolvesInvalidateCallable(node.expression, initializers, aliases)
    ) {
      locations.add(`${repoPath}:${String(sourceLine(sourceFile, node))}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...locations];
}

function nonContractHelperCallLocations(repoPath: string, source: string): string[] {
  const sourceFile = parseSource(repoPath, source);
  const initializers = variableInitializers(sourceFile);
  const helperNames = new Set(["invalidateByContract"]);
  sourceFile.forEachChild((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteralLike(node.moduleSpecifier) ||
      !node.moduleSpecifier.text.endsWith("invalidation-contract") ||
      node.importClause?.namedBindings === undefined ||
      !ts.isNamedImports(node.importClause.namedBindings)
    ) {
      return;
    }
    for (const element of node.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "invalidateByContract") helperNames.add(element.name.text);
    }
  });
  let foundAlias = true;
  while (foundAlias) {
    foundAlias = false;
    for (const [name, initializer] of initializers) {
      const unwrapped = unwrapExpression(initializer);
      if (ts.isIdentifier(unwrapped) && helperNames.has(unwrapped.text) && !helperNames.has(name)) {
        helperNames.add(name);
        foundAlias = true;
      }
    }
  }
  const locations = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && helperNames.has(node.text)) {
      const isDirectCallee = ts.isCallExpression(node.parent) && node.parent.expression === node;
      const isPropertyName =
        ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
      if (!isDirectCallee && !isPropertyName) {
        locations.add(`${repoPath}:${String(sourceLine(sourceFile, node))}`);
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "invalidateByContract" &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    ) {
      locations.add(`${repoPath}:${String(sourceLine(sourceFile, node))}`);
    }
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    const callee = unwrapExpression(node.expression);
    const isHelper =
      (ts.isIdentifier(callee) && helperNames.has(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) && callee.name.text === "invalidateByContract");
    if (isHelper) {
      const directContractCall =
        node.arguments.length === 2 &&
        isDirectContractArguments(node.arguments[0], node.arguments[1]);
      if (!directContractCall) {
        locations.add(`${repoPath}:${String(sourceLine(sourceFile, node))}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...locations];
}

function forbiddenContractReachability(
  sources: ReadonlyMap<string, string>,
  entryPath: string,
): string[] {
  const resolveModule = (fromPath: string, specifier: string): string | undefined => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return undefined;
    let base = specifier.startsWith("@/")
      ? specifier.slice(2)
      : posix.normalize(posix.join(posix.dirname(fromPath), specifier));
    if (base.endsWith(".js") || base.endsWith(".jsx")) base = base.replace(/\.jsx?$/, "");
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
    return candidates.find((candidate) => sources.has(candidate));
  };

  const moduleSpecifiers = (repoPath: string, includeImports: boolean): string[] => {
    const source = sources.get(repoPath);
    if (source === undefined) return [];
    const sourceFile = parseSource(repoPath, source);
    const specifiers: string[] = [];
    const importedLocals = new Map<string, string>();
    sourceFile.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (includeImports) specifiers.push(specifier);
        if (node.importClause?.name !== undefined) {
          importedLocals.set(node.importClause.name.text, specifier);
        }
        const bindings = node.importClause?.namedBindings;
        if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
          importedLocals.set(bindings.name.text, specifier);
        } else if (bindings !== undefined) {
          for (const element of bindings.elements) {
            importedLocals.set(element.name.text, specifier);
          }
        }
      }
    });
    sourceFile.forEachChild((node) => {
      if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier !== undefined && ts.isStringLiteralLike(node.moduleSpecifier)) {
          specifiers.push(node.moduleSpecifier.text);
          return;
        }
        if (node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const localName = element.propertyName?.text ?? element.name.text;
            const importedFrom = importedLocals.get(localName);
            if (importedFrom !== undefined) specifiers.push(importedFrom);
          }
        }
        return;
      }
      if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) {
        const importedFrom = importedLocals.get(node.expression.text);
        if (importedFrom !== undefined) specifiers.push(importedFrom);
      }
    });
    return [...new Set(specifiers)];
  };

  const violations: string[] = [];
  const visit = (repoPath: string, chain: string[], visited: ReadonlySet<string>): void => {
    if (repoPath === CONTRACT_PATH) {
      violations.push(chain.join(" -> "));
      return;
    }
    if (visited.has(repoPath)) return;
    const nextVisited = new Set(visited).add(repoPath);
    // Test-support modules may import another bridge module, while production SUT modules may
    // legitimately import the contract internally. After crossing into production, follow only
    // re-export edges so the gate tracks expectation sharing without rejecting normal SUT wiring.
    const includeImports =
      repoPath === entryPath || repoPath.startsWith("test/") || repoPath.includes(".test.");
    for (const specifier of moduleSpecifiers(repoPath, includeImports)) {
      const target = resolveModule(repoPath, specifier);
      if (target !== undefined) visit(target, [...chain, target], nextVisited);
    }
  };
  visit(entryPath, [entryPath], new Set());
  return violations;
}

function repositorySources(): Map<string, string> {
  return new Map(
    sourceFiles(SOURCE_ROOT, true).map((path) => [
      relative(SOURCE_ROOT, path).split("\\").join("/"),
      readFileSync(path, "utf8"),
    ]),
  );
}

describe("UI-07 D-052-S1 invalidation SSOT routing", () => {
  it("rejects direct invalidateQueries calls outside explicit exceptions", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const repoPath = relative(SOURCE_ROOT, path);
      if (ALLOWED_DIRECT_CALL_FILES.has(repoPath)) return [];
      return directCallLocations(repoPath, readFileSync(path, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("rejects production helper calls whose key set does not come directly from the SSOT", () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const repoPath = relative(SOURCE_ROOT, path);
      if (repoPath === "lib/invalidation-contract.ts") return [];
      return nonContractHelperCallLocations(repoPath, readFileSync(path, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("keeps page-test oracles isolated from the production contract", () => {
    const sources = repositorySources();
    const forbiddenImports = [...sources.keys()]
      .filter(
        (repoPath) =>
          (repoPath.includes(".test.") || repoPath === "test/invalidation-oracle.ts") &&
          !ALLOWED_CONTRACT_IMPORT_TEST_FILES.has(repoPath),
      )
      .flatMap((repoPath) => forbiddenContractReachability(sources, repoPath));

    expect(forbiddenImports).toEqual([]);
  });

  it("UI-07 D-052-S1 rejects a transitive re-export from the oracle", () => {
    expect(
      forbiddenContractReachability(REEXPORT_SURVIVOR_FILES, "test/invalidation-oracle.ts"),
    ).toEqual([
      "test/invalidation-oracle.ts -> lib/contract-bridge.ts -> lib/invalidation-contract.ts",
    ]);
  });

  it.each([
    ["concat", HELPER_CONCAT_SURVIVOR_SOURCE],
    ["spread", HELPER_SPREAD_SOURCE],
    ["conditional", HELPER_CONDITIONAL_SOURCE],
    ["wrapper", HELPER_WRAPPER_SOURCE],
  ])("UI-07 D-052-S1 rejects transformed helper key expressions: %s", (_name, source) => {
    expect(nonContractHelperCallLocations("fixture/transformed-helper.ts", source)).toEqual([
      "fixture/transformed-helper.ts:2",
    ]);
  });

  it("UI-07 D-052-S1 rejects computed invalidateQueries calls", () => {
    expect(
      directCallLocations("fixture/computed-call.ts", COMPUTED_INVALIDATE_SURVIVOR_SOURCE),
    ).toEqual(["fixture/computed-call.ts:7"]);
  });

  it("UI-07 D-052-S1 rejects bound invalidateQueries aliases", () => {
    expect(directCallLocations("fixture/bound-alias.ts", BOUND_INVALIDATE_ALIAS_SOURCE)).toEqual([
      "fixture/bound-alias.ts:2",
      "fixture/bound-alias.ts:3",
    ]);
  });

  it("UI-07 D-052-S1 rejects destructured invalidateQueries aliases", () => {
    expect(
      directCallLocations("fixture/destructured-alias.ts", DESTRUCTURED_INVALIDATE_ALIAS_SOURCE),
    ).toEqual(["fixture/destructured-alias.ts:2", "fixture/destructured-alias.ts:3"]);
  });

  it("UI-07 D-052-S1 rejects destructured capabilities before indirect assignment", () => {
    expect(
      directCallLocations(
        "fixture/assigned-destructured-alias.ts",
        ASSIGNED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE,
      ),
    ).toContain("fixture/assigned-destructured-alias.ts:2");
  });

  it("UI-07 D-052-S1 rejects computed destructured invalidateQueries aliases", () => {
    expect(
      directCallLocations(
        "fixture/computed-destructured-alias.ts",
        COMPUTED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE,
      ),
    ).toContain("fixture/computed-destructured-alias.ts:3");
  });

  it("UI-07 D-052-S1 rejects imported aliases of the contract helper", () => {
    expect(
      nonContractHelperCallLocations("fixture/helper-alias.ts", HELPER_IMPORT_ALIAS_SOURCE),
    ).toEqual(["fixture/helper-alias.ts:3"]);
  });

  it("UI-07 D-052-S1 rejects invalidateQueries capability assignment", () => {
    expect(
      directCallLocations("fixture/assigned-direct.ts", ASSIGNED_INVALIDATE_ALIAS_SOURCE),
    ).toEqual(["fixture/assigned-direct.ts:3"]);
  });

  it("UI-07 D-052-S1 rejects contract-helper capability assignment", () => {
    expect(
      nonContractHelperCallLocations("fixture/assigned-helper.ts", ASSIGNED_HELPER_ALIAS_SOURCE),
    ).toContain("fixture/assigned-helper.ts:3");
  });
});
