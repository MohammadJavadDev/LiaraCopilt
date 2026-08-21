# Liara Copilot — Master Implementation Spec (Cursor-Ready)

> این فایل نسخه‌ی نهایی و اجرایی spec است. منبع اصلی brief اولیه‌ی تیم بود؛ این نسخه با معیارهای داوری رسمی هکاتون (۳۰۰ امتیاز، ۶ محور) تطبیق داده شده و چند شکاف امتیازی برطرف شده. **هرچه در این فایل نوشته نشده، نساز.** هرچه P0 است را کامل کن قبل از رفتن سراغ P1.

## 0. نگاشت امتیاز داوری → بخش‌های این spec

| محور داوری | امتیاز | بخش‌های مرتبط در این فایل |
|---|---|---|
| کیفیت و صحت پاسخ‌ها | 80 | §4 Retrieval، §5 Answer Generation، §6 Citations |
| طراحی UI/UX | 55 | §8 UI، §9 Welcome/Source cards، §13 UX details |
| Agentic و Personalization | 50 | §7 Intents، **§7.4 Personalization (جدید)** |
| امنیت، پایداری، Monitoring | 50 | §10 Security، **§11 Logging (جدید)**، §12 Rate limit |
| استقرار روی لیارا | 40 | §14 Deployment |
| بهینه‌سازی هزینه | 25 | §3 Model/Cost strategy |

جزئیات کامل نگاشت هر آیتم داوری → فایل کد در `RUBRIC_CHECKLIST.md` است؛ آن فایل را به‌عنوان acceptance checklist نهایی استفاده کن.

⚠️ نسبت به brief اولیه دو تغییر اولویت مهم داده شده:
1. **Personalization** در brief اولیه به P2 رانده شده بود ("User preferences")، اما در رابریک رسمی زیرمجموعه‌ی یک بلوک ۵۰ امتیازی است. نسخه‌ی سبک آن باید P0/P1 باشد (جزئیات §7.4).
2. **Logging** به‌صراحت در رابریک رسمی جدا از Monitoring ذکر شده و در brief اولیه فقط به `/status` اشاره شده بود. باید logging ساختاریافته اضافه شود (§11).

---

## 1. هدف پروژه

دستیار هوشمند «Liara Copilot»: پاسخ به سوالات فارسی/انگلیسی درباره‌ی سرویس‌های لیارا، بر پایه‌ی مستندات رسمی (`docs.liara.ir` و `github.com/liara-cloud/docs`)، با استریم، منبع‌دهی دقیق، حافظه‌ی مکالمه، و سه رفتار agentic مشخص (QA / Deploy guide / Troubleshooting).

عدم-هدف (do NOT build): auth پیچیده، vector DB سنگین، میکروسرویس، صف پیام، Kubernetes، observability پلتفرم بزرگ.

---

## 2. Stack

* Next.js 15/16 (App Router) + TypeScript + Tailwind + shadcn/ui
* Vercel AI SDK (`ai`, `@ai-sdk/openai` یا معادل سازگار با OpenAI schema)
* Liara AI API به‌عنوان provider هوش مصنوعی (سازگار با فرمت OpenAI — طبق `docs.liara.ir/ai/quick-start`؛ base URL و کلید را از کنسول لیارا بگیر، آن‌ها را حدس نزن)
* Zod برای اعتبارسنجی ورودی/خروجی
* ذخیره‌سازی: پیش‌فرض بدون دیتابیس (client-side)؛ فقط اگر لازم شد Postgres مدیریت‌شده‌ی لیارا (§9)

---

## 3. انتخاب مدل و بهینه‌سازی هزینه (۲۵ امتیاز رابریک)

این محور مستقل داوری می‌شود؛ توضیح تصمیمات را در README بیاور، نه فقط در کد.

* از کنسول لیارا (`console.liara.ir/ai/.../models`) لیست مدل‌های در دسترس را بردار.
* **دو سطح مدل** تعریف کن:
  * مدل ارزان/سریع برای: تشخیص intent، تولید عنوان مکالمه، تولید follow-up suggestions.
  * مدل قوی‌تر فقط برای: تولید پاسخ نهایی فنی (که کیفیتش وزن ۸۰ امتیازی دارد).
* اگر intent به‌وضوح از روی keyword قابل تشخیص است (مثلاً «۵۰۲»، «deploy»، «PostgreSQL»)، تشخیص intent را **محلی و بدون فراخوانی LLM** انجام بده (regex/keyword)، نه با یک call جدا به مدل. این دقیقاً همان چیزی است که رابریک زیر «کاهش درخواست‌های غیرضروری» می‌خواهد.
* `max_tokens` خروجی را محدود کن (مثلاً ۶۰۰–۸۰۰ توکن برای پاسخ متنی).
* فقط ۴–۶ chunk مرتبط را به مدل بده، نه کل corpus مستندات (§4).
* تاریخچه‌ی مکالمه را به آخرین ۶–۸ پیام محدود کن؛ پیام‌های قدیمی‌تر را خلاصه یا حذف کن.
* نتیجه‌ی parse مستندات (`liara-docs.json`) را cache کن؛ در هر request دوباره فایل را parse نکن.
* در README یک جدول کوچک بگذار: «چرا این مدل، با این محدودیت توکن، انتخاب شد» — داور این استدلال را می‌خواند و امتیاز می‌دهد، صرف کدنویسی کافی نیست.

---

## 4. دیتای مستندات و Retrieval (بخشی از ۸۰ امتیاز کیفیت پاسخ)

### 4.1 Ingestion

اسکریپت `scripts/ingest-liara-docs.ts`:
* از `github.com/liara-cloud/docs` (شاخه‌ی `master`، پوشه‌های MDX) بخش‌ها را می‌خواند یا از HTML صفحات `docs.liara.ir` استخراج می‌کند.
* هر chunk بر اساس heading تقسیم می‌شود، نه بر اساس تعداد کاراکتر ثابت — کانتکست فنی باید کامل بماند (مثلاً کل بخش «استقرار Next.js با CLI» یک chunk باشد، نه نصفه).
* خروجی: `data/liara-docs.json` با schema:

```ts
{
  id: string
  title: string
  section: string
  content: string
  url: string        // باید واقعی و از منبع استخراج‌شده باشد؛ هرگز حدس زده نشود
  keywords?: string[] // عبارات فنی استخراج‌شده از خود متن، برای بوست امتیاز retrieval
}
```

### 4.2 Retrieval — hybrid ساده (نه فقط keyword خام)

چون این بخش مستقیماً روی بالاترین‌وزن رابریک اثر دارد، کمی فراتر از «فقط keyword matching» برو، اما بدون vector DB:

1. امتیازدهی keyword/BM25-like: تطابق عنوان > تطابق section > تطابق بدنه.
2. **بوست توکن‌های فنی**: لیست ثابتی از عبارات پرتکرار (502, PostgreSQL, LIARA_API_TOKEN, liara deploy, environment variable, domain, SSL, Docker, Node.js, liara.json, Object Storage, ...) وزن بالاتر بگیرند.
3. Persian normalization حتمی است: نیم‌فاصله، ی/ك عربی↔فارسی، حذف اعراب — وگرنه سوالات فارسی با نگارش‌های مختلف miss می‌خورند. این ریسک اصلی کیفیت پاسخ در این پروژه است.
4. اگر زمان اجازه داد (P1، نه P0): یک لایه‌ی fallback با embedding سبک (مثلاً از طریق همان Liara AI API اگر endpoint embedding دارد؛ در غیر این صورت رد شو، وقت را روی همین hybrid keyword بگذار). embedding را روی خود سند‌ها یک‌بار در ingestion اجرا کن، نه per-query سنگین.
5. خروجی نهایی: ۴–۶ chunk برتر.

---

## 5. Answer Generation Flow

```
User Question
  → Local intent detection (keyword/regex, رایگان)
  → Retrieve top 4–6 chunks (hybrid retrieval)
  → System prompt + [فقط chunkهای بازیابی‌شده] + [۶-۸ پیام آخر مکالمه] → LLM (streaming)
  → پارس پاسخ برای استخراج source references
  → نمایش پاسخ + Source cards + Suggested follow-ups
```

قانون سخت: مدل فقط اجازه دارد از chunkهایی که واقعاً retrieve شده‌اند نقل کند. اگر chunk کافی مرتبط نبود، باید صریح بگوید که در مستندات موجود پاسخ قابل‌اطمینانی پیدا نشد (Scenario E در دمو دقیقاً همین را تست می‌کند).

---

## 6. Citations

* هر پاسخ فنی باید Source card نشان دهد (حداکثر ۳–۵ تا).
* لینک هر source دقیقاً همان `url` واقعی از `liara-docs.json` است. هرگز URL ساخته/حدس‌زده نمایش داده نشود.
* اگر chunk بازیابی‌شده منبع کافی نداشت → پیام: «برای این سؤال منبع قابل‌اعتمادی در مستندات موجود پیدا نکردم.»

---

## 7. رفتار Agentic (۵۰ امتیاز — بخش Agentic/Personalization)

### 7.1 Intent 1 — Documentation Q&A
Retrieve → Answer → Sources. ساده و مستقیم.

### 7.2 Intent 2 — Deployment Guide (چندمرحله‌ای)
State machine ساده در حافظه‌ی مکالمه (نه دیتابیس جدا):
`ask_source(GitHub/local) → detect_framework → step: create_app → step: env_vars → step: deploy → step: verify`

هر پیام assistant باید بداند «الان کدام قدم» است و پاسخ بعدی را بر همان اساس بدهد. این state را در یک فیلد ساختاریافته کنار message نگه دار (نه فقط با حدس زدن از متن).

### 7.3 Intent 3 — Troubleshooting
اول اطلاعات لازم را بپرس (تکنولوژی، وضعیت build)، بعد checklist مبتنی بر مستندات بده. هرگز حدس فوری برنگردان.

### 7.4 Personalization (سبک، بدون auth) — این بخش را دست‌کم نگیر

رابریک صراحتاً «شخصی‌سازی پاسخ‌ها» را زیرمجموعه‌ی همان بلوک ۵۰ امتیازی Agentic گذاشته؛ پس این باید حداقل به این شکل در MVP باشد (بدون نیاز به لاگین/دیتابیس کاربر):

* **حافظه‌ی سطح-مکالمه**: فریم‌ورک/پلتفرمی که کاربر یک‌بار گفته (مثلاً "پروژه‌ام Next.js است") را در طول همان مکالمه به خاطر بسپار و در پاسخ‌های بعدی دوباره نپرس.
* **تطبیق لحن پاسخ با سطح کاربر**: اگر کاربر از اصطلاحات پیشرفته استفاده کرد (Docker, CI/CD) پاسخ فنی‌تر و کوتاه‌تر بده؛ اگر سوال مبتدیانه بود، گام‌به‌گام‌تر توضیح بده. این را با یک heuristic ساده (طول سوال + وجود اصطلاحات فنی) پیاده کن، نه مدل جداگانه.
* **پیشنهاد قدم بعدی متناسب با تاریخچه**: اگر کاربر قبلاً درباره‌ی دیتابیس پرسیده، در انتهای پاسخ بعدی گزینه‌ی «اتصال env variable به دیتابیس‌ات» را پیشنهاد بده، نه یک پیشنهاد generic.
* این‌ها همه client/session-scoped هستند؛ نیازی به دیتابیس یا حساب کاربری نیست، فقط باید در context مکالمه رسماً مدل‌سازی شوند (یک فیلد `sessionMemory` در state مکالمه).

---

## 8. Conversation Context

* ۶–۸ پیام آخر را کامل بفرست؛ قدیمی‌تر را خلاصه/حذف کن.
* فیلد `deploymentStep` و `sessionMemory` (از §7.4) باید همراه با message history نگه‌داری شوند.

---

## 9. UI/UX (۵۵ امتیاز)

### Desktop
Sidebar (New Chat / Conversations / Quick Actions / About) + Chat اصلی.

### Mobile
Drawer برای تاریخچه؛ RTL کامل برای فارسی، LTR اجباری برای بلاک‌های کد.

### Chat
Streaming، Markdown، syntax highlighting، Copy code، Copy answer، Retry، Source cards، Suggested follow-up buttons (این دکمه‌ها باید واقعاً یک پیام واقعی بفرستند، نه فقط UI تزئینی).

### Welcome Screen
چهار کارت پیشنهادی (Deploy / Troubleshoot / Database / Domains) — کلیک = ارسال خودکار همان سوال.

### Source Card
```
┌────────────────────────────────────┐
│ 📖 استقرار Next.js                 │
│ docs.liara.ir                       │
│ مشاهده مستندات ↗                   │
└────────────────────────────────────┘
```
حداکثر ۳–۵ تا.

### حالت‌های Loading/Error
* Loading: «در حال بررسی مستندات لیارا...»
* خطای API: «در دریافت پاسخ مشکلی پیش آمد.» + دکمه‌ی تلاش مجدد
* بدون منبع: «برای این سؤال منبع قابل‌اعتمادی در مستندات موجود پیدا نکردم.»
* Rate limit: «تعداد درخواست‌ها زیاد شده. چند لحظه بعد دوباره امتحان کنید.»
* هرگز stack trace خام به کاربر نشان داده نشود.

جزئیات دیگر: auto-scroll هنگام استریم، دکمه‌ی Stop generation، empty state، skeleton loading، انیمیشن‌های محدود و ظریف (نه پرزرق‌وبرق). Light/Dark mode هر دو.

طراحی: الهام از ChatGPT/Claude/Linear/Vercel اما کپی نشود. برندینگ لیارا ظریف باشد، نه گرادیان و glass effect زیاد.

---

## 9-b. Conversation History (پایداری)

برای MVP هکاتون، **پیش‌فرض client-side (localStorage/IndexedDB)** است — بدون نیاز به دیتابیس یا backend اضافه، و کاملاً روی زیرساخت لیارا هم قابل دیپلوی است چون هیچ وابستگی سرور جدیدی ایجاد نمی‌کند.
اگر زمان اجازه داد (P1)، می‌توان یک دیتابیس مدیریت‌شده‌ی PostgreSQL لیارا اضافه کرد تا مکالمات cross-device بمانند — این را فقط بعد از تکمیل کامل P0 انجام بده.

هر مکالمه: `{ id, title, createdAt, updatedAt, messages }`. عنوان کوتاه بعد از اولین پیام کاربر تولید شود (با مدل ارزان §3).

کاربر باید بتواند: مکالمه‌ی جدید بسازد، مکالمه‌ی قبلی را باز کند، مکالمه حذف کند.

---

## 10. امنیت (بخشی از ۵۰ امتیاز)

* هیچ secret (AI API Key, Liara API Token) هاردکد نشود؛ فقط `.env.local` + `.env.example` واقعی (بدون مقدار واقعی).
* Rate limiting ساده روی `/api/chat` (مثلاً ۲۰ درخواست/دقیقه/IP) — پیاده‌سازی in-memory کافی است، نیازی به Redis نیست مگر خیلی راحت اضافه شود.
* **Prompt injection**: محتوای retrieve‌شده از مستندات، DATA است نه instruction. در system prompt صریحاً تاکید کن که مدل هرگز نباید از دستوری که داخل متن مستندات آمده پیروی کند.
* هیچ API key یا system prompt داخلی در پاسخ به کاربر نشان داده نشود.

---

## 11. Logging (بند جدا در رابریک — این را فراموش نکن)

Brief اولیه فقط `/status` metrics داشت؛ رابریک رسمی صریحاً «Logging و Monitoring» را جدا ذکر کرده. حداقل لازم:

* لاگ ساختاریافته (JSON) برای هر request به `/api/chat`: timestamp, intent تشخیص‌داده‌شده, تعداد chunk بازیابی‌شده, latency, موفق/ناموفق، تخمین توکن ورودی/خروجی. `console.log(JSON.stringify(...))` کافی است — چیزی سنگین لازم نیست.
* خطاها با severity مشخص لاگ شوند (نه فقط throw خام).
* این لاگ‌ها منبع داده‌ی صفحه‌ی `/status` هم باشند (بخش بعد).

---

## 12. Monitoring

صفحه‌ی `/status` (یا `/admin`) با: تعداد کل request، موفق، خطا، میانگین latency، تخمین توکن ورودی/خروجی. اگر persistence سنگین شد، فقط runtime metrics حافظه‌ای برای دمو کافی است.

`GET /api/health` → `{ "status": "ok" }`

---

## 13. UX جزئیات تکمیلی

Auto-scroll، Stop generation، Copy answer/code، Retry، New chat، Mobile drawer، Empty state، Skeleton loading، RTL فارسی + LTR کد، انیمیشن محدود.

---

## 14. استقرار روی لیارا (۴۰ امتیاز) — جزئیات دقیق و تاییدشده از مستندات رسمی

### پیش‌نیاز پروژه
* پروژه باید با `create-next-app` ساخته شده باشد (پلتفرم Next.js لیارا فقط این را به‌رسمیت می‌شناسد).
* `package.json` باید این اسکریپت‌ها را داشته باشد:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```
* `node_modules` را در پروژه نگه ندار / در `.gitignore`/`.gitignore`-مطابق حذف کن؛ لیارا خودش `npm install` را روی سرورهای خودش اجرا می‌کند.

### روش‌های دیپلوی
1. **Liara CLI** (پیشنهادی برای دمو + امتیاز کیفیت فرآیند): نصب CLI → `liara login` → از ریشه‌ی پروژه: `liara deploy`. CLI پلتفرم Next.js را خودکار تشخیص می‌دهد.
2. Console (drag & drop zip) هم به‌عنوان راه جایگزین قابل ذکر است، اما برای هکاتون CLI سریع‌تر و قابل مستندسازی در README است.

### `liara.json` (در ریشه‌ی پروژه، اختیاری ولی توصیه‌شده برای دیپلوی تکرارپذیر)
```json
{
  "platform": "next",
  "app": "liara-copilot",
  "port": 3000,
  "build": {
    "location": "iran"
  }
}
```
مقدار دقیق `app` باید با شناسه‌ای که در کنسول لیارا ساخته‌ای یکی باشد. اگر تیم اطمینان ندارد، همین فایل را بعد از ساخت اپ در کنسول، از داکیومنتیشن دقیق `docs.liara.ir/paas/liarajson` تطبیق بده — مقادیر ممکن است در نسخه‌ی فعلی داکیومنتیشن کمی فرق کند، پیش از deploy نهایی حتماً چک کن.

### Environment Variables روی لیارا
* در کنسول لیارا (بخش اپ → Environment Variables) موارد زیر ست شوند: کلید API سرویس AI لیارا، و هر متغیر دیگر پروژه (مثلاً connection string دیتابیس در صورت اضافه‌شدن).
* هرگز این مقادیر داخل کد یا `liara.json` قرار نگیرد.

### چک‌لیست پیش از ارسال خروجی نهایی
* [ ] `npm run build` و `npm run lint` بدون خطا
* [ ] بعد از deploy، `https://<app-id>.liara.run` باز می‌شود و چت کار می‌کند
* [ ] `/api/health` روی دامنه‌ی دیپلوی‌شده پاسخ `ok` می‌دهد
* [ ] Environment Variables روی کنسول لیارا (نه فقط لوکال) ست شده‌اند

README باید شامل این مراحل به‌صورت گام‌به‌گام باشد چون «کیفیت فرآیند Deployment» جدا امتیاز دارد، نه فقط «موفق بودن».

---

## 15. تست‌ها (حداقلی، نه زیرساخت سنگین)

* Retrieval: سوالات شناخته‌شده باید chunk درست را برگردانند.
* Citation: هر source نمایش‌داده‌شده باید واقعاً از میان chunkهای بازیابی‌شده باشد.
* Chat API: درخواست موفق → پاسخ streamed.
* Rate limit: درخواست بیش‌ازحد → رد می‌شود.
* Build: `npm run build` و `npm run lint` بدون خطای TypeScript.

---

## 16. سناریوهای دمو (باید قبل از اتمام کار کنند)

A) «چطور پروژه Next.js رو روی لیارا deploy کنم؟» → پاسخ گام‌به‌گام + منبع + follow-up
B) «خطای 502 دارم» → سوال تکمیلی به‌جای حدس، سپس checklist
C) «PostgreSQL چطور به پروژه وصل میشه؟» → پاسخ دقیق + منبع
D) دنباله: «چطور Next.js deploy کنم؟» → «اگه environment variable داشته باشه چی؟» → باید context حفظ شود
E) سوالی خارج از مستندات → باید صریحاً بگوید که نمی‌تواند از مستندات موجود تایید کند (نه حدس بزند)

---

## 17. ساختار پروژه

```
app/
  page.tsx
  api/
    chat/route.ts
    health/route.ts
  status/page.tsx
components/
  chat/ (chat.tsx, message.tsx, composer.tsx, sources.tsx, suggested-actions.tsx)
  sidebar/conversation-list.tsx
lib/
  ai/ (system-prompt.ts, chat.ts, model-config.ts)
  docs/ (load-docs.ts, retrieve.ts, types.ts, normalize-fa.ts)
  intent/detect-intent.ts
  session/ (memory.ts — برای §7.4 personalization و deploymentStep)
  logging/index.ts
  rate-limit/index.ts
data/liara-docs.json
scripts/ingest-liara-docs.ts
liara.json
.env.example
README.md
```

---

## 18. برنامه‌ی زمانی پیشنهادی (بازه‌ی مسابقه ~۴۵ ساعت)

| بازه | کار |
|---|---|
| ۰–۴h | Setup پروژه با `create-next-app`، Tailwind/shadcn، ingestion script اولیه و تولید `liara-docs.json` |
| ۴–۱۰h | Retrieval hybrid + normalization فارسی + `/api/chat` با streaming پایه (بدون UI کامل) |
| ۱۰–۱۸h | UI کامل: layout، welcome screen، source cards، markdown/code render |
| ۱۸–۲۴h | سه Intent + state چندمرحله‌ای Deploy + Personalization سبک (§7.4) |
| ۲۴–۳۰h | Conversation history (client-side) + suggested follow-ups واقعی |
| ۳۰–۳۴h | Rate limiting + logging + `/status` + `/api/health` + error/loading states |
| ۳۴–۳۸h | Deploy روی لیارا (CLI) + رفع مشکلات واقعی deployment |
| ۳۸–۴۲h | اجرای ۵ سناریوی دمو، رفع باگ، polish UI، نوشتن README |
| ۴۲–۴۵h | بافر / ضبط ویدیوی دمو در صورت نیاز |

---

## 19. Definition of Done

پروژه کامل است وقتی: چت کار می‌کند، پاسخ‌ها stream می‌شوند، مستندات واقعی retrieve می‌شوند، منابع معتبر و کلیک‌پذیرند، سوالات پیگیری context را حفظ می‌کنند، مسیر Deploy و Troubleshoot کار می‌کند، Personalization سبک قابل مشاهده است، موبایل کار می‌کند، خطاها مدیریت می‌شوند، secretها محافظت‌شده‌اند، rate limit فعال است، logging ساختاریافته وجود دارد، build موفق است، و روی زیرساخت لیارا واقعاً بالا و قابل‌استفاده است.

**اصل نهایی: Simple + Working + Polished، نه Complex + Incomplete.**
