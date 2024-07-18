const options = {
    fields: ["place_id", "formatted_address", "name", "address_components", "geometry"],
    strictBounds: false,
    language: "en",
    types: ["(regions)"],
    componentRestrictions: { country: "us" }
};

const modalElement = document.getElementById('locationModal');
const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

var place = null;
var modalPlace = null;
let refSearchId = null;
let refSearchScope = null;

function initMap() {
    const input = document.getElementById("locationInput");
    const autocomplete = new google.maps.places.Autocomplete(input, options);
    autocomplete.addListener("place_changed", () => {
        place = autocomplete.getPlace();
        if (getPlaceType(place) == 'city') {
            document.getElementById('milesRangeSearch').classList.remove('d-none');
        } else {
            document.getElementById('milesRangeSearch').classList.add('d-none');
        }
    });

    const inputModal = document.getElementById("locationModalInput");
    const autocompleteModal = new google.maps.places.Autocomplete(inputModal, options);
    autocompleteModal.addListener("place_changed", () => {
        modalPlace = autocompleteModal.getPlace();
        if (getPlaceType(modalPlace) == 'city') {
            document.getElementById('milesRangeSearchModal').classList.remove('d-none');
        } else {
            document.getElementById('milesRangeSearchModal').classList.add('d-none');
        }
    });
}

window.initMap = initMap;

function mapAutocompleteToModal() {
    modalElement.addEventListener('shown.bs.modal', event => {
        document.getElementById("locationModalInput").focus();
    });
}

function showModal(searchId, scope) {
    refSearchId = searchId;
    refSearchScope = scope;
    modal.show();
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        let html = document.getElementsByTagName('html');
        html[0].setAttribute('data-bs-theme', 'dark');
    } else {
        let html = document.getElementsByTagName('html');
        html[0].setAttribute('data-bs-theme', 'light');
    }
});

function showPopup(text) {
    const toastLiveExample = document.getElementById('liveToast');
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastLiveExample);
    document.getElementById('toast-text').innerHTML = text;
    toastBootstrap.show();
}

window.onload = (_event) => {
    addEventListenerToShipWithinRange();
    addEventListenerToMilesSearchRange();
    addEventListenerToMilesSearchRangeModal();
    mapAutocompleteToModal();
    checkInitData();
};

function checkInitData() {
    if (Telegram.WebApp.initData) {
        getAuthToken();
    } else {
        alert("Please open this page via Telegram bot");
        return;
    }
}

function loadUserData() {
    getCurrentSearches();
    getBrokerBlocks();
    getPersistentBrokerBlocks();
    checkAdminRights();
}

//tooltip init
const miwe = new bootstrap.Tooltip(document.getElementById('miwe'));
const noea = new bootstrap.Tooltip(document.getElementById('noea'));
const nowe = new bootstrap.Tooltip(document.getElementById('nowe'));
const sout = new bootstrap.Tooltip(document.getElementById('sout'));
const soea = new bootstrap.Tooltip(document.getElementById('soea'));
const sowe = new bootstrap.Tooltip(document.getElementById('sowe'));

function addLocation() {
    let input = document.getElementById('locationInput');
    if (input.value != '') {
        let locationsDiv = document.getElementById('locations');
        let cityElement = createLocation();
        locationsDiv.appendChild(cityElement);
        document.getElementById('milesRangeSearch').classList.add('d-none');
        input.value = "";
        Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function addLocationFromModal() {
    let input = document.getElementById('locationModalInput');
    if (input.value != '') {
        var locationDivId = (refSearchScope == "pu" ? "from" : "to") + refSearchId;
        let locationsDiv = document.getElementById(locationDivId);
        let cityElement = createLocationModal(refSearchScope == "pu" ? "Pickup" : "Delivery");
        locationsDiv.appendChild(cityElement);
        document.getElementById('milesRangeSearchModal').classList.add('d-none');
        modal.hide();
        input.value = "";
        Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function addEventListenerToShipWithinRange() {
    let input = document.getElementById('readyToShip');
    let text = document.getElementById('readyToShipText');
    input.addEventListener("input", function() {
        if (input.value == -1) {
            text.innerHTML = 'any time';
        } else if (input.value == 0) {
            text.innerHTML = 'today';
        } else {
            text.innerHTML = input.value + ' day(s)';
        }
    });
}

function addEventListenerToMilesSearchRange() {
    let input = document.getElementById('searchRange');
    let text = document.getElementById('searchRangeText');
    input.addEventListener("input", function() {
        text.innerHTML = input.value + 'mi';
    });
}

function addEventListenerToMilesSearchRangeModal() {
    let input = document.getElementById('searchRangeModal');
    let text = document.getElementById('searchRangeTextModal');
    input.addEventListener("input", function() {
        text.innerHTML = input.value + 'mi';
    });
}

function getPlaceType(placeObj) {
    if (placeObj.address_components.find(a => a.types.includes('locality')) !== undefined) {
        return 'city';
    } else {
        return 'state';
    }
}

function getPayloadData() {
    let locations = Array.from(document.querySelectorAll('#locations input')).map(loc => ({
        name: loc.getAttribute('data-name'),
        id: loc.getAttribute('data-id'),
        type: loc.getAttribute('data-type'),
        scope: loc.getAttribute('data-scope'),
        range: loc.getAttribute('data-range'),
        state: loc.getAttribute('data-state'),
        latitude: loc.getAttribute('data-latitude'),
        longitude: loc.getAttribute('data-longitude')
    }));
    let vehicleTypes = Array.from(document.querySelectorAll('#vehicleTypes input:checked')).map(c => c.value);
    let trailerType = document.getElementById('trailerType').value;
    let vehicleStatus = document.getElementById('vehicleStatus').value;
    let minVehicles = document.getElementById('minVehicles').value;
    let maxVehicles = document.getElementById('maxVehicles').value;
    let readyToShip = document.getElementById('readyToShip').value;
    let minTotal = document.getElementById('minTotal').value;
    let minPpm = document.getElementById('minPpm').value.replace(",", ".");
    return {
        locations,
        vehicleTypes,
        trailerType,
        vehicleStatus,
        minVehicles,
        maxVehicles,
        readyToShip,
        minTotal,
        minPpm
    }
}

function createRegion(option) {
    let locationsDiv = document.getElementById('locations');
    let item = document.createElement('div');
    item.classList.add('input-group');
    item.innerHTML = `<button class="btn btn-outline-primary" type="button" onclick="switchLocationType(this)">Pickup</button>
                    <input disabled type="text" class="form-control" data-name="${option.innerHTML}" data-type="region" data-scope="Pickup" data-range="0" data-id="new" data-state=${option.value} value="${option.innerHTML}">
                    <button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button>`;
    locationsDiv.appendChild(item);
    Telegram.WebApp.HapticFeedback.impactOccurred('light');
}

function createRegionModal(option) {
    var locationDivId = (refSearchScope == "pu" ? "from" : "to") + refSearchId;
    let locationsDiv = document.getElementById(locationDivId);
    let item = document.createElement('div');
    item.classList.add('input-group');
    item.classList.add('mb-1');
    item.innerHTML = `<input disabled type="text" class="form-control" data-name="${option.innerHTML}" data-type="region" data-scope="${refSearchScope == "pu" ? "Pickup" : "Delivery"}" data-range="0" data-id="new" data-state=${option.value} value="${option.innerHTML}">
                    <button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button>`;
    locationsDiv.appendChild(item);
    modal.hide();
    Telegram.WebApp.HapticFeedback.impactOccurred('light');
}

function createLocation() {
    let placeType = getPlaceType(place);
    let item = document.createElement('div');
    item.classList.add('input-group');
    let locationName = document.getElementById('locationInput').value;
    item.innerHTML = `<button class="btn btn-outline-primary" type="button" onclick="switchLocationType(this)">Pickup</button>
                    <input disabled type="text" class="form-control" data-name="${getNameAttr(place)}" data-id="${place.place_id}" data-latitude="${place.geometry.location.lat()}" data-longitude="${place.geometry.location.lng()}" data-type="${placeType}" data-scope="Pickup" data-range="${getRangeAttr(placeType)}" data-state="${getStateAttr(place)}" value="${locationName + (placeType == 'city' && getRangeAttr(placeType) != 0 ? `, ${getRangeAttr(placeType)}mi` : '')}">
                    <button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button>`;
    return item;
}

function createLocationModal(scope) {
    let placeType = getPlaceType(modalPlace);
    let item = document.createElement('div');
    item.classList.add('input-group');
    let locationName = document.getElementById('locationModalInput').value;
    item.innerHTML = `<input disabled type="text" class="form-control" data-name="${getNameAttr(modalPlace)}" data-id="${modalPlace.place_id}" data-latitude="${modalPlace.geometry.location.lat()}" data-longitude="${modalPlace.geometry.location.lng()}" data-type="${placeType}" data-scope="${scope}" data-range="${getRangeAttrModal(placeType)}" data-state="${getStateAttr(modalPlace)}" value="${locationName + (placeType == 'city' && getRangeAttrModal(placeType) != 0 ? `, ${getRangeAttrModal(placeType)}mi` : '')}">
                    <button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button>`;
    return item;
}

function getRangeAttr(locType){
    if (locType == 'city'){
        return document.getElementById('searchRange').value;
    }
    else{
        return 0;
    }
}

function getRangeAttrModal(locType){
    if (locType == 'city'){
        return document.getElementById('searchRangeModal').value;
    }
    else{
        return 0;
    }
}

function getStateAttr(loc){
    let placeType = getPlaceType(loc);
    if (placeType == 'city')
    {
        return loc.address_components.find(a => a.types.includes('administrative_area_level_1')).short_name;
    }
    else{
        return '';
    }
}

function getNameAttr(loc){
    let placeType = getPlaceType(loc);
    if (placeType == 'city')
    {
        return loc.address_components.find(a => a.types.includes('locality')).short_name;
    }
    else{
        return loc.address_components.find(a => a.types.includes('administrative_area_level_1')).short_name;
    }
}

function removeLocation(button) {
    button.parentElement.remove();
    Telegram.WebApp.HapticFeedback.impactOccurred('light');
}

function switchLocationType(button) {
    if (button.innerHTML == 'Pickup') {
        button.nextElementSibling.setAttribute('data-scope', 'Delivery');
        button.innerHTML = 'Delivery';
    }
    else {
        button.nextElementSibling.setAttribute('data-scope', 'Pickup');
        button.innerHTML = 'Pickup';
    }
    Telegram.WebApp.HapticFeedback.impactOccurred('light');
}

const States = {
    1: "AL",
    2: "AK",
    3: "AZ",
    4: "AR",
    5: "CA",
    6: "CO",
    7: "CT",
    8: "DE",
    9: "DC",
    10: "FL",
    11: "GA",
    12: "HI",
    13: "ID",
    14: "IL",
    15: "IN",
    16: "IA",
    17: "KS",
    18: "KY",
    19: "LA",
    20: "ME",
    21: "MD",
    22: "MA",
    23: "MI",
    24: "MN",
    25: "MS",
    26: "MO",
    27: "MT",
    28: "NE",
    29: "NV",
    30: "NH",
    31: "NJ",
    32: "NM",
    33: "NY",
    34: "NC",
    35: "ND",
    36: "OH",
    37: "OK",
    38: "OR",
    39: "PA",
    40: "RI",
    41: "SC",
    42: "SD",
    43: "TN",
    44: "TX",
    45: "UT",
    46: "VT",
    47: "VA",
    48: "WA",
    49: "WV",
    50: "WI",
    51: "WY",
    52: "Northeast",
    53: "Southeast",
    54: "MidwestPlains",
    55: "Southwest",
    56: "Any",
    57: "Northwest",
    58: "South"
};

const PaymentFrequency = {
    1: "1 month",
    2: "2 months",
    3: "3 months",
    6: "6 months"
}

function renderCurrentSearches(searches){
    let renderString = "";
    searches.forEach(s => {
        renderString += `
        <li class="list-group-item pb-4" id="search${s.orderSearchId}">
            <span class="mb-2 fs-5">Order search ${s.orderSearchId}</span>
            <br>
            <span class="mb-2 fs-5">Created at - ${new Date(Date.parse(s.createdAt)).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
            <br>
            <span class="mb-2 fs-5">Notifications sent - ${s.notificationsCount}</span>
            <div id="from${s.orderSearchId}">
                <span class="input-group-text mt-2 mb-1">From</span>
                ${s.geoCities.filter(c => c.scope == 0).map((g) => '<div class="input-group mb-1" id="' + s.orderSearchId + 'from' + g.geoCityId + '"><input type="text" class="form-control" data-name="'+ g.cityName +'" data-state="' + States[g.cityState] + '" data-type="city" data-scope="Pickup" data-id="keep" aria-label="Pickup location" value="'+ g.cityName + ', '+ States[g.cityState] + ', ' + g.radius +'mi" disabled></input><button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button></div>')}
                ${s.geoZones.filter(c => c.scope == 0).map((g) => '<div class="input-group mb-1" id="' + s.orderSearchId + 'from' + g.geoZoneId + '"><input type="text" class="form-control" data-name="'+ States[g.state] +'" data-state="' + States[g.state] + '" aria-label="Pickup location" value="'+ States[g.state] +'" data-type="state" data-scope="Pickup" data-id="keep" disabled></input><button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button></div>')}
            </div>
            <button type="button" class="btn btn-primary mt-1" onclick="showModal(${s.orderSearchId}, 'pu')">
                Add location
            </button>
            <hr>
            <div id="to${s.orderSearchId}">
                <span class="input-group-text mb-1">To</span>
                ${s.geoCities.filter(c => c.scope == 1).map((g) => '<div class="input-group mb-1" id="'+ s.orderSearchId + 'to' + g.geoCityId + '"><input type="text" class="form-control" aria-label="Delivery location" value="'+ g.cityName + ', '+ States[g.cityState] +', ' + g.radius + 'mi" data-name="'+ g.cityName +'" data-state="' + States[g.cityState] + '" data-type="city" data-scope="Delivery" data-id="keep" disabled></input><button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button></div>')}
                ${s.geoZones.filter(c => c.scope == 1).map((g) => '<div class="input-group mb-1" id="' + s.orderSearchId + 'to' + g.geoZoneId + '"><input type="text" class="form-control" aria-label="Delivery location" value="'+ States[g.state] +'" data-name="'+ States[g.state] +'" data-state="' + States[g.state] + '" data-type="state" data-scope="Delivery" data-id="keep" disabled></input><button class="btn btn-outline-danger" type="button" onclick="removeLocation(this)"><i class="bi bi-trash"></i></button></div>')}
            </div>
            <button type="button" class="btn btn-primary mt-1" onclick="showModal(${s.orderSearchId}, 'del')">
                Add location
            </button>
            <hr>
            <div class="input-group mb-2">
                <span class="input-group-text">Total pay ($)</span>
                <input id="total${s.orderSearchId}" type="number" class="form-control" aria-label="Total pay" ${s.totalPay ? 'value="'+s.totalPay+'"' : ''}>
                <span class="input-group-text">.00</span>
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Per mile ($)</span>
                <input id="permile${s.orderSearchId}" type="number" inputmode="decimal" class="form-control" aria-label="Price per mile" ${s.perMile ? 'value="'+s.perMile+'"' : ''}>
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Ship within</span>
                <input id="shipwithin${s.orderSearchId}" type="number" class="form-control" aria-label="Ship within" ${s.shipWithin ? 'value="'+s.shipWithin+'"' : ''}>
                <span class="input-group-text">day(s)</span>
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Min vehicles</span>
                <input id="minvehicles${s.orderSearchId}" type="number" class="form-control" aria-label="Min vehicles" value="${s.minVehicles}">
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Max vehicles</span>
                <input id="maxvehicles${s.orderSearchId}" type="number" class="form-control" aria-label="Max vehicles" value="${s.maxVehicles}">
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Trailer type</span>
                <select id="trailertype${s.orderSearchId}" class="form-select" aria-label="Trailer type">
                    <option value="all" ${s.trailerType == 0 ? 'selected' : ''}>Any</option>
                    <option value="OPEN" ${s.trailerType == 1 ? 'selected' : ''}>Open</option>
                    <option value="ENCLOSED" ${s.trailerType == 2 ? 'selected' : ''}>Enclosed</option>
                </select>
            </div>
            <div class="input-group mb-2">
                <span class="input-group-text">Vehicle condition</span>
                <select id="vehiclecondition${s.orderSearchId}" class="form-select" aria-label="Vehicle condition">
                    <option value="all" ${s.vehicleCondition == 0 ? 'selected' : ''}>Any</option>
                    <option value="operableonly" ${s.vehicleCondition == 1 ? 'selected' : ''}>Operable</option>
                    <option value="hasinoperable" ${s.vehicleCondition == 2 ? 'selected' : ''}>Inoperable</option>
                </select>
            </div>
            <span class="input-group-text mb-2">Vehicle types</span>
            <div class="row" id="vehicleTypes${s.orderSearchId}">
                <div class="col">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="ATV" id="atv${s.orderSearchId}" ${s.vehicleType.includes(1) ? 'checked' : ''}>
                        <label class="form-check-label" for="atv${s.orderSearchId}">
                        ATV
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Boat" id="boat${s.orderSearchId}" ${s.vehicleType.includes(2) ? 'checked' : ''}>
                        <label class="form-check-label" for="boat${s.orderSearchId}">
                        Boat
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Car" id="car${s.orderSearchId}" ${s.vehicleType.includes(4) ? 'checked' : ''}>
                        <label class="form-check-label" for="car${s.orderSearchId}">
                        Car
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="HeavyEquipment" id="heavyequipment${s.orderSearchId}" ${s.vehicleType.includes(8) ? 'checked' : ''}>
                        <label class="form-check-label" for="heavyequipment${s.orderSearchId}">
                        Heavy equipment
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Motorcycle" id="motorcycle${s.orderSearchId}" ${s.vehicleType.includes(16) ? 'checked' : ''}>
                        <label class="form-check-label" for="motorcycle${s.orderSearchId}">
                        Motorcycle
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Pickup" id="pickup${s.orderSearchId}" ${s.vehicleType.includes(32) ? 'checked' : ''}>
                        <label class="form-check-label" for="pickup${s.orderSearchId}">
                        Pickup
                        </label>
                    </div>
                </div>
                <div class="col">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="RV" id="rv${s.orderSearchId}" ${s.vehicleType.includes(64) ? 'checked' : ''}>
                        <label class="form-check-label" for="rv${s.orderSearchId}">
                        RV
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="SUV" id="suv${s.orderSearchId}" ${s.vehicleType.includes(128) ? 'checked' : ''}>
                        <label class="form-check-label" for="suv${s.orderSearchId}">
                        SUV
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="TravelTrailer" id="traveltrailer${s.orderSearchId}" ${s.vehicleType.includes(256) ? 'checked' : ''}>
                        <label class="form-check-label" for="traveltrailer${s.orderSearchId}">
                        Travel trailer
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Van" id="van${s.orderSearchId}" ${s.vehicleType.includes(512) ? 'checked' : ''}>
                        <label class="form-check-label" for="van${s.orderSearchId}">
                        Van
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="Other" id="other${s.orderSearchId}" ${s.vehicleType.includes(1024) ? 'checked' : ''}>
                        <label class="form-check-label" for="other${s.orderSearchId}">
                        Other
                        </label>
                    </div>
                </div>
            </div>
            <button type="button" class="btn btn-primary w-25" onclick="updateSavedSearch(${s.orderSearchId})"><i class="bi bi-floppy"></i></button>
            <button type="button" class="btn btn-danger w-25" onclick="deleteSavedSearch(${s.orderSearchId})"><i class="bi bi-trash"></i></button>
        </li>
        `
    });
    let searchListContainer = document.getElementById('configured-searches');
    if (renderString != ""){
        searchListContainer.innerHTML = renderString;
    } else {
        searchListContainer.innerHTML = "<li class=\"list-group-item\">You don't have any searches</li>";
    }
}

function renderBrokerBlocks(blocks){
    let renderString = "";
    blocks.forEach(b => {
        renderString += `<li id="block${b.blockId}" class="list-group-item d-flex justify-content-between">
                            <span>${b.value}</span>
                            <button type="button" class="btn btn-danger" ${b.isPersistent ? "disabled" : ""} onclick="deleteBrokerBlock(${b.blockId})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </li>`;
    });
    let blocksContainer = document.getElementById('block-list');
    if (renderString != ""){
        blocksContainer.innerHTML = renderString;
    } else {
        blocksContainer.innerHTML = "<li class=\"list-group-item\">You don't have any blocked brokers</li>";
    }
}

function renderPersistentBrokerBlocks(blocks){
    let renderString = "";
    blocks.forEach(b => {
        renderString += `<li id="block${b.blockId}" class="list-group-item d-flex justify-content-between">
                            <span>${b.value}</span>
                            <button type="button" class="btn btn-danger" onclick="deletePersistentBrokerBlock(${b.blockId})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </li>`;
    });
    let blocksContainer = document.getElementById('persistent-block-list');
    if (renderString != ""){
        blocksContainer.innerHTML = renderString;
    } else {
        blocksContainer.innerHTML = "<li class=\"list-group-item\">No blocked broker overrides</li>";
    }
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 16);
}

function getSearchData(searchId){
    var fromContainer = document.getElementById('from'+searchId);
    var fromLocations = fromContainer.querySelectorAll('input:disabled');
    let fromLocationsFormatted = Array.from(fromLocations).map(loc => ({
        name: loc.getAttribute('data-name'),
        id: loc.getAttribute('data-id'),
        type: loc.getAttribute('data-type'),
        scope: loc.getAttribute('data-scope'),
        range: loc.getAttribute('data-range'),
        state: loc.getAttribute('data-state'),
        latitude: loc.getAttribute('data-latitude'),
        longitude: loc.getAttribute('data-longitude')
    }));
    var toContainer = document.getElementById('to'+searchId);
    var toLocations = toContainer.querySelectorAll('input:disabled');
    let toLocationsFormatted = Array.from(toLocations).map(loc => ({
        name: loc.getAttribute('data-name'),
        id: loc.getAttribute('data-id'),
        type: loc.getAttribute('data-type'),
        scope: loc.getAttribute('data-scope'),
        range: loc.getAttribute('data-range'),
        state: loc.getAttribute('data-state'),
        latitude: loc.getAttribute('data-latitude'),
        longitude: loc.getAttribute('data-longitude')
    }));
    let locations = fromLocationsFormatted.concat(toLocationsFormatted);
    let vehicleTypes = Array.from(document.querySelectorAll('#vehicleTypes' + searchId + ' input:checked')).map(c => c.value);
    let trailerType = document.getElementById('trailertype' + searchId).value;
    let vehicleStatus = document.getElementById('vehiclecondition' + searchId).value;
    let minVehicles = document.getElementById('minvehicles' + searchId).value;
    let maxVehicles = document.getElementById('maxvehicles' + searchId).value;
    let readyToShip = document.getElementById('shipwithin' + searchId).value;
    let minTotal = document.getElementById('total' + searchId).value;
    let minPpm = document.getElementById('permile' + searchId).value.replace(",", ".");
    return {
        locations,
        vehicleTypes,
        trailerType,
        vehicleStatus,
        minVehicles,
        maxVehicles,
        readyToShip,
        minTotal,
        minPpm
    }
}

function parseJwt(tkn) {
    const base64Url = tkn.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function checkAdminRights(){
    let claims = parseJwt(token);
    if (claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] == 'admin'){
        let adminPanel = document.getElementById('admin-panel');
        adminPanel.classList.remove('d-none');
        getBotUsers();
        getPersistentBrokerBlocks();
    }
}

function renderBotUsers(botUsers){
    let renderString = "";
    botUsers.forEach(u => {
        renderString += `<li id="user${u.botUserId}" class="list-group-item">
                            <div class="d-flex justify-content-between">
                                <span>${u.firstName} ${u.lastName} ${u.isAdmin ? "(Admin)" : ""}</span>
                                <button type="button" class="btn btn-danger" ${u.isAdmin ? "disabled" : ""} onclick="removeUser(${u.botUserId})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                            <span>Last search created at: ${u.lastSearchCreatedAt ? new Date(Date.parse(u.lastSearchCreatedAt)).toLocaleString() : "never"} </span>
                            <br>
                            <span>Total searches created: ${u.searchesCreated}</span>
                            <br>
                            <span>Current search count: ${u.count}</span>
                        </li>`;
    });
    let usersContainer = document.getElementById('user-list');
    if (renderString != ""){
        usersContainer.innerHTML = renderString;
    } else {
        usersContainer.innerHTML = "<li class=\"list-group-item\">User list goes here</li>";
    }
}

//requests

const baseAddress = "https://8888-38-242-244-233.ngrok-free.app/web"
let token = '';

function getAuthToken(){
    axios.post(baseAddress + "/validate", {
        InitData: Telegram.WebApp.initData
    })
    .then(function (response){
        token = response.data;
        loadUserData();
    })
    .catch(function (errror){
        alert("There was an error during auth, please contact admin");
    });
}

function createNewSearch(){
    let minVehicles = document.getElementById('minVehicles').value;
    let maxVehicles = document.getElementById('maxVehicles').value;
    if (parseInt(minVehicles) > parseInt(maxVehicles))
    {
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("Min vehicles amount cannot be greater than max vehicles amount!");
        return;
    }
    let payload = getPayloadData();
    if (payload.locations.length == 0){
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("Cannot create a search without any pickup or delivery location!");
        return;
    }
    axios.post(baseAddress + "/search", payload, {
        headers: {
            Authorization: `Bearer ${token}`
         }
    })
    .then(function (response){
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        showPopup("Search created");
        getCurrentSearches();
        let accordeonItem2 = document.getElementById('flush-collapseTwo');
        let bsCollapse = new bootstrap.Collapse(accordeonItem2, {
            toggle: true
        }).catch(function (error){
            showPopup("There was an error while saving new search")
        });
    });
}

function getCurrentSearches(){
    axios.get(baseAddress + "/searches", {
        headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420'
         }
    })
    .then(function (response){
        renderCurrentSearches(response.data);
    });
}

function updateSavedSearch(searchId){
    var payload = getSearchData(searchId);
    if (payload.minVehicles > payload.maxVehicles){
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("Min vehicles amount cannot be greater than max vehicles amount!");
    }
    else {
        axios.put(baseAddress + "/search/" + searchId, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'ngrok-skip-browser-warning': '69420'
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            showPopup("Search updated");
            getCurrentSearches();
        }).catch(function (error){
            showPopup("There was an error while updating search")
        });
    }
}

function deleteSavedSearch(searchId){
    if (confirm('Are you sure you want to delete this search?')) {
        axios.delete(baseAddress + "/search/" + searchId, {
            headers: {
                Authorization: `Bearer ${token}`
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.impactOccurred('light');
            showPopup("Search deleted");
            getCurrentSearches();
        }).catch(function (error){
            showPopup("There was an error while deleting search")
        });
      } else {
      }
}

function getBrokerBlocks(){
    axios.get(baseAddress + "/blocked-brokers", {
        headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420'
         }
        })
        .then(function (response){
            renderBrokerBlocks(response.data);
        });
}

function createBrokerBlock(){
    var brokerNameInput = document.getElementById('brokerInput');
    if (brokerNameInput.value != ''){
        axios.post(baseAddress + "/blocked-broker/", brokerNameInput.value, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            brokerNameInput.value = "";
            showPopup("New broker block created");
            getBrokerBlocks();
        })
        .catch(function (error){
            showPopup("There was an error while creating broker block")
        });    
    } else{
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("Broker name cannot be empty!");
    }
}

function deleteBrokerBlock(blockId){
    if (confirm('Are you sure you want to delete this broker block?')) {
        axios.delete(baseAddress + "/blocked-broker/" + blockId, {
            headers: {
                Authorization: `Bearer ${token}`
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.impactOccurred('light');
            getBrokerBlocks();
        }).catch(function (error){
            showPopup("There was an error while deleting broker block")
        });
      } else {
      }
}

function getPersistentBrokerBlocks(){
    axios.get(baseAddress + "/blocked-brokers-persistent", {
        headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420'
         }
        })
        .then(function (response){
            renderPersistentBrokerBlocks(response.data);
        });
}

function createPersistentBrokerBlock(){
    var brokerNameInput = document.getElementById('brokerOverrideInput');
    if (brokerNameInput.value != ''){
        axios.post(baseAddress + "/blocked-broker-persistent/", brokerNameInput.value, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            brokerNameInput.value = "";
            showPopup("Persistent broker block created");
            getPersistentBrokerBlocks();
        });    
    } else{
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("Broker name cannot be empty!");
    }
}

function deletePersistentBrokerBlock(blockId){
    if (confirm('Are you sure you want to delete persistent broker block?')) {
        axios.delete(baseAddress + "/blocked-broker-persistent/" + blockId, {
            headers: {
                Authorization: `Bearer ${token}`
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.impactOccurred('light');
            showPopup("Persistent broker block deleted");
            getPersistentBrokerBlocks();
        });
      } else {
      }
    
}

function getBotUsers(){
    axios.get(baseAddress + "/users", {
        headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420'
         }
        })
        .then(function (response){
            renderBotUsers(response.data);
        });
}

function removeUser(userId){
    if (confirm('Are you sure you want to remove this user?')) {
        axios.delete(baseAddress + "/users/" + userId, {
            headers: {
                Authorization: `Bearer ${token}`
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.impactOccurred('light');
            showPopup("Bot user deleted");
            getBotUsers();
        });
      } else {
      }
    
}

function createUser(){
    var userNameInput = document.getElementById('userInput');
    if (userNameInput.value != ''){
        axios.post(baseAddress + "/users", userNameInput.value, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
             }
        })
        .then(function (response){
            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            userNameInput.value = "";
            showPopup("New user created, token has been sent to you");
            getBotUsers();
        }); 
    } else {
        Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        alert("New user name/surname cannot be empty!");
    }
}