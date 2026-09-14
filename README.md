# Daily Diary

Web-based Monday–Friday internship diary. Anyone can create an account, choose an **organisation name** for branding, record **date, time in, time out, job assignment, and hours worked**, organise tasks by priority and due date, then download a week as Excel.

| Layer | Stack |
| --- | --- |
| Database | Google Sheets |
| Backend | Google Apps Script |
| Frontend | HTML, CSS, JavaScript, Font Awesome, Google Fonts (Plus Jakarta Sans) |
| Time zone | Africa/Nairobi |

GitHub: https://github.com/harry934/Daily-Diary-Management-System

Existing Apps Script project ID: `1WDunC7vNnZrtwaYOUCz8sSHK1JH-UtK3MIgyUp26VkgThceBX1Wx9Nof`

## 1. One-time spreadsheet setup

Open [Setup.gs](Setup.gs). You can leave the intern placeholders as they are — people create their own accounts in the web app.

If you want to seed the first account from the editor, change these three values, then run setup:

```javascript
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';
```

Use a strong unique password. It is hashed with a salt. It is never written into the HTML.

## 2. Push the project (optional, if you use clasp)

```bash
npm install -g @google/clasp
clasp login
clasp push --force
```

[`.clasp.json`](.clasp.json) already points at the script ID above.

## 3. Run setup and authorize

1. Open the script: `https://script.google.com/d/1WDunC7vNnZrtwaYOUCz8sSHK1JH-UtK3MIgyUp26VkgThceBX1Wx9Nof/edit`
2. Select function `setupInitialize` (first time only)
3. Click **Run**
4. Allow **Sheets**, **Drive**, and **external requests** (needed for Excel download)

The function creates (or reuses) a spreadsheet named **Daily Diary** with `Users`, `Diary`, `Tasks`, and `Subtasks` tabs. Existing intern logins stored in Script Properties are copied into `Users` so that diary is not lost.

If setup already ran, you do not need to run it again. Re-authorize once after this update so Excel export still works.

After first setup, change `SETUP_INTERN_PASSWORD` back to a placeholder if you used it.

To rotate that seeded password later: set `SETUP_INTERN_PASSWORD` and run `setupChangePassword`.

## 4. Deploy the web app

1. **Deploy → New deployment** (or **Manage deployments → Edit → New version**)
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the `/exec` URL

After a new deploy, hard-refresh the `/exec` URL so the browser does not keep the old page.

## What you can do in the app

- **Create an account** with your name, email, password, organisation name, and programme start date
- Sign in; organisation name appears in the sidebar, header, footer, and Excel export
- Record **one weekday at a time** (Prev / Next skip Saturday and Sunday; nothing before your programme start)
- Use the **Mon–Fri week dots** to jump around the current week (lime = already saved)
- Set time with a stepper clock. Time out stays **PM** unless you tap **Left before noon** and give a reason
- Write the job assignment as a list (up to 4000 characters). **Add line** inserts `- `
- Unsaved typing is kept as a **session draft** — refresh the tab and the list comes back
- **Save day** or **Save and next**. Hours fill in from time in / out
- Download a clean `.xlsx` for the week of the day you are on
- Open **Summary** for every logged day (times, assignment, hours, AM clock-out reason) plus programme totals and open/urgent/overdue tasks
- Open **Tasks** to add, **edit**, tag priority (Urgent / High / Medium / Low), set a due date, add subtasks, and filter the list
- After sign-in, a popup lists tasks that are **urgent** or **due soon** (today, overdue, or within two days)

Each account only sees its own diary and tasks. The organisation name is a label, not a shared workspace.

Sessions last up to 6 hours (Apps Script cache limit). After that, sign in again.

## Security notes

- Custom login (not Google Sign-In). Anyone with the URL sees the login / create-account screen.
- Failed logins lock for 15 minutes after 5 attempts
- Every save and export checks the session token on the server
- The spreadsheet stays in the deployer’s Google Drive; the web app runs as that Google account
- Passwords are salted SHA-256 hashes in the Users sheet — never stored in HTML
