/* Browser/Node port of master AutocompleteService and LocationCatalog.
 * Keep ranking changes covered by the C# parity fixture in tests/. */
(function (root) {
    'use strict';
    const normalize = value => value.trim().toLowerCase().normalize('NFD')
        .replace(/\p{Mn}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const typeRank = { region: 0, state: 1, city: 2 };

    function similarity(left, right) {
        if (left === right) return 100;
        const total = left.length + right.length;
        if (!total || 200 * Math.min(left.length, right.length) / total < 84.5) return 0;
        const row = new Uint16Array(right.length + 1);
        for (let i = 0; i < left.length; i++) {
            let previous = 0;
            for (let j = 0; j < right.length; j++) {
                const old = row[j + 1];
                row[j + 1] = left[i] === right[j] ? previous + 1 : Math.max(row[j], old);
                previous = old;
            }
        }
        const score = 200 * row[right.length] / total;
        // Match Math.Round's midpoint-to-even rule in the C# source.
        const floor = Math.floor(score);
        return score - floor === 0.5 ? floor + floor % 2 : Math.round(score);
    }

    function tokenScore(location, query, fuzzy) {
        if (location.startsWith(query)) return 0;
        if (!fuzzy || query.length < 3) return Infinity;
        const ratio = similarity(location, query);
        return ratio >= 85 ? 100 - ratio : Infinity;
    }

    function tokensScore(location, query, ordered, fuzzy) {
        let start = 0, total = 0;
        for (const token of query) {
            let best = Infinity, bestIndex = -1;
            for (let i = start; i < location.length; i++) {
                const score = tokenScore(location[i], token, fuzzy);
                if (score < best) { best = score; bestIndex = i; }
                if (best === 0) break;
            }
            if (!Number.isFinite(best)) return Infinity;
            total += best;
            if (ordered) start = bestIndex + 1;
        }
        return total;
    }

    function aliasRank(alias, term, query, tokenSearch, fuzzySearch) {
        const name = alias.name;
        if (name === term) return 0;
        if (name.startsWith(term)) return 10;
        if (name.includes(term)) return 20;
        if (!tokenSearch && query.length === 1 && fuzzySearch) {
            const score = tokensScore(alias.tokens, query, false, true);
            if (Number.isFinite(score)) return 25 + score;
        }
        if (tokenSearch) {
            if (tokensScore(alias.tokens, query, true, false) === 0) return 30;
            if (tokensScore(alias.tokens, query, false, false) === 0) return 35;
            const ordered = tokensScore(alias.tokens, query, true, true);
            if (Number.isFinite(ordered)) return 40 + ordered;
            const unordered = tokensScore(alias.tokens, query, false, true);
            if (Number.isFinite(unordered)) return 45 + unordered;
        }
        if (fuzzySearch) {
            const ratio = similarity(name, term);
            if (ratio >= 85) return 150 - ratio;
        }
        return Infinity;
    }

    function locationId(type, name, state) {
        return `${type[0].toUpperCase() + type.slice(1)}:${state}:${name.trim().toUpperCase().split(/ +/).join('-')}`;
    }

    class LocationSearch {
        constructor(catalog) {
            if (catalog.version !== 1) throw new Error('Unsupported location catalog');
            this.cache = new Map();
            this.records = [];
            this.zipIndex = new Map();
            const states = new Map(catalog.states);
            const add = (name, state, type, latitude = 0, longitude = 0, zips = []) => {
                const names = [name];
                if (type === 'city') names.push(`${name} ${state}`, `${name} ${states.get(state)}`);
                if (type === 'state') names.push(state);
                const record = {
                    location: { id: locationId(type, name, state), name, state, type, latitude, longitude },
                    order: this.records.length,
                    aliases: [...new Set(names.map(normalize))].map(name => ({ name, tokens: name.split(' ') })),
                    zips
                };
                this.records.push(record);
                for (const zip of zips) {
                    for (let length = 1; length <= zip.length; length++) {
                        const prefix = zip.slice(0, length);
                        if (!this.zipIndex.has(prefix)) this.zipIndex.set(prefix, new Set());
                        this.zipIndex.get(prefix).add(record);
                    }
                }
            };
            for (const [name, state, lat, lon, zips] of catalog.cities) add(name, state, 'city', lat, lon, zips);
            for (const [state, name] of catalog.states) add(name, state, 'state');
            for (const [state, name] of catalog.regions) add(name, state, 'region');
        }

        search(value) {
            if (typeof value !== 'string' || value.length > 100) return [];
            const term = normalize(value);
            if (!term) return [];
            if (this.cache.has(term)) return this.cache.get(term);
            const query = term.split(' ');
            const zipSearch = /^\d+$/.test(term);
            const tokenSearch = query.length > 1 && query[1].length >= 2;
            const fuzzySearch = term.length >= 3;
            const candidates = zipSearch ? this.zipIndex.get(term) || [] : this.records;
            const best = [];
            const compare = (left, right) => typeRank[left.record.location.type] - typeRank[right.record.location.type]
                || left.rank - right.rank || left.record.order - right.record.order;
            for (const record of candidates) {
                let rank = Infinity;
                if (zipSearch) rank = record.zips.includes(term) ? 0 : 10;
                else for (const alias of record.aliases) {
                    rank = Math.min(rank, aliasRank(alias, term, query, tokenSearch, fuzzySearch));
                    if (rank === 0) break;
                }
                if (!Number.isFinite(rank)) continue;
                const match = { record, rank };
                let low = 0, high = best.length;
                while (low < high) {
                    const middle = (low + high) >>> 1;
                    if (compare(match, best[middle]) < 0) high = middle;
                    else low = middle + 1;
                }
                if (low >= 20) continue;
                best.splice(low, 0, match);
                if (best.length > 20) best.pop();
            }
            const result = best.map(item => item.record.location);
            if (this.cache.size === 128) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(term, result);
            return result;
        }
    }
    root.LocationSearch = LocationSearch;
    if (typeof module !== 'undefined') module.exports = { LocationSearch, normalize, similarity };
})(typeof self !== 'undefined' ? self : globalThis);
