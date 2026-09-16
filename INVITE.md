# You’re invited to Daily Diary

This is a Monday–Sunday internship diary. You log the days you actually work, keep tasks, and send **all weeks** to one Google Sheet you connect once.

## 1. Open the app

Open the invite link the admin sent you:

**https://harry934.github.io/Daily-Diary-Management-System/**

(That page embeds the live app. The admin’s Apps Script `/exec` URL is the backend; you do not need it.)

## 2. Create your account

On the sign-in screen choose **Create an account** and enter:

- Full name
- Username (3–24 characters; letters, numbers, dots, or underscores)
- Organisation name (this is only a label on your diary)
- Email (**optional** — leave blank if you prefer)
- Password (at least 8 characters) and confirm password
- Programme start date

You **cannot** open the diary until an admin approves the account. After you submit, wait. The admin will approve you, then you sign in with your **username** and password.

If you already had an account that used email, you can still sign in with that email once, or use the username the system assigned (usually the part before `@` in your old email).

## 3. Log your days

Any calendar day is allowed, including weekends, from your programme start date onward. For each day set:

- Time in
- Time out
- Job assignment (what you were given / what you did)

Hours are calculated from time in and time out. If you leave before noon, add a short reason.

After you save, the form shows **Done for today** and stays blank until the next day. Use **Edit** if you need to change that day’s record.

## 4. Connect your Google Sheet (once)

Excel download is not used. **One** Google Sheet stores every week’s records. Use a **new sheet you own** (not the app’s sheets).

1. Go to [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. In cell **A1** of the first tab, type exactly the code shown on the Daily Diary screen (it looks like `DAILY-DIARY:your_username`).
3. Click **Share**. Add the admin’s app email as **Editor** (the Daily Diary screen shows the exact address to copy).
4. Copy the spreadsheet URL from the address bar.
5. In Daily Diary, paste that URL under **Report spreadsheet** and click **Connect sheet**.

You only paste this URL once. After that, click **Send records to my sheet** whenever you want tabs such as `Week 1`, `Week 2`, and so on. If you need a different spreadsheet later, ask the admin to disconnect your current sheet.

If connect fails, check A1 has the exact code, the sheet is shared as Editor with the app email, and the sheet is one you own.

## 5. Tasks

Add tasks, set priority (Urgent / High / Medium / Low) and an optional due date. After you sign in, a popup lists urgent or due-soon work.

## 6. Change your password

Open your profile menu (top right) and choose **Change password**. Enter your current password, then the new password twice.

---

**Admin:** send this file together with the GitHub Pages link: https://harry934.github.io/Daily-Diary-Management-System/
