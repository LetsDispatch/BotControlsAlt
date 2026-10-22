(function () {
    'use strict';
    const workerUrl = new URL('./location-worker.js?v=1', document.currentScript.src);
    let worker, sequence = 0;
    const pending = new Map();

    function failWorker() {
        worker?.terminate();
        worker = null;
        for (const { reject, timer } of pending.values()) {
            clearTimeout(timer);
            reject(new Error('Unable to load locations. Type again to retry.'));
        }
        pending.clear();
    }

    function search(query) {
        return new Promise((resolve, reject) => {
            if (!worker) {
                worker = new Worker(workerUrl);
                worker.onerror = failWorker;
                worker.onmessage = ({ data }) => {
                    const request = pending.get(data.id);
                    if (!request) return;
                    pending.delete(data.id);
                    clearTimeout(request.timer);
                    if (data.error) request.reject(new Error(data.error));
                    else request.resolve(data.results);
                };
            }
            const id = ++sequence;
            const timer = setTimeout(failWorker, 30000);
            pending.set(id, { resolve, reject, timer });
            worker.postMessage({ id, query });
        });
    }

    function label(location) {
        if (location.type === 'city') return `${location.name}, ${location.state} — City`;
        if (location.type === 'state') return `${location.name} (${location.state}) — State`;
        return `${location.name} — Region`;
    }

    function attach(input, onChange) {
        let selected = null, results = [], active = -1, generation = 0, timer;
        const parent = input.parentElement;
        parent.classList.add('location-picker');
        const list = document.createElement('div');
        list.id = input.id + '-suggestions';
        list.className = 'location-suggestions shadow';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Location suggestions');
        list.hidden = true;
        parent.appendChild(list);
        const status = document.createElement('div');
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        parent.appendChild(status);
        input.maxLength = 100;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', list.id);
        input.setAttribute('aria-expanded', 'false');

        const hide = () => {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
        };
        const show = () => {
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        };
        const message = text => {
            results = [];
            active = -1;
            list.replaceChildren();
            const item = document.createElement('div');
            item.className = 'p-2 text-body-secondary';
            item.textContent = text;
            list.appendChild(item);
            status.textContent = text;
            show();
        };
        const choose = location => {
            generation++;
            clearTimeout(timer);
            selected = location;
            input.value = label(location);
            input.setCustomValidity('');
            hide();
            onChange(location);
            input.focus();
        };
        const activate = index => {
            active = index;
            [...list.children].forEach((item, i) => {
                item.classList.toggle('active', i === active);
                item.setAttribute('aria-selected', String(i === active));
            });
            const item = list.children[active];
            input.setAttribute('aria-activedescendant', item.id);
            item.scrollIntoView({ block: 'nearest' });
        };
        const lookup = async () => {
            const current = ++generation;
            const query = input.value.trim();
            if (!query) { hide(); return; }
            message('Loading locations…');
            try {
                const found = await search(query);
                if (current !== generation || document.activeElement !== input) return;
                results = found;
                active = -1;
                list.replaceChildren();
                if (!results.length) { message('No matching US locations.'); return; }
                results.forEach((location, index) => {
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.id = `${list.id}-${index}`;
                    item.className = 'location-suggestion';
                    item.setAttribute('role', 'option');
                    item.setAttribute('aria-selected', 'false');
                    item.tabIndex = -1;
                    item.textContent = label(location);
                    item.addEventListener('mousedown', event => event.preventDefault());
                    item.addEventListener('click', () => choose(location));
                    list.appendChild(item);
                });
                status.textContent = `${results.length} suggestions. Use arrow keys and Enter to select.`;
                show();
            } catch {
                if (current === generation && document.activeElement === input)
                    message('Unable to load locations. Type again to retry.');
            }
        };
        input.addEventListener('input', () => {
            generation++;
            clearTimeout(timer);
            selected = null;
            results = [];
            input.setCustomValidity('');
            onChange(null);
            hide();
            timer = setTimeout(lookup, 200);
        });
        input.addEventListener('focus', () => {
            if (!selected && input.value.trim()) { clearTimeout(timer); timer = setTimeout(lookup, 200); }
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') { generation++; clearTimeout(timer); hide(); }
            if (list.hidden || !results.length) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const next = active < 0
                    ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
                    : (active + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
                activate(next);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(results[active < 0 ? 0 : active]);
            }
        });
        parent.addEventListener('focusout', event => {
            if (!parent.contains(event.relatedTarget)) hide();
        });
        document.addEventListener('pointerdown', event => {
            if (!parent.contains(event.target)) hide();
        });
        onChange(null);
        return {
            get selected() { return selected; },
            clear() {
                generation++;
                clearTimeout(timer);
                selected = null;
                results = [];
                input.value = '';
                input.setCustomValidity('');
                hide();
                onChange(null);
            }
        };
    }

    // Preserve the legacy API contract: states use their abbreviation as `name`.
    function createInput(location, scope, radius) {
        const input = document.createElement('input');
        input.disabled = true;
        input.type = 'text';
        input.className = 'form-control';
        Object.assign(input.dataset, {
            name: location.type === 'state' ? location.state : location.name,
            id: location.id, type: location.type, scope, state: location.state,
            latitude: location.latitude, longitude: location.longitude,
            range: location.type === 'city' ? radius : 0
        });
        input.value = label(location) + (location.type === 'city' && Number(radius) ? `, ${radius}mi` : '');
        return input;
    }

    window.LocationPicker = { attach, createInput };
})();
