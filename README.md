# Daily Diary (Tiyo)

Tiyo is an internship daily diary. Interns create an account, clock in and out, log what they worked on each day, track tasks, and download PDF or Google Sheet reports for the weeks they choose. The dashboard shows progress toward the target hours (**400 hours over ~14 weeks** by default).

**Open the app:** https://harry934.github.io/Daily-Diary-Management-System/

**Install guide:** https://harry934.github.io/Daily-Diary-Management-System/install.html

## Demo

<!-- Replace GIF_URL below with the link to the demo GIF -->
<p align="center">
  <img src="GIF_URL" alt="Tiyo demo: signing in, logging a day, tracking tasks and downloading a report" width="720">
</p>

*Tiyo is a Dholuo word meaning "to work".*

## Built with

- **Google Apps Script** for the backend, sign-in and API
- **Google Sheets** as the database, with optional per-intern report sheets
- **HTML, CSS and JavaScript** with Bootstrap 5 for the interface
- **GitHub Pages** for the installable web app shell, service worker and install guide

## Install the app

Tiyo works in any browser and can be installed like a normal app. The [install guide](https://harry934.github.io/Daily-Diary-Management-System/install.html) has step-by-step instructions for every device. You can also open it from inside the app: **Me > Install the app** on a phone, **Install the app** in the sidebar on a computer, or the link under the sign-in form.

| Device | How to install |
| --- | --- |
| iPhone / iPad | Open the app link in **Safari**, tap **Share** (or **•••** then **Share**), then **Add to Home Screen** |
| Android | Open the link in **Chrome** and tap **Install app**, or download **Tiyo.apk** from [Releases](https://github.com/harry934/Daily-Diary-Management-System/releases/latest) |
| Windows / Mac / Chromebook | Open the link in **Chrome** or **Edge** and click the install icon in the address bar |

You need an internet connection to use the app.

## Features

- **Today:** clock in and out, adjust times, and write what you did, one line at a time.
- **Week and Calendar:** look back over your logged days by week or month.
- **Tasks:** keep a to-do list with priorities and due dates.
- **Reports:** download a PDF or export to a Google Sheet for this week, the last 4 weeks, or all weeks.
- **Progress:** hours logged against your target, days worked this week, and programme completion.
- **Reminders:** device notifications (turn on in **Settings > Notifications**), an in-app notification centre, and optional daily emails to help you keep your diary up to date.
- **Settings:** update your profile, organisation, programme length, target hours, working days, and password.

## For interns

See [INVITE.md](INVITE.md) for how to create an account and get started.

## About this repository

This public repository hosts the GitHub Pages shell in [`docs/`](docs): the installable web app wrapper, the install guide, the offline page, icons and the service worker. The application itself runs in a private Google Apps Script project and is loaded into the shell.
