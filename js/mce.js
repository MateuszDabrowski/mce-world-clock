/* MCE date conversion and script generation */

import { getTzByIana, getOffsetMinutes } from './timezones.js';
import * as clocks from './clocks.js';

let scriptsPanel = null;

export function init({ showScripts }) {
  scriptsPanel = showScripts;
}

export function applyMceDate(inputVal) {
  if (!inputVal) return { success: false, message: 'No input provided.' };

  // Pre-process common variations
  inputVal = inputVal.replace(/(\d)(AM|PM)/i, '$1 $2');
  inputVal = inputVal.replace(/([a-z]{3}\s\d{1,2})\s(\d{4})/i, '$1, $2');

  const nominalDate = new Date(inputVal);

  if (isNaN(nominalDate.getTime())) {
    return { success: false, message: 'Invalid format.' };
  }

  const year = nominalDate.getFullYear();
  const month = nominalDate.getMonth();
  const day = nominalDate.getDate();
  const hour = nominalDate.getHours();
  const min = nominalDate.getMinutes();
  const sec = nominalDate.getSeconds();
  const ms = nominalDate.getMilliseconds();

  // UTC = SalesforceTime + 6 hours
  const override = new Date(Date.UTC(year, month, day, hour + 6, min, sec, ms));
  clocks.setOverrideTime(override);

  return { success: true, message: 'Locked to Salesforce (UTC-6)' };
}

/**
 * Find DST transition dates for a timezone in a given year.
 * Returns { dstStart: 'MM-DD', dstEnd: 'MM-DD' } or null if no DST.
 */
function findDSTTransitions(iana, year) {
  const jan = new Date(year, 0, 1);
  const jul = new Date(year, 6, 1);
  const janOff = getOffsetMinutes(iana, jan);
  const julOff = getOffsetMinutes(iana, jul);
  if (janOff === julOff) return null;

  const summerOff = Math.max(janOff, julOff);

  // Binary search for transition date between two months
  function findTransition(startMonth, endMonth) {
    let lo = new Date(year, startMonth, 1);
    let hi = new Date(year, endMonth + 1, 0); // last day of endMonth
    while ((hi - lo) > 86400000) { // within 1 day
      const mid = new Date((lo.getTime() + hi.getTime()) / 2);
      const midOff = getOffsetMinutes(iana, mid);
      const loOff = getOffsetMinutes(iana, lo);
      if (midOff !== loOff) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    // Return the day when the transition happens (hi side)
    return hi;
  }

  let springTransition, fallTransition;

  // Northern hemisphere: Jan offset < Jul offset → spring forward in Mar-Apr, fall back in Oct-Nov
  // Southern hemisphere: Jan offset > Jul offset → spring forward in Sep-Oct, fall back in Mar-Apr
  if (janOff < julOff) {
    // Northern: DST starts spring, ends fall
    springTransition = findTransition(1, 5);  // Feb–Jun
    fallTransition = findTransition(7, 11);   // Aug–Dec
  } else {
    // Southern: DST starts fall (Oct-ish), ends spring (Mar-ish)
    springTransition = findTransition(7, 11); // Aug–Dec (DST starts)
    fallTransition = findTransition(1, 5);    // Feb–Jun (DST ends)
  }

  const fmt = (d) => {
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${mo}-${day}`;
  };

  return { dstStart: fmt(springTransition), dstEnd: fmt(fallTransition) };
}

export function generateScriptsForTimezone(iana, isLocal, forceDST = false) {
  const tzEntry = getTzByIana(iana);
  const windowsName = tzEntry ? tzEntry.windows : 'Target Standard Time';
  const now = clocks.getOverrideTime() || new Date();
  const isUtc = iana === 'UTC';

  const currentYear = now.getFullYear();
  const jan = new Date(currentYear, 0, 1);
  const jul = new Date(currentYear, 6, 1);

  const systemOffset = -360; // SFMC is fixed UTC-6

  const offWinter = getOffsetMinutes(iana, jan);
  const offSummer = getOffsetMinutes(iana, jul);

  const offsetWinterHours = (offWinter - systemOffset) / 60;
  const offsetSummerHours = (offSummer - systemOffset) / 60;

  // Timezone shortcut for alias
  let tzShort = 'TZ';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' });
    tzShort = formatter.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'TZ';
  } catch {
    // Fallback to default if Intl doesn't support this timezone
  }

  const sanitizedTz = tzShort
    .replace(/\+/g, '_plus_')
    .replace(/-/g, '_minus_')
    .replace(/:/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // SQL
  const sqlSnippet = `[DateColumn] AT TIME ZONE 'Central America Standard Time' AT TIME ZONE '${windowsName}' AS [DateColumn_${sanitizedTz}]`;

  let ampSnippet, ssjsSnippet;
  const hasDST = offsetWinterHours !== offsetSummerHours;
  const dstDates = hasDST ? findDSTTransitions(iana, currentYear) : null;

  if (isLocal) {
    ampSnippet = `%%[\n    VAR @date, @convertedDate\n    SET @date = [DateColumn]\n    SET @convertedDate = SystemDateToLocalDate(@date)\n]%%`;
    ssjsSnippet = `<script runat="server">\n    Platform.Load('Core', '1.1.1');\n    var date = Attribute.GetValue('DateColumn');\n    var convertedDate = Platform.Function.SystemDateToLocalDate(date);\n</script>`;
  } else if ((!hasDST && !forceDST) || isUtc) {
    // Simple fixed offset — no DST
    const fixedOffset = offsetWinterHours;
    ampSnippet = `%%[\n    VAR @date, @convertedDate\n    SET @date = [DateColumn]\n    SET @convertedDate = DateAdd(@date, ${fixedOffset}, 'H')\n]%%`;
    ssjsSnippet = `<script runat="server">\n    Platform.Load('Core', '1.1.1');\n    var date = Attribute.GetValue('DateColumn');\n    var convertedDate = Platform.Function.DateAdd(date, ${fixedOffset}, 'H');\n</script>`;
  } else {
    // DST-aware code — use real transition dates or defaults for forceDST
    const dstStart = dstDates ? dstDates.dstStart : '03-30';
    const dstEnd = dstDates ? dstDates.dstEnd : '10-26';
    const summerOff = hasDST ? offsetSummerHours : offsetWinterHours + 1;
    const winterOff = offsetWinterHours;

    ampSnippet = `%%[
    VAR @date, @dstStart, @dstEnd, @offset, @convertedDate
    SET @date = [DateColumn]
    /* Verify -MM-DD dates match DST boundaries for your timezone */
    SET @dstStart = CONCAT(DatePart(@date, 'Y'), '-${dstStart}')
    SET @dstEnd = CONCAT(DatePart(@date, 'Y'), '-${dstEnd}')

    IF @date >= @dstStart AND @date <= @dstEnd THEN
        SET @offset = ${summerOff} /* Summer offset */
    ELSE
        SET @offset = ${winterOff} /* Winter offset */
    ENDIF

    SET @convertedDate = DateAdd(@date, @offset, 'H')
]%%`;

    ssjsSnippet = `<script runat="server">
    Platform.Load('Core', '1.1.1');

    var date = new Date(Attribute.GetValue('DateColumn'));
    var year = date.getFullYear();
    // Verify -MM-DD dates match DST boundaries for your timezone
    var dstStart = new Date(year + '-${dstStart}');
    var dstEnd = new Date(year + '-${dstEnd}');

    // Summer offset: ${summerOff}, Winter offset: ${winterOff}
    var offset = (date >= dstStart && date <= dstEnd) ? ${summerOff} : ${winterOff};
    var convertedDate = Platform.Function.DateAdd(date, offset, 'H');
</script>`;
  }

  return { sql: sqlSnippet, ampscript: ampSnippet, ssjs: ssjsSnippet, isLocal, hasDST, forceDST };
}
