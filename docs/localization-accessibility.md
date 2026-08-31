# Localization, IME, mobile, and accessibility

## Per-instance locale

Classic editors accept a locale, optional logical direction, and additional
plain-text resources:

```ts
const editor = await createClassicEditor(textarea, {
    locale: 'zh-CN',
});

const rtlEditor = await createClassicEditor(otherTextarea, {
    locale: 'ar',
    translations: [
        {
            locale: 'ar',
            direction: 'rtl',
            messages: {
                Bold: 'عريض',
            },
        },
    ],
});
```

Built-in baseline resources cover English (`en`), Simplified Chinese
(`zh-CN`/`zh-Hans`), and Traditional Chinese (`zh-TW`/`zh-Hant`). Resolution is
exact locale, then base language, then English identity fallback. Applications
can dynamically import a resource before calling the asynchronous classic
factory; resources are data rather than executable HTML.

Locale and direction are resolved per editor. `lang` and `dir` are applied to
the owned chrome only. Canonical HTML, Visual content direction, Source, and a
neighboring editor are unchanged.

## Keyboard and embedded help

The classic toolbar includes localized accessibility help. Tab enters controls;
Arrow keys, Home, and End move within toolbar/menu groups. Shift+F10 opens the
context menu, Escape closes menus/dialogs, and native dialog focus returns to
the invoking control. Narrow layouts use at least 44px logical control targets.

## Chinese composition and history

Controlled composition keeps the initial selection as the replacement range.
Intermediate Pinyin/IME values replace one another, and each composition
session receives a distinct Core history group. One Undo removes the latest
committed composition without also removing the prior session.

Automated evidence uses Simplified/Traditional Chinese strings, punctuation,
selection replacement, sequential composition sessions, narrow viewport
changes, touch-pointer resizing, RTL isolation, and teardown.

## Browser and manual qualification limits

The repository contains a four-project CMS qualification configuration:

```bash
pnpm test:browser:cms       # available Chromium desktop + mobile projects
pnpm test:browser:cms:all   # Chromium, Firefox, WebKit, Chromium mobile
```

On the current Linux host, Chromium desktop and touch/mobile projects pass.
Firefox cannot start because the host `libstdc++` lacks `GLIBCXX_3.4.26`;
WebKit cannot start because GTK4, Vulkan, Graphene, Event, Flite, AVIF, JPEG,
and Manette runtime libraries are unavailable. The three-engine configuration
is retained so a provisioned CI image can run it unchanged.

Native Windows/macOS Chinese IMEs and screen readers are not faithfully
automatable in this container. Before a CMS release, manually check Microsoft
Pinyin, macOS Pinyin/Zhuyin, VoiceOver, NVDA, and a mobile virtual keyboard.
This evidence is qualification coverage, not a claim of WCAG, screen-reader,
or universal IME certification.
