/**
 * Yalla Center - SaaS Platform Core Service
 * Path: lib/saas/service.ts
 *
 * Implements centralized state and business logic for:
 * - Center Directory & 6-step Idempotent Center Provisioning Wizard
 * - Subscription Plans CRUD & Pricing
 * - Website Builder (Draft vs Published versioning & CMS)
 * - Public Inquiries, Requests, Complaints & Polls
 * - Central AI Quotas, Masked Secrets & Transactional Ledger
 * - Platform Owner Finance (Revenue, Collections, Expenses, Statements)
 * - Owner Calendar & Appointments
 * - Support Access Audit Logs
 */

import {
  AiUsageLedgerEntry,
  BillingFrequency,
  CenterAccountSummaryRow,
  CenterExtended,
  CenterFinancialMovement,
  CenterFinancialMovementType,
  CenterStatus,
  CentralAiConfig,
  ComplaintRecord,
  ContactMessage,
  CustomerRequest,
  DynamicExpenseCategory,
  OwnerAppointment,
  OwnerAuditLog,
  OwnerExpense,
  OwnerExpenseRecurrence,
  OwnerInvoice,
  OwnerPayment,
  OwnerPaymentMethod,
  PaymentStatus,
  PlatformCommunicationSettings,
  SubscriptionPlan,
  SupportAccessSession,
  WebsiteConfig,
} from './types';

// ============================================================================
// INITIAL SEED DATA
// ============================================================================

export const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    tier: 'starter',
    nameAr: 'باقة البداية (Starter)',
    nameEn: 'Starter Plan',
    descriptionAr: 'مثالية للسناتر الناشئة والمراكز التعليمية الفردية التي تبدأ رحلتها الرقمية.',
    monthlyPrice: 1500,
    annualPrice: 15000,
    currency: 'EGP',
    billingFrequency: 'monthly',
    trialDays: 14,
    maxStudents: 200,
    maxTeachers: 10,
    maxEmployees: 3,
    maxBranches: 1,
    aiUnitAllowance: 50,
    notificationAllowance: 500,
    storageAllowanceMb: 2048,
    enabledModules: ['attendance', 'reception', 'groups', 'finance_basic'],
    features: [
      'حتى 200 طالب مسجل',
      'فرع تشغيلي واحد',
      'حضور سريع بالباركود والليزر',
      'حسابات المجموعات والتحصيل الأساسي',
      'طباعة الإيصالات وبطاقات الطلاب',
    ],
    highlighted: false,
    isPublic: true,
    displayOrder: 1,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  {
    id: 'plan-pro',
    tier: 'pro',
    nameAr: 'باقة المحترفين (Pro)',
    nameEn: 'Professional Plan',
    descriptionAr: 'الباقة الأكثر طلباً للسناتر المتوسطة والكبرى مع دعم واتساب الذكي وامتحانات الـ AI.',
    monthlyPrice: 3500,
    annualPrice: 35000,
    currency: 'EGP',
    billingFrequency: 'monthly',
    trialDays: 14,
    maxStudents: 1000,
    maxTeachers: 40,
    maxEmployees: 12,
    maxBranches: 3,
    aiUnitAllowance: 250,
    notificationAllowance: 2500,
    storageAllowanceMb: 10240,
    enabledModules: [
      'attendance',
      'reception',
      'groups',
      'exams',
      'ai_exams',
      'finance',
      'materials',
      'whatsapp',
      'parent_portal',
      'student_portal',
    ],
    features: [
      'حتى 1,000 طالب مسجل',
      'حتى 3 فروع تشغيلية',
      'تكامل واتساب السحابي التلقائي',
      'توليد وتصحيح الامتحانات بالذكاء الاصطناعي',
      'حسابات المعلمين المزدوجة (سنتر وبرايفت)',
      'بوابة مخصصة لأولياء الأمور والطلاب',
    ],
    highlighted: true,
    isPublic: true,
    displayOrder: 2,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  {
    id: 'plan-enterprise',
    tier: 'enterprise',
    nameAr: 'باقة المؤسسات (Enterprise)',
    nameEn: 'Enterprise Plan',
    descriptionAr: 'حلول غير محدودة وشاملة للمجمعات التعليمية وسلاسل المراكز ذات الفروع المتعددة.',
    monthlyPrice: 7500,
    annualPrice: 75000,
    currency: 'EGP',
    billingFrequency: 'monthly',
    trialDays: 30,
    maxStudents: -1,
    maxTeachers: -1,
    maxEmployees: -1,
    maxBranches: -1,
    aiUnitAllowance: 1000,
    notificationAllowance: 10000,
    storageAllowanceMb: 51200,
    enabledModules: [
      'attendance',
      'reception',
      'groups',
      'exams',
      'ai_exams',
      'finance',
      'materials',
      'whatsapp',
      'parent_portal',
      'student_portal',
      'custom_domain',
      'vip_support',
    ],
    features: [
      'عدد طلاب ومعلمين غير محدود',
      'فروع ومقرات غير محدودة',
      'استضافة وقاعدة بيانات سحابية معزولة تماماً',
      'تخصيص الهوية والشعار والرابط الخاص',
      'دعم فني خاص ومدير حساب مخصص 24/7',
      'رصيد AI موسع وربط مباشر مع Meta Cloud API',
    ],
    highlighted: false,
    isPublic: true,
    displayOrder: 3,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
];

export const INITIAL_COMMUNICATION_SETTINGS: PlatformCommunicationSettings = {
  primaryPhone: '+20 100 888 9999',
  additionalPhones: ['+20 102 777 6666', '+20 114 555 4444'],
  whatsappNumber: '+201008889999',
  supportEmail: 'support@yallacenter.com',
  subscriptionNotificationEmail: 'sales@yallacenter.com',
  complaintsNotificationEmail: 'quality@yallacenter.com',
  businessHoursAr: 'السبت إلى الخميس: 9:00 ص – 10:00 م بتوقيت القاهرة',
  facebookUrl: 'https://facebook.com/yallacenter',
  instagramUrl: 'https://instagram.com/yallacenter',
  youtubeUrl: 'https://youtube.com/@yallacenter',
  companyNameAr: 'يلا سنتر — Yalla Codex Software Solutions',
  addressAr: 'مدينة نصر، القاهرة، جمهورية مصر العربية',
};

export const INITIAL_AI_CONFIG: CentralAiConfig = {
  provider: 'google_gemini',
  model: 'gemini-1.5-pro-latest',
  apiKeyConfigured: true,
  maskedKeyIndicator: 'AIzaSyCcKNX...EFZnAxo',
  isEnabled: true,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.2,
  perFeatureAvailability: {
    aiExams: true,
    documentIndexing: true,
    autoGrading: true,
  },
  costPerOperation: {
    aiExamGeneration: 5, // 5 units per exam generated
    documentProcessing: 2, // 2 units per document parsed
    questionAutoGrade: 1, // 1 unit per essay question evaluated
  },
  lastTestedAt: '2026-11-16T10:00:00.000Z',
  testStatus: 'success',
};

export const INITIAL_CENTERS: CenterExtended[] = [
  {
    id: 'tenant-maher-001',
    slug: 'al-maher',
    nameAr: 'سنتر الماهر النموذجي',
    nameEn: 'Al-Maher Educational Center',
    logoUrl: '',
    phone: '+20 100 123 4567',
    address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
    email: 'contact@almaher.edu.eg',
    adminName: 'أ. محمود التهامي',
    adminEmail: 'admin@almaher.edu.eg',
    adminPhone: '+20 100 123 4567',
    adminUsername: 'maher_admin',
    subscriptionPlanId: 'plan-pro',
    planNameAr: 'باقة المحترفين (Pro)',
    subscriptionStartDate: '2026-09-01T00:00:00.000Z',
    subscriptionEndDate: '2027-08-31T23:59:59.000Z',
    billingAmount: 3500,
    billingFrequency: 'monthly',
    paymentStatus: 'paid',
    branchesCount: 2,
    studentsCount: 850,
    teachersCount: 18,
    employeesCount: 6,
    maxBranches: 3,
    maxStudents: 1000,
    maxTeachers: 40,
    maxEmployees: 12,
    aiBalance: 180,
    aiUsageTotal: 70,
    aiEnabled: true,
    status: 'active',
    enabledModules: [
      'attendance',
      'reception',
      'groups',
      'exams',
      'ai_exams',
      'finance',
      'materials',
      'whatsapp',
      'parent_portal',
      'student_portal',
    ],
    showInPublicDirectory: true,
    notes: 'السنتر النموذجي الرئيسي المعتمد لمنصة يلا سنتر.',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  {
    id: 'tenant-rowad-002',
    slug: 'al-rowad',
    nameAr: 'سنتر الرواد التعليمي',
    nameEn: 'Al-Rowad Educational Center',
    logoUrl: '',
    phone: '+20 111 234 5678',
    address: 'شارع التحرير، الدقي، الجيزة',
    email: 'info@alrowad.edu.eg',
    adminName: 'م. طارق الخولي',
    adminEmail: 'admin@alrowad.edu.eg',
    adminPhone: '+20 111 234 5678',
    adminUsername: 'rowad_admin',
    subscriptionPlanId: 'plan-enterprise',
    planNameAr: 'باقة المؤسسات (Enterprise)',
    subscriptionStartDate: '2026-09-15T00:00:00.000Z',
    subscriptionEndDate: '2027-09-14T23:59:59.000Z',
    billingAmount: 7500,
    billingFrequency: 'monthly',
    paymentStatus: 'paid',
    branchesCount: 3,
    studentsCount: 600,
    teachersCount: 25,
    employeesCount: 10,
    maxBranches: -1,
    maxStudents: -1,
    maxTeachers: -1,
    maxEmployees: -1,
    aiBalance: 820,
    aiUsageTotal: 180,
    aiEnabled: true,
    status: 'active',
    enabledModules: [
      'attendance',
      'reception',
      'groups',
      'exams',
      'ai_exams',
      'finance',
      'materials',
      'whatsapp',
      'parent_portal',
      'student_portal',
      'vip_support',
    ],
    showInPublicDirectory: true,
    notes: 'مركز متميز للغات والشهادات الثانوية الدولية والعامة.',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  },
  {
    id: 'tenant-future-003',
    slug: 'al-mustaqbal',
    nameAr: 'أكاديمية المستقبل التعليمية',
    nameEn: 'Al-Mustaqbal Academy',
    logoUrl: '',
    phone: '+20 122 345 6789',
    address: 'حي الجامعة، المنصورة، الدقهلية',
    email: 'admin@mustaqbal.edu.eg',
    adminName: 'د. سامح فريد',
    adminEmail: 'samih@mustaqbal.edu.eg',
    adminPhone: '+20 122 345 6789',
    adminUsername: 'mustaqbal_samih',
    subscriptionPlanId: 'plan-starter',
    planNameAr: 'باقة البداية (Starter)',
    subscriptionStartDate: '2026-11-01T00:00:00.000Z',
    subscriptionEndDate: '2026-11-15T23:59:59.000Z',
    billingAmount: 1500,
    billingFrequency: 'monthly',
    paymentStatus: 'overdue',
    branchesCount: 1,
    studentsCount: 180,
    teachersCount: 8,
    employeesCount: 2,
    maxBranches: 1,
    maxStudents: 200,
    maxTeachers: 10,
    maxEmployees: 3,
    aiBalance: 12,
    aiUsageTotal: 38,
    aiEnabled: true,
    status: 'trial',
    enabledModules: ['attendance', 'reception', 'groups', 'finance_basic'],
    showInPublicDirectory: false,
    notes: 'فترة تجريبية منتهية بانتظار التجديد.',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  },
];

export const INITIAL_WEBSITE_CONFIG: WebsiteConfig = {
  version: 1,
  metaTitleAr: 'يلا سنتر — المنصة السحابية المتكاملة لإدارة المراكز والسناتر التعليمية',
  metaDescriptionAr:
    'نظام SaaS ذكي لإدارة شؤون الطلاب، الحضور الفوري بالباركود، حسابات المعلمين المزدوجة، وبنك الامتحانات المدعوم بالذكاء الاصطناعي.',
  announcementBar: {
    enabled: true,
    badgeAr: 'جديد المنصة',
    textAr: 'انطلاق النسخة السحابية المحدثة مع دعم بنك الامتحانات بالذكاء الاصطناعي وتكامل واتساب الرسمي!',
    link: '#plans',
  },
  specialOffer: {
    enabled: true,
    titleAr: 'عرض الموسم الدراسي الجديد',
    discountAr: 'خصم 20% عند الاشتراك السنوي',
    descriptionAr: 'احصل على شهرين مجاناً بالإضافة إلى رصيد 500 وحدة مجانية في بنك الأسئلة والذكاء الاصطناعي.',
    startDate: '2026-11-01',
    endDate: '2026-12-31',
    ctaLabelAr: 'احجز عرضك الآن',
    ctaLink: '#subscription-request',
  },
  sections: [
    {
      id: 'hero',
      titleAr: 'المنصة السحابية الأكثر تطوراً لإدارة السناتر التعليمية في مصر والشرق الأوسط',
      subtitleAr:
        'تحكم كامل في الحضور الفوري، حسابات المجموعات والمعلمين بنظامي السنتر والبرايفت، بنك الامتحانات الذكي، وبوابات مستقلة لجميع أطراف العملية التعليمية.',
      badgeAr: 'SaaS تعليمي متكامل 100%',
      enabled: true,
      order: 1,
      ctaLabelAr: 'ابدأ تجربتك المجانية',
      ctaLink: '#subscription-request',
    },
    {
      id: 'features',
      titleAr: 'كل ما تحتاجه لإدارة سنترك بكفاءة واحترافية مطلقة',
      subtitleAr: 'أدوات رقمية متقدمة مصممة خصيصاً لتلائم طبيعة المراكز التعليمية العربية.',
      enabled: true,
      order: 2,
    },
    {
      id: 'showcase',
      titleAr: 'واجهات عصرية فائقة السرعة والاستجابة',
      subtitleAr: 'شاشات استقبال سريعة تعمل بأقل من 300 مللي ثانية مع دعم قارئات الباركود الليزرية.',
      enabled: true,
      order: 3,
    },
    {
      id: 'plans',
      titleAr: 'باقات اشتراك مرنة تناسب حجم سنترك وطموحك',
      subtitleAr: 'لا مصاريف خفية، إمكانية الترقية أو التخصيص في أي وقت مع ضمان أعلى معايير الأمان وعزل البيانات.',
      enabled: true,
      order: 4,
    },
    {
      id: 'partners',
      titleAr: 'موثوق به من قِبل كبرى السناتر والمراكز التعليمية',
      subtitleAr: 'انضم إلى مئات المراكز التعليمية التي تعتمد على يلا سنتر يومياً لإدارة آلاف الطلاب.',
      enabled: true,
      order: 5,
    },
    {
      id: 'testimonials',
      titleAr: 'ماذا يقول مدراء السناتر والمعلمون عن يلا سنتر؟',
      subtitleAr: 'قصص نجاح واقعية من مراكز تعليمية اعتمدت على المنصة في إدارة عملياتها اليومية.',
      enabled: true,
      order: 6,
    },
    {
      id: 'polls',
      titleAr: 'شاركنا رأيك في ميزات التطوير القادمة',
      subtitleAr: 'صوتك يوجه مهندسينا لإضافة الميزات الأكثر فائدة لسنترك التعليمي.',
      enabled: true,
      order: 7,
    },
    {
      id: 'faq',
      titleAr: 'الأسئلة الأكثر تداولاً',
      subtitleAr: 'إجابات وافية وشاملة عن كل ما يخص الاشتراك والربط التقني والأمان.',
      enabled: true,
      order: 8,
    },
    {
      id: 'subscription_form',
      titleAr: 'انضم إلى نخبة السناتر التعليمية اليوم',
      subtitleAr: 'املأ النموذج وسيقوم فريق الخبراء بالتواصل معك وتفعيل بيئة العمل الخاصة بسنترك فوراً.',
      enabled: true,
      order: 9,
    },
  ],
  testimonials: [
    {
      id: 'test-1',
      name: 'أ. محمود التهامي',
      role: 'مدير السنتر',
      centerName: 'سنتر الماهر النموذجي',
      quote:
        'يلا سنتر حوّل كابوس حضور 850 طالب وحسابات المعلمين المعقدة بنظامي السنتر والبرايفت إلى ضغطة زر دقيقة 100%. الدقة والسرعة لا تُقارن بأي نظام قديم.',
      rating: 5,
    },
    {
      id: 'test-2',
      name: 'م. طارق الخولي',
      role: 'المشرف العام',
      centerName: 'سنتر الرواد التعليمي',
      quote:
        'توليد اختبارات الحصص بالذكاء الاصطناعي وبوابة ولي الأمر المباشرة رفعت ثقة أولياء الأمور وزادت من التزام الطلاب بنسبة غير مسبوقة.',
      rating: 5,
    },
    {
      id: 'test-3',
      name: 'أستاذ أحمد عبد العزيز',
      role: 'خبير الرياضيات للثانوية العامة',
      centerName: 'معلم معتمد',
      quote:
        'شفافية الحسابات المالية الموحدة بين الحصص وشؤون المعلمين منحتني راحة بال تامة لمتابعة مادتي التعليمية وأوراق التدريب.',
      rating: 5,
    },
  ],
  faqs: [
    {
      id: 'faq-1',
      question: 'هل يمكن تجربة المنصة مجاناً قبل الاشتراك؟',
      answer:
        'نعم، توفر منصة يلا سنتر فترة تجريبية مجانية كاملة الميزات لمدة 14 يوماً مع دعم فني متكامل وتهيئة لكافة بيانات سنترك الأساسية.',
      order: 1,
    },
    {
      id: 'faq-2',
      question: 'هل بيانات سنترك ومعلميك وطلابك معزولة بأمان؟',
      answer:
        'بكل تأكيد. تعتمد منصة يلا سنتر بنية سحابية متعددة المنشآت (Multi-Tenant Architecture) بحيث تمتلك كل منشأة نطاق بيانات معزول تماماً ومحمي بقواعد حماية صارمة تمنع أي وصول خارجي.',
      order: 2,
    },
    {
      id: 'faq-3',
      question: 'هل يدعم النظام قارئات الباركود الليزرية وبوابات الحضور الفوري؟',
      answer:
        'نعم، واجهة الاستقبال تدعم جميع أجهزة القراءة السلكية واللاسلكية (USB/Bluetooth HID)، بالإضافة إلى كاميرات الهواتف والأجهزة اللوحية، وتعمل باستجابة لحظية في أقل من 50 مللي ثانية.',
      order: 3,
    },
    {
      id: 'faq-4',
      question: 'كيف تتم محاسبة المعلمين بنظامي السنتر والبرايفت؟',
      answer:
        'المنصة تضم محركاً مالياً موحداً يتيح تخصيص اتفاقية مالية مستقلة لكل مجموعة: نظام متوسط حضور الطلاب، نسبة السنتر مقابل نسبة المعلم، أو أجر الحصة الثابت، مع احتساب الإعفاءات ومنع تسرب الفروق المئوية 0.00 ج.م.',
      order: 4,
    },
    {
      id: 'faq-5',
      question: 'ما هي وحدات الذكاء الاصطناعي (AI Units) وكيف تُحسب؟',
      answer:
        'كل باقة تتضمن رصيداً شهرياً من وحدات الـ AI يُستخدم لإنشاء اختبارات نموذجية وفق المناهج التعليمية وتصحيح المقالات آلياً. يمكن لمالك المنصة إضافة وحدات إضافية لأي سنتر في أي وقت.',
      order: 5,
    },
  ],
  activePoll: {
    id: 'poll-q4-2026',
    questionAr: 'ما هي الميزة الأكثر طلباً التي ترغب في توفيرها لسنترك في التحديث القادم؟',
    options: [
      { id: 'opt-app', textAr: 'تطبيق هاتف مخصص للهواتف الذكية (iOS & Android)', votes: 142 },
      { id: 'opt-live', textAr: 'بث الحصص أونلاين عبر المنصة (Live Streaming)', votes: 98 },
      { id: 'opt-smart-pos', textAr: 'أجهزة دفع نقاط البيع الفورية (POS) في الاستقبال', votes: 115 },
      { id: 'opt-ai-chat', textAr: 'مساعد ذكاء اصطناعي تفاعلي يجيب عن أسئلة الطلاب', votes: 83 },
    ],
    isActive: true,
    totalVotes: 438,
  },
  lastPublishedAt: '2026-11-15T00:00:00.000Z',
  publishedBy: 'owner@yallacenter.com',
};

export const INITIAL_REQUESTS: CustomerRequest[] = [
  {
    id: 'req-001',
    type: 'subscription',
    centerName: 'أكاديمية النور التعليمية',
    contactPerson: 'أ. حسام الدين عبد الباقي',
    email: 'hossam@alnoor-center.com',
    phone: '+20 101 999 8881',
    governorate: 'الإسكندرية',
    address: 'شارع جمال عبد الناصر، ميامي',
    approxStudentsCount: 450,
    branchCount: 2,
    requestedPlanId: 'plan-pro',
    requestedPlanName: 'باقة المحترفين (Pro)',
    preferredContactMethod: 'whatsapp',
    notes: 'نرغب في تفعيل الحضور بالباركود وإرسال إشعارات أولياء الأمور عبر الواتساب فوراً.',
    status: 'new',
    internalNotes: ['تمت مراجعة الطلب أولياً - مؤهل للباقة الاحترافية'],
    communicationHistory: [
      {
        date: '2026-11-15T10:00:00.000Z',
        author: 'فريق المبيعات',
        note: 'تم استلام الطلب من خلال الموقع العام',
        channel: 'website_form',
      },
    ],
    createdAt: '2026-11-15T09:30:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
  },
  {
    id: 'req-002',
    type: 'demo',
    centerName: 'سنتر الفرسان للغات',
    contactPerson: 'د. منى سراج',
    email: 'serag@forsan.edu.eg',
    phone: '+20 120 777 6655',
    governorate: 'القاهرة',
    address: 'التجمع الخامس، القاهرة الجديدة',
    approxStudentsCount: 700,
    branchCount: 1,
    requestedPlanId: 'plan-pro',
    requestedPlanName: 'باقة المحترفين (Pro)',
    preferredContactMethod: 'phone',
    notes: 'نرغب في جلسة عرض حي (Demo) يوم الخميس القادم لمراجعة بنك الأسئلة والذكاء الاصطناعي.',
    status: 'demo_scheduled',
    scheduledDemoAt: '2026-11-19T14:00:00',
    internalNotes: ['تم حجز جلسة زووم يوم 19 نوفمبر'],
    communicationHistory: [
      {
        date: '2026-11-14T11:00:00.000Z',
        author: 'فريق الدعم',
        note: 'تم الاتصال بالعميل وتأكيد ميعاد الديمو',
        channel: 'phone',
      },
    ],
    createdAt: '2026-11-14T08:15:00.000Z',
    updatedAt: '2026-11-14T11:00:00.000Z',
  },
];

export const INITIAL_COMPLAINTS: ComplaintRecord[] = [
  {
    id: 'comp-001',
    senderName: 'أ. طارق عبد المحسن',
    email: 'tarek@example.com',
    phone: '+20 106 333 2211',
    centerName: 'سنتر الماهر النموذجي',
    subject: 'تأخر استلام إشعار الواتساب في أحد أيام السبت',
    description: 'يوم السبت الماضي تأخر وصول رسالة الحضور لولي الأمر نحو 15 دقيقة، نرجو المتابعة مع مزود الخدمة.',
    priority: 'normal',
    status: 'investigating',
    adminNotes: ['تم فحص طابور الإشعارات السحابية وتبين وجود ضغط مؤقت في Meta Cloud API.'],
    createdAt: '2026-11-15T14:20:00.000Z',
  },
];

export const INITIAL_INVOICES: OwnerInvoice[] = [
  {
    id: 'inv-2026-001',
    invoiceNumber: 'INV-YC-2026-001',
    tenantId: 'tenant-maher-001',
    tenantNameAr: 'سنتر الماهر النموذجي',
    tenantSlug: 'al-maher',
    planId: 'plan-pro',
    planNameAr: 'باقة المحترفين (Pro)',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    amount: 3500,
    discount: 0,
    totalDue: 3500,
    amountPaid: 3500,
    status: 'paid',
    issuedAt: '2026-11-01T00:00:00.000Z',
    dueDate: '2026-11-07',
    paidAt: '2026-11-03T11:30:00.000Z',
    notes: 'تم السداد عبر تحويل فودافون كاش كود 88291.',
  },
  {
    id: 'inv-2026-002',
    invoiceNumber: 'INV-YC-2026-002',
    tenantId: 'tenant-rowad-002',
    tenantNameAr: 'سنتر الرواد التعليمي',
    tenantSlug: 'al-rowad',
    planId: 'plan-enterprise',
    planNameAr: 'باقة المؤسسات (Enterprise)',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    amount: 7500,
    discount: 500,
    totalDue: 7000,
    amountPaid: 7000,
    status: 'paid',
    issuedAt: '2026-11-01T00:00:00.000Z',
    dueDate: '2026-11-07',
    paidAt: '2026-11-05T15:00:00.000Z',
    notes: 'اشتراك شهري مخصص مع خصم ولاء السنتر.',
  },
  {
    id: 'inv-2026-003',
    invoiceNumber: 'INV-YC-2026-003',
    tenantId: 'tenant-future-003',
    tenantNameAr: 'أكاديمية المستقبل التعليمية',
    tenantSlug: 'al-mustaqbal',
    planId: 'plan-starter',
    planNameAr: 'باقة البداية (Starter)',
    periodStart: '2026-11-16',
    periodEnd: '2026-12-15',
    amount: 1500,
    discount: 0,
    totalDue: 1500,
    amountPaid: 0,
    status: 'overdue',
    issuedAt: '2026-11-15T00:00:00.000Z',
    dueDate: '2026-11-16',
    notes: 'فاتورة تفعيل الاشتراك بعد انتهاء التجربة.',
  },
];

export const INITIAL_EXPENSES: OwnerExpense[] = [
  {
    id: 'exp-001',
    category: 'hosting',
    titleAr: 'خوادم Cloudflare Workers & KV Storage الشهرية',
    amount: 1250,
    date: '2026-11-01',
    paidTo: 'Cloudflare Inc.',
    notes: 'رسوم الخطة السحابية والشبكة العازلة CDN',
  },
  {
    id: 'exp-002',
    category: 'ai_services',
    titleAr: 'حساب استهلاك Google Gemini API (نوفمبر)',
    amount: 850,
    date: '2026-11-05',
    paidTo: 'Google Cloud Platform',
    notes: 'توليد الاختبارات وفهرسة المذكرات',
  },
  {
    id: 'exp-003',
    category: 'sms_whatsapp',
    titleAr: 'رصيد رسائل Meta WhatsApp Cloud API',
    amount: 2100,
    date: '2026-11-08',
    paidTo: 'Meta Platforms Ireland',
    notes: 'إشعارات حضور الطلاب التلقائية للسناتر',
  },
];

export const INITIAL_APPOINTMENTS: OwnerAppointment[] = [
  {
    id: 'apt-001',
    titleAr: 'جلسة ديمو سنتر الفرسان للغات',
    type: 'demo',
    requestId: 'req-002',
    contactName: 'د. منى سراج',
    contactPhone: '+20 120 777 6655',
    date: '2026-11-19',
    startTime: '14:00',
    endTime: '15:00',
    status: 'scheduled',
    reminderMinutes: 30,
    notes: 'استعراض بنك الأسئلة والامتحانات بالذكاء الاصطناعي وبوابة ولي الأمر',
  },
  {
    id: 'apt-002',
    titleAr: 'متابعة تجديد سنتر المستقبل',
    type: 'renewal_followup',
    tenantId: 'tenant-future-003',
    tenantNameAr: 'أكاديمية المستقبل التعليمية',
    contactName: 'د. سامح فريد',
    contactPhone: '+20 122 345 6789',
    date: '2026-11-17',
    startTime: '11:00',
    endTime: '11:30',
    status: 'scheduled',
    reminderMinutes: 15,
    notes: 'التأكيد على سداد فاتورة الباقة بعد انتهاء الفترة التجريبية',
  },
  {
    id: 'apt-003',
    titleAr: 'اجتماع تطوير النسخة السحابية مع فريق Yalla Codex',
    type: 'meeting',
    contactName: 'م. إسلام فتحي (Yalla Codex)',
    date: '2026-11-18',
    startTime: '17:00',
    endTime: '18:30',
    status: 'scheduled',
    reminderMinutes: 60,
    notes: 'مراجعة أداء محرك الذكاء الاصطناعي وبوابات الطلاب',
  },
];

export const INITIAL_EXPENSE_CATEGORIES: DynamicExpenseCategory[] = [
  { id: 'cat-cloudflare', key: 'cloudflare', nameAr: 'خوادم وشبكة Cloudflare Workers', descriptionAr: 'تكاليف تشغيل الحوسبة السحابية والتخزين السريع', isCustom: false },
  { id: 'cat-firebase', key: 'firebase', nameAr: 'قواعد بيانات واستضافة Firebase', descriptionAr: 'قواعد بيانات Firestore والمصادقة والتخزين السحابي', isCustom: false },
  { id: 'cat-whatsapp', key: 'whatsapp_api', nameAr: 'بوابة رسائل WhatsApp Cloud API', descriptionAr: 'رسائل الإشعارات وأكواد الدخول وأولياء الأمور', isCustom: false },
  { id: 'cat-ai', key: 'ai_gemini', nameAr: 'خدمات الذكاء الاصطناعي Google Gemini', descriptionAr: 'توليد الاختبارات وفهرسة المذكرات وتصحيح الأسئلة', isCustom: false },
  { id: 'cat-domains', key: 'domains', nameAr: 'الدومينات وحجز النطاقات', descriptionAr: 'تجديد النطاقات الرسمية وشهادات الأمان SSL', isCustom: false },
  { id: 'cat-marketing', key: 'marketing', nameAr: 'التسويق والحملات الإعلانية', descriptionAr: 'إعلانات السوشيال ميديا وجذب السناتر الجديدة', isCustom: false },
  { id: 'cat-salaries', key: 'salaries', nameAr: 'المرتبات والمكافآت', descriptionAr: 'رواتب المطورين وفريق الدعم الفني والمبيعات', isCustom: false },
  { id: 'cat-other', key: 'other', nameAr: 'مصروفات تشغيلية أخرى', descriptionAr: 'رسوم بنكية، أدوات داخلية، ومصروفات عامة', isCustom: false },
];

export const INITIAL_PAYMENTS: OwnerPayment[] = [
  {
    id: 'pay-2026-001',
    receiptNumber: 'REC-2026-001',
    invoiceId: 'inv-2026-001',
    tenantId: 'tenant-maher-001',
    tenantNameAr: 'سنتر الماهر النموذجي',
    amount: 3500,
    paymentMethod: 'vodafone_cash',
    referenceNumber: '88291',
    receivedAt: '2026-11-03T11:30:00.000Z',
    recordedBy: 'مالك المنصة',
    notes: 'تم استلام المبلغ بالكامل عبر فودافون كاش كود 88291',
  },
  {
    id: 'pay-2026-002',
    receiptNumber: 'REC-2026-002',
    invoiceId: 'inv-2026-002',
    tenantId: 'tenant-rowad-002',
    tenantNameAr: 'سنتر الرواد التعليمي',
    amount: 7000,
    paymentMethod: 'bank_transfer',
    referenceNumber: 'TRF-992144',
    receivedAt: '2026-11-05T15:00:00.000Z',
    recordedBy: 'مالك المنصة',
    notes: 'تحويل بنكي رسمي للبنك الأهلي المصري',
  },
];

export const INITIAL_MOVEMENTS: CenterFinancialMovement[] = [
  {
    id: 'mov-001',
    movementNumber: 'MOV-2026-001',
    tenantId: 'tenant-maher-001',
    tenantSlug: 'al-maher',
    tenantNameAr: 'سنتر الماهر النموذجي',
    date: '2026-11-01',
    type: 'invoice',
    description: 'إصدار فاتورة اشتراك شهري (باقة المحترفين Pro) لشهر نوفمبر 2026',
    debit: 3500,
    credit: 0,
    balanceAfter: 3500,
    invoiceId: 'inv-2026-001',
    status: 'confirmed',
    recordedBy: 'نظام الفوترة التلقائي',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'mov-002',
    movementNumber: 'MOV-2026-002',
    tenantId: 'tenant-maher-001',
    tenantSlug: 'al-maher',
    tenantNameAr: 'سنتر الماهر النموذجي',
    date: '2026-11-03',
    type: 'full_payment',
    description: 'سداد كامل لفاتورة اشتراك شهر نوفمبر 2026',
    debit: 0,
    credit: 3500,
    balanceAfter: 0,
    paymentMethod: 'vodafone_cash',
    referenceNumber: '88291',
    invoiceId: 'inv-2026-001',
    paymentId: 'pay-2026-001',
    notes: 'تحويل محفظة إلكترونية معتمد',
    status: 'confirmed',
    recordedBy: 'مالك المنصة',
    createdAt: '2026-11-03T11:30:00.000Z',
  },
  {
    id: 'mov-003',
    movementNumber: 'MOV-2026-003',
    tenantId: 'tenant-rowad-002',
    tenantSlug: 'al-rowad',
    tenantNameAr: 'سنتر الرواد التعليمي',
    date: '2026-11-01',
    type: 'invoice',
    description: 'إصدار فاتورة اشتراك شهري (باقة المؤسسات Enterprise) لشهر نوفمبر 2026',
    debit: 7500,
    credit: 0,
    balanceAfter: 7500,
    invoiceId: 'inv-2026-002',
    status: 'confirmed',
    recordedBy: 'نظام الفوترة التلقائي',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'mov-004',
    movementNumber: 'MOV-2026-004',
    tenantId: 'tenant-rowad-002',
    tenantSlug: 'al-rowad',
    tenantNameAr: 'سنتر الرواد التعليمي',
    date: '2026-11-01',
    type: 'discount',
    description: 'خصم ولاء السنتر الترويجي على فاتورة نوفمبر',
    debit: 0,
    credit: 500,
    balanceAfter: 7000,
    invoiceId: 'inv-2026-002',
    notes: 'خصم معتمد بقرار المالك',
    status: 'confirmed',
    recordedBy: 'مالك المنصة',
    createdAt: '2026-11-01T01:00:00.000Z',
  },
  {
    id: 'mov-005',
    movementNumber: 'MOV-2026-005',
    tenantId: 'tenant-rowad-002',
    tenantSlug: 'al-rowad',
    tenantNameAr: 'سنتر الرواد التعليمي',
    date: '2026-11-05',
    type: 'full_payment',
    description: 'سداد كامل المبلغ المتبقي لفاتورة اشتراك شهر نوفمبر 2026',
    debit: 0,
    credit: 7000,
    balanceAfter: 0,
    paymentMethod: 'bank_transfer',
    referenceNumber: 'TRF-992144',
    invoiceId: 'inv-2026-002',
    paymentId: 'pay-2026-002',
    notes: 'تحويل بنكي - البنك الأهلي المصري',
    status: 'confirmed',
    recordedBy: 'مالك المنصة',
    createdAt: '2026-11-05T15:00:00.000Z',
  },
  {
    id: 'mov-006',
    movementNumber: 'MOV-2026-006',
    tenantId: 'tenant-future-003',
    tenantSlug: 'al-mustaqbal',
    tenantNameAr: 'أكاديمية المستقبل التعليمية',
    date: '2026-11-15',
    type: 'invoice',
    description: 'فاتورة تفعيل الاشتراك بعد انتهاء الفترة التجريبية (باقة البداية Starter)',
    debit: 1500,
    credit: 0,
    balanceAfter: 1500,
    invoiceId: 'inv-2026-003',
    status: 'confirmed',
    recordedBy: 'نظام الفوترة التلقائي',
    createdAt: '2026-11-15T00:00:00.000Z',
  },
];

// ============================================================================
// SINGLETON IN-MEMORY & LOCALSTORAGE STATE CONTAINER
// ============================================================================

const STORAGE_KEYS = {
  CENTERS: 'yc_saas_centers_v2',
  PLANS: 'yc_saas_plans_v2',
  WEBSITE_DRAFT: 'yc_saas_website_draft_v2',
  WEBSITE_PUBLISHED: 'yc_saas_website_published_v2',
  REQUESTS: 'yc_saas_requests_v2',
  COMPLAINTS: 'yc_saas_complaints_v2',
  CONTACT_MESSAGES: 'yc_saas_contact_msgs_v2',
  SETTINGS: 'yc_saas_comm_settings_v2',
  AI_CONFIG: 'yc_saas_ai_config_v2',
  AI_LEDGER: 'yc_saas_ai_ledger_v2',
  INVOICES: 'yc_saas_invoices_v2',
  PAYMENTS: 'yc_saas_payments_v2',
  MOVEMENTS: 'yc_saas_movements_v2',
  EXPENSES: 'yc_saas_expenses_v2',
  EXPENSE_CATEGORIES: 'yc_saas_expense_categories_v2',
  APPOINTMENTS: 'yc_saas_appointments_v2',
  SUPPORT_SESSIONS: 'yc_saas_support_sessions_v2',
  AUDIT_LOGS: 'yc_saas_audit_logs_v2',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  if (process.env.DATA_PROVIDER_MODE === 'production') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // transient storage limit or blocked in private window
  }
}

// In-memory memory caches for SSR runtime
const isFixturesMode = process.env.NODE_ENV === 'test' || (typeof window !== 'undefined' && window.location.search.includes('fixtures=true'));
let memoryCenters = isFixturesMode && process.env.DATA_PROVIDER_MODE !== 'production' ? [...INITIAL_CENTERS] : [];
let memoryPlans = [...INITIAL_PLANS];
let memoryWebsiteDraft = { ...INITIAL_WEBSITE_CONFIG };
let memoryWebsitePublished = { ...INITIAL_WEBSITE_CONFIG };
let memoryRequests = [...INITIAL_REQUESTS];
let memoryComplaints = [...INITIAL_COMPLAINTS];
let memoryContactMessages: ContactMessage[] = [];
let memorySettings = { ...INITIAL_COMMUNICATION_SETTINGS };
let memoryAiConfig = { ...INITIAL_AI_CONFIG };
let memoryAiLedger: AiUsageLedgerEntry[] = [];
let memoryInvoices = [...INITIAL_INVOICES];
let memoryPayments: OwnerPayment[] = [...INITIAL_PAYMENTS];
let memoryMovements: CenterFinancialMovement[] = [...INITIAL_MOVEMENTS];
let memoryExpenses: OwnerExpense[] = [...INITIAL_EXPENSES];
let memoryExpenseCategories: DynamicExpenseCategory[] = [...INITIAL_EXPENSE_CATEGORIES];
let memoryAppointments = [...INITIAL_APPOINTMENTS];
let memorySupportSessions: SupportAccessSession[] = [];

// ============================================================================
// SERVICE CLASS: SaasPlatformService
// ============================================================================

export class SaasPlatformService {
  // --------------------------------------------------------------------------
  // 1. Center Directory & Provisioning
  // --------------------------------------------------------------------------
  static getCenters(): CenterExtended[] {
    const raw = readStorage(STORAGE_KEYS.CENTERS, memoryCenters);
    if (process.env.DATA_PROVIDER_MODE === 'production' || process.env.NODE_ENV === 'production') {
      const filtered = raw.filter(c => c.slug !== 'al-maher' && c.slug !== 'al-rowad' && c.id !== 'tenant-maher-001' && c.id !== 'tenant-rowad-002');
      if (filtered.length === 0) {
        return [
          {
            id: 'tenant-elmaher-001',
            slug: 'elmaher',
            nameAr: 'سنتر الماهر',
            nameEn: 'El Maher Educational Center',
            logoUrl: '',
            phone: '+20 100 123 4567',
            address: 'الفرع الرئيسي',
            email: 'contact@elmaher.edu.eg',
            adminName: 'مدير سنتر الماهر',
            adminEmail: 'admin@elmaher.edu.eg',
            adminPhone: '+20 100 123 4567',
            adminUsername: 'maher_admin',
            subscriptionPlanId: 'plan-pro',
            planNameAr: 'باقة المحترفين (Pro)',
            subscriptionStartDate: '2026-09-01T00:00:00.000Z',
            subscriptionEndDate: '2027-08-31T23:59:59.000Z',
            billingAmount: 3500,
            billingFrequency: 'monthly',
            paymentStatus: 'paid',
            customPricing: null,
            branchesCount: 1,
            studentsCount: 0,
            teachersCount: 0,
            employeesCount: 1,
            maxBranches: 3,
            maxStudents: 500,
            maxTeachers: 30,
            maxEmployees: 10,
            aiBalance: 100,
            aiUsageTotal: 0,
            aiEnabled: true,
            status: 'active',
            enabledModules: [
              'attendance',
              'reception',
              'groups',
              'exams',
              'ai_exams',
              'finance',
              'materials',
              'whatsapp',
              'parent_portal',
              'student_portal',
            ],
            showInPublicDirectory: true,
            notes: 'السنتر المعتمد الرئيسي',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      return filtered;
    }
    return raw;
  }

  static getCenterBySlug(slug: string): CenterExtended | null {
    const all = this.getCenters();
    return all.find((c) => c.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  static getCenterById(id: string): CenterExtended | null {
    const all = this.getCenters();
    return all.find((c) => c.id === id) || null;
  }

  /**
   * Idempotent Center Provisioning Wizard
   */
  static async provisionNewCenter(wizardInput: {
    nameAr: string;
    nameEn?: string;
    slug: string;
    phone?: string;
    address?: string;
    city?: string;
    governorate?: string;
    email?: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    adminUsername?: string;
    planId: string;
    billingFrequency: BillingFrequency;
    customPrice?: number;
    startDate?: string;
    endDate?: string;
    modules?: string[];
    aiAllocation?: number;
    showInPublicDirectory?: boolean;
    notes?: string;
    branchesCount?: number;
    studentsLimit?: number;
    teachersLimit?: number;
    branchesLimit?: number;
  }): Promise<{ ok: boolean; center?: CenterExtended; errorAr?: string }> {
    const current = this.getCenters();
    const cleanSlug = wizardInput.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (!cleanSlug) {
      return { ok: false, errorAr: 'الرابط التعريفي للسنتر (Slug) غير صالح' };
    }

    // Idempotent guard: if center with this slug exists, return it or error
    const existing = current.find((c) => c.slug === cleanSlug);
    if (existing) {
      return { ok: true, center: existing }; // idempotent success
    }

    const plan = this.getPlanById(wizardInput.planId) || INITIAL_PLANS[1]; // default pro
    const billingAmount =
      wizardInput.customPrice !== undefined && wizardInput.customPrice !== null
        ? Number(wizardInput.customPrice)
        : wizardInput.billingFrequency === 'annual'
        ? plan.annualPrice
        : plan.monthlyPrice;

    const newCenterId = `tenant-${cleanSlug}-${Date.now().toString().slice(-4)}`;
    const nowIso = new Date().toISOString();

    const newCenter: CenterExtended = {
      id: newCenterId,
      slug: cleanSlug,
      nameAr: wizardInput.nameAr.trim(),
      nameEn: wizardInput.nameEn?.trim(),
      phone: wizardInput.phone?.trim() || wizardInput.adminPhone.trim(),
      address: wizardInput.address?.trim() || `${wizardInput.city || 'القاهرة'} - ${wizardInput.governorate || 'القاهرة'}`,
      email: wizardInput.email?.trim() || wizardInput.adminEmail.trim(),
      adminName: wizardInput.adminName.trim(),
      adminEmail: wizardInput.adminEmail.trim(),
      adminPhone: wizardInput.adminPhone.trim(),
      adminUsername: wizardInput.adminUsername?.trim() || `admin_${cleanSlug}`,
      subscriptionPlanId: plan.id,
      planNameAr: plan.nameAr,
      subscriptionStartDate: wizardInput.startDate || nowIso,
      subscriptionEndDate:
        wizardInput.endDate ||
        new Date(Date.now() + 365 * 86400000).toISOString(),
      billingAmount,
      billingFrequency: wizardInput.billingFrequency,
      paymentStatus: 'paid',
      customPricing: wizardInput.customPrice ?? null,
      branchesCount: 1,
      studentsCount: 0,
      teachersCount: 0,
      employeesCount: 1,
      maxBranches: plan.maxBranches,
      maxStudents: plan.maxStudents,
      maxTeachers: plan.maxTeachers,
      maxEmployees: plan.maxEmployees,
      aiBalance: wizardInput.aiAllocation ?? plan.aiUnitAllowance,
      aiUsageTotal: 0,
      aiEnabled: true,
      status: 'active',
      enabledModules: wizardInput.modules || plan.enabledModules,
      showInPublicDirectory: wizardInput.showInPublicDirectory ?? true,
      notes: wizardInput.notes || 'تم الإنشاء بواسطة معالج مالك المنصة',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextCenters = [newCenter, ...current];
    memoryCenters = nextCenters;
    writeStorage(STORAGE_KEYS.CENTERS, nextCenters);

    // Sync to Cloud Firestore API in browser environment
    if (typeof window !== 'undefined') {
      try {
        const token =
          sessionStorage.getItem('yc_id_token') ||
          document.cookie.split('yc_token=')[1]?.split(';')[0];
        if (token) {
          fetch('/api/owner/centers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(newCenter),
          }).catch(() => {});
        }
      } catch {}
    }

    // Automatically issue the initial subscription invoice
    this.createInvoice({
      tenantId: newCenter.id,
      tenantNameAr: newCenter.nameAr,
      tenantSlug: newCenter.slug,
      planId: plan.id,
      planNameAr: plan.nameAr,
      periodStart: newCenter.subscriptionStartDate.slice(0, 10),
      periodEnd: newCenter.subscriptionEndDate.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      amount: billingAmount,
      discount: 0,
      status: 'paid',
      notes: 'فاتورة تفعيل السنتر المبدئية عند الإنشاء',
    });

    return { ok: true, center: newCenter };
  }

  static updateCenter(
    centerId: string,
    updates: Partial<CenterExtended>
  ): CenterExtended | null {
    const all = this.getCenters();
    const idx = all.findIndex((c) => c.id === centerId || c.slug === centerId);
    if (idx === -1) return null;

    const updated: CenterExtended = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    memoryCenters = all;
    writeStorage(STORAGE_KEYS.CENTERS, all);
    return updated;
  }

  static setCenterStatus(
    centerId: string,
    status: CenterStatus,
    _reason?: string
  ): CenterExtended | null {
    return this.updateCenter(centerId, { status });
  }

  static allocateAiUnits(
    centerId: string,
    units: number,
    reasonAr: string
  ): { ok: boolean; newBalance?: number; errorAr?: string } {
    const center = this.getCenterById(centerId) || this.getCenterBySlug(centerId);
    if (!center) return { ok: false, errorAr: 'السنتر غير موجود' };

    const newBalance = Math.max(0, center.aiBalance + units);
    this.updateCenter(center.id, { aiBalance: newBalance });

    // Record in ledger
    this.recordAiLedgerEntry({
      id: `ai-alloc-${Date.now()}`,
      tenantId: center.id,
      tenantSlug: center.slug,
      operation: 'manual_allocation',
      units,
      balanceBefore: center.aiBalance,
      balanceAfter: newBalance,
      actorId: 'owner',
      actorRole: 'PLATFORM_OWNER',
      timestamp: new Date().toISOString(),
      status: 'completed',
      idempotencyKey: `alloc-${center.id}-${Date.now()}`,
      descriptionAr: reasonAr || (units > 0 ? `شحن رصيد إضافي (+${units})` : `خصم رصيد (${units})`),
    });

    return { ok: true, newBalance };
  }

  // --------------------------------------------------------------------------
  // 2. Support Access Sessions (Audit Trail)
  // --------------------------------------------------------------------------
  static startSupportAccess(
    tenantSlug: string,
    reason: string,
    durationMinutes = 60
  ): SupportAccessSession | null {
    const center = this.getCenterBySlug(tenantSlug);
    if (!center) return null;

    const now = new Date();
    const expires = new Date(now.getTime() + durationMinutes * 60000);

    const session: SupportAccessSession = {
      id: `sup-${Date.now()}`,
      tenantId: center.id,
      tenantSlug: center.slug,
      ownerId: 'owner-superadmin',
      ownerEmail: 'owner@yallacenter.com',
      reason,
      startedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: 'active',
      actionsPerformed: [
        {
          timestamp: now.toISOString(),
          action: 'ACCESS_STARTED',
          resource: `Center Support for ${center.nameAr}`,
        },
      ],
    };

    const current = readStorage(STORAGE_KEYS.SUPPORT_SESSIONS, memorySupportSessions);
    const next = [session, ...current];
    memorySupportSessions = next;
    writeStorage(STORAGE_KEYS.SUPPORT_SESSIONS, next);

    this.updateCenter(center.id, { supportAccessActive: true });
    return session;
  }

  static endSupportAccess(sessionId: string): void {
    const current = readStorage(STORAGE_KEYS.SUPPORT_SESSIONS, memorySupportSessions);
    const found = current.find((s) => s.id === sessionId);
    if (found) {
      found.status = 'revoked';
      memorySupportSessions = current;
      writeStorage(STORAGE_KEYS.SUPPORT_SESSIONS, current);
      this.updateCenter(found.tenantId, { supportAccessActive: false });
    }
  }

  // --------------------------------------------------------------------------
  // 3. Subscription Plans Management
  // --------------------------------------------------------------------------
  static getPlans(includeInactive = false): SubscriptionPlan[] {
    const all = readStorage(STORAGE_KEYS.PLANS, memoryPlans);
    return includeInactive ? all : all.filter((p) => p.isActive);
  }

  static getPlanById(id: string): SubscriptionPlan | null {
    const all = this.getPlans(true);
    return all.find((p) => p.id === id) || null;
  }

  static savePlan(plan: Partial<SubscriptionPlan> & { id: string; nameAr: string }): SubscriptionPlan {
    const all = this.getPlans(true);
    const nowIso = new Date().toISOString();
    const idx = all.findIndex((p) => p.id === plan.id);

    const fullPlan: SubscriptionPlan = {
      tier: 'custom',
      nameEn: plan.nameAr,
      descriptionAr: '',
      monthlyPrice: 0,
      annualPrice: 0,
      currency: 'EGP',
      billingFrequency: 'monthly',
      trialDays: 14,
      maxStudents: -1,
      maxTeachers: -1,
      maxEmployees: -1,
      maxBranches: -1,
      aiUnitAllowance: 100,
      notificationAllowance: 1000,
      storageAllowanceMb: 5000,
      enabledModules: [],
      features: [],
      highlighted: false,
      isPublic: true,
      displayOrder: all.length + 1,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...plan,
      id: plan.id,
      nameAr: plan.nameAr,
    };

    if (idx !== -1) {
      all[idx] = { ...all[idx], ...fullPlan, updatedAt: nowIso };
    } else {
      all.push(fullPlan);
    }

    all.sort((a, b) => a.displayOrder - b.displayOrder);
    memoryPlans = all;
    writeStorage(STORAGE_KEYS.PLANS, all);
    return fullPlan;
  }

  static archivePlan(planId: string): void {
    const all = this.getPlans(true);
    const found = all.find((p) => p.id === planId);
    if (found) {
      found.isActive = false;
      found.isPublic = false;
      memoryPlans = all;
      writeStorage(STORAGE_KEYS.PLANS, all);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Public Website Builder (CMS)
  // --------------------------------------------------------------------------
  static getWebsiteDraft(): WebsiteConfig {
    return readStorage(STORAGE_KEYS.WEBSITE_DRAFT, memoryWebsiteDraft);
  }

  static getWebsitePublished(): WebsiteConfig {
    return readStorage(STORAGE_KEYS.WEBSITE_PUBLISHED, memoryWebsitePublished);
  }

  static updateWebsiteDraft(updates: Partial<WebsiteConfig>): WebsiteConfig {
    const current = this.getWebsiteDraft();
    const updated: WebsiteConfig = {
      ...current,
      ...updates,
      version: current.version + 1,
    };
    memoryWebsiteDraft = updated;
    writeStorage(STORAGE_KEYS.WEBSITE_DRAFT, updated);
    return updated;
  }

  static publishWebsite(publishedBy = 'owner@yallacenter.com'): WebsiteConfig {
    const draft = this.getWebsiteDraft();
    const published: WebsiteConfig = {
      ...draft,
      lastPublishedAt: new Date().toISOString(),
      publishedBy,
    };
    memoryWebsitePublished = published;
    writeStorage(STORAGE_KEYS.WEBSITE_PUBLISHED, published);
    return published;
  }

  // --------------------------------------------------------------------------
  // 5. Inquiries, Requests, Complaints & Polls
  // --------------------------------------------------------------------------
  static getRequests(): CustomerRequest[] {
    return readStorage(STORAGE_KEYS.REQUESTS, memoryRequests);
  }

  static submitCustomerRequest(
    data: Omit<
      CustomerRequest,
      | 'id'
      | 'status'
      | 'internalNotes'
      | 'communicationHistory'
      | 'createdAt'
      | 'updatedAt'
    >
  ): CustomerRequest {
    const nowIso = new Date().toISOString();
    const req: CustomerRequest = {
      ...data,
      id: `req-${Date.now().toString().slice(-6)}`,
      status: 'new',
      internalNotes: [],
      communicationHistory: [
        {
          date: nowIso,
          author: 'النظام',
          note: 'تم استلام الطلب من نموذج الموقع بنجاح',
          channel: 'website_form',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const all = this.getRequests();
    const next = [req, ...all];
    memoryRequests = next;
    writeStorage(STORAGE_KEYS.REQUESTS, next);
    return req;
  }

  static updateRequestStatus(
    id: string,
    status: CustomerRequest['status'],
    note?: string
  ): CustomerRequest | null {
    const all = this.getRequests();
    const found = all.find((r) => r.id === id);
    if (!found) return null;

    found.status = status;
    found.updatedAt = new Date().toISOString();
    if (note) {
      found.internalNotes.push(note);
      found.communicationHistory.push({
        date: new Date().toISOString(),
        author: 'مالك المنصة',
        note,
        channel: 'owner_dashboard',
      });
    }

    memoryRequests = all;
    writeStorage(STORAGE_KEYS.REQUESTS, all);
    return found;
  }

  static getComplaints(): ComplaintRecord[] {
    return readStorage(STORAGE_KEYS.COMPLAINTS, memoryComplaints);
  }

  static submitComplaint(data: {
    senderName: string;
    email: string;
    phone: string;
    centerName?: string;
    subject: string;
    description: string;
  }): ComplaintRecord {
    const comp: ComplaintRecord = {
      ...data,
      id: `comp-${Date.now().toString().slice(-6)}`,
      priority: 'normal',
      status: 'open',
      adminNotes: [],
      createdAt: new Date().toISOString(),
    };
    const all = this.getComplaints();
    const next = [comp, ...all];
    memoryComplaints = next;
    writeStorage(STORAGE_KEYS.COMPLAINTS, next);
    return comp;
  }

  static updateComplaintStatus(
    id: string,
    status: ComplaintRecord['status'],
    note?: string
  ): void {
    const all = this.getComplaints();
    const found = all.find((c) => c.id === id);
    if (found) {
      found.status = status;
      if (status === 'resolved') found.resolvedAt = new Date().toISOString();
      if (note) found.adminNotes.push(note);
      memoryComplaints = all;
      writeStorage(STORAGE_KEYS.COMPLAINTS, all);
    }
  }

  static votePoll(optionId: string): boolean {
    const config = this.getWebsitePublished();
    if (!config.activePoll || !config.activePoll.isActive) return false;

    const opt = config.activePoll.options.find((o) => o.id === optionId);
    if (!opt) return false;

    opt.votes += 1;
    config.activePoll.totalVotes += 1;

    // Update in published and draft
    memoryWebsitePublished = config;
    writeStorage(STORAGE_KEYS.WEBSITE_PUBLISHED, config);

    const draft = this.getWebsiteDraft();
    if (draft.activePoll) {
      const draftOpt = draft.activePoll.options.find((o) => o.id === optionId);
      if (draftOpt) draftOpt.votes += 1;
      draft.activePoll.totalVotes += 1;
      memoryWebsiteDraft = draft;
      writeStorage(STORAGE_KEYS.WEBSITE_DRAFT, draft);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // 6. Central AI Provider & Ledger
  // --------------------------------------------------------------------------
  static getCentralAiConfig(): CentralAiConfig {
    return readStorage(STORAGE_KEYS.AI_CONFIG, memoryAiConfig);
  }

  static updateCentralAiConfig(
    updates: Partial<CentralAiConfig>
  ): CentralAiConfig {
    const current = this.getCentralAiConfig();
    const updated: CentralAiConfig = {
      ...current,
      ...updates,
    };
    memoryAiConfig = updated;
    writeStorage(STORAGE_KEYS.AI_CONFIG, updated);
    return updated;
  }

  static recordAiLedgerEntry(entry: AiUsageLedgerEntry): void {
    const all = readStorage(STORAGE_KEYS.AI_LEDGER, memoryAiLedger);
    const next = [entry, ...all];
    memoryAiLedger = next;
    writeStorage(STORAGE_KEYS.AI_LEDGER, next);
  }

  static getAiLedger(tenantId?: string): AiUsageLedgerEntry[] {
    const all = readStorage(STORAGE_KEYS.AI_LEDGER, memoryAiLedger);
    return tenantId ? all.filter((e) => e.tenantId === tenantId) : all;
  }

  static chargeCenterAiUnits(
    tenantSlug: string,
    operation: string,
    units: number,
    descriptionAr: string,
    idempotencyKey?: string
  ): { ok: boolean; newBalance?: number; errorAr?: string } {
    const center = this.getCenterBySlug(tenantSlug);
    if (!center) return { ok: false, errorAr: 'السنتر غير موجود' };

    if (!center.aiEnabled) {
      return { ok: false, errorAr: 'خدمات الذكاء الاصطناعي معطلة لهذا السنتر حالياً من قِبل الإدارة.' };
    }

    // Guard against overdraft
    if (center.aiBalance < units) {
      return {
        ok: false,
        errorAr: `رصيد وحدات الـ AI غير كافٍ. المطلوب: ${units}، المتاح: ${center.aiBalance}. يُرجى التواصل مع إدارة المنصة للشحن.`,
      };
    }

    // Idempotency check
    const key = idempotencyKey || `charge-${center.id}-${Date.now()}`;
    const ledger = this.getAiLedger(center.id);
    const dup = ledger.find((l) => l.idempotencyKey === key && l.status === 'completed');
    if (dup) {
      return { ok: true, newBalance: center.aiBalance }; // already charged
    }

    const balanceBefore = center.aiBalance;
    const balanceAfter = balanceBefore - units;

    this.updateCenter(center.id, {
      aiBalance: balanceAfter,
      aiUsageTotal: center.aiUsageTotal + units,
    });

    this.recordAiLedgerEntry({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId: center.id,
      tenantSlug: center.slug,
      operation,
      units,
      balanceBefore,
      balanceAfter,
      actorId: 'system',
      actorRole: 'SYSTEM',
      timestamp: new Date().toISOString(),
      status: 'completed',
      idempotencyKey: key,
      descriptionAr,
    });

    return { ok: true, newBalance: balanceAfter };
  }

  // --------------------------------------------------------------------------
  // 7. Platform Owner SaaS Finance & Multi-Tenant Accounting Engine
  // --------------------------------------------------------------------------
  static toPiastres(amount: number): number {
    return Math.round((Number(amount) || 0) * 100);
  }

  static fromPiastres(piastres: number): number {
    return Math.round(piastres) / 100;
  }

  // --- Dynamic Expense Categories ---
  static getExpenseCategories(): DynamicExpenseCategory[] {
    return readStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, memoryExpenseCategories);
  }

  static createExpenseCategory(cat: {
    key: string;
    nameAr: string;
    descriptionAr?: string;
  }): DynamicExpenseCategory {
    const all = this.getExpenseCategories();
    const sanitizedKey = cat.key.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const existing = all.find((c) => c.key === sanitizedKey);
    if (existing) return existing;

    const newCat: DynamicExpenseCategory = {
      id: `cat-${Date.now()}`,
      key: sanitizedKey,
      nameAr: cat.nameAr.trim(),
      descriptionAr: cat.descriptionAr,
      isCustom: true,
    };
    const next = [...all, newCat];
    memoryExpenseCategories = next;
    writeStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, next);
    return newCat;
  }

  static updateExpenseCategory(
    id: string,
    updates: Partial<DynamicExpenseCategory>
  ): DynamicExpenseCategory | null {
    const all = this.getExpenseCategories();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const updated = { ...all[idx], ...updates };
    all[idx] = updated;
    memoryExpenseCategories = [...all];
    writeStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, memoryExpenseCategories);
    return updated;
  }

  static deleteExpenseCategory(id: string): boolean {
    const all = this.getExpenseCategories();
    const next = all.filter((c) => c.id !== id);
    if (next.length === all.length) return false;
    memoryExpenseCategories = next;
    writeStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, next);
    return true;
  }

  // --- Platform Expenses Management ---
  static getExpenses(): OwnerExpense[] {
    return readStorage(STORAGE_KEYS.EXPENSES, memoryExpenses);
  }

  static createExpense(
    data: Omit<OwnerExpense, 'id'>
  ): OwnerExpense {
    const expense: OwnerExpense = {
      ...data,
      id: `exp-${Date.now()}`,
      amount: this.fromPiastres(this.toPiastres(data.amount)),
    };
    const all = this.getExpenses();
    const next = [expense, ...all];
    memoryExpenses = next;
    writeStorage(STORAGE_KEYS.EXPENSES, next);
    return expense;
  }

  static deleteExpense(id: string): boolean {
    const all = this.getExpenses();
    const next = all.filter((e) => e.id !== id);
    if (next.length === all.length) return false;
    memoryExpenses = next;
    writeStorage(STORAGE_KEYS.EXPENSES, next);
    return true;
  }

  // --- Financial Movements Ledger ---
  static getMovements(tenantId?: string): CenterFinancialMovement[] {
    const all = readStorage(STORAGE_KEYS.MOVEMENTS, memoryMovements);
    if (!tenantId) return all;
    return all.filter((m) => m.tenantId === tenantId || m.tenantSlug === tenantId);
  }

  static getCenterStatement(tenantIdOrSlug: string): {
    center: CenterExtended | null;
    movements: CenterFinancialMovement[];
    totalDebit: number;
    totalCredit: number;
    remainingBalance: number;
    creditBalance: number;
    lastPaymentDate?: string;
    nextDueDate: string;
    paymentStatus: PaymentStatus;
  } {
    const centers = this.getCenters();
    const center = centers.find((c) => c.id === tenantIdOrSlug || c.slug === tenantIdOrSlug) || null;
    const tid = center?.id || tenantIdOrSlug;

    const rawMovements = this.getMovements(tid);
    // Sort chronologically ascending to accurately accumulate running balance
    const sorted = [...rawMovements].sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() ||
        a.movementNumber.localeCompare(b.movementNumber)
    );

    let runningPiastres = 0;
    let totalDebitPiastres = 0;
    let totalCreditPiastres = 0;
    let lastPayDate: string | undefined = undefined;

    const computed = sorted.map((mov) => {
      if (mov.status === 'confirmed') {
        const debitP = this.toPiastres(mov.debit || 0);
        const creditP = this.toPiastres(mov.credit || 0);
        runningPiastres += debitP - creditP;
        totalDebitPiastres += debitP;
        totalCreditPiastres += creditP;
        if (creditP > 0 && mov.date) {
          lastPayDate = mov.date;
        }
      }
      return {
        ...mov,
        balanceAfter: this.fromPiastres(runningPiastres),
      };
    });

    const netRemainingPiastres = Math.max(0, runningPiastres);
    const existingCreditPiastres = this.toPiastres(center?.creditBalance || 0);
    const excessCreditPiastres = runningPiastres < 0 ? Math.abs(runningPiastres) : 0;
    const totalCreditBalance = this.fromPiastres(Math.max(existingCreditPiastres, excessCreditPiastres));

    let paymentStatus: PaymentStatus = 'unpaid';
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueDate = center?.subscriptionEndDate || todayIso;

    if (netRemainingPiastres === 0 && totalCreditPiastres > 0) {
      paymentStatus = 'paid';
    } else if (totalCreditPiastres > 0 && netRemainingPiastres > 0) {
      paymentStatus = 'partial';
    } else if (netRemainingPiastres > 0 && dueDate < todayIso) {
      paymentStatus = 'overdue';
    }

    return {
      center,
      movements: [...computed].reverse(), // descending for table display
      totalDebit: this.fromPiastres(totalDebitPiastres),
      totalCredit: this.fromPiastres(totalCreditPiastres),
      remainingBalance: this.fromPiastres(netRemainingPiastres),
      creditBalance: totalCreditBalance,
      lastPaymentDate: lastPayDate,
      nextDueDate: dueDate,
      paymentStatus,
    };
  }

  static createMovement(data: {
    tenantId: string;
    type: CenterFinancialMovementType;
    description: string;
    debit: number;
    credit: number;
    paymentMethod?: OwnerPaymentMethod | 'none';
    referenceNumber?: string;
    invoiceId?: string;
    paymentId?: string;
    notes?: string;
    recordedBy?: string;
    date?: string;
  }): CenterFinancialMovement {
    const centers = this.getCenters();
    const center = centers.find((c) => c.id === data.tenantId || c.slug === data.tenantId);
    const all = this.getMovements();
    const count = all.length + 1;
    const seq = String(count).padStart(3, '0');
    const movementNumber = `MOV-2026-${seq}`;
    const nowIso = new Date().toISOString();
    const date = data.date || nowIso.slice(0, 10);

    const debitP = this.toPiastres(data.debit);
    const creditP = this.toPiastres(data.credit);

    // Get current balance before this movement
    const statement = this.getCenterStatement(data.tenantId);
    const balanceBeforeP = this.toPiastres(statement.remainingBalance) - this.toPiastres(statement.creditBalance);
    const balanceAfterP = balanceBeforeP + (debitP - creditP);

    const movement: CenterFinancialMovement = {
      id: `mov-${Date.now()}`,
      movementNumber,
      tenantId: center?.id || data.tenantId,
      tenantSlug: center?.slug || '',
      tenantNameAr: center?.nameAr || 'سنتر تعليمي',
      date,
      type: data.type,
      description: data.description,
      debit: this.fromPiastres(debitP),
      credit: this.fromPiastres(creditP),
      balanceAfter: this.fromPiastres(balanceAfterP),
      paymentMethod: data.paymentMethod || 'none',
      referenceNumber: data.referenceNumber,
      invoiceId: data.invoiceId,
      paymentId: data.paymentId,
      notes: data.notes,
      status: 'confirmed',
      recordedBy: data.recordedBy || 'مالك المنصة',
      createdAt: nowIso,
    };

    const next = [movement, ...all];
    memoryMovements = next;
    writeStorage(STORAGE_KEYS.MOVEMENTS, next);

    return movement;
  }

  static reverseMovement(
    id: string,
    reason: string,
    reversedBy = 'مالك المنصة'
  ): { ok: boolean; error?: string } {
    const all = this.getMovements();
    const mov = all.find((m) => m.id === id);
    if (!mov) return { ok: false, error: 'العملية المالية غير موجودة.' };
    if (mov.status === 'reversed') return { ok: false, error: 'تم إلغاء هذه العملية مسبقاً.' };

    const nowIso = new Date().toISOString();
    mov.status = 'reversed';
    mov.reversedBy = reversedBy;
    mov.reversedAt = nowIso;
    mov.reversalReason = reason;

    // Roll back invoice / payment if linked
    if (mov.paymentId) {
      const payments = this.getPayments();
      const nextPayments = payments.filter((p) => p.id !== mov.paymentId);
      memoryPayments = nextPayments;
      writeStorage(STORAGE_KEYS.PAYMENTS, nextPayments);

      if (mov.invoiceId) {
        const invoices = this.getInvoices();
        const inv = invoices.find((i) => i.id === mov.invoiceId);
        if (inv) {
          inv.amountPaid = Math.max(0, inv.amountPaid - mov.credit);
          if (inv.amountPaid === 0) {
            inv.status = 'issued';
          } else if (inv.amountPaid < inv.totalDue) {
            inv.status = 'partially_paid';
          }
          memoryInvoices = invoices;
          writeStorage(STORAGE_KEYS.INVOICES, invoices);
        }
      }
    }

    memoryMovements = all;
    writeStorage(STORAGE_KEYS.MOVEMENTS, all);

    this.recordAuditLog({
      action: 'REVERSE_FINANCIAL_MOVEMENT',
      entityType: 'financial_movement',
      entityId: id,
      actorEmail: reversedBy,
      details: {
        movementNumber: mov.movementNumber,
        reason,
        debit: mov.debit,
        credit: mov.credit,
        tenantId: mov.tenantId,
      },
    });

    return { ok: true };
  }

  // --- Invoices & Subscription Billing ---
  static getInvoices(): OwnerInvoice[] {
    return readStorage(STORAGE_KEYS.INVOICES, memoryInvoices);
  }

  static createInvoice(
    data: Omit<
      OwnerInvoice,
      'id' | 'invoiceNumber' | 'issuedAt' | 'totalDue' | 'amountPaid' | 'periodStart' | 'periodEnd' | 'dueDate'
    > & {
      amountPaid?: number;
      periodStart?: string;
      periodEnd?: string;
      dueDate?: string;
    }
  ): OwnerInvoice {
    const all = this.getInvoices();
    const count = all.length + 1;
    const seq = String(count).padStart(3, '0');
    const invoiceNumber = `INV-YC-2026-${seq}`;
    const nowIso = new Date().toISOString();
    const periodStart = data.periodStart || nowIso.slice(0, 10);
    const periodEnd =
      data.periodEnd || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const dueDate =
      data.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const amountP = this.toPiastres(data.amount);
    const discountP = this.toPiastres(data.discount || 0);
    const totalDueP = Math.max(0, amountP - discountP);
    const totalDue = this.fromPiastres(totalDueP);
    const amountPaid = data.amountPaid ?? (data.status === 'paid' ? totalDue : 0);

    const invoice: OwnerInvoice = {
      ...data,
      id: `inv-${Date.now()}`,
      invoiceNumber,
      issuedAt: nowIso,
      periodStart,
      periodEnd,
      dueDate,
      amount: this.fromPiastres(amountP),
      discount: this.fromPiastres(discountP),
      totalDue,
      amountPaid,
    };

    const next = [invoice, ...all];
    memoryInvoices = next;
    writeStorage(STORAGE_KEYS.INVOICES, next);

    // Automatically record debit movement in center ledger
    this.createMovement({
      tenantId: data.tenantId,
      type: 'invoice',
      description: `إصدار فاتورة اشتراك #${invoiceNumber} (${data.planNameAr})`,
      debit: totalDue,
      credit: 0,
      invoiceId: invoice.id,
      notes: data.notes,
      date: data.periodStart || nowIso.slice(0, 10),
    });

    // If marked paid on creation, record credit movement
    if (amountPaid > 0) {
      this.createMovement({
        tenantId: data.tenantId,
        type: amountPaid >= totalDue ? 'full_payment' : 'partial_payment',
        description: `سداد فاتورة اشتراك #${invoiceNumber}`,
        debit: 0,
        credit: amountPaid,
        invoiceId: invoice.id,
        notes: 'سداد فوري عند الإصدار',
        date: data.periodStart || nowIso.slice(0, 10),
      });
    }

    return invoice;
  }

  // --- Payments & Collections ---
  static getPayments(): OwnerPayment[] {
    return readStorage(STORAGE_KEYS.PAYMENTS, memoryPayments);
  }

  static recordPayment(payment: {
    invoiceId: string;
    amount: number;
    paymentMethod: OwnerPaymentMethod;
    referenceNumber?: string;
    recordedBy?: string;
    notes?: string;
    receivedAt?: string;
  }): { payment: OwnerPayment; movement: CenterFinancialMovement } | null {
    const invoices = this.getInvoices();
    const inv = invoices.find((i) => i.id === payment.invoiceId);
    if (!inv) return null;

    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();
    const receivedAt = payment.receivedAt || nowIso;

    const paymentAmountP = this.toPiastres(payment.amount);
    const paymentAmount = this.fromPiastres(paymentAmountP);

    const record: OwnerPayment = {
      id: `pay-${Date.now()}`,
      receiptNumber,
      invoiceId: inv.id,
      tenantId: inv.tenantId,
      tenantNameAr: inv.tenantNameAr,
      amount: paymentAmount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      receivedAt,
      recordedBy: payment.recordedBy || 'مالك المنصة',
      notes: payment.notes,
    };

    // Update invoice balance
    const currentPaidP = this.toPiastres(inv.amountPaid);
    const totalDueP = this.toPiastres(inv.totalDue);
    const nextPaidP = currentPaidP + paymentAmountP;

    inv.amountPaid = this.fromPiastres(Math.min(nextPaidP, totalDueP));
    if (nextPaidP >= totalDueP) {
      inv.status = 'paid';
      inv.paidAt = receivedAt;
    } else if (nextPaidP > 0) {
      inv.status = 'partially_paid';
    }

    // Check for overpayment / credit balance surplus
    if (nextPaidP > totalDueP) {
      const surplusP = nextPaidP - totalDueP;
      const surplus = this.fromPiastres(surplusP);
      const centers = this.getCenters();
      const center = centers.find((c) => c.id === inv.tenantId);
      if (center) {
        center.creditBalance = this.fromPiastres(
          this.toPiastres(center.creditBalance || 0) + surplusP
        );
        memoryCenters = centers;
        writeStorage(STORAGE_KEYS.CENTERS, centers);
      }
    }

    memoryInvoices = invoices;
    writeStorage(STORAGE_KEYS.INVOICES, invoices);

    const payments = this.getPayments();
    const nextPay = [record, ...payments];
    memoryPayments = nextPay;
    writeStorage(STORAGE_KEYS.PAYMENTS, nextPay);

    // Record credit movement in center ledger
    const movement = this.createMovement({
      tenantId: inv.tenantId,
      type: nextPaidP >= totalDueP ? 'full_payment' : 'partial_payment',
      description: `سداد لفاتورة اشتراك #${inv.invoiceNumber} (${payment.paymentMethod})`,
      debit: 0,
      credit: paymentAmount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      invoiceId: inv.id,
      paymentId: record.id,
      notes: payment.notes,
      recordedBy: payment.recordedBy,
      date: receivedAt.slice(0, 10),
    });

    return { payment: record, movement };
  }

  // --- Adjustments, Discounts & Credits ---
  static addAdjustmentOrDiscount(data: {
    tenantId: string;
    type: 'discount' | 'credit_added' | 'refund' | 'adjustment';
    amount: number;
    description: string;
    reason: string;
    invoiceId?: string;
    recordedBy?: string;
  }): CenterFinancialMovement {
    const isCreditOperation = data.type === 'discount' || data.type === 'credit_added';
    const isDebitOperation = data.type === 'refund';

    const movement = this.createMovement({
      tenantId: data.tenantId,
      type: data.type,
      description: data.description,
      debit: isDebitOperation ? data.amount : 0,
      credit: isCreditOperation ? data.amount : 0,
      invoiceId: data.invoiceId,
      notes: `السبب: ${data.reason}`,
      recordedBy: data.recordedBy || 'مالك المنصة',
    });

    return movement;
  }

  // --- Interactive Center Accounts Sheet (19 Columns) ---
  static getCenterAccountsSheet(): CenterAccountSummaryRow[] {
    const centers = this.getCenters();
    const invoices = this.getInvoices();
    const todayIso = new Date().toISOString().slice(0, 10);

    return centers.map((center, index) => {
      const statement = this.getCenterStatement(center.id);
      const centerInvoices = invoices.filter(
        (i) => i.tenantId === center.id && i.status !== 'cancelled'
      );

      const totalInvoicedP = centerInvoices.reduce(
        (sum, inv) => sum + this.toPiastres(inv.amount),
        0
      );
      const totalDiscountsP = centerInvoices.reduce(
        (sum, inv) => sum + this.toPiastres(inv.discount || 0),
        0
      );
      const netDueP = Math.max(0, totalInvoicedP - totalDiscountsP);
      const totalPaidP = this.toPiastres(statement.totalCredit);
      const remainingBalanceP = Math.max(0, netDueP - totalPaidP);

      let paymentStatus: PaymentStatus = 'unpaid';
      if (remainingBalanceP === 0 && totalPaidP > 0) {
        paymentStatus = 'paid';
      } else if (totalPaidP > 0 && remainingBalanceP > 0) {
        paymentStatus = 'partial';
      } else if (remainingBalanceP > 0 && center.subscriptionEndDate < todayIso) {
        paymentStatus = 'overdue';
      }

      return {
        seq: index + 1,
        tenantId: center.id,
        slug: center.slug,
        centerNameAr: center.nameAr,
        adminName: center.adminName,
        adminPhone: center.adminPhone,
        planNameAr: center.planNameAr,
        planTier: (center.subscriptionPlanId.replace('plan-', '') as any) || 'pro',
        billingFrequency: center.billingFrequency,
        subscriptionStartDate: center.subscriptionStartDate.slice(0, 10),
        subscriptionEndDate: center.subscriptionEndDate.slice(0, 10),
        totalInvoiced: this.fromPiastres(totalInvoicedP),
        totalDiscounts: this.fromPiastres(totalDiscountsP),
        netDue: this.fromPiastres(netDueP),
        totalPaid: this.fromPiastres(totalPaidP),
        remainingBalance: this.fromPiastres(remainingBalanceP),
        creditBalance: statement.creditBalance,
        lastPaymentDate: statement.lastPaymentDate,
        nextDueDate: center.subscriptionEndDate.slice(0, 10),
        paymentStatus,
        subscriptionStatus: center.status,
      };
    });
  }

  // --- Upcoming Renewals & Alerts (7-day, 30-day, overdue) ---
  static getUpcomingRenewals(): {
    expiring7Days: CenterAccountSummaryRow[];
    expiring30Days: CenterAccountSummaryRow[];
    overdueAccounts: CenterAccountSummaryRow[];
    dueToday: CenterAccountSummaryRow[];
  } {
    const sheet = this.getCenterAccountsSheet();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const msPerDay = 86400000;
    const todayIso = today.toISOString().slice(0, 10);

    const expiring7Days: CenterAccountSummaryRow[] = [];
    const expiring30Days: CenterAccountSummaryRow[] = [];
    const overdueAccounts: CenterAccountSummaryRow[] = [];
    const dueToday: CenterAccountSummaryRow[] = [];

    sheet.forEach((row) => {
      const endDate = new Date(row.subscriptionEndDate);
      endDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((endDate.getTime() - today.getTime()) / msPerDay);

      if (row.remainingBalance > 0 && diffDays < 0) {
        overdueAccounts.push(row);
      } else if (diffDays === 0) {
        dueToday.push(row);
      } else if (diffDays > 0 && diffDays <= 7) {
        expiring7Days.push(row);
      } else if (diffDays > 7 && diffDays <= 30) {
        expiring30Days.push(row);
      }
    });

    return {
      expiring7Days,
      expiring30Days,
      overdueAccounts,
      dueToday,
    };
  }

  // --- Financial Summary Metrics ---
  static getFinancialSummary(): {
    totalRevenueInvoiced: number;
    totalCollections: number;
    outstandingReceivables: number;
    totalExpenses: number;
    netProfit: number;
    totalDiscounts: number;
    activeCentersCount: number;
    overdueCount: number;
  } {
    const sheet = this.getCenterAccountsSheet();
    const expenses = this.getExpenses();

    const totalRevenueInvoicedP = sheet.reduce(
      (sum, row) => sum + this.toPiastres(row.totalInvoiced),
      0
    );
    const totalDiscountsP = sheet.reduce(
      (sum, row) => sum + this.toPiastres(row.totalDiscounts),
      0
    );
    const totalCollectionsP = sheet.reduce(
      (sum, row) => sum + this.toPiastres(row.totalPaid),
      0
    );
    const outstandingReceivablesP = sheet.reduce(
      (sum, row) => sum + this.toPiastres(row.remainingBalance),
      0
    );
    const totalExpensesP = expenses.reduce(
      (sum, exp) => sum + this.toPiastres(exp.amount),
      0
    );
    const netProfitP = totalCollectionsP - totalExpensesP;

    const overdueCount = sheet.filter((r) => r.paymentStatus === 'overdue').length;
    const activeCentersCount = sheet.filter((r) => r.subscriptionStatus === 'active').length;

    return {
      totalRevenueInvoiced: this.fromPiastres(totalRevenueInvoicedP),
      totalCollections: this.fromPiastres(totalCollectionsP),
      outstandingReceivables: this.fromPiastres(outstandingReceivablesP),
      totalExpenses: this.fromPiastres(totalExpensesP),
      netProfit: this.fromPiastres(netProfitP),
      totalDiscounts: this.fromPiastres(totalDiscountsP),
      activeCentersCount,
      overdueCount,
    };
  }

  // --------------------------------------------------------------------------
  // 8. Owner Calendar & Appointments
  // --------------------------------------------------------------------------
  static getAppointments(): OwnerAppointment[] {
    return readStorage(STORAGE_KEYS.APPOINTMENTS, memoryAppointments);
  }

  static createAppointment(
    data: Omit<OwnerAppointment, 'id' | 'status'>
  ): OwnerAppointment {
    const apt: OwnerAppointment = {
      ...data,
      id: `apt-${Date.now()}`,
      status: 'scheduled',
    };
    const all = this.getAppointments();
    const next = [apt, ...all];
    memoryAppointments = next;
    writeStorage(STORAGE_KEYS.APPOINTMENTS, next);
    return apt;
  }

  static updateAppointment(
    id: string,
    updates: Partial<OwnerAppointment>
  ): OwnerAppointment | null {
    const all = this.getAppointments();
    const found = all.find((a) => a.id === id);
    if (!found) return null;

    Object.assign(found, updates);
    memoryAppointments = all;
    writeStorage(STORAGE_KEYS.APPOINTMENTS, all);
    return found;
  }

  // --------------------------------------------------------------------------
  // 9. Platform Communication Settings
  // --------------------------------------------------------------------------
  static getCommunicationSettings(): PlatformCommunicationSettings {
    return readStorage(STORAGE_KEYS.SETTINGS, memorySettings);
  }

  static updateCommunicationSettings(
    updates: Partial<PlatformCommunicationSettings>
  ): PlatformCommunicationSettings {
    const current = this.getCommunicationSettings();
    const updated = { ...current, ...updates };
    memorySettings = updated;
    writeStorage(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // 10. Audit Logs
  // --------------------------------------------------------------------------
  static getAuditLogs(): OwnerAuditLog[] {
    return readStorage(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  static recordAuditLog(
    log: Omit<OwnerAuditLog, 'id' | 'timestamp'>
  ): OwnerAuditLog {
    const entry: OwnerAuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const all = this.getAuditLogs();
    const next = [entry, ...all];
    writeStorage(STORAGE_KEYS.AUDIT_LOGS, next);
    return entry;
  }
}
