import { execSync } from 'node:child_process';

function readGitMetadata(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const gitSha =
  process.env.NEXT_PUBLIC_GIT_SHA ||
  process.env.GIT_COMMIT_SHA ||
  process.env.WORKERS_CI_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  readGitMetadata('git rev-parse HEAD') ||
  'unknown';

const gitBranch =
  process.env.NEXT_PUBLIC_GIT_BRANCH ||
  process.env.WORKERS_CI_BRANCH ||
  process.env.CF_PAGES_BRANCH ||
  readGitMetadata('git rev-parse --abbrev-ref HEAD') ||
  'unknown';

const buildTimestamp = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_GIT_BRANCH: gitBranch,
    NEXT_PUBLIC_BUILD_TIMESTAMP: buildTimestamp,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
