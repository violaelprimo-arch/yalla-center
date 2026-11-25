import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const isProd = process.env.NODE_ENV === 'production';
  const secureAttr = isProd ? '; Secure' : '';
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.headers.append('Set-Cookie', `yc_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttr}`);
  response.headers.append('Set-Cookie', `yc_role=; Path=/; Max-Age=0; SameSite=Lax`);
  response.headers.append('Set-Cookie', `yc_tenant=; Path=/; Max-Age=0; SameSite=Lax`);
  response.headers.append('Set-Cookie', `yc_user_id=; Path=/; Max-Age=0; SameSite=Lax`);
  return response;
}
