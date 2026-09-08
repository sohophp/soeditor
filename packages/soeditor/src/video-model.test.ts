import { describe, expect, it } from 'vitest';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlElement,
} from '@soeditor/html';
import { buildVideo, readVideo } from './video-model.js';
import { mediaUrl, youtubeId } from './video-policy.js';
const base = 'https://cms.example/articles/1';
const parse = (html: string): HtmlElement => {
    const node = parseHtmlFragment(html).document.children[0];
    if (node?.type !== 'element') throw new Error('Expected element');
    return node;
};
const html = (node: HtmlElement): string =>
    serializeHtmlFragment({ type: 'document-fragment', children: [node] });

describe('optional CMS video model', () => {
    it('persists YouTube card thumbnails and keeps them when editing the title', () => {
        const node = buildVideo(
            {
                ...readVideo(),
                src: 'https://youtu.be/abcdefghijk',
                poster: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
            },
            base,
            {},
        );
        expect(node.tagName).toBe('iframe');
        expect(html(node)).toContain('data-soeditor-poster=');
        expect(html(node)).not.toContain(' poster=');
        const edited = buildVideo(
            { ...readVideo(node), title: 'Changed' },
            base,
            {},
            node,
        );
        expect(readVideo(edited).poster).toBe(readVideo(node).poster);
        const native = buildVideo(
            { ...readVideo(edited), src: '/movie.mp4' },
            base,
            {},
            edited,
        );
        expect(html(native)).not.toContain('data-soeditor-poster=');
        expect(readVideo(native).poster).toBe(readVideo(node).poster);
    });
    it('normalizes supported YouTube URLs and rejects lookalike/executable URLs', () => {
        for (const url of [
            'https://youtu.be/abcdefghijk',
            'https://www.youtube.com/watch?v=abcdefghijk&t=9',
            'https://www.youtube.com/shorts/abcdefghijk',
            'https://www.youtube-nocookie.com/embed/abcdefghijk',
        ])
            expect(youtubeId(url)).toBe('abcdefghijk');
        for (const url of [
            'https://youtube.com.evil.test/watch?v=abcdefghijk',
            'https://youtube.com@evil.test/watch?v=abcdefghijk',
            'http://youtube.com/watch?v=abcdefghijk',
            'https://youtube.com:444/embed/abcdefghijk',
            'javascript:alert(1)',
            'https://youtu.be/short',
        ])
            expect(youtubeId(url)).toBeUndefined();
    });
    it('validates asset origins, protocols and credentials', () => {
        const options = { allowedMediaOrigins: ['https://assets.example'] };
        for (const value of ['/video.mp4', 'https://assets.example/video.webm'])
            expect(mediaUrl(value, base, options)).toBe(value);
        for (const value of [
            'javascript:alert(1)',
            'data:video/mp4,test',
            '//evil.test/v.mp4',
            'https://user:pass@assets.example/v.mp4',
            'https://evil.test/v.mp4',
            'https:\\evil.test/v.mp4',
            'blob:https://cms.example/id',
        ])
            expect(() => mediaUrl(value, base, options)).toThrow();
    });
    it('builds responsive native HTML with controls, no autoplay and a validated subtitle', () => {
        const node = buildVideo(
            {
                ...readVideo(),
                src: '/video.mp4',
                poster: '/poster.webp',
                subtitle: '/captions.vtt',
                subtitleLabel: '中文',
                width: '640',
                align: 'right',
            },
            base,
            {},
        );
        const output = html(node);
        expect(output).toContain('<video');
        expect(output).toContain('controls');
        expect(output).toContain('preload="none"');
        expect(output).not.toContain('autoplay');
        expect(output).toContain('margin-left:auto;margin-right:0');
        expect(output).toContain('srclang="zh"');
        expect(output).toContain('crossorigin="anonymous"');
        expect(readVideo(node).subtitle).toBe('/captions.vtt');
    });
    it('preserves unknown CMS attributes, comments, wrappers and alternative sources', () => {
        const original = parse(
            '<figure class="cms-media" data-id="42"><!--CMS--><video data-custom="keep" style="border:1px solid red" src="/old.mp4"><source src="/backup.webm"><track kind="captions" src="/other.vtt"><span>fallback</span></video><figcaption>Caption</figcaption></figure>',
        );
        const output = html(
            buildVideo(
                { ...readVideo(original), src: '/new.mp4', title: 'A "title"' },
                base,
                {},
                original,
            ),
        );
        for (const content of [
            'class="cms-media"',
            'data-custom="keep"',
            '<!--CMS-->',
            '/backup.webm',
            'kind="captions"',
            '<span>fallback</span>',
            '<figcaption>Caption</figcaption>',
            'border:1px solid red',
        ])
            expect(output).toContain(content);
        expect(output).toContain('A &quot;title&quot;');
    });
    it('produces a constrained YouTube iframe and rejects invalid options', () => {
        const values = { ...readVideo(), src: 'https://youtu.be/abcdefghijk' };
        const output = html(buildVideo(values, base, {}));
        expect(output).toContain(
            'https://www.youtube-nocookie.com/embed/abcdefghijk',
        );
        expect(output).toContain('sandbox=');
        expect(output).not.toContain('autoplay');
        expect(() => buildVideo(values, base, { youtube: false })).toThrow();
        for (const width of ['0', '9999', 'calc(100%)'])
            expect(() => buildVideo({ ...values, width }, base, {})).toThrow();
        expect(() =>
            buildVideo(
                { ...values, src: 'https://youtube.com/watch?v=bad' },
                base,
                {},
            ),
        ).toThrow();
    });
    it('retains source alternatives, playback flags and authored layout on a title-only edit', () => {
        const original = parse(
            '<video autoplay preload="auto" style="width:45%;border:1px solid red"><source src="/video.webm" type="video/webm"><source src="/video.mp4" type="video/mp4"></video>',
        );
        const updated = buildVideo(
            { ...readVideo(original), title: 'New title' },
            base,
            {},
            original,
        );
        const output = html(updated);
        expect(output).not.toMatch(/<video[^>]*\bsrc=/u);
        expect(output).toContain('autoplay');
        expect(output).toContain('preload="auto"');
        expect(output).toContain('style="width:45%;border:1px solid red"');
        expect(output).toContain('/video.mp4');
        const aligned = html(
            buildVideo(
                { ...readVideo(updated), align: 'right' },
                base,
                {},
                updated,
            ),
        );
        expect(aligned).toContain('width:45%');
        const iframe = parse(
            '<iframe src="https://www.youtube.com/embed/abcdefghijk?start=12&amp;autoplay=1"></iframe>',
        );
        expect(
            html(
                buildVideo(
                    { ...readVideo(iframe), title: 'New title' },
                    base,
                    {},
                    iframe,
                ),
            ),
        ).toContain('start=12&amp;autoplay=1');
    });
});
