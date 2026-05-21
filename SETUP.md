# הוראות הגדרה — גרסת אינטרנט עם מסד נתונים

## מה מקבלים?
- כתובת ציבורית: `https://anat1969.github.io/ROVAZ/app.html`
- מסד נתונים PostgreSQL חינמי ב-Supabase
- כל הבקשות נשמרות בענן ונגישות מכל מכשיר

---

## שלב 1 — צור חשבון Supabase (חינמי)

1. עבור לכתובת: **https://supabase.com**
2. לחץ **Start your project** → **Sign up**
3. הירשם עם Google או אימייל
4. לאחר כניסה: לחץ **New project**
   - שם הפרויקט: `rovaz` (או כל שם שתרצה)
   - סיסמת DB: שמור אותה במקום בטוח
   - Region: בחר **Israel (il-central-1)** אם קיים, אחרת **EU West**
5. המתן כ-2 דקות ליצירת הפרויקט

---

## שלב 2 — צור את הטבלאות

1. בתפריט הצד: לחץ **SQL Editor** (סמל פקודה)
2. לחץ **New query**
3. פתח את הקובץ `supabase_schema.sql` מהפרויקט
4. העתק את כל התוכן והדבק בתיבת ה-SQL Editor
5. לחץ **Run** (כפתור ירוק)
6. אם הצליח — תראה "Success. No rows returned"

---

## שלב 3 — קבל את המפתחות

1. בתפריט הצד: לחץ **Project Settings** (גלגל שיניים)
2. לחץ **API**
3. העתק שני ערכים:
   - **Project URL** — נראה כך: `https://xxxx.supabase.co`
   - **anon public** key — מחרוזת ארוכה שמתחילה ב-`eyJ...`

---

## שלב 4 — הכנס את המפתחות ב-app.html

1. פתח את `app.html` בעורך טקסט (Notepad++ / VS Code)
2. חפש את השורות (בסביבות שורה 10):
   ```javascript
   const SUPABASE_URL = '';
   const SUPABASE_ANON_KEY = '';
   ```
3. הוסף את הערכים בין הגרשיים:
   ```javascript
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
4. שמור את הקובץ

---

## שלב 5 — פרסם ב-GitHub Pages

1. עבור לדף הריפוסיטורי: **https://github.com/Anat1969/ROVAZ**
2. לחץ על **Settings** (הגדרות)
3. בתפריט הצד: לחץ **Pages**
4. תחת **Branch**: בחר **main** ולחץ **Save**
5. המתן כ-2-3 דקות
6. האתר יהיה חי בכתובת:
   **https://anat1969.github.io/ROVAZ/app.html**

---

## שלב 6 — העלה את הקובץ המעודכן ל-GitHub

לאחר עדכון המפתחות ב-app.html:

```bash
git add app.html
git commit -m "Add Supabase config"
git push
```

---

## בדיקה

- פתח את `https://anat1969.github.io/ROVAZ/app.html`
- בפינה השמאלית התחתונה צריך להופיע: **"מסד נתונים מחובר ☁"** (ירוק)
- אם מופיע **"שמירה מקומית"** (צהוב) — הגדרות Supabase לא הוכנסו

---

## שאלות נפוצות

**ש: האם הנתונים מאובטחים?**  
ת: לצורך שימוש עירוני פנימי, ניתן. לשימוש ציבורי מלא — מומלץ להוסיף מערכת התחברות.

**ש: מה נפח המסד?**  
ת: 500MB חינמי ב-Supabase (מספיק לאלפי בקשות). קבצי תמונה גדולים יכולים לצרוך נפח.

**ש: מה קורה אם אין חיבור לאינטרנט?**  
ת: האפליקציה עובדת עם localStorage (מקומי) כגיבוי. בחזרה לחיבור — יש לרענן.
