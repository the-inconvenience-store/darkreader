import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const safariManifestPath = join(__dirname, '../../../src/manifest-safari.json');
const baseManifestPath = join(__dirname, '../../../src/manifest.json');

async function readJSONIfPresent(path: string): Promise<Record<string, any>> {
    if (!existsSync(path)) {
        return {};
    }
    return JSON.parse(await readFile(path, {encoding: 'utf-8'}));
}

describe('Safari manifest', () => {
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
});
