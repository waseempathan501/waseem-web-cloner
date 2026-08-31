# Web Copier By Waseem

Node.js + Vercel website source-code copier. Enter any URL, view the full HTML in a copyable box, and download the HTML/CSS/JS as a ZIP.

## Deploy on Vercel (GitHub method — recommended)

1. Is folder ko ek naye GitHub repo mein push karo (empty repo banao, phir):
   ```
   git init
   git add .
   git commit -m "Web Copier By Waseem"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. https://vercel.com pe login karo (GitHub se) → **Add New Project** → apna repo select karo.
3. Framework preset: **Other** (Vercel khud detect kar lega, kuch change karne ki zaroorat nahi).
4. **Deploy** dabao. 1-2 minute mein live ho jayegi (`your-project.vercel.app`).

## Deploy via Vercel CLI (bina GitHub ke)

```
npm i -g vercel
cd web-cloner
vercel
```
Prompts follow karo, phir `vercel --prod` se production live karo.

## Files

- `index.html` — Frontend (particle network background, form, source code box, ZIP download)
- `api/clone.js` — Backend serverless function (fetch + parse + zip)
- `package.json` — Dependencies (`axios`, `cheerio`, `jszip`)
- `vercel.json` — Function timeout config

## Notes

- Free Vercel tier pe har request ki 10-second limit hai — chhoti/medium websites ke liye ye kaafi hai.
- Heavy websites (bohot saari assets wali) kabhi kabhi timeout ho sakti hain — ye Vercel free tier ki limitation hai, code ka bug nahi.
- Kuch websites bot-protection (Cloudflare etc.) ki wajah se block kar sakti hain — ye normal hai, har cloning tool ke saath hota hai.
