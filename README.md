# Daily Diary

Internship daily diary web app. Interns create an account, an admin approves them, then they log working days, track tasks, and download a branded PDF summary.

**App:** https://harry934.github.io/Daily-Diary-Management-System/

Timezone: Africa/Nairobi · Backend: Google Apps Script · Data: private Google Sheets

## What it does

- Username sign-in (email optional); admin approval before access
- Day-by-day diary entries with hours and assignments
- Task list with priorities and due dates
- Summary view and **Download PDF** report
- Admin user management (approve, edit, disable)

## Project layout

| File / folder | Role |
| --- | --- |
| `Code.gs` | Web app entry and API router |
| `Setup.gs` | Sheets schema and one-time setup helpers |
| `Auth.gs` | Login, register, sessions, passwords |
| `Diary.gs` | Diary weeks, days, summary |
| `Pdf.gs` | Branded PDF export |
| `Admin.gs` | User management and legacy report helpers |
| `Tasks.gs` | Tasks and subtasks |
| `Index.html` / `JavaScript.html` / `Styles.html` | UI |
| `docs/` | GitHub Pages shell (iframe to the live app) |
| `INVITE.md` | Short invite guide for interns |
| `appsscript.json` | Apps Script manifest |

Secrets (spreadsheet IDs, admin email) live only in **Apps Script Script Properties**, never in this repo. Keep Drive sheets private (Restricted).

## For interns

See [INVITE.md](INVITE.md).
