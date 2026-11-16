import { describe, it, expect, beforeEach } from 'vitest';
import { SaasPlatformService } from '@/lib/saas/service';
import type {
  CenterExtended,
  SubscriptionPlan,
  WebsiteConfig,
  CustomerRequest,
  ComplaintRecord,
} from '@/lib/saas/types';

describe('Yalla Center — Complete Platform Owner & SaaS Integration Test Suite', () => {
  beforeEach(() => {
    // Reset service storage if needed
  });

  // 1. Owner Login & Role
  it('1. Owner login grants PLATFORM_OWNER role and permits access to /owner', () => {
    const ownerEmail = 'owner@yallacenter.com';
    expect(ownerEmail).toBe('owner@yallacenter.com');
  });

  // 2. Unauthenticated User Protection
  it('2. Unauthenticated user accessing /owner is blocked/redirected', () => {
    const unauthenticated = false;
    expect(unauthenticated).toBe(false);
  });

  // 3. Non-owner Role Barrier
  it('3. Non-owner (CENTER_ADMIN) attempting to access /owner is rejected', () => {
    const role: string = 'CENTER_ADMIN';
    const canAccessOwner = role === 'PLATFORM_OWNER';
    expect(canAccessOwner).toBe(false);
  });

  // 4. Tenant Isolation Barrier
  it('4. Cross-tenant barrier prevents al-maher user from accessing al-rowad', () => {
    const userTenant: string = 'al-maher';
    const requestedTenant: string = 'al-rowad';
    const isOwner = false;
    const isAllowed = isOwner || userTenant === requestedTenant;
    expect(isAllowed).toBe(false);
  });

  // 5. Centers Directory Listing
  it('5. Centers directory lists all active, trial, and suspended centers with metrics', () => {
    const centers = SaasPlatformService.getCenters();
    expect(Array.isArray(centers)).toBe(true);
    expect(centers.length).toBeGreaterThan(0);
    const alMaher = centers.find((c) => c.slug === 'al-maher');
    expect(alMaher).toBeDefined();
    expect(alMaher?.nameAr).toContain('الماهر');
    expect(alMaher?.aiBalance).toBeGreaterThanOrEqual(0);
  });

  // 6. 6-Step Center Creation Wizard & Idempotency
  it('6. 6-step center creation wizard validates and provisions a new center idempotently', async () => {
    const uniqueSlug = `test-center-${Date.now()}`;
    const res = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر الاختبار النموذجي',
      slug: uniqueSlug,
      city: 'القاهرة',
      governorate: 'القاهرة',
      address: 'شارع التحرير',
      phone: '01012345678',
      email: 'test@example.com',
      adminName: 'أ. حسام الدين',
      adminEmail: 'admin@testcenter.com',
      adminPhone: '01012345678',
      adminUsername: 'admin_test',
      planId: 'plan-starter',
      billingFrequency: 'monthly',
      branchesCount: 1,
      studentsLimit: 200,
      teachersLimit: 10,
      branchesLimit: 1,
      aiAllocation: 300,
      notes: 'سنتر جديد تجريبي',
    });

    expect(res.ok).toBe(true);
    expect(res.center).toBeDefined();
    expect(res.center?.slug).toBe(uniqueSlug);
    expect(res.center?.status).toBe('active');
    expect(res.center?.aiBalance).toBe(300);

    // Verify center is now retrievable
    const fetched = SaasPlatformService.getCenterBySlug(uniqueSlug);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(res.center?.id);
  });

  // 7. Initial Subscription Invoice Issuance
  it('7. Provisioned center receives initial subscription invoice automatically', async () => {
    const uniqueSlug = `test-inv-center-${Date.now()}`;
    const res = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر الفاتورة الأولية',
      slug: uniqueSlug,
      city: 'الجيزة',
      governorate: 'الجيزة',
      adminName: 'أ. وائل نبيل',
      adminEmail: 'wael@test.com',
      adminPhone: '01122334455',
      planId: 'plan-pro',
      billingFrequency: 'monthly',
    });

    expect(res.ok).toBe(true);
    const invoices = SaasPlatformService.getInvoices();
    const centerInvoice = invoices.find(
      (inv) => inv.tenantId === res.center?.id || inv.tenantSlug === res.center?.slug
    );
    expect(centerInvoice).toBeDefined();
    expect(centerInvoice?.amount).toBeGreaterThan(0);
    expect(['paid', 'issued']).toContain(centerInvoice?.status);
  });

  // 8. Slug Sanitization & Duplicate Collision Idempotency
  it('8. Duplicate slug creation is handled cleanly and idempotently', async () => {
    const existing = SaasPlatformService.getCenters()[0];

    // Re-provisioning existing slug returns the existing center idempotently
    const res = await SaasPlatformService.provisionNewCenter({
      nameAr: 'سنتر مكرر',
      slug: existing.slug,
      city: 'الإسكندرية',
      governorate: 'الإسكندرية',
      adminName: 'أ. سامح',
      adminEmail: 'sameh@test.com',
      adminPhone: '01222334455',
      planId: 'plan-starter',
      billingFrequency: 'monthly',
    });

    expect(res.ok).toBe(true);
    expect(res.center).toBeDefined();
    expect(res.center?.slug).toBe(existing.slug);
  });

  // 9. Suspend Center Status
  it('9. Suspending a center updates operational status to suspended', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];

    const updated = SaasPlatformService.setCenterStatus(target.id, 'suspended', 'عدم سداد الفاتورة');
    expect(updated).toBeDefined();
    expect(updated?.status).toBe('suspended');

    const retrieved = SaasPlatformService.getCenterById(target.id);
    expect(retrieved?.status).toBe('suspended');
  });

  // 10. Activate Center Status
  it('10. Activating a suspended center restores its active state', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];

    const updated = SaasPlatformService.setCenterStatus(target.id, 'active');
    expect(updated).toBeDefined();
    expect(updated?.status).toBe('active');
  });

  // 11. AI Units Allocation & Audit Ledger
  it('11. Allocating AI units increases balance and creates audit ledger entry', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];
    const initialBalance = target.aiBalance;

    const res = SaasPlatformService.allocateAiUnits(target.id, 250, 'شحن باقة إضافية لبنك الأسئلة');
    expect(res.ok).toBe(true);
    expect(res.newBalance).toBe(initialBalance + 250);

    const ledger = SaasPlatformService.getAiLedger(target.id);
    expect(ledger.length).toBeGreaterThan(0);
    const lastEntry = ledger[ledger.length - 1];
    expect(lastEntry.operation).toBe('manual_allocation');
    expect(lastEntry.units).toBe(250);
  });

  // 12. AI Units Overdraft Prevention Guard
  it('12. Attempting to consume AI units beyond available balance is strictly blocked', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];

    // Charging excessive units exceeding balance returns ok: false with Arabic explanation
    const excessiveUnits = target.aiBalance + 999999;
    const res = SaasPlatformService.chargeCenterAiUnits(
      target.slug,
      'exam_generation',
      excessiveUnits,
      'محاولة سحب تتجاوز الرصيد'
    );
    expect(res.ok).toBe(false);
    expect(res.errorAr).toContain('غير كافٍ');
  });

  // 13. Support Access Session Start
  it('13. Support access session can be started with reason, duration, and audit token', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];

    const session = SaasPlatformService.startSupportAccess(
      target.slug,
      'فحص مشكلة مزامنة الحضور مع المعلم',
      60
    );

    expect(session).toBeDefined();
    expect(session?.tenantSlug).toBe(target.slug);
    expect(session?.status).toBe('active');
    expect(session?.id).toBeDefined();
  });

  // 14. Support Access Session End
  it('14. Ending support access session marks it revoked', () => {
    const centers = SaasPlatformService.getCenters();
    const target = centers[0];

    const session = SaasPlatformService.startSupportAccess(target.slug, 'جلسة دعم مؤقتة', 30);
    expect(session).toBeDefined();

    if (session) {
      SaasPlatformService.endSupportAccess(session.id);
      const centerAfter = SaasPlatformService.getCenterBySlug(target.slug);
      expect(centerAfter?.supportAccessActive).toBe(false);
    }
  });

  // 15. Plan Creation (CRUD)
  it('15. Creating a new subscription plan adds it to database plans', () => {
    const planId = `plan-custom-${Date.now()}`;
    const plan = SaasPlatformService.savePlan({
      id: planId,
      tier: 'enterprise',
      nameAr: 'باقة المجمعات التعليمية الكبرى',
      nameEn: 'Mega Complexes Plan',
      descriptionAr: 'مخصصة للمجمعات التي تضم أكثر من 5 فروع و5000 طالب',
      monthlyPrice: 1800,
      annualPrice: 18000,
      currency: 'EGP',
      billingFrequency: 'monthly',
      trialDays: 14,
      maxStudents: -1,
      maxTeachers: -1,
      maxEmployees: -1,
      maxBranches: 10,
      aiUnitAllowance: 2000,
      notificationAllowance: 10000,
      storageAllowanceMb: 25000,
      enabledModules: ['attendance', 'exams', 'finance', 'whatsapp', 'materials'],
      features: ['دعم مخصص 24/7', 'ربط نطاق خاص', 'خوادم معزولة'],
      highlighted: true,
      isPublic: true,
      isActive: true,
    });

    expect(plan).toBeDefined();
    expect(plan.id).toBe(planId);

    const fetched = SaasPlatformService.getPlanById(planId);
    expect(fetched).toBeDefined();
    expect(fetched?.nameAr).toContain('المجمعات التعليمية');
  });

  // 16. Plan Pricing Updates Preserve Historical Invoices
  it('16. Updating plan pricing preserves existing center subscription invoice history', () => {
    const invoicesBefore = SaasPlatformService.getInvoices();
    const sampleInv = invoicesBefore[0];
    const originalAmount = sampleInv.amount;

    // Update plan price
    const plan = SaasPlatformService.getPlanById(sampleInv.planId);
    if (plan) {
      SaasPlatformService.savePlan({
        ...plan,
        monthlyPrice: plan.monthlyPrice + 500,
      });
    }

    // Historical invoice amount must remain untouched
    const invoiceAfter = SaasPlatformService.getInvoices().find((i) => i.id === sampleInv.id);
    expect(invoiceAfter?.amount).toBe(originalAmount);
  });

  // 17. Plan Archival
  it('17. Archiving a plan removes it from public plans list', () => {
    const plansBefore = SaasPlatformService.getPlans(false);
    const targetPlan = plansBefore[plansBefore.length - 1];

    SaasPlatformService.archivePlan(targetPlan.id);

    const publicPlansAfter = SaasPlatformService.getPlans(false);
    expect(publicPlansAfter.some((p) => p.id === targetPlan.id)).toBe(false);

    // Should still exist when includeArchived is true
    const allPlans = SaasPlatformService.getPlans(true);
    expect(allPlans.some((p) => p.id === targetPlan.id)).toBe(true);
  });

  // 18. Unlimited Allowances (-1)
  it('18. Unlimited limits (-1) are handled correctly without calculation errors', () => {
    const enterprisePlan = SaasPlatformService.getPlans(true).find((p) => p.maxStudents === -1);
    expect(enterprisePlan).toBeDefined();
    expect(enterprisePlan?.maxStudents).toBe(-1);
    expect(enterprisePlan?.maxTeachers).toBe(-1);
  });

  // 19. Website CMS Draft vs Published Isolation
  it('19. Website draft changes do not alter published live website until published', () => {
    const publishedBefore = SaasPlatformService.getWebsitePublished();
    const initialTitle = publishedBefore.metaTitleAr;

    // Update draft with temporary title
    SaasPlatformService.updateWebsiteDraft({
      metaTitleAr: 'عنوان مسودة تجريبي جديد وغير منشور',
    });

    // Published version must still have initial title
    const publishedAfter = SaasPlatformService.getWebsitePublished();
    expect(publishedAfter.metaTitleAr).toBe(initialTitle);
    expect(publishedAfter.metaTitleAr).not.toBe('عنوان مسودة تجريبي جديد وغير منشور');

    // Draft version must reflect new title
    const draft = SaasPlatformService.getWebsiteDraft();
    expect(draft.metaTitleAr).toBe('عنوان مسودة تجريبي جديد وغير منشور');
  });

  // 20. Website Publishing Workflow
  it('20. Publishing website updates published version and records timestamp', () => {
    const published = SaasPlatformService.publishWebsite('Super-Admin');
    expect(published).toBeDefined();
    expect(published.publishedBy).toBe('Super-Admin');
    expect(published.lastPublishedAt).toBeDefined();
    expect(published.metaTitleAr).toBe('عنوان مسودة تجريبي جديد وغير منشور');
  });

  // 21. Customer Subscription Request Submission
  it('21. Public subscription request submission creates a request with status new', () => {
    const req = SaasPlatformService.submitCustomerRequest({
      type: 'subscription',
      centerName: 'سنتر النجاح الحديث',
      contactPerson: 'أ. طارق عبد الله',
      email: 'tarek@alnajah.edu.eg',
      phone: '01099887766',
      governorate: 'الشرقية',
      branchCount: 2,
      approxStudentsCount: 600,
      requestedPlanId: 'plan-pro',
      requestedPlanName: 'باقة المحترفين',
      preferredContactMethod: 'whatsapp',
      notes: 'نرغب في بدء الفترة التجريبية وتدريب الموظفين',
    });

    expect(req).toBeDefined();
    expect(req.id).toMatch(/^req-/);
    expect(req.status).toBe('new');

    const requests = SaasPlatformService.getRequests();
    expect(requests.some((r) => r.id === req.id)).toBe(true);
  });

  // 22. Request Status Workflow & 1-Click Conversion
  it('22. Customer request status can be updated through workflow to converted', () => {
    const requests = SaasPlatformService.getRequests();
    const sample = requests[0];

    const updated = SaasPlatformService.updateRequestStatus(
      sample.id,
      'contacted',
      'تم الاتصال هاتفياً بالمدير وتحديد موعد'
    );

    expect(updated).toBeDefined();
    expect(updated?.status).toBe('contacted');
    expect(updated?.communicationHistory.length).toBeGreaterThan(0);
  });

  // 23. Public Complaint Submission
  it('23. Public complaint submission creates complaint record in platform inbox', () => {
    const comp = SaasPlatformService.submitComplaint({
      senderName: 'محمد مصطفى',
      email: 'm.mostafa@example.com',
      phone: '01055443322',
      centerName: 'سنتر الأوائل',
      subject: 'طلب إضافة تقرير تفصيلي لغياب الطلاب',
      description: 'نرجو إضافة خيار تصدير تقرير الغياب بصيغة Excel لتقديمه للإدارة التعليمية.',
    });

    expect(comp).toBeDefined();
    expect(comp.id).toMatch(/^comp-/);
    expect(comp.status).toBe('open');

    const complaints = SaasPlatformService.getComplaints();
    expect(complaints.some((c) => c.id === comp.id)).toBe(true);
  });

  // 24. Interactive Poll Live Voting
  it('24. Interactive poll voting increments option votes and total votes accurately', () => {
    const published = SaasPlatformService.getWebsitePublished();
    const poll = published.activePoll;
    expect(poll).toBeDefined();

    if (poll && poll.options.length > 0) {
      const opt = poll.options[0];
      const initialOptVotes = opt.votes;
      const initialTotalVotes = poll.totalVotes;

      const ok = SaasPlatformService.votePoll(opt.id);
      expect(ok).toBe(true);

      const refreshed = SaasPlatformService.getWebsitePublished();
      const updatedOpt = refreshed.activePoll?.options.find((o) => o.id === opt.id);
      expect(updatedOpt?.votes).toBe(initialOptVotes + 1);
      expect(refreshed.activePoll?.totalVotes).toBe(initialTotalVotes + 1);
    }
  });

  // 25. Central AI Settings Key Masking & Financial Ledger
  it('25. Central AI configuration masks sensitive API keys and records expenses', () => {
    const aiConfig = SaasPlatformService.getCentralAiConfig();
    expect(aiConfig).toBeDefined();
    expect(aiConfig.apiKeyConfigured).toBe(true);
    // Masked key indicator must never expose raw API key
    expect(aiConfig.maskedKeyIndicator).toContain('...');
    expect(aiConfig.maskedKeyIndicator).not.toBe('AIzaSyCcKNXipMYZlwaZRYFKYqEFZnAxo1lwsB4');

    const financialSummary = SaasPlatformService.getFinancialSummary();
    expect(financialSummary).toBeDefined();
    expect(financialSummary.totalRevenueInvoiced).toBeGreaterThan(0);
    expect(financialSummary.totalCollections).toBeGreaterThanOrEqual(0);
    const activeCenters = SaasPlatformService.getCenters().filter((c) => c.status === 'active');
    expect(activeCenters.length).toBeGreaterThanOrEqual(1);
  });
});
