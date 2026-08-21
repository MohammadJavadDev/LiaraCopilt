# RUBRIC_CHECKLIST.md — نگاشت دقیق معیار داوری ↔ پیاده‌سازی

این فایل را به‌عنوان acceptance checklist نهایی استفاده کن. قبل از تحویل، هر ردیف را با علامت ✅ ببند. اگر ردیفی خالی ماند، احتمالاً امتیاز از دست می‌رود حتی اگر پروژه "کار کند".

## ۱. کیفیت و صحت پاسخ‌ها — ۸۰ امتیاز

| آیتم رابریک | پیاده‌سازی | فایل/محل |
|---|---|---|
| صحت و مرتبط بودن پاسخ‌ها | فقط از chunk‌های retrieve‌شده پاسخ تولید می‌شود | `lib/ai/chat.ts`, system prompt |
| کامل و کاربردی بودن پاسخ‌ها | خروجی گام‌به‌گام، نه تئوری طولانی | system prompt §13 اصل brief |
| توانایی پیدا کردن اطلاعات مناسب | retrieval hybrid + نرمال‌سازی فارسی | `lib/docs/retrieve.ts`, `normalize-fa.ts` |
| کاهش پاسخ‌های نادرست/ساختگی | قانون "منبع کافی نبود → بگو نمی‌دانم" + هرگز URL ساختگی | system prompt، `lib/docs/retrieve.ts` |
| ارائه منبع مناسب | Source cards با URL واقعی از داده retrieve‌شده | `components/chat/sources.tsx` |
| عملکرد در سوالات ساده و پیچیده | تست سناریوهای A–E (§16 در PROJECT_SPEC) | `__tests__/` یا اجرای دستی + ضبط |

## ۲. طراحی UI و تجربه کاربری — ۵۵ امتیاز

| آیتم | پیاده‌سازی | فایل/محل |
|---|---|---|
| کیفیت طراحی و سادگی استفاده | shadcn/ui + دایرکشن طراحی ChatGPT/Linear بدون کپی | `components/`, Tailwind config |
| تجربه مناسب در مکالمه | استریم، Markdown، Copy، Retry | `components/chat/chat.tsx`, `message.tsx` |
| نمایش مناسب کد/لینک/اطلاعات فنی | Syntax highlighting، LTR در بلاک کد داخل RTL | `message.tsx` |
| تجربه مناسب در ادامه Conversation | context حفظ‌شده + عدم پرسش تکراری | `lib/session/memory.ts` |
| Responsive بودن | Desktop sidebar / Mobile drawer | `components/sidebar/` |
| توجه به جزئیات UX | Empty state, skeleton, auto-scroll, stop generation | `components/chat/composer.tsx` |

## ۳. قابلیت‌های Agentic و Personalization — ۵۰ امتیاز

| آیتم | پیاده‌سازی | فایل/محل |
|---|---|---|
| درک صحیح Intent کاربر | تشخیص محلی intent (بدون فراخوانی اضافه‌ی مدل) | `lib/intent/detect-intent.ts` |
| پرسیدن سؤال تکمیلی در صورت نیاز | Troubleshooting قبل از پاسخ سوال می‌پرسد | Intent 3 در PROJECT_SPEC §7.3 |
| حفظ Context مکالمه | ۶–۸ پیام آخر + state ساختاریافته | `lib/session/memory.ts` |
| **شخصی‌سازی پاسخ‌ها** ⚠️ | حافظه‌ی سطح-جلسه از استک/سطح کاربر؛ تطبیق لحن | `lib/session/memory.ts` — PROJECT_SPEC §7.4 |
| پیشنهاد قدم بعدی به کاربر | Follow-up suggestions واقعی و کلیک‌پذیر | `components/chat/suggested-actions.tsx` |
| انجام فرآیندهای چندمرحله‌ای | Deployment guide state machine | Intent 2، `deploymentStep` در session state |
| استفاده خلاقانه از Agentic | ترکیب سه intent + personalization سبک با هم | کل جریان `/api/chat` |

⚠️ این ردیف در brief اولیه به P2 رانده شده بود — حتماً چک شود که واقعاً پیاده شده، نه فقط ذکر شده در متن.

## ۴. امنیت، پایداری و Monitoring — ۵۰ امتیاز

| آیتم | پیاده‌سازی | فایل/محل |
|---|---|---|
| Rate Limiting | ۲۰ req/min/IP روی `/api/chat` | `lib/rate-limit/index.ts` |
| مدیریت صحیح API Key/Secret | `.env.local` + `.env.example`، هرگز هاردکد | `.env.example`, README |
| مدیریت خطا و Failure | پیام خطای کاربرپسند، بدون stack trace خام | `components/chat/*`, `app/api/chat/route.ts` |
| کنترل مصرف Token/درخواست غیرضروری | intent محلی، محدودیت chunk و history، `max_tokens` | `lib/ai/model-config.ts` |
| **Logging و Monitoring** ⚠️ | لاگ JSON ساختاریافته هر request + `/status` | `lib/logging/index.ts`, `app/status/page.tsx` |
| معماری قابل توسعه و نگهداری | جدا بودن lib/ai, lib/docs, lib/intent, lib/session | ساختار پروژه در PROJECT_SPEC §17 |

⚠️ Logging جدا از Monitoring در رابریک آمده — فقط صفحه‌ی `/status` کافی نیست.

## ۵. استقرار روی زیرساخت لیارا — ۴۰ امتیاز

| آیتم | پیاده‌سازی | فایل/محل |
|---|---|---|
| اجرای موفق روی لیارا | `liara deploy` موفق، URL باز و کاربردی | — |
| کیفیت فرآیند Deployment | مستندسازی گام‌به‌گام در README | `README.md` |
| Configuration مناسب | `liara.json` صحیح، env vars روی کنسول ست‌شده | `liara.json`, README |
| آمادگی برای Production | health check، error handling، rate limit فعال | `app/api/health/route.ts` |

## ۶. بهینه‌سازی هزینه — ۲۵ امتیاز

| آیتم | پیاده‌سازی | فایل/محل |
|---|---|---|
| انتخاب مناسب مدل/سرویس | مدل ارزان برای intent/title، مدل قوی فقط برای پاسخ نهایی + توضیح در README | `lib/ai/model-config.ts`, README |
| کنترل مصرف Token | `max_tokens`، محدودیت chunk، محدودیت history | `lib/ai/model-config.ts` |
| کاهش درخواست غیرضروری | intent محلی به‌جای LLM call اضافه | `lib/intent/detect-intent.ts` |
| استفاده از Cache در صورت نیاز | cache نتیجه‌ی parse مستندات | `lib/docs/load-docs.ts` |
| توجه به هزینه زیرساخت | یک پلن ساده‌ی لیارا، بدون سرویس اضافه غیرضروری (Redis/DB فقط اگر لازم) | README (توضیح تصمیم معماری) |
| تعادل کیفیت/هزینه | مستدل در README | README |

---

## چک‌لیست نهایی قبل از ارسال

- [ ] هر ۶ ردیف بالا با علامت ✅ بسته شده
- [ ] ۵ سناریوی دمو (A–E) واقعاً اجرا و تست شده‌اند
- [ ] لینک Deploy شده روی لیارا کار می‌کند (یا در صورت شکست، ویدیوی دمو کامل ضبط شده)
- [ ] لینک GitHub پروژه آماده است
- [ ] README شامل: setup، env vars، ingestion، dev، build، deploy روی لیارا، خلاصه معماری
