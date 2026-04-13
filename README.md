# Clockforce

[Clockforce](https://clockforce.mateuszdabrowski.pl) - Timezone comparison, meeting time finder, and Salesforce Marketing Cloud Engagement (MCE) date conversion tool.

> You Should Know
>
> The app code is 100% AI generated as a part of my agentic coding learning journey.

## Timezone Collaboration Without Calendar Access

Working across timezones is a daily reality for global teams - but finding a good meeting time shouldn't require access to everyone's calendar. Clockforce gives you a visual, one-week timeline where you can compare timezones side by side, see sunrise and sunset for each location, and instantly spot overlapping working hours.

You ca select a time range on the timeline, save it as a named Time Block, and share it via URL. The recipient sees the exact same view — your proposed times mapped to their local timezone - without needing an account, installing anything, or sharing calendar access. This makes it ideal for cross-organization coordination where tools like Google Calendar or Outlook aren't shared.

Time Blocks are especially useful for multi-timezone planning with customers, consultants or platform support specialists: save your team's availability window, share the link in a Slack channel or email, and let everyone see what that window looks like in their timezone.

## The UTC-6 Challenge

The most straightforward way to work with dates in MCE is to understand the server time.

> You Should Know
>
> For Salesforce Marketing Cloud Engagement, the system time is Central Standard Time (UTC-6) without changes between standard and daylight savings time. This behavior cannot be changed, even with timezone and culture settings in the Setup.
>
> This dashboard allows you to paste a raw system date from Query or Data Extension and instantly see what that moment was across all your added timezones. It effectively bridges the gap between fixed server timestamps and your local audience's reality.

## Script Generation Engine

One of the standout features of this tool is the ability to generate production-ready code snippets for your Marketing Automation needs. Depending on your specific use case, you can choose between SQL, AMPScript, or SSJS.

The generated codes adapts to selected timezones and handles DST logic, so you can implement it directly into your automations without worrying about the underlying complexity. It also provides option to set custom DST boundaries for accurate conversions regardless of your target timezone DST timeframe.

### SFMC SQL

The generator leverages the [AT TIME ZONE function](https://mateuszdabrowski.pl/docs/salesforce/marketing-cloud-engagement/sql/sql-date-functions/#at-time-zone) to handle offset information. It specifically uses the Central America Standard Time workaround to account for MCE's lack of DST.

### AMPScript & SSJS

The tool provides dynamic datetime conversion logic. Since AMPScript & SSJS does not natively handle timezone objects, the generated code uses one of the three approaches:

1. __Simple DateAdd__: When you convert to UTC (no DST).
2. __SystemDateToLocalDate__: When you convert to your local time (assuming you have the same timezone selected on your user in MCE).
3. __Manual Summer Time (DST)__: DST boundary variables that you can update to ensure accuracy throughout the year for all other timezones.

### Sum Up

[This dashboard](https://clockforce.mateuszdabrowski.pl) is a useful tool for everyone working in multiple timezones and developers planning to personalize communication using date data.

- Be consistent with Marketing Cloud Engagement system time (UTC-6).
- Strive for readability by generating clean, formatted code.
- Save time by avoiding complex manual calculations.
- Handle DST magic automatically.

Looking for more Marketing Cloud style? Check out my guides on [SQL](https://mateuszdabrowski.pl/docs/category/salesforce/marketing-cloud-engagement/sql/), [AMPScript](https://mateuszdabrowski.pl/docs/category/salesforce/marketing-cloud-engagement/ampscript/), and [SSJS](https://mateuszdabrowski.pl/docs/category/salesforce/marketing-cloud-engagement/ssjs/) to keep your codebase clean and bug-free.

## Key Features

- __Interactive Timeline__: Horizontal one week timeline with draggable time indicator, range selection, sunrise/sunset visualization, and past-hour marking for finding the best meeting times across timezones.
- __Time Blocks__: Save and name time ranges on the timeline. Click a block to preview it across all timezone rows with start/end times. Total duration automatically calculated. Shareable via URL with colleagues outside your organization across the globe.
- __Floating Datetime Picker__: Lock all clocks to any point in time in any timezone — switch the reference timezone with one click to see conversions instantly.
- __MCE Date Conversion__: Paste a raw MCE system date to sync all clocks to that specific point in time.
- __Timeline + Clocks Views__: Toggle between the interactive timeline and analog clock faces with real-time digital readouts.
- __12h / 24h / Mix Format__: Choose between 24-hour, 12-hour, or Mix mode that uses the conventional format per timezone.
- __Instant Script Generation__: Autogenerated snippets for SQL, AMPScript, and SSJS to handle timezone shifts.
- - __DST-Aware Logic__: Automatically detects if a target timezone is in Summer/Winter time and suggests appropriate offsets.
- __Save / Load / Share__: Save configurations to browser, export/import as JSON, or share via URL.
- __Custom Timezone Names__: Add custom timezone label in timezone serach sidebar.
