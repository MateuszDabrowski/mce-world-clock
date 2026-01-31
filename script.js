document.addEventListener('DOMContentLoaded', () => {
    const clockGrid = document.getElementById('clock-grid');
    const clockTemplate = document.getElementById('clock-template');
    const themeToggle = document.getElementById('theme-toggle');
    const htmlSelect = document.documentElement;
    const addClockBtn = document.getElementById('add-clock-btn');
    const pickerContainer = document.getElementById('timezone-picker');
    const timezoneSearch = document.getElementById('timezone-search');
    const timezoneList = document.getElementById('timezone-list');
    const displayToggle = document.getElementById('display-toggle');

    // --- STATE & INITIALIZATION ---
    let clocks = JSON.parse(localStorage.getItem('clocks')) || [];
    let displayMode = localStorage.getItem('displayMode') || 'analog';

    // Deduplicate Clocks immediately
    const uniqueClocks = new Map();
    clocks.forEach(clock => {
        if (!uniqueClocks.has(clock.timezone)) {
            uniqueClocks.set(clock.timezone, clock);
        }
    });
    clocks = Array.from(uniqueClocks.values());

    // Ensure Local Clock always exists
    if (!clocks.some(c => c.isLocal)) {
        clocks.unshift({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isLocal: true });
    }

    // Default Fallback
    if (localStorage.getItem('clocks') === null || clocks.length === 0) {
        clocks = [
            { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isLocal: true },
            { timezone: 'Etc/GMT+6', isLocal: false }
        ];
    }
    localStorage.setItem('clocks', JSON.stringify(clocks));

    // --- THEME LOGIC ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlSelect.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlSelect.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        htmlSelect.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- DISPLAY TOGGLE LOGIC ---
    function updateToggleIcon() {
        const analogIcon = displayToggle.querySelector('.analog');
        const digitalIcon = displayToggle.querySelector('.digital');
        if (displayMode === 'analog') {
            analogIcon.style.display = 'none';
            digitalIcon.style.display = 'block';
            displayToggle.setAttribute('aria-label', 'Switch to Digital');
        } else {
            analogIcon.style.display = 'block';
            digitalIcon.style.display = 'none';
            displayToggle.setAttribute('aria-label', 'Switch to Analog');
        }
    }
    updateToggleIcon();

    displayToggle.addEventListener('click', () => {
        displayMode = displayMode === 'analog' ? 'digital' : 'analog';
        localStorage.setItem('displayMode', displayMode);
        updateToggleIcon();
        renderClocks();
    });

    // --- TIMEZONE DATA ---
    const majorTimezones = [
        'UTC',
        'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
        'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
        'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
        'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai',
        'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
        'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
        'Etc/GMT+6'
    ];

    const customLabels = {
        'UTC': 'UTC',
        'Etc/GMT+6': 'Salesforce / MCE'
    };

    function getOffsetMinutes(timeZone) {
        try {
            const now = new Date();
            const str = now.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
            const match = str.match(/GMT([+-])(\d{2}):(\d{2})/);
            if (!match) return 0;
            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2], 10);
            const mins = parseInt(match[3], 10);
            return sign * (hours * 60 + mins);
        } catch (e) {
            return 0;
        }
    }

    function getOffsetString(timeZone) {
        try {
            const now = new Date();
            const str = now.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
            const match = str.match(/GMT([+-]\d{2}:\d{2})/);
            return match ? `GMT${match[1]}` : 'GMT+00:00';
        } catch (e) {
            return 'GMT+00:00';
        }
    }

    const processedTimezones = majorTimezones.map(tz => {
        const offsetMins = getOffsetMinutes(tz);
        const sign = offsetMins >= 0 ? '+' : '-';
        const abs = Math.abs(offsetMins);
        const h = Math.floor(abs / 60).toString().padStart(2, '0');
        const m = (abs % 60).toString().padStart(2, '0');
        const offsetLabel = `GMT${sign}${h}:${m}`;
        const city = tz.split('/').pop().replace(/_/g, ' ');
        return {
            id: tz,
            city: city,
            offsetMins: offsetMins,
            offsetLabel: offsetLabel,
            searchStr: (city + " " + tz + (customLabels[tz] || "")).toLowerCase()
        };
    }).sort((a, b) => a.offsetMins - b.offsetMins);

    // --- PICKER LOGIC ---
    function renderTimezoneList(filter = "") {
        timezoneList.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        processedTimezones.forEach(data => {
            if (data.searchStr.includes(lowerFilter)) {
                const li = document.createElement('li');
                li.className = 'timezone-option';
                let label = customLabels[data.id] || data.id.replace(/_/g, ' ').split('/').join(' / ');
                li.textContent = `${label} (${data.offsetLabel})`;
                li.dataset.timezone = data.id;
                li.addEventListener('click', () => {
                    addClock(data.id);
                    closePicker();
                });
                timezoneList.appendChild(li);
            }
        });
    }

    function openPicker() {
        pickerContainer.classList.remove('hidden');
        timezoneSearch.value = "";
        renderTimezoneList();
        timezoneSearch.focus();
    }

    function closePicker() { pickerContainer.classList.add('hidden'); }

    addClockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (clocks.length >= 8) { alert('Max 8 clocks allowed.'); return; }
        if (pickerContainer.classList.contains('hidden')) openPicker();
        else closePicker();
    });

    timezoneSearch.addEventListener('input', (e) => renderTimezoneList(e.target.value));

    document.addEventListener('click', (e) => {
        if (!pickerContainer.classList.contains('hidden') &&
            !pickerContainer.contains(e.target) &&
            e.target !== addClockBtn &&
            !addClockBtn.contains(e.target)) {
            closePicker();
        }
    });

    // --- CLOCK RENDERING ---
    function renderClocks() {
        clockGrid.innerHTML = '';
        clocks.sort((a, b) => getOffsetMinutes(a.timezone) - getOffsetMinutes(b.timezone));
        saveClocks();
        clockGrid.setAttribute('data-clock-count', clocks.length);

        clocks.forEach((clockData, index) => {
            const clone = clockTemplate.content.cloneNode(true);
            const card = clone.querySelector('.clock-card');
            const hourHand = clone.querySelector('.hour-hand');
            const minuteHand = clone.querySelector('.minute-hand');
            const secondHand = clone.querySelector('.second-hand');
            const dateDisplay = clone.querySelector('.date-display');
            const timezoneDisplay = clone.querySelector('.timezone-display');
            const removeBtn = clone.querySelector('.remove-btn');
            const homeIcon = clone.querySelector('.home-icon');
            const salesforceIcon = clone.querySelector('.salesforce-icon');
            const analogFace = clone.querySelector('.analog-face');
            const digitalFace = clone.querySelector('.digital-face');

            card.dataset.timezone = clockData.timezone;
            card.dataset.index = index;

            // Faces Visibility
            if (displayMode === 'analog') {
                analogFace.classList.remove('hidden');
                digitalFace.classList.add('hidden');
            } else {
                analogFace.classList.add('hidden');
                digitalFace.classList.remove('hidden');
            }

            // Controls
            if (clockData.isLocal) {
                homeIcon.style.display = 'block';
                salesforceIcon.style.display = 'none';
                removeBtn.style.display = 'none';
            } else if (clockData.timezone === 'Etc/GMT+6') {
                homeIcon.style.display = 'none';
                salesforceIcon.style.display = 'block';
                removeBtn.style.display = 'none';
            } else {
                homeIcon.style.display = 'none';
                salesforceIcon.style.display = 'none';
                removeBtn.style.display = 'flex';
                removeBtn.addEventListener('click', () => removeClock(index));
            }

            updateSingleClock(
                clockData.timezone,
                hourHand, minuteHand, secondHand,
                dateDisplay, timezoneDisplay,
                analogFace, digitalFace
            );
            clockGrid.appendChild(clone);
        });
    }

    function removeClock(index) {
        if (confirm('Are you sure you want to remove this clock?')) {
            clocks.splice(index, 1);
            saveClocks();
            renderClocks();
        }
    }

    function addClock(timezone) {
        if (clocks.length >= 8) { alert('Max 8 clocks allowed.'); return; }
        clocks.push({ timezone, isLocal: false });
        saveClocks();
        renderClocks();
    }

    function saveClocks() { localStorage.setItem('clocks', JSON.stringify(clocks)); }

    function updateSingleClock(timezone, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalFace) {
        try {
            const now = new Date();
            const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            const h = timeInTz.getHours();
            const m = timeInTz.getMinutes();
            const s = timeInTz.getSeconds();
            const ms = now.getMilliseconds();

            // Day/Night
            const card = timezoneDisplay.closest('.clock-card');
            if (card) {
                const isDay = h >= 6 && h < 18;
                card.classList.toggle('day', isDay);
                card.classList.toggle('night', !isDay);
            }

            // Analog Update
            if (displayMode === 'analog' && hourHand) {
                const sDeg = ((s + ms / 1000) / 60) * 360;
                const mDeg = ((m / 60) * 360) + ((s / 60) * 6);
                const hDeg = ((h / 12) * 360) + ((m / 60) * 30);
                secondHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
                minuteHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
                hourHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;
                dateDisplay.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone }).toUpperCase();
            }

            // Digital Update
            if (displayMode === 'digital' && digitalFace) {
                digitalFace.querySelector('.digital-time').textContent =
                    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                digitalFace.querySelector('.digital-date').textContent =
                    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone }).toUpperCase();
            }

            // Timezone Display
            const displayName = customLabels[timezone] || timezone.replace(/_/g, ' ').split('/').join(' / ').toUpperCase();
            const offset = getOffsetString(timezone);
            let season = 'WINTER';
            if (timezone === 'UTC' || timezone === 'Etc/GMT+6') {
                season = 'No DST';
            } else {
                try {
                    const long = now.toLocaleDateString('en-US', { timeZone: timezone, timeZoneName: 'long' });
                    season = long.toLowerCase().includes('daylight' || 'summer') ? 'SUMMER' : 'WINTER';
                } catch (e) {}
            }
            timezoneDisplay.innerHTML = `<div>${displayName}</div><div class="timezone-details">${offset} • ${season}</div>`;
        } catch (e) {}
    }

    function tick() {
        const cards = document.querySelectorAll('.clock-card');
        cards.forEach(card => {
            const tz = card.dataset.timezone;
            const hourHand = card.querySelector('.hour-hand');
            const minuteHand = card.querySelector('.minute-hand');
            const secondHand = card.querySelector('.second-hand');
            const dateDisplay = card.querySelector('.date-display');
            const timezoneDisplay = card.querySelector('.timezone-display');
            const analogFace = card.querySelector('.analog-face');
            const digitalFace = card.querySelector('.digital-face');
            if (tz) updateSingleClock(tz, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalFace);
        });
        requestAnimationFrame(tick);
    }

    renderClocks();
    requestAnimationFrame(tick);
});
