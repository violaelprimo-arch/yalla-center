'use client';

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Tag, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SaasPlatformService } from '@/lib/saas/service';
import { DynamicExpenseCategory } from '@/lib/saas/types';

export function ExpenseCategoriesModal({
  isOpen,
  onClose,
  onCategoriesChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged: () => void;
}) {
  const [categories, setCategories] = useState<DynamicExpenseCategory[]>(() =>
    SaasPlatformService.getExpenseCategories()
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newDescAr, setNewDescAr] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editDescAr, setEditDescAr] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameAr.trim()) return;
    SaasPlatformService.createExpenseCategory({
      key: newKey || newNameAr,
      nameAr: newNameAr,
      descriptionAr: newDescAr,
    });
    setNewKey('');
    setNewNameAr('');
    setNewDescAr('');
    setIsAdding(false);
    setCategories(SaasPlatformService.getExpenseCategories());
    onCategoriesChanged();
  };

  const handleStartEdit = (cat: DynamicExpenseCategory) => {
    setEditingId(cat.id);
    setEditNameAr(cat.nameAr);
    setEditDescAr(cat.descriptionAr || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editNameAr.trim()) return;
    SaasPlatformService.updateExpenseCategory(id, {
      nameAr: editNameAr,
      descriptionAr: editDescAr,
    });
    setEditingId(null);
    setCategories(SaasPlatformService.getExpenseCategories());
    onCategoriesChanged();
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
      SaasPlatformService.deleteExpenseCategory(id);
      setCategories(SaasPlatformService.getExpenseCategories());
      onCategoriesChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Tag className="w-4 h-4" />
            </span>
            <h3 className="text-base font-black text-foreground">
              إدارة أقسام وتصنيفات المصروفات
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs p-1"
          >
            ✕
          </button>
        </div>

        <p className="text-muted-foreground text-xs">
          يمكنك إضافة وتعديل أقسام المصاريف ديناميكياً لتصنيف كافة تكاليف المنصة بدقة.
        </p>

        {/* Categories List */}
        <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
          {categories.map((cat) => {
            const isEditing = editingId === cat.id;
            return (
              <div
                key={cat.id}
                className="p-3 rounded-2xl border border-border bg-muted/20 flex items-center justify-between gap-3"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editNameAr}
                      onChange={(e) => setEditNameAr(e.target.value)}
                      placeholder="اسم القسم بالعربية"
                      className="w-full h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={editDescAr}
                      onChange={(e) => setEditDescAr(e.target.value)}
                      placeholder="وصف مختصر للقسم"
                      className="w-full h-8 px-2.5 rounded-xl border border-border bg-background text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="h-7 text-[11px] px-2"
                      >
                        إلغاء
                      </Button>
                      <Button
                        type="button"
                        variant="cyan"
                        size="sm"
                        onClick={() => handleSaveEdit(cat.id)}
                        className="h-7 text-[11px] px-2 font-bold"
                      >
                        حفظ التعديل
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong className="text-foreground text-xs font-bold block">
                        {cat.nameAr}
                      </strong>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        كود: {cat.key}
                      </span>
                      {cat.descriptionAr && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {cat.descriptionAr}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="تعديل"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Category Form Toggle */}
        {!isAdding ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="w-full text-xs font-bold gap-1.5 h-9"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة قسم مصروفات جديد</span>
          </Button>
        ) : (
          <form onSubmit={handleAdd} className="p-3.5 rounded-2xl border border-brand-cyan-500/30 bg-card space-y-2.5">
            <h4 className="font-bold text-xs text-foreground">بيانات القسم الجديد</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="اسم القسم (مثال: الرسائل البريدية)"
                value={newNameAr}
                onChange={(e) => {
                  setNewNameAr(e.target.value);
                  if (!newKey) {
                    setNewKey(e.target.value.trim().toLowerCase().replace(/\s+/g, '_'));
                  }
                }}
                className="w-full h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-bold"
                required
              />
              <input
                type="text"
                placeholder="الكود الإنجليزي (email_api)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-mono"
                dir="ltr"
                required
              />
            </div>
            <input
              type="text"
              placeholder="وصف القسم وتوضيحه"
              value={newDescAr}
              onChange={(e) => setNewDescAr(e.target.value)}
              className="w-full h-8 px-2.5 rounded-xl border border-border bg-background text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="h-7 text-xs"
              >
                إلغاء
              </Button>
              <Button type="submit" variant="cyan" size="sm" className="h-7 text-xs font-bold">
                إضافة القسم
              </Button>
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-border flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
