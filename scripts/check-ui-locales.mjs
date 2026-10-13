// Audit literal CMS UI labels; content, technical values and API errors stay caller-owned.
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';
import ts from 'typescript';
import fs from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url));
const keys = new Set();
for (const file of [
    'packages/ui/src/localization.ts',
    'packages/soeditor/src/classic-translations.ts',
    'packages/source/src/source-translations.ts',
]) {
    const sf = ts.createSourceFile(
        file,
        fs.readFileSync(root + '/' + file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
    );
    const walk = (n) => {
        if (
            ts.isArrayLiteralExpression(n) &&
            n.elements.length === 3 &&
            n.elements.every(ts.isStringLiteral)
        )
            keys.add(n.elements[0].text);
        if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name))
            keys.add(n.name.text);
        ts.forEachChild(n, walk);
    };
    walk(sf);
}
const technical = new Set([
    'specialCharacter.insert',
    '#2563eb or rgb(37, 99, 235)',
    'https://example.com/page',
    '{line}',
    '{column}',
    '{reason}',
    '{code}',
    '{columns}',
    '{total}',
    'subtitleLabel',
]);
let checked = new Set();
let missing = new Map();
for (const pkg of [
    'ui',
    'soeditor',
    'source',
    'preview',
    'file-manager',
    'rich-text',
]) {
    const dir = root + '/packages/' + pkg + '/src';
    for (const file of fs
        .readdirSync(dir)
        .filter(
            (f) =>
                f.endsWith('.ts') &&
                !f.endsWith('.test.ts') &&
                (pkg !== 'rich-text' ||
                    [
                        'cms-objects.ts',
                        'features.ts',
                        'font.ts',
                        'paste.ts',
                        'table.ts',
                    ].includes(f)),
        )) {
        const sf = ts.createSourceFile(
            file,
            fs.readFileSync(dir + '/' + file, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
        );
        const walk = (n) => {
            if (
                ts.isStringLiteral(n) &&
                /[A-Za-z]{2}/.test(n.text) &&
                !/^[a-z][a-z0-9:.-]*$/.test(n.text)
            ) {
                const p = n.parent;
                let visible =
                    ts.isPropertyAssignment(p) &&
                    /^(label|title|message|placeholder|description|removeLabel|emptyLabel|hint)$/.test(
                        p.name.getText(sf),
                    );
                visible ||=
                    ts.isCallExpression(p) &&
                    /translate|setIcon|field|imageAction|textField|selectField/.test(
                        p.expression.getText(sf),
                    );
                visible ||=
                    ts.isBinaryExpression(p) &&
                    /\.(textContent|title|placeholder)$/.test(
                        p.left.getText(sf),
                    );
                visible ||=
                    ts.isCallExpression(p) &&
                    p.expression.getText(sf).endsWith('setAttribute') &&
                    ['aria-label', 'title', 'placeholder'].includes(
                        p.arguments[0]?.text,
                    );
                if (
                    visible &&
                    /[A-Za-z]/u.test(n.text) &&
                    !/[\p{Script=Han}]/u.test(n.text) &&
                    !technical.has(n.text) &&
                    !n.text.startsWith('soeditor') &&
                    !n.text.includes('image/')
                ) {
                    checked.add(n.text);
                }
                if (
                    visible &&
                    !keys.has(n.text) &&
                    !/[\p{Script=Han}]/u.test(n.text) &&
                    !technical.has(n.text) &&
                    !n.text.startsWith('soeditor') &&
                    !n.text.includes('image/')
                ) {
                    const line =
                        sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
                    missing.set(n.text, [
                        ...(missing.get(n.text) ?? []),
                        pkg + '/' + file + ':' + line,
                    ]);
                }
            }
            ts.forEachChild(n, walk);
        };
        walk(sf);
    }
}
for (const [key, files] of missing)
    console.log(JSON.stringify(key) + ' ' + files.join(', '));
console.log(
    `${checked.size} literal CMS UI keys checked; ${keys.size} known translation keys; ${missing.size} missing.`,
);
if (missing.size) process.exitCode = 1;
