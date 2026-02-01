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
    const mceBtn = document.getElementById('mce-btn');

    // MCE Elements
    const mceInlineControls = document.getElementById('mce-inline-controls');
    const datetimeInput = document.getElementById('datetime-input');
    const applyTimeBtn = document.getElementById('apply-time-btn');
    const mceFeedback = document.getElementById('mce-feedback');
    const mceOptionsList = document.getElementById('mce-options-list');
    const mceOpts = document.querySelectorAll('.mce-opt');
    const mceResetBtn = document.getElementById('mce-reset-btn');
    const notificationToast = document.getElementById('notification-toast');


    // Script Output Panel
    const scriptOutput = document.getElementById('script-output');
    const closeScriptBtn = document.getElementById('close-script-panel');
    const copyBtns = document.querySelectorAll('.copy-btn');

    if (closeScriptBtn) {
        closeScriptBtn.addEventListener('click', () => {
            scriptOutput.classList.add('hidden');
        });
    }

    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const text = document.getElementById(targetId).textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "COPIED!";
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            });
        });
    });

    // --- STATE & INITIALIZATION ---
    let clocks = JSON.parse(localStorage.getItem('clocks')) || [];
    let displayMode = localStorage.getItem('displayMode') || 'analog';
    let overrideTime = null; // Stays null for live time

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
        if (!displayToggle) return;
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

    // --- MCE CONVERTER LOGIC ---
    if (mceBtn) {
        mceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mceOptionsList.classList.toggle('hidden');
            // Close other pickers if open
            pickerContainer.classList.add('hidden');
        });
    }

    // Handle MCE Menu Actions
    mceOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            const action = opt.dataset.action;
            mceOptionsList.classList.add('hidden');

            if (action === 'convert') {
                mceInlineControls.classList.remove('hidden');
                clockGrid.classList.add('mce-active'); // Add extra padding for scrolling
                datetimeInput.focus();
                if (mceResetBtn) mceResetBtn.classList.remove('hidden');
            } else if (action === 'reset') {
                resetToLive();
            }
        });
    });

    // Close MCE picker when clicking outside
    document.addEventListener('click', (e) => {
        if (mceOptionsList && !mceOptionsList.contains(e.target) && e.target !== mceBtn) {
            mceOptionsList.classList.add('hidden');
        }
    });

    if (mceResetBtn) {
        mceResetBtn.addEventListener('click', () => {
            resetToLive();
        });
    }

    function resetToLive() {
        overrideTime = null;
        datetimeInput.value = "";
        mceInlineControls.classList.add('hidden');
        clockGrid.classList.remove('mce-active'); // Remove extra padding
        mceFeedback.textContent = "";
        if (mceResetBtn) mceResetBtn.classList.add('hidden');
        renderClocks();
        requestAnimationFrame(tick);
    }

    applyTimeBtn.addEventListener('click', () => {
        let inputVal = datetimeInput.value.trim();
        if (!inputVal) return;

        // Pre-process common variations for robust parsing
        inputVal = inputVal.replace(/(\d)(AM|PM)/i, '$1 $2');
        inputVal = inputVal.replace(/([a-z]{3}\s\d{1,2})\s(\d{4})/i, '$1, $2');

        // 1. Parse the input as a "nominal" date (using browser's local parser first)
        const nominalDate = new Date(inputVal);

        if (isNaN(nominalDate.getTime())) {
            mceFeedback.textContent = "Invalid format.";
            mceFeedback.style.color = "var(--bauhaus-red)";
        } else {
            // Save current scroll position and first clock position
            const scrollY = window.scrollY;
            const firstClock = clockGrid.querySelector('.clock-card');
            const firstClockTop = firstClock ? firstClock.getBoundingClientRect().top : 0;

            // 2. We want the entered hours/minutes to represent Salesforce time (UTC-6)
            // We extract the YMD HM from the nominal date and construct a UTC date shifted by 6 hours
            const year = nominalDate.getFullYear();
            const month = nominalDate.getMonth();
            const day = nominalDate.getDate();
            const hour = nominalDate.getHours();
            const min = nominalDate.getMinutes();
            const sec = nominalDate.getSeconds();
            const ms = nominalDate.getMilliseconds();

            // UTC = SalesforceTime + 6 hours
            overrideTime = new Date(Date.UTC(year, month, day, hour + 6, min, sec, ms));

            mceFeedback.textContent = "Locked to Salesforce (UTC-6)";
            mceFeedback.style.color = "var(--bauhaus-blue)";
            clockGrid.classList.add('mce-active'); // Add extra padding for scrolling
            if (mceResetBtn) mceResetBtn.classList.remove('hidden');
            renderClocks();

            // Restore visual position by compensating for layout changes
            requestAnimationFrame(() => {
                const firstClockAfter = clockGrid.querySelector('.clock-card');
                if (firstClockAfter) {
                    const firstClockTopAfter = firstClockAfter.getBoundingClientRect().top;
                    const offset = firstClockTopAfter - firstClockTop;
                    window.scrollTo(0, scrollY + offset);
                }
            });
        }
    });

    // --- TIMEZONE DATA ---
    const majorTimezones = [
        'UTC',
        'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
        'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
        'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Warsaw',
        'Europe/Moscow', 'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai',
        'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
        'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
        'Etc/GMT+6'
    ];

    const windowsTimezoneMap = {
        'UTC': 'UTC',
        'Pacific/Midway': 'UTC-11',
        'Pacific/Honolulu': 'Hawaiian Standard Time',
        'America/Anchorage': 'Alaskan Standard Time',
        'America/Los_Angeles': 'Pacific Standard Time',
        'America/Denver': 'Mountain Standard Time',
        'America/Chicago': 'Central Standard Time',
        'America/New_York': 'Eastern Standard Time',
        'America/Sao_Paulo': 'E. South America Standard Time',
        'Atlantic/Azores': 'Azores Standard Time',
        'Europe/London': 'GMT Standard Time',
        'Europe/Paris': 'Romance Standard Time',
        'Europe/Berlin': 'W. Europe Standard Time',
        'Europe/Warsaw': 'Central European Standard Time',
        'Europe/Moscow': 'Russian Standard Time',
        'Africa/Cairo': 'Egypt Standard Time',
        'Africa/Johannesburg': 'South Africa Standard Time',
        'Asia/Dubai': 'Arabian Standard Time',
        'Asia/Karachi': 'Pakistan Standard Time',
        'Asia/Kolkata': 'India Standard Time',
        'Asia/Dhaka': 'Bangladesh Standard Time',
        'Asia/Bangkok': 'SE Asia Standard Time',
        'Asia/Shanghai': 'China Standard Time',
        'Asia/Tokyo': 'Tokyo Standard Time',
        'Australia/Sydney': 'AUS Eastern Standard Time',
        'Pacific/Auckland': 'New Zealand Standard Time'
    };

    const customLabels = {
        'UTC': 'UTC',
        'Etc/GMT+6': 'Salesforce / MCE'
    };

    function getOffsetMinutes(timeZone, referenceDate = new Date()) {
        try {
            const str = referenceDate.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
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

    function getOffsetString(timeZone, referenceDate = new Date()) {
        try {
            const str = referenceDate.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
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
        // Get currently used timezones to filter them out
        const usedTimezones = clocks.map(c => c.timezone);

        processedTimezones.forEach(data => {
            // Skip if timezone is already added
            if (usedTimezones.includes(data.id)) return;

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
        if (clocks.length >= 8) {
            showNotification('MAX 8 CLOCKS ALLOWED');
            return;
        }
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
        const ref = overrideTime || new Date();
        clocks.sort((a, b) => getOffsetMinutes(a.timezone, ref) - getOffsetMinutes(b.timezone, ref));
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
            const deleteOverlay = clone.querySelector('.delete-overlay');
            const confirmBtn = clone.querySelector('.confirm-delete');
            const cancelBtn = clone.querySelector('.cancel-delete');

            const getScriptContainer = clone.querySelector('.get-script-container');
            const getScriptBtn = clone.querySelector('.get-script-btn');
            const scriptOptions = clone.querySelector('.script-options');

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
            const isSalesforce = clockData.timezone === 'Etc/GMT+6';
            if (clockData.isLocal) {
                homeIcon.style.display = 'block';
                salesforceIcon.style.display = 'none';
                removeBtn.style.display = 'none';
                getScriptContainer.classList.toggle('hidden', !overrideTime);
            } else if (isSalesforce) {
                homeIcon.style.display = 'none';
                salesforceIcon.style.display = 'block';
                removeBtn.style.display = 'none';
                getScriptContainer.classList.add('hidden'); // Never for Salesforce
            } else {
                homeIcon.style.display = 'none';
                salesforceIcon.style.display = 'none';
                removeBtn.style.display = 'flex';
                getScriptContainer.classList.toggle('hidden', !overrideTime);

                removeBtn.addEventListener('click', () => {
                    deleteOverlay.classList.remove('hidden');
                });

                cancelBtn.addEventListener('click', () => {
                    deleteOverlay.classList.add('hidden');
                });

                confirmBtn.addEventListener('click', () => {
                    clocks.splice(index, 1);
                    saveClocks();
                    renderClocks();
                });
            }

            // Simplified Get Script Logic - Direct Multi-Language output (DST Aware Refined)
            getScriptBtn.addEventListener('click', () => {
                const iana = clockData.timezone;
                const windowsName = windowsTimezoneMap[iana] || 'Target Standard Time';
                const now = overrideTime || new Date();
                const isLocal = clockData.isLocal;
                const isUtc = iana === 'UTC';

                // 1. Calculate Offsets for Winter (Jan) and Summer (Jul)
                const currentYear = now.getFullYear();
                const jan = new Date(currentYear, 0, 1);
                const jul = new Date(currentYear, 6, 1);

                const systemOffset = -360; // SFMC is fixed UTC-6

                const offWinter = getOffsetMinutes(iana, jan);
                const offSummer = getOffsetMinutes(iana, jul);

                const offsetWinterHours = (offWinter - systemOffset) / 60;
                const offsetSummerHours = (offSummer - systemOffset) / 60;

                // 2. Get Timezone Shortcut for Alias
                let tzShort = 'TZ';
                try {
                    const formatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: iana,
                        timeZoneName: 'short'
                    });
                    tzShort = formatter.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'TZ';
                } catch (e) {}

                const sanitizedTz = tzShort.replace(/\+/g, 'plus').replace(/-/g, 'minus');

                // 3. Generate Snippets
                const sqlSnippet = `[DateColumn] AT TIME ZONE 'Central America Standard Time' AT TIME ZONE '${windowsName}' AS [DateColumn_${sanitizedTz}]`;

                let ampSnippet, ssjsSnippet;

                if (isLocal) {
                    ampSnippet = `%%[\n    VAR @date, @convertedDate\n    SET @date = [DateColumn]\n    SET @convertedDate = SystemDateToLocalDate(@date)\n]%%`;
                    ssjsSnippet = `<script runat="server">\n    Platform.Load('Core', '1.1.1');\n    var date = Attribute.GetValue('DateColumn');\n    var convertedDate = Platform.Function.SystemDateToLocalDate(date);\n</script>`;
                } else if (isUtc) {
                    ampSnippet = `%%[\n    VAR @date, @convertedDate\n    SET @date = [DateColumn]\n    SET @convertedDate = DateAdd(@date, 6, 'H')\n]%%`;
                    ssjsSnippet = `<script runat="server">\n    Platform.Load('Core', '1.1.1');\n    var date = Attribute.GetValue('DateColumn'); \n    var convertedDate = Platform.Function.DateAdd(date, 6, 'H');\n</script>`;
                } else {
                    // Logic with User-Defined DST bounds
                    ampSnippet = `%%[\n    VAR @date, @summerTimeStart, @summerTimeEnd, @winterOffset, @summerOffset, @offset, @convertedDate\n    SET @date = [DateColumn]\n    SET @summerTimeStart = '${currentYear}-03-30' /* UPDATE TO ACTUAL */\n    SET @summerTimeEnd = '${currentYear}-10-26'   /* UPDATE TO ACTUAL */\n    \n    SET @winterOffset = ${offsetWinterHours}\n    SET @summerOffset = ${offsetSummerHours}\n    \n    IF @date >= @summerTimeStart AND @date <= @summerTimeEnd THEN\n        SET @offset = @summerOffset\n    ELSE\n        SET @offset = @winterOffset\n    ENDIF\n    \n    SET @convertedDate = DateAdd(@date, @offset, 'H')\n]%%`;

                    ssjsSnippet = `<script runat="server">\n    Platform.Load('Core', '1.1.1');\n    var date = Attribute.GetValue('DateColumn');\n    var summerTimeStart = new Date('${currentYear}-03-30'); // UPDATE TO ACTUAL\n    var summerTimeEnd = new Date('${currentYear}-10-26');   // UPDATE TO ACTUAL\n    \n    var offset = (date >= summerTimeStart && date <= summerTimeEnd) ? ${offsetSummerHours} : ${offsetWinterHours};\n    var convertedDate = Platform.Function.DateAdd(date, offset, 'H');\n</script>`;
                }

                // 4. Populate UI
                document.getElementById('sql-text').textContent = sqlSnippet;
                document.getElementById('ampscript-text').textContent = ampSnippet;
                document.getElementById('ssjs-text').textContent = ssjsSnippet;

                scriptOutput.classList.remove('hidden');
            });

            updateSingleClock(
                clockData.timezone,
                hourHand, minuteHand, secondHand,
                dateDisplay, timezoneDisplay,
                analogFace, digitalFace,
                ref
            );
            clockGrid.appendChild(clone);
        });
    }

    function addClock(timezone) {
        if (clocks.length >= 8) {
            showNotification('MAX 8 CLOCKS ALLOWED');
            return;
        }
        clocks.push({ timezone, isLocal: false });
        saveClocks();
        renderClocks();
    }

    function saveClocks() { localStorage.setItem('clocks', JSON.stringify(clocks)); }

    function updateSingleClock(timezone, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalFace, referenceDate = new Date()) {
        try {
            // Use Intl.DateTimeFormat to reliably get components in the target timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false,
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const parts = formatter.formatToParts(referenceDate);
            const getPart = (type) => parts.find(p => p.type === type)?.value;

            const h = parseInt(getPart('hour'), 10);
            const m = parseInt(getPart('minute'), 10);
            const s = parseInt(getPart('second'), 10);
            const ms = referenceDate.getMilliseconds();

            const card = timezoneDisplay ? timezoneDisplay.closest('.clock-card') : null;
            if (card) {
                const isDay = h >= 6 && h < 18;
                card.classList.toggle('day', isDay);
                card.classList.toggle('night', !isDay);
            }

            if (displayMode === 'analog' && hourHand) {
                // Ensure second hand reflects the applied point in time exactly
                const sDeg = ((s + ms / 1000) / 60) * 360;
                const mDeg = ((m / 60) * 360) + ((s / 60) * 6);
                const hDeg = ((h / 12) * 360) + ((m / 60) * 30);

                secondHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
                minuteHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
                hourHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;

                if (dateDisplay) {
                    const monthStr = getPart('month').toUpperCase();
                    const dayStr = getPart('day');
                    dateDisplay.textContent = `${monthStr} ${dayStr}`;
                }
            }

            if (displayMode === 'digital' && digitalFace) {
                const hStr = h.toString().padStart(2, '0');
                const mStr = m.toString().padStart(2, '0');
                digitalFace.querySelector('.digital-time').textContent = `${hStr}:${mStr}`;

                const monthStr = getPart('month').toUpperCase();
                const dayStr = getPart('day');
                const yearStr = getPart('year');
                digitalFace.querySelector('.digital-date').textContent = `${monthStr} ${dayStr}, ${yearStr}`;
            }

            const displayName = customLabels[timezone] || timezone.replace(/_/g, ' ').split('/').join(' / ').toUpperCase();
            const offset = getOffsetString(timezone, referenceDate);
            let season = 'WINTER';
            if (timezone === 'UTC' || timezone === 'Etc/GMT+6') {
                season = 'No DST';
            } else {
                try {
                    const long = referenceDate.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'long' });
                    season = long.toLowerCase().includes('daylight') || long.toLowerCase().includes('summer') ? 'SUMMER' : 'WINTER';
                } catch (e) {}
            }
            if (timezoneDisplay) {
                timezoneDisplay.innerHTML = `<div>${displayName}</div><div class="timezone-details">${offset} • ${season}</div>`;
            }
        } catch (e) {
            console.error("Error updating clock:", e);
        }
    }

    function tick() {
        const ref = overrideTime || new Date();
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
            if (tz) updateSingleClock(tz, hourHand, minuteHand, secondHand, dateDisplay, timezoneDisplay, analogFace, digitalFace, ref);
        });

        if (!overrideTime) {
            requestAnimationFrame(tick);
        }
    }

    // --- UTILS ---
    let toastTimeout;
    function showNotification(msg) {
        if (!notificationToast) return;
        notificationToast.textContent = msg;
        notificationToast.classList.remove('hidden');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            notificationToast.classList.add('hidden');
        }, 3000);
    }

    // INITIAL STARTUP
    renderClocks();
    requestAnimationFrame(tick);
});
