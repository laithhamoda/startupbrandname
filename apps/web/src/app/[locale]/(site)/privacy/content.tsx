// Placeholder privacy policy (M2). Draft wording only: it must be replaced after legal review
// (CLAUDE.md §10). Keep the processor list in step with docs/DECISIONS.md.

export const PRIVACY_UPDATED = '2026-09-26';

export function PrivacyAr() {
  return (
    <>
      <section>
        <h2>من يعالج بياناتك</h2>
        <p>
          منصة <span lang="en">Startup Brand Name</span>. [اسم الجهة المشغّلة وعنوانها وطريقة
          التواصل تُضاف بعد المراجعة القانونية.]
        </p>
      </section>
      <section>
        <h2>ما الذي نجمعه</h2>
        <ul>
          <li>بريدك الإلكتروني، لإرسال رمز الدخول.</li>
          <li>بلد إقامتك ولغتك، لاختيار بيانات البلد في تحليلك.</li>
          <li>
            إجابتك عن سؤال: هل لديك مشروع أو فكرة مشروع؟ لا نطلب تاريخ الميلاد ولا صور الشهادات.
          </li>
          <li>سجل موافقاتك وسحبها، مع نسخة النص الذي وافقت عليه.</li>
          <li>
            إذا دخلت بحساب Google، يحفظ نظام الدخول اسمك وصورتك كما أرسلهما Google. لا نستخدمهما ولا
            نعرضهما.
          </li>
          <li>في المراحل القادمة: إجاباتك ومحتوى مشاريعك.</li>
        </ul>
      </section>
      <section>
        <h2>أين تُعالج بياناتك</h2>
        <ul>
          <li>Supabase: قاعدة البيانات وتسجيل الدخول، في ألمانيا (فرانكفورت).</li>
          <li>
            Vercel: تشغيل الموقع، وخوادمه في ألمانيا (فرانكفورت)، والملفات العامة عبر شبكة توزيع
            عالمية.
          </li>
          <li>Resend: إرسال رسائل البريد، في أيرلندا.</li>
          <li>Google: فقط إذا اخترت الدخول بحساب Google، في الولايات المتحدة.</li>
          <li>
            Anthropic: فقط بموافقتك الاختيارية، لتشغيل المرشد الذكي، في الولايات المتحدة. يُرسَل
            محتوى المشروع دون اسمك أو بريدك.
          </li>
        </ul>
      </section>
      <section>
        <h2>مدة الاحتفاظ</h2>
        <ul>
          <li>الحساب الذي لا يكتمل خلال 24 ساعة يُحذف تلقائيًا.</li>
          <li>حذف الحساب من صفحة حسابك فوري، ويشمل كل بياناتك.</li>
          <li>[مدد الاحتفاظ الأخرى تُحدَّد بعد المراجعة القانونية.]</li>
        </ul>
      </section>
      <section>
        <h2>حقوقك</h2>
        <p>
          يمكنك الاطلاع على بياناتك وتصحيح بلدك ولغتك وسحب موافقتك وحذف حسابك في أي وقت من صفحة
          حسابك.
        </p>
      </section>
      <section>
        <h2>ملفات تعريف الارتباط</h2>
        <p>
          نستخدم فقط ما يلزم لعمل المنصة: جلسة الدخول، ولغة الواجهة خلال التصفح، وإجابات خطوة
          التسجيل لمدة 30 دقيقة. يُحفظ اختيار المظهر في متصفحك. لا نستخدم ملفات إعلانية أو تحليلية.
        </p>
      </section>
    </>
  );
}

export function PrivacyEn() {
  return (
    <>
      <section>
        <h2>Who processes your data</h2>
        <p>
          Startup Brand Name. [The operator’s name, address and contact details will be added after
          legal review.]
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your email address, to send your sign-in code.</li>
          <li>
            Your country of residence and language, to pick the country data for your analysis.
          </li>
          <li>
            Your answer to “Do you have a project or a project idea?”. We do not ask for your date
            of birth or for certificates.
          </li>
          <li>Your consents and withdrawals, with the version of the text you agreed to.</li>
          <li>
            If you sign in with Google, the sign-in system keeps the name and photo Google sends. We
            neither use nor show them.
          </li>
          <li>In later milestones: your answers and the content of your projects.</li>
        </ul>
      </section>
      <section>
        <h2>Where your data is processed</h2>
        <ul>
          <li>Supabase: database and sign-in, in Germany (Frankfurt).</li>
          <li>
            Vercel: runs the website, with its servers in Germany (Frankfurt) and public files on a
            global delivery network.
          </li>
          <li>Resend: sends our emails, in Ireland.</li>
          <li>Google: only if you choose to sign in with Google, in the United States.</li>
          <li>
            Anthropic: only with your optional consent, to run the AI mentor, in the United States.
            Project content is sent without your name or email.
          </li>
        </ul>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>An account that is not completed within 24 hours is deleted automatically.</li>
          <li>
            Deleting your account from your account page is immediate and covers all your data.
          </li>
          <li>[Other retention periods will be set after legal review.]</li>
        </ul>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          On your account page you can see your data, correct your country and language, withdraw
          your consent and delete your account at any time.
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          Only what the platform needs to work: your sign-in session, the interface language while
          you browse, and your sign-up answers for 30 minutes. Your theme choice is stored in your
          browser. No advertising or analytics cookies.
        </p>
      </section>
    </>
  );
}
