# Mascot: تحقیق مدیریت حساب‌های Claude Code

تاریخ بررسی: 2026-10-31. این سند پیشنهاد معماری است؛ پیاده‌سازی یا آزمون زندهٔ چند حساب انجام نشده است.

## پیشنهاد اصلی

Mascot یک CLI محلی با افزونهٔ VS Code/Cursor باشد که خود باینری رسمی و بدون تغییر Claude Code را اجرا می‌کند. هر حساب پروفایل مستقل داشته باشد. UI مدیریت حساب، مشاهدهٔ مصرف و تحویل کار را انجام دهد؛ اجرای مدل و احراز هویت با Claude Code بماند.

اجرای محلی یعنی نیازی به سرور اختصاصی نیست؛ درخواست‌های مدل همچنان به سرویس Anthropic می‌روند و اینترنت لازم است.

## شواهد بررسی‌شده

- مخزن Mascot: `/Users/mahdifarahani/Projects/Mascot`، remote برابر `https://github.com/mahtifarahani/Mascot.git`. در زمان بررسی فقط `.git` و `.gitignore` خالی داشت؛ مسیر داده‌شده فایل ignore بود، نه سورس برنامه.
- CatHouse محلی: commit `c9deabe108f789b63b1539b949dc379a7e10c86b`، manifest افزونه `0.5.1`.
- `catherd` upstream HEAD مشاهده‌شده: `a68a715ae52a97a6884bc3e53dd69fa987b84fbd`. clone موقت در `/tmp/mascot-catherd-rd-20261031` دریافت و بخش‌های failover، session و adapter بررسی شدند. package هنوز `1.5.0` است، ولی README تغییرات معماری daemon و مهاجرت 2.0 را شرح می‌دهد؛ بنابراین شمارهٔ manifest به‌تنهایی قرارداد سازگاری نیست. بررسی کامل تمام کد upstream ادعا نمی‌شود.
- Claude Code نصب‌شده: `2.1.283`؛ فقط `--version` و `auth status --help` اجرا شد. ورود، خروج، درخواست مدل، خواندن token یا تعویض واقعی حساب انجام نشد.
- مستندات آنلاین ممکن است جلوتر از باینری نصب‌شده باشند؛ هر قابلیت نیاز به بررسی نسخه و آزمایش مستقل دارد.

## احراز هویت و مرز سیاست‌ها

مستندات رسمی [Authentication](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts) استفاده از `CLAUDE_CONFIG_DIR` جدا برای چند حساب را توضیح می‌دهند. هر پروفایل تنظیمات و تاریخچهٔ خودش را دارد. این روش برای دو ورود Console بدون API key جداسازی کامل ایجاد نمی‌کند.

الگوی مفهومی برای دو اشتراک claude.ai:

```sh
CLAUDE_CONFIG_DIR="$HOME/.mascot/profiles/personal/claude" claude
CLAUDE_CONFIG_DIR="$HOME/.mascot/profiles/work/claude" claude
```

این دستورها در تحقیق اجرا نشده‌اند. ایجاد پوشه و login در محصول باید از مسیر رسمی CLI انجام شود. مسیرها بیرون Git باشند؛ اطلاعات ورود را خود Claude مدیریت کند.

[Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use) بین اجرای باینری رسمی با ورود خود کاربر و استفادهٔ برنامهٔ ثالث از credential اشتراک فرق می‌گذارد. محصول ثالث نباید token نشست claude.ai را جمع‌آوری، نگهداری یا واسطه‌گری کند؛ برای ادغام مستقیم Agent SDK، مسیر API key یا provider پشتیبانی‌شده توصیه شده است. برای انتشار عمومیِ محصولی که Claude Code را اجرا می‌کند، شرایط ارائهٔ Claude Code در محصول هم باید رعایت شود.

نتیجهٔ طراحی: هیچ OAuth اختصاصی، کپی credential، دست‌کاری Keychain، refresh token، proxy درخواست یا تغییر باینری در Mascot نباشد. این انتخاب سطح ریسک را کاهش می‌دهد و تضمین عدم تعلیق حساب نیست.

وجود قابلیت چند حساب، مجوز مشخصی برای چرخش خودکار حساب‌ها با هدف عبور از سهمیه نیست. در منابع بررسی‌شده تأیید روشن برای این کاربرد پیدا نشد. دستی‌کردن همان رفتار نیز به‌خودی‌خود مجوز ایجاد نمی‌کند.

## مصرف و اطلاعات حساب

[CLI reference](https://code.claude.com/docs/en/cli-reference) فرمان `claude auth status` و خروجی JSON آن را مستند می‌کند. افزونه فقط فیلدهای مجاز مانند وضعیت ورود، روش احراز هویت، ایمیل و مسیر تنظیمات را پس از اعتبارسنجی نمایش دهد؛ فیلد ناموجود با حدس پر نشود. پشتیبانی دقیقِ نام پلن و سازمان باید روی نسخهٔ هدف آزموده شود.

[Statusline](https://code.claude.com/docs/en/statusline#rate-limit-usage) ورودی رسمی JSON با `rate_limits.five_hour` و `rate_limits.seven_day`، درصد مصرف و زمان reset دارد. این داده ممکن است فقط پس از پاسخ مدل موجود شود و هر پنجره مستقل غایب باشد. درصد context با درصد سهمیهٔ حساب فرق دارد.

پیشنهاد: یک adapter محلیِ statusline دادهٔ مجاز را با شناسهٔ پروفایل و زمان مشاهده ذخیره کند. statusline فعلی کاربر نباید بی‌اطلاع جایگزین شود؛ ترکیب دو script نیاز به آزمون دارد. دادهٔ خام stdin لاگ نشود.

برای حساب غیرفعال، آخرین مقدار مشاهده‌شده با برچسب «آخرین به‌روزرسانی» نمایش داده شود. بعد از reset یا قدیمی‌شدن، وضعیت «نیاز به بررسی» باشد؛ هیچ صفر یا ۱۰۰ درصد ساختگی و درخواست مدل صرفاً برای تازه‌سازی نمایش نباشد. برای بررسی مستقیم، session رسمی و صفحهٔ Usage در دسترس کاربر قرار گیرد. API عمومی و مستندِ polling مصرف همهٔ اشتراک‌ها در منابع بررسی‌شده پیدا نشد؛ endpoint خصوصی به‌عنوان راهکار MVP پیشنهاد نمی‌شود.

## انتقال context و ادامهٔ کار

[Sessions](https://code.claude.com/docs/en/sessions) ذخیرهٔ محلی، `/export` و `--resume <transcript-path>` را توضیح می‌دهد. فرمت JSONL داخلی و قابل تغییر است. این قابلیت‌ها تضمین نمی‌کنند که انتقال بین حساب‌ها تمام وضعیت اجرا را حفظ کند.

پیشنهاد پایه، بستهٔ تحویل کار است:

- هدف، محدودیت‌ها، تصمیم‌ها و مرحلهٔ بعد؛
- مسیر repo/worktree، branch، commit، فهرست تغییرات و نتیجهٔ آزمون‌ها؛
- خلاصهٔ گفتگو و ارجاع به export انتخاب‌شده؛
- وضعیت ابزارها، کارهای نیمه‌تمام و اجازه‌هایی که باید دوباره گرفته شوند.

پیش از تعویض باید معلوم شود اجرای قبلی متوقف شده یا هنوز ابزار پس‌زمینه دارد؛ دو process نباید بی‌هماهنگی روی یک worktree بنویسند. خلاصه‌ها در طول کار checkpoint شوند: بعد از رسیدن به limit نمی‌توان تولید خلاصه با مدل حساب قبلی را تضمین کرد. fallback می‌تواند metadata محلی و export موجود باشد.

حساب مقصد بستهٔ تحویل را به‌عنوان مرجع می‌خواند و session تازه شروع می‌کند. صرف اشاره به session ID حساب قبلی، دسترسی به گفتگو ایجاد نمی‌کند. فایل‌های ارجاع باید برای مقصد قابل خواندن و انتقال اطلاعات بین حساب شخصی/سازمانی مجاز باشد.

آزمایش resume مستقیم از transcript، قابلیت پژوهشی مرحلهٔ بعد است؛ روی کپی و session جدید بررسی شود. انتقال حافظهٔ پنهان مدل، cache سرور، مجوزهای موقت، ابزارهای زنده و entitlement حساب وعده داده نمی‌شود. credential و پوشهٔ کامل profile برای انتقال context کپی نشود.

## برخورد با limit

در MVP چرخش خودکار حساب مبتنی بر quota نباشد. رویداد limit موجب نمایش وضعیت و حفظ checkpoint شود؛ وضعیت ورود ناموفق یا تعلیق حساب نیز نباید به تعویض خودکار و retry تبدیل شود.

مسیرهای مستند ادامه روی همان حساب:

- [Interactive mode](https://code.claude.com/docs/en/interactive-mode#wait-for-a-usage-limit-to-reset): انتظار تا reset و ادامهٔ session تعاملی، با شرایط نسخه و بازماندن session.
- [Usage credits](https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans): مصرف اضافه با هزینه و سقف خرجِ تنظیم‌شده توسط کاربر. Mascot نباید خودکار آن را فعال یا خرید انجام دهد.

تعویض معمولی بین حساب‌های مجاز و انتخاب مقصد برای کار بعدی می‌تواند قابلیت مستقل باشد. افزودن fallback خودکار میان اشتراک‌ها برای یک کارِ محدودشده، نیاز به روشن‌شدن مجوز این کاربرد از Anthropic دارد.

## حفظ قابلیت‌ها

اجرای CLI اصلی، بهترین پایه برای حفظ رفتار native است؛ ولی «همهٔ امکانات Claude» دامنهٔ بیش از حد بزرگی دارد. قابلیت‌های claude.ai، Cowork، Desktop و UI رسمی VS Code الزاماً به افزونهٔ Mascot منتقل نمی‌شوند.

ماتریس آزمایش لازم: مدل‌های مجاز هر حساب، permissions، plan mode، MCP، plugins، skills، hooks، memory، resume، ورودی تصویر/clipboard، shortcutها، IDE integration و Remote Control در صورت نیاز. حفظ هر مورد وابسته به سطح دسترسی حساب و پیکربندی صحیح پروفایل است.

تنظیمات قابل اشتراک از credential جدا شوند. MCP ممکن است احراز هویت خودش را بخواهد. symlink کامل پروفایل یا یکسان‌کردن کورکورانهٔ تنظیمات راهکار مناسبی نیست.

## معماری پیشنهادی

```text
VS Code / Cursor extension: Accounts · Sessions · Usage · Handoff
                       │
                Mascot local core / CLI
                       │
         official Claude Code in native terminal
               ├── isolated profile A
               ├── isolated profile B
               └── isolated profile C
```

برای MVP: TypeScript، CLI مستقل، قراردادهای zod، React webview با theme و CSP مشابه CatHouse، و ترمینال خود editor. هستهٔ مشترک میان CLI و افزونه تکرار منطق را حذف کند. daemon دائمی و HTTP server فعلاً لازم نیست؛ IPC فقط در صورت نیاز و با Unix socket محلی محدود اضافه شود. بستن editor نباید به اشتباه به‌عنوان حفظ اجرای session تضمین شود.

هر session هنگام ساخت به یک profile ثابت متصل شود. تغییر انتخاب حساب، credential یک process زنده را تغییر ندهد. برای ورود مجدد فقط مسیر رسمی CLI باز شود. ورودی‌های auth/proxy/provider از محیط موروثی می‌توانند حساب انتخاب‌شده را override کنند؛ adapter باید تداخل را تشخیص دهد و محیط child را صریح بسازد، بدون افشای مقدار secret یا حذف سیاست مدیریت‌شدهٔ سازمان.

state خصوصی در مسیر دادهٔ کاربر باشد، با دسترسی محدود؛ repo عمومی فقط کد و مستندات بگیرد. مسیرهای profile، ایمیل واقعی، usage واقعی و transcript کاربر در fixture یا commit نباشند. گزارش‌های اشتراک‌پذیر باید redacted باشند.

## چه چیزی از catherd و CatHouse بگیریم

[catherd](https://github.com/47vigen/catherd): مرز روشن CLI/runtime، state قابل ادامه، preflight، adapter و checkpoint الگوهای خوبی‌اند. orchestration چندنقشی و failover مدل‌ها مستقیماً مسئلهٔ مدیریت حساب نیستند. فعلاً وابستگی runtime به catherd لازم نیست. مجوز MIT آن هنگام استفادهٔ واقعی از کد نیازمند حفظ notices است.

شاهد کد در commit بالا: `src/domain/failover.ts:9` سهمیه را با backend/billing key مشخص می‌کند، نه شناسهٔ حساب. `src/services/failover-rungs.ts:83` مقصدِ دارای همان quota را رد می‌کند. پس failover موجود را نمی‌توان account switcher فرض کرد. `src/adapters/claude-code/index.ts:268` ادامه را از طریق `--resume` به CLI می‌سپارد؛ این الگوی adapter برای Mascot مناسب است.

CatHouse محلی: workspace با بسته‌های protocol/ui/webview/extension/compat، جداسازی webview از process، setup، نسخه‌بندی سازگاری و مدیریت resume قابل الگوبرداری است. شواهد مستقیم: `packages/extension/src/orchestrator/session.ts:128` از Agent SDK استفاده می‌کند؛ `:132` منابع تنظیمات و `:139` محیط را می‌فرستد؛ `:140` resume را تنظیم می‌کند. `packages/extension/src/setup/detect.ts:94` وضعیت ورود را از CLI می‌گیرد. مسیر SDK اشتراکی به‌عنوان الگوی سیاستی Mascot فرض نشود. manifest افزونه فعلاً `UNLICENSED` است؛ انتخاب مجوز انتشار جدا انجام شود.

## مرحلهٔ بعد و معیار تصمیم

1. spike محلی با دو ورود رسمی و پروفایل تازه: جداسازی ورود، خروج و refresh را روی macOS تأیید کند؛ بدون خواندن secret توسط Mascot.
2. نمونهٔ statusline واقعی با رضایت کاربر: دادهٔ حاضر/غایب، reset، چند session و حفظ statusline قبلی بررسی شود.
3. یک بستهٔ تحویل و session مقصد در worktree آزمایشی: ادامهٔ کار بدون دوباره‌اجرای اثرهای جانبی ارزیابی شود؛ limit واقعی عمداً مصرف نشود.
4. آزمایش جداگانهٔ resume بین پروفایل‌ها و ماتریس قابلیت‌ها؛ نتیجهٔ شکست به بستهٔ تحویل fallback کند.
5. سپس اسکلت CLI و افزونه ساخته شود. توسعهٔ quota rotation تا روشن‌شدن مجوز کاربرد وارد scope نشود.

نتیجهٔ R&D: مدیریت محلی چند حساب و تحویل کار عملی به نظر می‌رسد. «سوییچ خودکار برای ادامه بعد از تمام‌شدن سهمیه»، «مصرف زندهٔ همهٔ حساب‌های خاموش» و «انتقال بی‌نقص تمام state» با شواهد فعلی قابل تعهد نیستند.
