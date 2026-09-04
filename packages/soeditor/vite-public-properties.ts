import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
        true;

const addNamedMember = (
    names: Set<string>,
    node: ts.NamedDeclaration,
): void => {
    const name = node.name;
    if (
        name !== undefined &&
        (ts.isIdentifier(name) || ts.isStringLiteral(name))
    ) {
        names.add(name.text);
    }
};

export function collectPublicPropertyNames(
    repositoryRoot: string,
    packageNames: readonly string[],
    initialNames: readonly string[],
): Set<string> {
    const names = new Set(initialNames);
    const visitDirectory = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = `${directory}/${entry.name}`;
            if (entry.isDirectory()) {
                visitDirectory(path);
                continue;
            }
            if (
                !entry.name.endsWith('.ts') ||
                entry.name.endsWith('.test.ts')
            ) {
                continue;
            }
            const source = ts.createSourceFile(
                path,
                readFileSync(path, 'utf8'),
                ts.ScriptTarget.Latest,
                false,
                ts.ScriptKind.TS,
            );
            for (const statement of source.statements) {
                if (!isExported(statement)) continue;
                if (ts.isInterfaceDeclaration(statement)) {
                    for (const member of statement.members)
                        addNamedMember(names, member);
                } else if (ts.isTypeAliasDeclaration(statement)) {
                    const visitType = (node: ts.Node): void => {
                        if (
                            ts.isPropertySignature(node) ||
                            ts.isMethodSignature(node)
                        ) {
                            addNamedMember(names, node);
                        }
                        ts.forEachChild(node, visitType);
                    };
                    visitType(statement.type);
                } else if (ts.isClassDeclaration(statement)) {
                    for (const member of statement.members) {
                        const hidden =
                            (member.name !== undefined &&
                                ts.isPrivateIdentifier(member.name)) ||
                            (ts.canHaveModifiers(member) &&
                                ts
                                    .getModifiers(member)
                                    ?.some(
                                        (modifier) =>
                                            modifier.kind ===
                                                ts.SyntaxKind.PrivateKeyword ||
                                            modifier.kind ===
                                                ts.SyntaxKind.ProtectedKeyword,
                                    ) === true);
                        if (!hidden) addNamedMember(names, member);
                    }
                }
            }
        }
    };
    for (const packageName of packageNames) {
        visitDirectory(`${repositoryRoot}/packages/${packageName}/src`);
    }
    return names;
}
