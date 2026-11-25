import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface VersionMetadataBinding {
  id?: string;
  tag?: string;
  timestamp?: string;
}

export async function GET() {
  let cloudflareVersionId: string | null = null;
  let cloudflareVersionTag: string | null = null;
  let cloudflareVersionTimestamp: string | null = null;
  let appEnv: string = process.env.APP_ENV || process.env.NODE_ENV || 'unknown';
  let dataProviderMode: string = process.env.DATA_PROVIDER_MODE || 'production';

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as unknown as Record<string, unknown> | undefined;
    if (env) {
      const meta = env.CF_VERSION_METADATA as VersionMetadataBinding | undefined;
      if (meta?.id) cloudflareVersionId = meta.id;
      if (meta?.tag) cloudflareVersionTag = meta.tag;
      if (meta?.timestamp) cloudflareVersionTimestamp = meta.timestamp;
      if (typeof env.APP_ENV === 'string' && env.APP_ENV) appEnv = env.APP_ENV;
      if (typeof env.DATA_PROVIDER_MODE === 'string' && env.DATA_PROVIDER_MODE) {
        dataProviderMode = env.DATA_PROVIDER_MODE;
      }
    }
  } catch {
    // Running outside Cloudflare Workers (e.g., local Next.js server or Vitest)
  }

  return NextResponse.json(
    {
      service: 'yalla-center',
      gitCommitSha: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown',
      gitBranch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'unknown',
      buildTimestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || 'unknown',
      environment: appEnv,
      dataProviderMode,
      cloudflareVersionId,
      cloudflareVersionTag,
      cloudflareVersionTimestamp,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
