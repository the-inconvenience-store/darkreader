const testChrome = product === 'chrome-mv3' ? test : test.skip;

testChrome('applies the theme without reloading when the first reply is lost', async () => {
    await emulateColorScheme('light');
    const wasReplyDropped = await backgroundUtils.dropNextThemeReply();
    await loadTestPage({
        '/': '<!doctype html><style>html {background: white}</style><h1>First navigation</h1>',
    });

    expect(await wasReplyDropped()).toBe(true);
    await expectPageStyles(expect, ['document', 'background-color', 'rgb(24, 26, 27)']);
    expect(await pageUtils.evaluateScript(() =>
        (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type,
    )).toBe('navigate');
}, 10_000);
