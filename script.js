document.addEventListener('DOMContentLoaded', () => {
    const clockGrid = document.getElementById('clock-grid');
    const clockTemplate = document.getElementById('clock-template');
    const themeToggle = document.getElementById('theme-toggle');
    const htmlSelect = document.documentElement;
    const addClockBtn = document.getElementById('add-clock-btn');
    const pickerContainer = document.getElementById('timezone-picker');
    const timezoneSearch = document.getElementById('timezone-search');
    const timezoneList = document.getElementById('timezone-list');

    // State
    // Default to local clock
    let clocks = JSON.parse(localStorage.getItem('clocks')) || [
        { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isLocal: true }
    ];

    // Theme Logic
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlSelect.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlSelect.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        htmlSelect.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Major Timezones (Curated List)
    const majorTimezones = [
        'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
        'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
        'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
        'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai',
        'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
        'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'
    ];

    // Helper to get offset in minutes
    function getOffsetMinutes(timeZone) {
        const now = new Date();
        const str = now.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
        // str format like "1/31/2026, 10:00:00 AM GMT-05:00" or "... GMT+05:30"
        const match = str.match(/GMT([+-])(\d{2}):(\d{2})/);
        if (!match) return 0; // UTC or error
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const mins = parseInt(match[3], 10);
        return sign * (hours * 60 + mins);
    }

    // Prepare Sorted List
    const processedTimezones = majorTimezones.map(tz => {
        const offsetMins = getOffsetMinutes(tz);

        // Format Offset String
        const sign = offsetMins >= 0 ? '+' : '-';
        const abs = Math.abs(offsetMins);
        const h = Math.floor(abs / 60).toString().padStart(2, '0');
        const m = (abs % 60).toString().padStart(2, '0');
        const offsetLabel = `GMT${sign}${h}:${m}`;

        // City Name
        const city = tz.split('/').pop().replace(/_/g, ' ');

        return {
            id: tz,
            city: city,
            offsetMins: offsetMins,
            offsetLabel: offsetLabel,
            searchStr: (city + " " + tz).toLowerCase()
        };
    }).sort((a, b) => a.offsetMins - b.offsetMins);

    // Helper to get offset (moved up to be accessible or duplicated if scope issue, but it's in same scope)
    function getOffsetString(timeZone) {
        const now = new Date();
        const str = now.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
        const match = str.match(/GMT([+-]\d{2}:\d{2})/);
        return match ? `GMT${match[1]}` : 'GMT+00:00';
    }

    function renderTimezoneList(filter = "") {
        timezoneList.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        processedTimezones.forEach(data => {
            if (data.searchStr.includes(lowerFilter)) {
                const li = document.createElement('li');
                li.className = 'timezone-option';

                // Display: "Asia / Kolkata (GMT+05:30)"
                // Matching the format under the clock: Region / City
                const regionCity = data.id.replace(/_/g, ' ').split('/').join(' / ');

                li.textContent = `${regionCity} (${data.offsetLabel})`;
                li.dataset.timezone = data.id;
                li.addEventListener('click', () => {
                    addClock(data.id);
                    closePicker();
                });
                timezoneList.appendChild(li);
            }
        });
    }

    // Enhanced Search Aliases
    // We append these to searchStr above implicitly if we want,
    // or we can manually Map aliases to our curated list.
    const extraAliases = {
        'Asia/Kolkata': 'Delhi New Delhi Mumbai India',
        'America/Los_Angeles': 'San Francisco Seattle California',
        'America/New_York': 'Boston',
        'Europe/London': 'UK',
        'Asia/Shanghai': 'Beijing China',
        'Asia/Tokyo': 'Japan'
    };

    // Re-process with aliases
    processedTimezones.forEach(item => {
        if (extraAliases[item.id]) {
            item.searchStr += " " + extraAliases[item.id].toLowerCase();
        }
    });

    // Picker Logic
    function openPicker() {
        pickerContainer.classList.remove('hidden');
        timezoneSearch.value = "";
        renderTimezoneList();
        timezoneSearch.focus();
    }

    function closePicker() {
        pickerContainer.classList.add('hidden');
    }

    function togglePicker() {
        if (pickerContainer.classList.contains('hidden')) {
            openPicker();
        } else {
            closePicker();
        }
    }

    addClockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (clocks.length >= 6) {
            alert('Max 6 clocks allowed.');
            return;
        }
        togglePicker();
    });

    timezoneSearch.addEventListener('input', (e) => {
        renderTimezoneList(e.target.value);
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!pickerContainer.classList.contains('hidden') &&
            !pickerContainer.contains(e.target) &&
            e.target !== addClockBtn &&
            !addClockBtn.contains(e.target)) {
            closePicker();
        }
    });

    // UI functions
    function renderClocks() {
        clockGrid.innerHTML = '';

        // Granular Spacing Support via Data Attribute
        clockGrid.setAttribute('data-clock-count', clocks.length);

        clocks.forEach((clockData, index) => {
            const clone = clockTemplate.content.cloneNode(true);
            const card = clone.querySelector('.clock-card');

            // Elements
            const hourHand = clone.querySelector('.hour-hand');
            const minuteHand = clone.querySelector('.minute-hand');
            const secondHand = clone.querySelector('.second-hand');
            const dateDisplay = clone.querySelector('.date-display');
            const timezoneDisplay = clone.querySelector('.timezone-display');
            const removeBtn = clone.querySelector('.remove-btn');
            const homeIcon = clone.querySelector('.home-icon');

            // Metadata linkage
            card.dataset.timezone = clockData.timezone;
            card.dataset.index = index;

            // Setup controls
            if (clockData.isLocal) {
                homeIcon.style.display = 'block'; // SVG displayed as block/inline-block
                removeBtn.style.display = 'none'; // Cannot remove local
            } else {
                removeBtn.addEventListener('click', () => removeClock(index));
            }

            // Initial Update (async to not block render, but fast enough)
            updateSingleClock(clockData.timezone, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay);

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
        if (clocks.length >= 6) {
            alert('Max 6 clocks allowed.');
            return;
        }
        clocks.push({ timezone, isLocal: false });
        saveClocks();
        renderClocks();
    }

    function saveClocks() {
        localStorage.setItem('clocks', JSON.stringify(clocks));
    }

    // Clock Loop
    function updateSingleClock(timezone, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay) {
        const now = new Date();
        const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        const seconds = timeInTz.getSeconds();
        const milliseconds = now.getMilliseconds();
        const minutes = timeInTz.getMinutes();
        const hours = timeInTz.getHours();

        // Day/Night Logic (Simple 6am-6pm)
        const isDay = hours >= 6 && hours < 18;

        const card = dateDisplay.closest('.clock-card');
        if (card) {
            if (isDay) {
                card.classList.add('day');
                card.classList.remove('night');
            } else {
                card.classList.add('night');
                card.classList.remove('day');
            }
        }

        const secondsDegrees = ((seconds + milliseconds/1000) / 60) * 360;
        const minutesDegrees = ((minutes / 60) * 360) + ((seconds/60)*6);
        const hoursDegrees = ((hours / 12) * 360) + ((minutes/60)*30);

        secondHand.style.transform = `translateX(-50%) rotate(${secondsDegrees}deg)`;
        minuteHand.style.transform = `translateX(-50%) rotate(${minutesDegrees}deg)`;
        hourHand.style.transform = `translateX(-50%) rotate(${hoursDegrees}deg)`;

        // Date text
        const options = { month: 'short', day: 'numeric', timeZone: timezone };
        dateDisplay.textContent = now.toLocaleDateString('en-US', options).toUpperCase();

        // Timezone Text Logic
        const displayName = timezone.replace(/_/g, ' ').split('/').join(' / ').toUpperCase();

        // GMT Offset: Consistent Calculation
        // Use the same logic as the picker: extract from longOffset
        const offsetLabel = getOffsetString(timezone);

        // Season Logic: Check if "Daylight" or "Summer" is in the long name
        const longName = now.toLocaleDateString('en-US', { timeZone: timezone, timeZoneName: 'long' });
        const isSummer = longName.toLowerCase().includes('daylight') || longName.toLowerCase().includes('summer');
        const season = isSummer ? 'SUMMER' : 'WINTER';

        timezoneDisplay.innerHTML = `
            <div>${displayName}</div>
            <div class="timezone-details">${offsetLabel} • ${season}</div>
        `;
    }

    function tick() {
        const renderedCards = document.querySelectorAll('.clock-card');
        renderedCards.forEach(card => {
            const tz = card.dataset.timezone;
            const hourHand = card.querySelector('.hour-hand');
            const minuteHand = card.querySelector('.minute-hand');
            const secondHand = card.querySelector('.second-hand');
            const dateDisplay = card.querySelector('.date-display');
            const timezoneDisplay = card.querySelector('.timezone-display');

            updateSingleClock(tz, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay);
        });
        requestAnimationFrame(tick);
    }

    renderClocks();
    requestAnimationFrame(tick);
});
