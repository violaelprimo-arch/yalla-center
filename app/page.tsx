import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';
import { BrandIcon } from '@/components/brand/brand-icon';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6 sm:p-12 relative overflow-hidden bg-background">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-blue-700/15 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <BrandLogo width={180} height={44} priority />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20">
            <span className="w-2 h-2 rounded-full bg-brand-cyan-500 animate-pulse" />
            نظام سحابي متكامل
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-4xl flex flex-col items-center text-center my-auto py-12 z-10">
        <div className="mb-6 inline-flex p-3 rounded-2xl bg-card border border-border shadow-soft-md">
          <BrandIcon size="xl" priority />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 text-foreground leading-[1.25]">
          المنصة السحابية لإدارة{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-cyan-500 to-brand-blue-600">
            المراكز والسناتر التعليمية
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-normal">
          إدارة شاملة متعددة السناتر: الحضور السريع بالباركود، حسابات المعلمين بنظامي السنتر والبرايفت، بنك الأسئلة المعتمد على الذكاء الاصطناعي، والطباعة الرسمية المعتمدة A4.
        </p>

        {/* Action Portal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
          <Link
            href="/owner"
            className="card-elevated card-interactive p-6 text-start flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-navy-800 text-brand-cyan-400 flex items-center justify-center font-bold text-lg mb-4 border border-brand-navy-700">
                مالك
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2 group-hover:text-brand-blue-500 transition-colors">
                بوابة مالك المنصة
              </h2>
              <p className="text-sm text-muted-foreground">
                لوحة القيادة المركزية، إدارة اشتراكات السناتر، مؤشرات النمو، والتحكم السحابي العام.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm font-semibold text-brand-blue-500">
              <span>دخول بوابة المالك</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>

          <Link
            href="/center/al-maher"
            className="card-elevated card-interactive p-6 text-start flex flex-col justify-between group border-brand-cyan-500/30"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center font-bold text-lg mb-4 border border-brand-cyan-500/20">
                سنتر
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2 group-hover:text-brand-blue-500 transition-colors">
                سنتر الماهر النموذجي
              </h2>
              <p className="text-sm text-muted-foreground">
                الاستقبال والحضور، شؤون الطلاب، المجموعات الدراسية، الخزينة، وبنك الامتحانات.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm font-semibold text-brand-cyan-600 dark:text-brand-cyan-400">
              <span>دخول بيئة السنتر</span>
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </div>
          </Link>
        </div>

        {/* Secondary link to Al-Rowad */}
        <div className="mt-6 text-sm text-muted-foreground">
          أو تصفح السنتر البديل:{' '}
          <Link href="/center/al-rowad" className="text-brand-blue-500 hover:underline font-medium">
            سنتر الرواد التعليمي
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-border/50 text-xs text-muted-foreground z-10">
        <div>
          جميع الحقوق محفوظة © {new Date().getFullYear()} منصة يلا سنتر — تطوير يلا كودكس (Yalla Codex)
        </div>
        <div className="flex items-center gap-6">
          <span>هوية عربية أصيلة</span>
          <span>•</span>
          <span>عزل تام للمراكز</span>
          <span>•</span>
          <span>دعم العمل غير المتصل (Demo)</span>
        </div>
      </footer>
    </main>
  );
}
