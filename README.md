# Daily Diary

Web-based internship diary. People create an account with a **username** (email optional) and an organisation name; an **admin approves** them before they can sign in. They record **any working day**, track tasks, and send **all weeks** to **one Google Sheet** they connect once.

| Layer | Stack |
| --- | --- |
| Database | Google Sheets |
| Backend | Google Apps Script |
| Frontend | HTML, CSS, JavaScript, Google Fonts (Plus Jakarta Sans), inline SVG |
| Time zone | Africa/Nairobi |

GitHub: https://github.com/harry934/Daily-Diary-Management-System

**Share this URL with users (hides the Google banner):** https://harry934.github.io/Daily-Diary-Management-System/

Apps Script backend (`/exec`): `https://script.google.com/macros/s/AKfycbyk8PzPuRuE9fTJFiq0ZBubXDtkluqPZgp4XilsvwGKSVQg6pr1clCJiN5UMQDVCrKd/exec`

Existing Apps Script project ID: `1WDunC7vNnZrtwaYOUCz8sSHK1JH-UtK3MIgyUp26VkgThceBX1Wx9Nof`

Admin Users spreadsheet ID lives only in Script Properties (`ADMIN_SPREADSHEET_ID`) — do not commit it.

## 1. One-time setup

Open [Setup.gs](Setup.gs). Set `ADMIN_EMAIL` to the Gmail that should auto-become admin if that address is entered on signup (recommended). Optionally set `SETUP_INTERN_EMAIL` / `SETUP_INTERN_PASSWORD` / `SETUP_INTERN_NAME` to seed an account. In Apps Script **Project settings → Script properties**, set `ADMIN_SPREADSHEET_ID` to your private Users spreadsheet ID.

```javascript
var ADMIN_EMAIL = 'you@example.com';
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';
```

People sign in with a **username**. Email is optional. Passwords use stretched hashing (legacy hashes upgrade on next login). Signup requires password confirmation. Anyone can change their password from the profile menu while signed in.

Keep the admin Users spreadsheet and diary spreadsheet **private** (only the script owner as Editor). Never share them as “Anyone with the link”.

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
4. Allow **Sheets**

The function creates (or reuses) the diary spreadsheet (`Diary`, `Tasks`, `Subtasks`) and the `Users` tab on the admin spreadsheet. Existing intern logins are copied into Users so diary history is not lost.

After first setup, change `SETUP_INTERN_PASSWORD` back to a placeholder if you used it.

## 4. Deploy the web app

1. **Deploy → New deployment** (or **Manage deployments → Edit → New version**)
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the `/exec` URL

Hard-refresh the `/exec` URL after a new deploy. Keep deploying to the **same** web app deployment so the GitHub Pages iframe keeps working.

**Invite people with the GitHub Pages link**, not the long `/exec` URL: https://harry934.github.io/Daily-Diary-Management-System/

The page in [`docs/`](docs/) is a full-screen iframe of the Apps Script app (GitHub Pages → Deploy from branch `main` / folder `/docs`).

Use [INVITE.md](INVITE.md) when you invite someone.

## What people can do

- Create an account with a username (email optional; pending until an admin approves it)
- Confirm password when creating an account; change password anytime from the profile menu
- Sign in after approval with username (legacy accounts can still use their old email once); organisation name is branding only
- Log **any day** from the programme start date (including weekends)
- Week view is Monday–Sunday; **Send records to my sheet** writes every week into the connected Google Sheet
- Connect a sheet once: put `DAILY-DIARY:username` in A1, share as Editor with the app owner, paste the URL (changing it later needs an admin)
- Open **Summary** for every logged day plus task counts
- Open **Tasks** to add, edit, tag priority, and set due dates
- After sign-in, a popup lists urgent or due-soon tasks
- Admins open **User management** to approve, edit, or delete accounts, and to disconnect a report sheet (spreadsheet IDs are not shown)
- If `ADMIN_EMAIL` is set and that email registers, it can be auto-approved as admin; otherwise admins are promoted only by an existing admin

Each account only sees its own diary and tasks. Only one active session per account (a new login signs out older tabs). Sessions last up to 6 hours.

## Security notes

- Public GitHub / Pages does **not** expose diary rows or password hashes — keep Drive sheets private
- Custom login (not Google Sign-In); one session per user; password confirm for delete / disconnect / promote admin
- Failed logins lock per account and globally after repeated abuse
- Report sheets cannot be the app’s own spreadsheets or sheets owned by the deployer
- Spreadsheet formula injection is escaped on report write
- Every save checks the session token on the server
- OAuth scope limited to Spreadsheets