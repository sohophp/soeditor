import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { argv } from 'node:process';
import { gunzipSync } from 'node:zlib';

assert.ok(
    argv[2] && argv[3],
    'Usage: output.json snapshot.heapsnapshot.gz [...]',
);
const results = [];
for (const file of argv.slice(3)) {
    const data = JSON.parse(gunzipSync(await readFile(file)).toString());
    const { nodes, edges, strings } = data;
    const meta = data.snapshot.meta;
    const nf = meta.node_fields,
        ef = meta.edge_fields;
    const width = nf.length,
        edgeWidth = ef.length,
        count = nodes.length / width;
    const ni = Object.fromEntries(nf.map((name, index) => [name, index]));
    const ei = Object.fromEntries(ef.map((name, index) => [name, index]));
    const edgeTypes = meta.edge_types[ei.type];
    const starts = new Uint32Array(count);
    let offset = 0;
    const detached = [],
        history = [];
    for (let index = 0; index < count; index += 1) {
        starts[index] = offset;
        const length = nodes[index * width + ni.edge_count];
        let before = false,
            after = false;
        for (
            let edge = offset;
            edge < offset + length * edgeWidth;
            edge += edgeWidth
        ) {
            if (edgeTypes[edges[edge + ei.type]] !== 'property') continue;
            const key = strings[edges[edge + ei.name_or_index]];
            before ||= key === 'beforeSource';
            after ||= key === 'afterSource';
        }
        if (before && after) history.push(index);
        if (nodes[index * width + ni.detachedness] === 2) detached.push(index);
        offset += length * edgeWidth;
    }
    // Shortest paths excluding explicitly weak edges; not a dominator analysis.
    const parents = new Int32Array(count).fill(-1),
        parentEdges = new Int32Array(count).fill(-1);
    const queue = new Uint32Array(count);
    queue[0] = 0;
    parents[0] = 0;
    let end = 1;
    for (let head = 0; head < end; head += 1) {
        const index = queue[head],
            stop =
                starts[index] +
                nodes[index * width + ni.edge_count] * edgeWidth;
        for (let edge = starts[index]; edge < stop; edge += edgeWidth) {
            if (edgeTypes[edges[edge + ei.type]] === 'weak') continue;
            const target = edges[edge + ei.to_node] / width;
            if (parents[target] !== -1) continue;
            parents[target] = index;
            parentEdges[target] = edge;
            queue[end++] = target;
        }
    }
    function describe(index) {
        return {
            id: nodes[index * width + ni.id],
            name: strings[nodes[index * width + ni.name]].slice(0, 160),
            selfBytes: nodes[index * width + ni.self_size],
        };
    }
    function path(index) {
        const steps = [];
        if (parents[index] === -1)
            return { reachableWithoutWeakEdges: false, node: describe(index) };
        while (index !== 0) {
            const edge = parentEdges[index],
                type = edgeTypes[edges[edge + ei.type]];
            const key = edges[edge + ei.name_or_index];
            steps.push({
                ...describe(index),
                edge:
                    type === 'element' || type === 'hidden'
                        ? String(key)
                        : strings[key],
                edgeType: type,
            });
            index = parents[index];
        }
        return { reachableWithoutWeakEdges: true, steps: steps.reverse() };
    }
    const grouped = new Map();
    for (const index of detached) {
        const name = describe(index).name;
        grouped.set(name, (grouped.get(name) ?? 0) + 1);
    }
    results.push({
        file,
        totalNodes: count,
        detachedCount: detached.length,
        detachedTypes: [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 20),
        historyEntryCount: history.length,
        historyExample: history.length ? path(history[0]) : undefined,
        detachedExamples: detached.slice(0, 5).map(path),
    });
}
await writeFile(
    argv[2],
    `${JSON.stringify({ analyzedAt: new Date().toISOString(), results, note: 'Snapshot graph diagnostics. History entries are identified by beforeSource/afterSource properties; shortest paths omit explicitly weak edges but do not calculate retained sizes or fully model ephemeron reachability. Detached DOM and reachable objects alone do not establish a leak.' }, null, 2)}\n`,
);
