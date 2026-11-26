'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';
import { Folder, FolderOpen, FileText, History, ExternalLink, Download, Check, Sparkles } from 'lucide-react';
import { EducationalSubjectBadge } from './educational-graphics';

export interface FileItem {
  id: string;
  name: string;
  size: string;
  version: number;
  subject: string;
  updatedAt: string;
  isDriveLink?: boolean;
}

export function FileLibraryAnimation({
  className = '',
}: {
  className?: string;
}) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [isFolderOpen, setIsFolderOpen] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string>('f1');
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  const files: FileItem[] = [
    {
      id: 'f1',
      name: 'مذكرة_التفاضل_والتكامل_الوحدة_الأولى.pdf',
      size: '3.6 ميجابايت',
      version: 2,
      subject: 'math',
      updatedAt: 'اليوم، 10:30 ص',
    },
    {
      id: 'f2',
      name: 'بنك_أسئلة_الفيزياء_الحديثة_نماذج_الوزارة.pdf',
      size: '6.1 ميجابايت',
      version: 1,
      subject: 'physics',
      updatedAt: 'أمس، 4:15 م',
    },
    {
      id: 'f3',
      name: 'كراسة_المفاهيم_والتجارب_الكيميائية.pdf',
      size: '2.4 ميجابايت',
      version: 3,
      subject: 'chemistry',
      updatedAt: '21 نوفمبر 2026',
    },
  ];

  const handleRestoreVersion = (file: FileItem) => {
    setRestoredNotice(`تم استعادة الإصدار السابق v${file.version - 1} بنجاح`);
    setTimeout(() => setRestoredNotice(null), 3000);
  };

  return (
    <div
      className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
      dir="rtl"
    >
      {/* Folder Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
        <button
          onClick={() => setIsFolderOpen(!isFolderOpen)}
          className="flex items-center gap-3 text-right group"
        >
          <motion.div
            whileHover={isReduced ? undefined : { scale: 1.08 }}
            className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors"
          >
            {isFolderOpen ? (
              <FolderOpen className="w-5 h-5" />
            ) : (
              <Folder className="w-5 h-5" />
            )}
          </motion.div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
              مجلد: مذكرات الصف الثالث الثانوي — الترم الأول
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">3 ملفات معتمدة • تنظيم ديناميكي بالأبواب والدروس</p>
          </div>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          مكتبة المعلم
        </span>
      </div>

      {/* Restore Notice Toast */}
      <AnimatePresence>
        {restoredNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{restoredNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files List with Staggered Entrance */}
      <AnimatePresence>
        {isFolderOpen && (
          <motion.div
            initial={isReduced ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={isReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {files.map((file, idx) => {
              const isSelected = selectedFileId === file.id;
              return (
                <motion.div
                  key={file.id}
                  initial={isReduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: isReduced ? 0 : idx * 0.08 }}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <EducationalSubjectBadge
                      subject={file.subject}
                      size="sm"
                      showLabel={false}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          v{file.version}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        {file.size} • {file.updatedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {file.version > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreVersion(file);
                        }}
                        title="استرجاع النسخة السابقة"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => e.stopPropagation()}
                      title="معاينة وتحميل"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
