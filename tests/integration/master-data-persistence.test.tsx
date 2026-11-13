import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TenantProvider, useTenant } from '@/components/layout/tenant-provider';
import { masterDataStorageKey, saveDemoMasterData } from '@/lib/dal/master-data-client';
import { MockDataProvider } from '@/lib/dal/mock-data';

const tenantId = 'tenant-maher-001';

beforeEach(() => {
  window.localStorage.clear();
});

function Catalog() {
  const { masterData, branches } = useTenant();
  return <>
    <div>{masterData.data.stages.flatMap(stage => [stage.nameAr, ...stage.grades.map(grade => grade.nameAr)]).join('، ')}</div>
    <div>{masterData.data.subjects.map(subject => subject.nameAr).join('، ')}</div>
    <div>{branches.map(branch => branch.nameAr).join('، ')}</div>
    <button disabled={!masterData.canEdit} onClick={() => void masterData.save({
      action: 'saveBranch', branch: { nameAr: 'فرع تجربة التحميل' },
    })}>حفظ الفرع</button>
  </>;
}

it('loads changes to stages, grades, subjects, and branches after the provider is mounted again', async () => {
  const dal = new MockDataProvider();
  const tenant = (await dal.getTenantById(tenantId))!;
  const branches = await dal.getBranches(tenantId);
  const users = await dal.getUsers(tenantId);
  const page = <TenantProvider tenant={tenant} branches={branches} initialUsers={users}><Catalog /></TenantProvider>;
  const view = render(page);
  await waitFor(() => expect(screen.getByRole('button', { name: 'حفظ الفرع' })).toBeEnabled());
  await act(async () => screen.getByRole('button', { name: 'حفظ الفرع' }).click());
  await screen.findByText(/فرع تجربة التحميل/);

  const initial = await saveDemoMasterData(tenantId, { action: 'saveStage', stage: { nameAr: 'مرحلة تجربة التحميل' } });
  const stageId = initial.stages.find(item => item.nameAr === 'مرحلة تجربة التحميل')!.id;
  const updated = await saveDemoMasterData(tenantId, { action: 'saveGrade', grade: { stageId, nameAr: 'صف تجربة التحميل' } });
  const grade = updated.stages.find(item => item.id === stageId)!.grades[0].id;
  const catalog = await saveDemoMasterData(tenantId, {
    action: 'saveSubject', subject: { stage: stageId, grade, nameAr: 'مادة تجربة التحميل' },
  });
  const subject = catalog.subjects.find(item => item.nameAr === 'مادة تجربة التحميل')!;
  await saveDemoMasterData(tenantId, { action: 'saveSubject', subject: { ...subject, nameAr: 'مادة معدلة بعد الإضافة' } });

  view.unmount();
  render(page);
  await screen.findByText(/مرحلة تجربة التحميل/);
  expect(screen.getByText(/صف تجربة التحميل/)).toBeInTheDocument();
  expect(screen.getByText(/مادة معدلة بعد الإضافة/)).toBeInTheDocument();
  expect(screen.getByText(/فرع تجربة التحميل/)).toBeInTheDocument();
  expect(window.localStorage.getItem(masterDataStorageKey('tenant-rowad-002'))).toBeNull();
});

it('reports storage failure and does not overwrite a previous catalog', async () => {
  await saveDemoMasterData(tenantId, { action: 'saveBranch', branch: { nameAr: 'فرع محفوظ' } });
  const key = masterDataStorageKey(tenantId);
  const original = window.localStorage.getItem(key);
  const write = vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, 'setItem')
    .mockImplementationOnce(() => { throw new Error('quota'); });
  try {
    await expect(saveDemoMasterData(tenantId, {
      action: 'saveBranch', branch: { nameAr: 'فرع لم يُحفظ' },
    })).rejects.toThrow('تعذّر حفظ البيانات');
    expect(window.localStorage.getItem(key)).toBe(original);
  } finally {
    write.mockRestore();
  }
});
