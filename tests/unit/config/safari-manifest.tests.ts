import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const rootDir = join(__dirname, '../../..');
const safariManifestPath = join(__dirname, '../../../src/manifest-safari.json');
const baseManifestPath = join(__dirname, '../../../src/manifest.json');
const builtManifestPath = join(rootDir, 'build/debug/safari/manifest.json');

async function readJSONIfPresent(path: string): Promise<Record<string, any>> {
    if (!existsSync(path)) {
        return {};
    }
    return JSON.parse(await readFile(path, {encoding: 'utf-8'}));
}

describe('Safari manifest', () => {
    beforeAll(() => {
        execFileSync(process.execPath, [
            '--input-type=module',
            '--eval',
            "const {default: task} = await import('./tasks/bundle-manifest.js'); await task.run({platforms: {safari: true}, debug: true, watch: false, test: false, log: false, version: false});",
        ], {cwd: rootDir});
    });

    it('uses a nonpersistent MV2 background page', async () => {
        const base = await readJSONIfPresent(baseManifestPath);
        const safari = await readJSONIfPresent(safariManifestPath);
        const manifest = {...base, ...safari};

        expect(manifest.manifest_version).toBe(2);
        expect(safari.background).toEqual({
            persistent: false,
            page: 'background/index.html',
        });
    });

    it('declares only the required Safari permissions', async () => {
        const safari = await readJSONIfPresent(safariManifestPath);

        expect(safari.permissions).toEqual([
            'alarms',
            'storage',
            'tabs',
            '<all_urls>',
        ]);
    });

    it('omits unsupported match_about_blank declarations', async () => {
        const manifest = await readJSONIfPresent(builtManifestPath);

        expect(manifest.content_scripts.every(
            (contentScript: Record<string, any>) => !('match_about_blank' in contentScript)
        )).toBe(true);
    });
});
