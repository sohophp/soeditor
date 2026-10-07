import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const cliRequire = createRequire(
    realpathSync(
        new URL(
            '../node_modules/@changesets/cli/package.json',
            import.meta.url,
        ),
    ),
);
const configRequire = createRequire(cliRequire.resolve('@changesets/config'));
const micromatchRequire = createRequire(configRequire.resolve('micromatch'));
const braces = micromatchRequire('braces');
const micromatch = configRequire('micromatch');
const isDepthError = (error) =>
    error instanceof RangeError && error.code === 'ERR_BRACES_DEPTH_LIMIT';
const nested = '{'.repeat(4_000) + 'a,b' + '}'.repeat(4_000);

for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    test(`patched braces ${method} rejects deeply nested source before recursion`, () => {
        assert.throws(() => braces[method](nested), isDepthError);
    });
}
for (const method of ['compile', 'expand', 'stringify']) {
    test(`patched braces ${method} bounds direct AST input`, () => {
        let ast = { type: 'text', value: 'a' };
        for (let depth = 0; depth < 20_000; depth += 1)
            ast = { type: 'root', nodes: [ast] };
        assert.throws(() => braces[method](ast), isDepthError);
        const cycle = { type: 'root', nodes: [] };
        cycle.nodes.push(cycle);
        assert.throws(() => braces[method](cycle), isDepthError);
    });
}
test('patched braces retains ordinary ranges, nesting and workspace globs', () => {
    assert.deepEqual(braces.expand('packages/{engine,{html,ui}}'), [
        'packages/engine',
        'packages/html',
        'packages/ui',
    ]);
    assert.deepEqual(braces.expand('release-{1..3}'), [
        'release-1',
        'release-2',
        'release-3',
    ]);
    assert.equal(
        braces.stringify(braces.parse('packages/{engine,ui}')),
        'packages/{engine,ui}',
    );
    assert.deepEqual(
        micromatch(
            ['packages/engine', 'packages/ui', 'docs/site'],
            'packages/{engine,ui}',
        ),
        ['packages/engine', 'packages/ui'],
    );
});
