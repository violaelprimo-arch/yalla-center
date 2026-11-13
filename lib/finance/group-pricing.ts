import { toCents, type GroupPricing } from '@/lib/timetable/group-schedule';

type SessionPricing = Extract<GroupPricing, { model: 'per_session' }>;

export function splitPrivateFee(fee: number, teacherPercentage: number) {
  const revenue = toCents(fee);
  const teacher = Math.round(revenue * toCents(teacherPercentage) / 10000);
  return { teacher: teacher / 100, center: (revenue - teacher) / 100 };
}

export function calculateFixedSessionSplit(pricing: SessionPricing, tickets: { netAmount: number; paidAmount: number }[]) {
  const agreedTeacher = toCents(pricing.teacherFee);
  let billed = 0;
  let collected = 0;
  let teacherDue = 0;
  let teacherCollected = 0;
  for (const ticket of tickets) {
    const net = toCents(ticket.netAmount);
    const paid = Math.min(net, toCents(ticket.paidAmount));
    const due = Math.min(net, agreedTeacher);
    billed += net;
    collected += paid;
    teacherDue += due;
    teacherCollected += Math.min(due, paid);
  }
  return {
    revenue: billed / 100, collected: collected / 100,
    teacherDue: teacherDue / 100, centerNet: (billed - teacherDue) / 100,
    teacherCollected: teacherCollected / 100, centerCollected: (collected - teacherCollected) / 100,
  };
}
