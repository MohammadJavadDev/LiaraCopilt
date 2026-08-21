# Liara Copilot

دستیار هوشمند فارسی/انگلیسی برای پرسش‌وپاسخ درباره‌ی سرویس‌های **لیارا**، بر پایه‌ی مستندات رسمی (`docs.liara.ir` و [`github.com/liara-cloud/docs`](https://github.com/liara-cloud/docs)). پاسخ‌ها استریم می‌شوند، همراه با منبع‌دهی دقیق (لینک به صفحه‌ی مستندات مرتبط)، حافظه‌ی مکالمه، و سه رفتار agentic: پاسخ به سوال (QA)، راهنمای گام‌به‌گام دیپلوی، و عیب‌یابی.

## ویژگی‌ها

- **Retrieval واقعی**: مستندات رسمی لیارا ingest می‌شوند (heading-chunked) و با یک retriever فارسی/انگلیسی هیبرید (keyword scoring + weighting) بازیابی می‌شوند — بدون vector DB سنگین.
- **استریم پاسخ** با [Vercel AI SDK](https://ai-sdk.dev) روی یک provider سازگار با OpenAI (Liara AI API).
- **منبع‌دهی**: هر پاسخ فقط از میان chunkهایی که واقعاً بازیابی شده‌اند منبع می‌دهد؛ اگر مستندات موجود پاسخ ندهند، صریحاً اعلام می‌شود.
- **Agentic behavior محلی**: تشخیص intent (QA / Deploy / Troubleshoot) بدون فراخوانی مدل، برای صرفه‌جویی در هزینه و تأخیر.
- **Personalization سبک**: حافظه‌ی نشست (فریم‌ورک کاربر، سطح فنی تخمینی، موضوعات مطرح‌شده، مرحله‌ی فعلی دیپلوی) روی کلاینت نگه داشته می‌شود و در پرامپت سیستم برای شخصی‌سازی پاسخ و پیشنهاد follow-up استفاده می‌شود.
- **بدون دیتابیس**: تاریخچه‌ی مکالمه در `localStorage` مرورگر ذخیره می‌شود.
- **امنیت و پایداری**: rate limiting در حافظه (پیش‌فرض ۲۰ درخواست/دقیقه/IP)، لاگ ساختاریافته (JSON)، و داشبورد متریک در `/status`.
- **تست‌های حداقلی** با Vitest برای retrieval، تشخیص intent، rate limit و اعتبارسنجی schema درخواست چت.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) · Zod · Vitest

## پیش‌نیازها

- Node.js 20 یا بالاتر
- یک پروژه و کلید API روی [console.liara.ir/ai](https://console.liara.ir/ai) (سرویس Liara AI، سازگار با OpenAI API)

## شروع سریع (توسعه‌ی لوکال)

1. نصب وابستگی‌ها:

   ```bash
   npm install
   ```

2. فایل `.env.example` را کپی کن و مقادیر واقعی را در `.env.local` بگذار (این فایل در `.gitignore` است و هرگز commit نمی‌شود):

   ```bash
   cp .env.example .env.local
   ```

   سپس در `.env.local`:

   | متغیر | توضیح |
   |---|---|
   | `LIARA_AI_API_KEY` | کلید API از console.liara.ir/ai (بخش AI → API Keys) |
   | `LIARA_AI_BASE_URL` | آدرس پایه‌ی OpenAI-compatible، پیش‌فرض `https://ai.liara.ir/api/v1` |
   | `LIARA_AI_MODEL_FAST` | شناسه‌ی مدل سریع/ارزان (تولید عنوان مکالمه، کارهای کمکی سبک) |
   | `LIARA_AI_MODEL_STRONG` | شناسه‌ی مدل قوی‌تر (تولید پاسخ نهایی فنی) |
   | `RATE_LIMIT_PER_MINUTE` | اختیاری، پیش‌فرض `20` |

   > ⚠️ **هرگز** مقدار واقعی این متغیرها را داخل `.env.example` قرار نده — این فایل commit می‌شود و در دسترس عموم قرار می‌گیرد. مقدار واقعی فقط در `.env.local` (لوکال) یا در بخش Environment Variables کنسول لیارا (production) قرار می‌گیرد.

3. مستندات لیارا را ingest کن تا `data/liara-docs.json` ساخته شود (این ریپوی `liara-cloud/docs` را clone و parse می‌کند):

   ```bash
   npm run ingest
   ```

4. اجرای سرور توسعه:

   ```bash
   npm run dev
   ```

   سپس [http://localhost:3000](http://localhost:3000) را باز کن.

## اسکریپت‌ها

| اسکریپت | توضیح |
|---|---|
| `npm run dev` | اجرای سرور توسعه (Next.js) |
| `npm run build` | build نهایی برای production |
| `npm run start` | اجرای build شده (بعد از `build`) |
| `npm run lint` | ESLint |
| `npm run test` | اجرای تست‌های Vitest |
| `npm run ingest` | بازسازی `data/liara-docs.json` از مستندات رسمی لیارا |

## ساختار پروژه

```
app/
  page.tsx              # صفحه‌ی اصلی چت
  api/
    chat/route.ts        # استریم پاسخ + retrieval + intent + rate limit
    title/route.ts        # تولید عنوان مکالمه با مدل سریع
    health/route.ts       # health check برای مانیتورینگ لیارا
  status/page.tsx         # داشبورد متریک درخواست‌ها
components/
  chat/                  # UI پیام‌ها، composer، welcome screen، followups
  sidebar/               # لیست مکالمات، اپ‌شل
lib/
  ai/                    # system prompt، schema درخواست، model config
  docs/                  # لود و retrieval مستندات، نرمال‌سازی فارسی
  intent/                # تشخیص intent محلی (بدون فراخوانی مدل)
  session/               # حافظه‌ی نشست و شخصی‌سازی
  logging/                # لاگ ساختاریافته + متریک درخواست
  rate-limit/            # rate limiter در حافظه
data/liara-docs.json      # خروجی ingest — corpus بازیابی
scripts/ingest-liara-docs.ts
liara.json
.env.example
```

## معماری (خلاصه)

1. **Ingestion** (`scripts/ingest-liara-docs.ts`): ریپوی مستندات رسمی لیارا clone می‌شود، فایل‌های MDX بر اساس heading به chunk تقسیم می‌شوند و در `data/liara-docs.json` ذخیره می‌شوند (schema با Zod اعتبارسنجی می‌شود).
2. **Retrieval** (`lib/docs/retrieve.ts`): برای هر پیام کاربر، بهترین chunkها با یک الگوریتم keyword-scoring هیبرید (با نرمال‌سازی فارسی) بازیابی می‌شوند.
3. **Intent detection** (`lib/intent/detect-intent.ts`): به‌صورت محلی و بدون فراخوانی مدل، بین سه حالت QA / Deploy guide / Troubleshoot تشخیص می‌دهد تا هزینه و تأخیر کم شود.
4. **Session memory** (`lib/session/memory.ts`): فریم‌ورک، سطح فنی، موضوعات و مرحله‌ی دیپلوی کاربر روی کلاینت نگه داشته و به سرور پاس داده می‌شود؛ سرور آن را برای شخصی‌سازی پرامپت سیستم و ساخت پیشنهادهای follow-up استفاده می‌کند.
5. **Answer generation** (`app/api/chat/route.ts`): با مدل قوی (`LIARA_AI_MODEL_STRONG`) و استریم پاسخ (Vercel AI SDK)، همراه با source parts برای منبع‌دهی دقیق.
6. **Persistence**: تاریخچه‌ی مکالمه در `localStorage` مرورگر (بدون دیتابیس، مناسب دموی هکاتون).
7. **امنیت و مانیتورینگ**: rate limiting در حافظه، لاگ JSON ساختاریافته برای هر درخواست، و متریک‌های تجمیعی در `/status`.

## تست

```bash
npm run test
```

تست‌ها شامل: retrieval (بازگشت chunk درست برای سوالات شناخته‌شده)، تشخیص intent، rate limiter، و اعتبارسنجی schema درخواست چت.

## استقرار روی لیارا (Deployment)

پلتفرم PaaS لیارا فقط پروژه‌های ساخته‌شده با `create-next-app` را به‌صورت رسمی پشتیبانی می‌کند؛ این پروژه با آن ساخته شده است.

### روش پیشنهادی: Liara CLI

1. نصب CLI (یک‌بار):

   ```bash
   npm install -g @liara/cli
   ```

2. ورود:

   ```bash
   liara login
   ```

3. یک اپ از نوع **Next.js** در [کنسول لیارا](https://console.liara.ir) بساز (یا مقدار `app` در `liara.json` را با شناسه‌ی اپی که ساختی مطابقت بده).

4. متغیرهای محیطی زیر را در کنسول لیارا (بخش اپ → **Environment Variables**) — **نه در کد و نه در `liara.json`** — ست کن:

   - `LIARA_AI_API_KEY`
   - `LIARA_AI_BASE_URL`
   - `LIARA_AI_MODEL_FAST`
   - `LIARA_AI_MODEL_STRONG`
   - `RATE_LIMIT_PER_MINUTE` (اختیاری)

5. از ریشه‌ی پروژه دیپلوی کن:

   ```bash
   liara deploy
   ```

   CLI به‌صورت خودکار پلتفرم Next.js را تشخیص می‌دهد، `npm install` و `npm run build` را روی سرورهای لیارا اجرا می‌کند (پس نیازی نیست `node_modules` را commit کنی — و در `.gitignore` هم نیست).

### روش جایگزین: Console (drag & drop zip)

می‌توان به‌جای CLI، از طریق کنسول لیارا یک zip از پروژه (بدون `node_modules` و `.next`) آپلود کرد؛ برای دموی هکاتون روش CLI سریع‌تر و قابل مستندسازی‌تر است.

### چک‌لیست پیش از ارسال خروجی نهایی

- [ ] `npm run build` و `npm run lint` بدون خطا اجرا می‌شوند
- [ ] بعد از دیپلوی، `https://<app-id>.liara.run` باز می‌شود و چت کار می‌کند
- [ ] `https://<app-id>.liara.run/api/health` پاسخ `{"status":"ok"}` می‌دهد
- [ ] Environment Variables روی **کنسول لیارا** (نه فقط `.env.local`) ست شده‌اند

## امنیت

- `.env.example` فقط placeholder دارد و هرگز باید placeholder بماند — مقدار واقعی فقط در `.env.local` (گیت‌ایگنور شده) یا Environment Variables کنسول لیارا قرار می‌گیرد.
- اگر یک کلید واقعی به‌اشتباه commit شود، **صرفاً حذف آن در یک commit جدید کافی نیست** — چون در تاریخچه‌ی git باقی می‌ماند. باید فوراً از کنسول لیارا revoke/rotate شود؛ rewrite کردن تاریخچه‌ی git (force-push) اختیاری و مخرب است و فقط با رضایت صریح انجام می‌شود.
- درخواست‌های `/api/chat` rate-limit می‌شوند (پیش‌فرض ۲۰ درخواست در دقیقه به‌ازای هر IP).
