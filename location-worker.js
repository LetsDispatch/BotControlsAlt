'use strict';
importScripts('./location-search.js?v=1');
let catalogPromise;

async function catalog() {
    if (!catalogPromise) {
        catalogPromise = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            try {
                const response = await fetch('./locations/catalog.v1.json', { cache: 'force-cache', signal: controller.signal });
                if (!response.ok) throw new Error('Location catalog unavailable');
                return new LocationSearch(await response.json());
            } finally { clearTimeout(timer); }
        })().catch(error => { catalogPromise = null; throw error; });
    }
    return catalogPromise;
}

self.onmessage = async ({ data: { id, query } }) => {
    try {
        const search = await catalog();
        self.postMessage({ id, results: search.search(query) });
    } catch {
        self.postMessage({ id, error: 'Unable to load locations. Type again to retry.' });
    }
};
