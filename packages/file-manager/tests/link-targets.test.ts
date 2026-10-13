import { describe, expect, it, vi } from 'vitest';
import {
    createFileManagerLinkTargetProvider,
    createHttpLinkTargetSearch,
} from '../src/index.js';

describe('shared Link/Image target providers', () => {
    it('keeps original URLs and cancels without inventing a target', async () => {
        const open = vi
            .fn()
            .mockResolvedValueOnce({
                url: '/site/uploads/guide.pdf',
                name: 'Guide',
            })
            .mockResolvedValueOnce(null);
        const provider = createFileManagerLinkTargetProvider({
            fileManager: { open },
        });
        expect(await provider.select('internal')).toBeNull();
        expect(open).not.toHaveBeenCalled();
        expect(await provider.select('file')).toEqual({
            href: '/site/uploads/guide.pdf',
            title: 'Guide',
        });
        expect(open).toHaveBeenCalledWith({ kind: 'file', multiple: false });
        expect(await provider.select('file')).toBeNull();
    });
    it('serializes async host URL resolution as well as the picker', async () => {
        let resolve!: (value: { href: string }) => void;
        const open = vi.fn().mockResolvedValue({ url: '/stored.pdf' });
        const provider = createFileManagerLinkTargetProvider({
            fileManager: { open },
            resolveFile: () =>
                new Promise((done) => {
                    resolve = done;
                }),
        });
        const first = provider.select('file');
        await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
        expect(await provider.select('file')).toBeNull();
        resolve({ href: '/published/file/7' });
        expect(await first).toEqual({ href: '/published/file/7' });
    });
    it('rejects unsafe files and permits a subsequent retry', async () => {
        const open = vi
            .fn()
            .mockResolvedValueOnce({ url: 'javascript:alert(1)' })
            .mockResolvedValueOnce({ url: '/safe.pdf' });
        const provider = createFileManagerLinkTargetProvider({
            fileManager: { open },
        });
        await expect(provider.select('file')).rejects.toThrow(
            'forbidden scheme',
        );
        expect(await provider.select('file')).toEqual({ href: '/safe.pdf' });
    });
    it('requests authenticated JSON only for bounded slash queries', async () => {
        const request = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    targets: [{ href: '/site/about?x=1', title: '<About>' }],
                }),
            ),
        );
        const search = createHttpLinkTargetSearch({
            endpoint: '/admin/pages',
            fetch: request,
        });
        expect(await search('about')).toEqual([]);
        expect(await search('//external')).toEqual([]);
        expect(await search('/' + 'a'.repeat(100))).toEqual([]);
        expect(request).not.toHaveBeenCalled();
        expect(await search('/about')).toEqual([
            { href: '/site/about?x=1', title: '<About>' },
        ]);
        expect(request).toHaveBeenCalledWith(
            'http://localhost/admin/pages?q=%2Fabout',
            {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            },
        );
    });
    it.each([
        'javascript:alert(1)',
        '//other.example/',
        '/bad\\path',
        '/bad\npath',
    ])('rejects malformed internal target %s', async (href) => {
        const search = createHttpLinkTargetSearch({
            endpoint: '/admin/pages',
            fetch: vi
                .fn()
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({ targets: [{ href, title: 'Page' }] }),
                    ),
                ),
        });
        await expect(search('/')).rejects.toThrow(
            'invalid site-relative target',
        );
    });
    it('caps server results and reports authentication failure', async () => {
        const request = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        targets: Array.from({ length: 80 }, (_, i) => ({
                            href: `/page/${i}`,
                            title: `Page ${i}`,
                        })),
                    }),
                ),
            )
            .mockResolvedValueOnce(new Response('', { status: 401 }));
        const search = createHttpLinkTargetSearch({
            endpoint: '/admin/pages',
            fetch: request,
        });
        expect(await search('/')).toHaveLength(50);
        await expect(search('/')).rejects.toThrow('(401)');
    });
});
