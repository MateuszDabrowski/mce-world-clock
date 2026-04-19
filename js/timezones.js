/* Timezone database and utility functions */

export const timezoneDatabase = [
  { iana: 'Etc/GMT+12', windows: 'Dateline Standard Time', label: 'International Date Line West', aliases: [] },
  { iana: 'Etc/GMT+11', windows: 'UTC-11', label: 'Coordinated Universal Time-11', aliases: [] },
  { iana: 'Pacific/Honolulu', windows: 'Hawaiian Standard Time', label: 'USA / Honolulu', aliases: ['Maui', 'Oahu', 'Kauai', 'Hilo'] },
  { iana: 'America/Anchorage', windows: 'Alaskan Standard Time', label: 'USA / Anchorage', aliases: ['Fairbanks', 'Juneau'] },
  { iana: 'America/Los_Angeles', windows: 'Pacific Standard Time', label: 'USA / Los Angeles', aliases: ['San Francisco', 'Seattle', 'Portland', 'Las Vegas', 'San Diego', 'Sacramento', 'Vancouver'] },
  { iana: 'America/Denver', windows: 'Mountain Standard Time', label: 'USA / Denver', aliases: ['Salt Lake City', 'Albuquerque', 'Boise', 'Calgary', 'Edmonton'] },
  { iana: 'America/Phoenix', windows: 'US Mountain Standard Time', label: 'USA / Phoenix', aliases: ['Tucson', 'Mesa', 'Scottsdale'] },
  { iana: 'America/Chicago', windows: 'Central Standard Time', label: 'USA / Chicago', aliases: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Minneapolis', 'Milwaukee', 'Nashville', 'New Orleans', 'Memphis', 'Oklahoma City', 'Winnipeg'] },
  { iana: 'America/Regina', windows: 'Canada Central Standard Time', label: 'Canada / Regina', aliases: ['Saskatoon'] },
  { iana: 'America/New_York', windows: 'Eastern Standard Time', label: 'USA / New York', aliases: ['Washington', 'Boston', 'Philadelphia', 'Atlanta', 'Miami', 'Detroit', 'Charlotte', 'Pittsburgh', 'Orlando', 'Tampa', 'Cleveland', 'Toronto', 'Montreal', 'Ottawa'] },
  { iana: 'America/Halifax', windows: 'Atlantic Standard Time', label: 'Canada / Halifax', aliases: ['Fredericton', 'Charlottetown'] },
  { iana: 'America/St_Johns', windows: 'Newfoundland Standard Time', label: 'Canada / St. Johns', aliases: [] },
  { iana: 'America/Sao_Paulo', windows: 'E. South America Standard Time', label: 'Brazil / Sao Paulo', aliases: ['Rio de Janeiro', 'Brasilia', 'Belo Horizonte'] },
  { iana: 'America/Bogota', windows: 'SA Pacific Standard Time', label: 'Colombia / Bogota', aliases: ['Medellin', 'Lima', 'Quito'] },
  { iana: 'America/Argentina/Buenos_Aires', windows: 'Argentina Standard Time', label: 'Argentina / Buenos Aires', aliases: ['Cordoba', 'Rosario', 'Mendoza'] },
  { iana: 'Atlantic/Azores', windows: 'Azores Standard Time', label: 'Portugal / Azores', aliases: [] },
  { iana: 'Atlantic/Cape_Verde', windows: 'Cape Verde Standard Time', label: 'Cape Verde / Praia', aliases: [] },
  { iana: 'Europe/London', windows: 'GMT Standard Time', label: 'UK / London', aliases: ['Manchester', 'Birmingham', 'Glasgow', 'Edinburgh', 'Liverpool', 'Dublin', 'Belfast', 'Lisbon'] },
  { iana: 'Europe/Paris', windows: 'Romance Standard Time', label: 'France / Paris', aliases: ['Lyon', 'Marseille', 'Toulouse', 'Brussels', 'Amsterdam', 'Luxembourg', 'Madrid', 'Barcelona'] },
  { iana: 'Europe/Berlin', windows: 'W. Europe Standard Time', label: 'Germany / Berlin', aliases: ['Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart', 'Vienna', 'Zurich', 'Bern', 'Rome', 'Milan', 'Copenhagen', 'Stockholm', 'Oslo'] },
  { iana: 'Europe/Warsaw', windows: 'Central European Standard Time', label: 'Poland / Warsaw', aliases: ['Krakow', 'Wroclaw', 'Gdansk', 'Poznan', 'Prague', 'Budapest', 'Bratislava', 'Ljubljana', 'Zagreb', 'Belgrade'] },
  { iana: 'Europe/Athens', windows: 'GTB Standard Time', label: 'Greece / Athens', aliases: ['Thessaloniki', 'Bucharest', 'Sofia', 'Istanbul', 'Helsinki', 'Tallinn', 'Riga', 'Vilnius', 'Kyiv'] },
  { iana: 'Europe/Moscow', windows: 'Russian Standard Time', label: 'Russia / Moscow', aliases: ['Saint Petersburg', 'Minsk'] },
  { iana: 'Africa/Lagos', windows: 'W. Central Africa Standard Time', label: 'Nigeria / Lagos', aliases: ['Abuja', 'Kano', 'Ibadan', 'Douala', 'Yaounde', 'Kinshasa', 'Luanda', 'Libreville', 'Bangui', 'Ndjamena', 'Niamey', 'Porto-Novo', 'Malabo', 'West Africa Time'] },
  { iana: 'Africa/Cairo', windows: 'Egypt Standard Time', label: 'Egypt / Cairo', aliases: ['Alexandria', 'Giza'] },
  { iana: 'Africa/Johannesburg', windows: 'South Africa Standard Time', label: 'South Africa / Johannesburg', aliases: ['Cape Town', 'Durban', 'Pretoria', 'Harare', 'Maputo'] },
  { iana: 'Africa/Nairobi', windows: 'E. Africa Standard Time', label: 'Kenya / Nairobi', aliases: ['Mombasa', 'Kisumu', 'Addis Ababa', 'Dar es Salaam', 'Kampala', 'Mogadishu', 'Asmara', 'Djibouti', 'Khartoum', 'Juba', 'Antananarivo', 'East Africa Time'] },
  { iana: 'Asia/Jerusalem', windows: 'Israel Standard Time', label: 'Israel / Jerusalem', aliases: ['Tel Aviv', 'Haifa'] },
  { iana: 'Asia/Riyadh', windows: 'Arab Standard Time', label: 'Saudi Arabia / Riyadh', aliases: ['Jeddah', 'Mecca', 'Kuwait City', 'Doha', 'Bahrain', 'Manama'] },
  { iana: 'Asia/Dubai', windows: 'Arabian Standard Time', label: 'UAE / Dubai', aliases: ['Abu Dhabi', 'Sharjah', 'Muscat'] },
  { iana: 'Asia/Tehran', windows: 'Iran Standard Time', label: 'Iran / Tehran', aliases: ['Isfahan', 'Tabriz', 'Mashhad'] },
  { iana: 'Asia/Karachi', windows: 'Pakistan Standard Time', label: 'Pakistan / Karachi', aliases: ['Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad'] },
  { iana: 'Asia/Kolkata', windows: 'India Standard Time', label: 'India / Kolkata', aliases: ['Delhi', 'New Delhi', 'Mumbai', 'Bangalore', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Calcutta', 'Surat'] },
  { iana: 'Asia/Dhaka', windows: 'Bangladesh Standard Time', label: 'Bangladesh / Dhaka', aliases: ['Chittagong'] },
  { iana: 'Asia/Yekaterinburg', windows: 'Ekaterinburg Standard Time', label: 'Russia / Yekaterinburg', aliases: ['Chelyabinsk', 'Perm'] },
  { iana: 'Asia/Bangkok', windows: 'SE Asia Standard Time', label: 'Thailand / Bangkok', aliases: ['Hanoi', 'Ho Chi Minh City', 'Jakarta', 'Phnom Penh'] },
  { iana: 'Asia/Novosibirsk', windows: 'N. Central Asia Standard Time', label: 'Russia / Novosibirsk', aliases: ['Omsk'] },
  { iana: 'Asia/Shanghai', windows: 'China Standard Time', label: 'China / Shanghai', aliases: ['Beijing', 'Shenzhen', 'Guangzhou', 'Hong Kong', 'Taipei', 'Singapore', 'Kuala Lumpur', 'Manila'] },
  { iana: 'Asia/Krasnoyarsk', windows: 'North Asia Standard Time', label: 'Russia / Krasnoyarsk', aliases: [] },
  { iana: 'Asia/Irkutsk', windows: 'North Asia East Standard Time', label: 'Russia / Irkutsk', aliases: [] },
  { iana: 'Asia/Tokyo', windows: 'Tokyo Standard Time', label: 'Japan / Tokyo', aliases: ['Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Seoul', 'Busan'] },
  { iana: 'Asia/Yakutsk', windows: 'Yakutsk Standard Time', label: 'Russia / Yakutsk', aliases: [] },
  { iana: 'Asia/Vladivostok', windows: 'Vladivostok Standard Time', label: 'Russia / Vladivostok', aliases: [] },
  { iana: 'Asia/Magadan', windows: 'Magadan Standard Time', label: 'Russia / Magadan', aliases: [] },
  { iana: 'Australia/Darwin', windows: 'AUS Central Standard Time', label: 'Australia / Darwin', aliases: [] },
  { iana: 'Australia/Adelaide', windows: 'Cen. Australia Standard Time', label: 'Australia / Adelaide', aliases: [] },
  { iana: 'Australia/Brisbane', windows: 'E. Australia Standard Time', label: 'Australia / Brisbane', aliases: ['Gold Coast'] },
  { iana: 'Australia/Sydney', windows: 'AUS Eastern Standard Time', label: 'Australia / Sydney', aliases: ['Melbourne', 'Canberra', 'Hobart'] },
  { iana: 'Australia/Perth', windows: 'W. Australia Standard Time', label: 'Australia / Perth', aliases: [] },
  { iana: 'Pacific/Guam', windows: 'West Pacific Standard Time', label: 'Guam / Hagatna', aliases: [] },
  { iana: 'Pacific/Auckland', windows: 'New Zealand Standard Time', label: 'New Zealand / Auckland', aliases: ['Wellington', 'Christchurch'] },
  { iana: 'Pacific/Tongatapu', windows: 'Tonga Standard Time', label: 'Tonga / Nuku\'alofa', aliases: [] },
  { iana: 'Pacific/Fiji', windows: 'Fiji Standard Time', label: 'Fiji / Suva', aliases: [] },
  { iana: 'Pacific/Pago_Pago', windows: 'UTC-11', label: 'Midway Island / Samoa', aliases: [] },
  { iana: 'UTC', windows: 'UTC', label: 'UTC', aliases: ['Greenwich', 'Zulu'] },
  { iana: 'Etc/GMT+6', windows: 'Central America Standard Time', label: 'Salesforce / MCE', aliases: ['SFMC', 'Marketing Cloud', 'ExactTarget'] }
];

// Pre-built lookup map for O(1) timezone data access
const tzByIana = new Map(timezoneDatabase.map(tz => [tz.iana, tz]));
export function getTzByIana(iana) { return tzByIana.get(iana) || null; }

export function getOffsetMinutes(timeZone, referenceDate = new Date()) {
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

export function getOffsetString(timeZone, referenceDate = new Date()) {
  try {
    const str = referenceDate.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
    const match = str.match(/GMT([+-]\d{2}:\d{2})/);
    return match ? `GMT${match[1]}` : 'GMT+00:00';
  } catch (e) {
    return 'GMT+00:00';
  }
}

// Pre-processed timezone list sorted by offset
export function getProcessedTimezones() {
  // Probe winter and summer to collect both standard and daylight abbreviations (e.g. CET/CEST, EST/EDT)
  const year = new Date().getFullYear();
  const winterDate = new Date(year, 0, 15);
  const summerDate = new Date(year, 6, 15);

  return timezoneDatabase.map(tz => {
    const offsetMins = getOffsetMinutes(tz.iana);
    const sign = offsetMins >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMins);
    const h = Math.floor(abs / 60).toString().padStart(2, '0');
    const m = (abs % 60).toString().padStart(2, '0');
    const offsetLabel = `GMT${sign}${h}:${m}`;

    const aliasStr = (tz.aliases || []).join(' ').toLowerCase();

    const winterAbbr = getTimezoneShortCode(tz.iana, winterDate);
    const summerAbbr = getTimezoneShortCode(tz.iana, summerDate);
    const abbrList = [...new Set([winterAbbr, summerAbbr])]
      .filter(a => a && !a.startsWith('GMT'));
    // Mark abbreviations with ^caret^ tokens so exact abbrev matches can be prioritised
    const abbrTokens = abbrList.map(a => `^${a.toLowerCase()}^`).join(' ');
    const abbrs = abbrList.join(' ');

    return {
      id: tz.iana,
      city: tz.label,
      windows: tz.windows,
      aliases: tz.aliases || [],
      abbrs: abbrList,
      offsetMins,
      offsetLabel,
      searchStr: (tz.label + " " + tz.iana + " " + tz.windows + " " + aliasStr + " " + abbrs + " " + abbrTokens).toLowerCase(),
      original: tz
    };
  }).sort((a, b) => a.offsetMins - b.offsetMins);
}

// Find which alias matched a search term
export function findMatchingAlias(aliases, filter) {
  if (!filter || !aliases || !aliases.length) return null;
  const lower = filter.toLowerCase();
  return aliases.find(a => a.toLowerCase().includes(lower)) || null;
}

// Find which abbreviation matched a search term (e.g. "CEST" → "CEST")
export function findMatchingAbbr(tzId, filter, ref = new Date()) {
  if (!filter || !tzId) return null;
  const lower = filter.toLowerCase();
  const year = ref.getFullYear();
  const winterDate = new Date(year, 0, 15);
  const summerDate = new Date(year, 6, 15);
  const candidates = [
    getTimezoneShortCode(tzId, winterDate),
    getTimezoneShortCode(tzId, summerDate),
  ].filter(a => a && !a.startsWith('GMT'));
  return candidates.find(a => a.toLowerCase().includes(lower)) || null;
}

// Common long-name-to-abbreviation map for when Intl returns GMT+X
const longNameAbbreviations = {
  'British Summer Time': 'BST', 'Greenwich Mean Time': 'GMT',
  'Central European Standard Time': 'CET', 'Central European Summer Time': 'CEST',
  'Eastern European Standard Time': 'EET', 'Eastern European Summer Time': 'EEST',
  'Western European Standard Time': 'WET', 'Western European Summer Time': 'WEST',
  'Moscow Standard Time': 'MSK',
  'Japan Standard Time': 'JST', 'Korea Standard Time': 'KST',
  'China Standard Time': 'CST', 'Hong Kong Standard Time': 'HKT',
  'India Standard Time': 'IST', 'Pakistan Standard Time': 'PKT',
  'Arabian Standard Time': 'AST', 'Gulf Standard Time': 'GST',
  'Israel Standard Time': 'IST', 'Israel Daylight Time': 'IDT',
  'Iran Standard Time': 'IRST', 'Iran Daylight Time': 'IRDT',
  'Australian Eastern Standard Time': 'AEST', 'Australian Eastern Daylight Time': 'AEDT',
  'Australian Central Standard Time': 'ACST', 'Australian Central Daylight Time': 'ACDT',
  'Australian Western Standard Time': 'AWST',
  'New Zealand Standard Time': 'NZST', 'New Zealand Daylight Time': 'NZDT',
  'South Africa Standard Time': 'SAST', 'East Africa Time': 'EAT',
  'West Africa Standard Time': 'WAT',
  'Bangladesh Standard Time': 'BST', 'Indochina Time': 'ICT',
};

export function getTimezoneShortCode(tz, ref = new Date()) {
  try {
    // Try Intl short name first
    const short = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(ref).find(p => p.type === 'timeZoneName')?.value || '';
    if (short && !short.startsWith('GMT')) return short;

    // Fallback: derive from long name
    const long = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' })
      .formatToParts(ref).find(p => p.type === 'timeZoneName')?.value || '';
    if (long && longNameAbbreviations[long]) return longNameAbbreviations[long];

    // Last resort: build from long name initials (e.g. "Central European Summer Time" → "CEST")
    if (long) {
      const initials = long.split(' ').map(w => w[0]).join('').toUpperCase();
      if (initials.length >= 2 && initials.length <= 5) return initials;
    }

    return short; // Return GMT+X if nothing else
  } catch (e) {
    return '';
  }
}
