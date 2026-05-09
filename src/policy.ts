/**
 * Policy engine for hermes-board-mcp.
 *
 * Reads policy.yaml (default-deny per profile) and enforces tool access.
 * Supports SIGHUP for hot-reload.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const DEFAULT_POLICY_PATH = resolve(
  process.env.BOARD_MCP_POLICY || fileURLToPath(new URL('../policy.yaml', import.meta.url))
);

interface PolicyProfile {
  tools: string[];
}

interface Policy {
  profiles: Record<string, PolicyProfile>;
}

let _policy: Policy = { profiles: {} };

function loadPolicy() {
  const policyPath = process.env.BOARD_MCP_POLICY
    ? resolve(process.env.BOARD_MCP_POLICY)
    : DEFAULT_POLICY_PATH;

  try {
    const raw = readFileSync(policyPath, 'utf8');
    _policy = (yaml.load(raw) || { profiles: {} }) as Policy;
    const profiles = Object.keys(_policy.profiles || {});
    console.log(`[policy] loaded ${profiles.length} profile(s) from ${policyPath}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`[policy] WARN: could not read policy file (${policyPath}): ${err.message}`);
    }
    _policy = { profiles: {} };
  }
}

export function initPolicy() {
  loadPolicy();
  process.on('SIGHUP', () => {
    console.log('[policy] SIGHUP received — reloading policy');
    loadPolicy();
  });
}

export class PolicyViolationError extends Error {
  profile: string;
  tool: string;

  constructor(profile: string, tool: string) {
    super(`Profile "${profile}" is not allowed to call tool "${tool}"`);
    this.name = 'PolicyViolationError';
    this.profile = profile;
    this.tool = tool;
  }
}

/**
 * Check if a profile has access to a tool.
 * Throws PolicyViolationError on denial.
 */
export function checkAccess(profile: string, toolName: string): void {
  const profileConfig = _policy.profiles?.[profile];
  if (!profileConfig) {
    throw new PolicyViolationError(profile, toolName);
  }

  const allowed = profileConfig.tools || [];
  if (!allowed.includes(toolName)) {
    throw new PolicyViolationError(profile, toolName);
  }
}
