'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { Bell, CheckCircle2, AlertCircle, Calendar, CreditCard, ChevronLeft } from 'lucide-react';

export interface ParentNotification {
  id: string;
  type: 'attendance' | 'payment' | 'exam' | 'schedule';
  title: string;
  body: string;
  time: string;
  studentName: string;
  unread: boolean;
}

export function NotificationAnimation({
  className = '',
}: {
  className?: string;
}) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;

  const [notifications, setNotifications] = useState<ParentNotification[]>([
    {
      id: 'n1',
      type: 'attendance',
      title: 'تسجيل حضور مؤكد',
      body: 'سجل الطالب زياد حضوره في حصة الرياضيات الساعة 05:05 مساءً.',
      time: 'منذ 15 دقيقة',
      studentName: 'زياد أحمد',
      unread: true,
    },
    {
      id: 'n2',
      type: 'exam',
      title: 'إعلان نتيجة الامتحان الأسبوعي',
      body: 'حصل زياد على 48 من 50 في امتحان الكيمياء (تقدير ممتاز).',
      time: 'اليوم، 01:20 م',
      studentName: 'زياد أحمد',
      unread: true,
    },
    {
      id: 'n3',
      type: 'payment',
      title: 'تأكيد استلام سداد اشتراك الشهر',
      body: 'تم استلام مبلغ 800 ج.م وإصدار إيصال السداد رقم REC-88319.',
      time: 'أمس، 06:40 م',
      studentName: 'زياد أحمد',
      unread: false,
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const getIcon = (type: ParentNotification['type']) => {
    switch (type) {
      case 'attendance':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'exam':
        return <Bell className="w-5 h-5 text-cyan-500" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-blue-500" />;
      default:
        return <Calendar className="w-5 h-5 text-indigo-500" />;
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900"
              >
                {unreadCount}
              </motion.span>
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              إشعارات وتنبيهات ولي الأمر اللحظية
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              متابعة مباشرة للحضور، والدرجات، والإيصالات المالية
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
            }
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            تحديد الكل كمقروء
          </button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {notifications.map((notif, idx) => (
            <motion.div
              key={notif.id}
              initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isReduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: isReduced ? 0 : idx * 0.06 }}
              onClick={() => markAsRead(notif.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                notif.unread
                  ? 'border-cyan-500/40 bg-cyan-50/30 dark:bg-cyan-950/20 shadow-sm'
                  : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 opacity-80'
              }`}
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {notif.title}
                  </h5>
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                    {notif.time}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {notif.body}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    الطالب: {notif.studentName}
                  </span>
                  {notif.unread && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
