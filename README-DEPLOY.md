# ⚡ AK BLOCH — Pairing Website (Deploy Guide)

Ye **AK BLOCH** bot ki official pairing website hai. User apna WhatsApp number likhta hai,
website WhatsApp se **pairing code** mangwa kar dikhati hai — bilkul MD-bot pairing sites jaisa flow.

## Ye kaam kaise karta hai?

1. User website par apna number likhta hai (country code ke saath, masalan `923001234567`)
2. `POST /api/pair` — server Baileys se WhatsApp ko request bhej kar **8-hurfi pairing code** leta hai
3. Code screen par bara bara nazar aata hai + copy button
4. User WhatsApp → **Settings → Linked devices → "Link with phone number"** → code enter karta hai
5. Pairing mukammal! Temporary session ~3 minute baad khud delete ho jati hai

**Hifazat:** phone number kahin log nahi hota, session temp hoti hai, aur har IP se
10 minute mein sirf 5 requests allowed hain (spam se bachao ke liye).

---

## 🚀 Render par FREE deploy karne ka tareeqa (step by step)

### 1. Code ko GitHub par dalna
1. [github.com](https://github.com) par free account banayein (agar nahi hai)
2. **New repository** banayein, naam rakhein `ak-bloch-pair`
3. Apne computer par ye folder us repo mein push karein:
   ```bash
   cd pairing-site
   git init
   git add .
   git commit -m "AK BLOCH pairing site"
   git branch -M main
   git remote add origin https://github.com/APNA-USERNAME/ak-bloch-pair.git
   git push -u origin main
   ```
   *(Git nahi aata to GitHub website par "uploading an existing file" se ye saari files upload kar dein — kaam ho jayega.)*

### 2. Render par web service banana
1. [render.com](https://render.com) par free account banayein (GitHub se login sab se aasan)
2. Dashboard mein **New + → Web Service** dabayein
3. Apni `ak-bloch-pair` repository select karein
4. Settings ye rakhein:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. **Create Web Service** dabayein — 2-4 minute mein website live!

### 3. Website kholna
Deploy mukammal hone par Render aapko link dega, jaise:
`https://ak-bloch-pair.onrender.com` — yehi aapki pairing website hai! 🎉

> **Note:** Free plan par website 15 minute istemal na ho to "so jati hai" — pehla
> khulne mein 30-50 second lag sakte hain. Ye normal hai.

---

## 💻 Apne computer par chalana (testing ke liye)

```bash
cd pairing-site
npm install
npm start
```
Phir browser mein kholein: `http://localhost:3000`

## 📁 Files

| File | Kaam |
|---|---|
| `server.js` | Express server + Baileys pairing logic |
| `public/index.html` | Poori website (single file, mobile-friendly) |
| `render.yaml` | Render deploy config |
| `Dockerfile` | Docker deploy ke liye |
| `railway.json` | Railway deploy ke liye |

---

## ⚠️ Zaroori tanbeeh

- Ye **unofficial** tareeqa hai — WhatsApp aise connect hone wale number **ban** kar sakta hai.
- Hamesha **secondary number** istemal karein, apna main number kabhi nahi.
- Pairing code sirf chand minute valid hota hai — jaldi enter karein.
