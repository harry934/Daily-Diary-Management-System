# Daily Diary

Web-based internship diary. People create an account with a **username** (email optional) and an organisation name; an **admin approves** them before they can sign in. They record **any working day**, track tasks, and send **all weeks** to **one Google Sheet** they connect once.

| Layer | Stack |
| --- | --- |
| Database | Google Sheets |
| Backend | Google Apps Script |
| Frontend | HTML, CSS, JavaScript, Google Fonts (Plus Jakarta Sans), inline SVG |
| Time zone | Africa/Nairobi |

GitHub: https://github.com/harry934/Daily-Diary-Management-System

Existing Apps Script project ID: `1WDunC7vNnZrtwaYOUCz8sSHK1JH-UtK3MIgyUp26VkgThceBX1Wx9Nof`

Admin users spreadsheet ID: `1uC3kzvoxwTCalatyhLXAt75I1cV2yRCbbb--Kktqfgc`

## 1. One-time setup

Open [Setup.gs](Setup.gs). Set `ADMIN_EMAIL` to the Gmail that should auto-become admin if that address is entered on signup (optional), or set `SETUP_INTERN_EMAIL` / `SETUP_INTERN_PASSWORD` / `SETUP_INTERN_NAME` to seed an account. Leave intern placeholders if you will only register in the web app — then the Google account that owns the script is treated as admin when that same email is used on signup (email is optional for everyone else).

```javascript
var ADMIN_EMAIL = 'you@example.com';
var SETUP_INTERN_EMAIL = 'your.email@example.com';
var SETUP_INTERN_PASSWORD = 'ChangeThisPassword';
var SETUP_INTERN_NAME = 'Your Full Name';
```

People sign in with a **username**. Email is optional. Passwords are hashed with a salt. They are never written into the HTML. Signup requires password confirmation. Anyone can change their password from the profile menu while signed in.

Share the admin spreadsheet (`1uC3kzvoxwTCalatyhLXAt75I1cV2yRCbbb--Kktqfgc`) with the script owner as Editor if it is not already owned by that account.

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
4. Allow **Sheets** and **Drive**

The function creates (or reuses) the diary spreadsheet (`Diary`, `Tasks`, `Subtasks`) and the `Users` tab on the admin spreadsheet. Existing intern logins are copied into Users so diary history is not lost.

After first setup, change `SETUP_INTERN_PASSWORD` back to a placeholder if you used it.

## 4. Deploy the web app

1. **Deploy → New deployment** (or **Manage deployments → Edit → New version**)
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy and copy the `/exec` URL

Hard-refresh the `/exec` URL after a new deploy.

Use [INVITE.md](INVITE.md) when you invite someone. Put the `/exec` URL at the top of that note.

## What people can do

- Create an account with a username (email optional; pending until an admin approves it)
- Confirm password when creating an account; change password anytime from the profile menu
- Sign in after approval with username (legacy accounts can still use their old email once); organisation name is branding only
- Log **any day** from the programme start date (including weekends)
- Week view is Monday–Sunday; **Send records to my sheet** writes every week into the connected Google Sheet
- Connect a sheet once by sharing it as Editor with the app owner email, then pasting the URL (changing it later needs an admin)
- Open **Summary** for every logged day plus task counts
- Open **Tasks** to add, edit, tag priority, and set due dates
- After sign-in, a popup lists urgent or due-soon tasks
- Admins open **User management** to approve, edit, or delete accounts, and to disconnect a report sheet (spreadsheet IDs are not shown)
- If no admin exists, the script-owner email is promoted, otherwise the oldest approved account

Each account only sees its own diary and tasks. Sessions last up to 6 hours.

## Security notes

- Custom login (not Google Sign-In)
- Failed logins lock for 15 minutes after 5 attempts
- Every save checks the session token on the server
- The diary spreadsheet and admin Users sheet stay in Google Drive; the web app runs as the deployer
