# Kenya Shipyards Limited — Internship Daily Diary

Web-based Monday–Friday diary for the Kenya Shipyards Limited internship programme. Sign in, record **date, time in, time out, job assignment, and hours worked**, track assigned tasks, then download the week as Excel.

| Layer | Stack |
| --- | --- |
| Database | Google Sheets |
| Backend | Google Apps Script |
| Frontend | HTML, CSS, JavaScript, Font Awesome, Google Fonts (Plus Jakarta Sans), Spark Admin theme |
| Time zone | Africa/Nairobi |
| Programme start | Monday 7 September 2026 (Week 1) |

GitHub: https://github.com/harry934/Daily-Diary-Management-System

Existing Apps Script project ID: `1WDunC7vNnZrtwaYOUCz8sSHK1JH-UtK3MIgyUp26VkgThceBX1Wx9Nof`

## 1. Put your login details in setup

Open [Setup.gs](Setup.gs) and change these three values:

```javascript
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';
```

Use a strong unique password. It is hashed with a salt and stored only in Script Properties. It is never written into the HTML.

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

The function creates (or reuses) a spreadsheet named **Kenya Shipyards Limited — Internship Daily Diary** with `Diary`, `Tasks`, and `Subtasks` tabs.

If setup already ran, you do not need to run it again. The app updates the company name and extra sheets on its own. Re-authorize once after this update so Excel export works.

After first setup, change `SETUP_INTERN_PASSWORD` back to a placeholder.

To rotate the password later: set `SETUP_INTERN_PASSWORD` and run `setupChangePassword`.

## 4. Deploy the web app

1. **Deploy → New deployment** (or **Manage deployments → Edit → New version**)
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the `/exec` URL

## What you can do in the app

- Sign in with the intern email and password
- Record **one weekday at a time** (Prev / Next skip Saturday and Sunday; nothing before 7 Sep 2026)
- Use the **Mon–Fri week dots** to jump around the current week (lime = already saved)
- Set time with a stepper clock. Time out stays **PM** unless you tap **Left before noon** and give a reason
- Write the job assignment as a list (up to 4000 characters). **Add line** inserts `- `
- Unsaved typing is kept as a **session draft** — refresh the tab and the list comes back
- **Save day** or **Save and next**. Hours fill in from time in / out
- Download a clean `.xlsx` for the week of the day you are on (assignment lines wrap; AM clock-out includes the reason)
- Open **Summary** for hours by week (click a week to open its Monday)
- Open **Tasks** to note assigned work, add subtasks, and see a completion ring

Sessions last up to 6 hours (Apps Script cache limit). After that, sign in again.

After a new deploy, hard-refresh the `/exec` URL so the browser does not keep the old week table.

## Security notes

- Custom login (not Google Sign-In). Anyone with the URL sees only the login screen.
- Failed logins lock for 15 minutes after 5 attempts
- Every save and export checks the session token on the server
- The spreadsheet stays in your Google Drive; the web app runs as you

Keep the `/exec` URL to yourself. Treat it like a private intern tool.
