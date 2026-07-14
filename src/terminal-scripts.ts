/**
 * Texture for the fake terminals in the film. Generic on purpose — rewrite
 * freely, this is yours. Each session is a list of lines; the film reveals them
 * one at a time as the window ages, so more lines = a longer-running agent.
 */

export interface Session {
  readonly cmd: string;
  readonly lines: readonly string[];
}

/**
 * The one the reader types. It starts as a bare prompt; the command arrives a
 * character at a time on scroll, then launches an agent like any other.
 */
export const HERO_SESSION: Session = {
  cmd: 'my-agent "refactor auth"',
  lines: ['reading src/auth/*.ts', 'found 3 call sites', 'editing session.ts', '+42 -17'],
};

export const SESSIONS: readonly Session[] = [
  { cmd: 'my-agent "refactor auth"', lines: ['reading src/auth/*.ts', 'found 3 call sites', 'editing session.ts', '+42 -17'] },
  { cmd: 'my-agent "why is login slow"', lines: ['tracing request', 'db query 1.2s', 'missing index'] },
  { cmd: 'my-agent "write tests"', lines: ['12 passing', '2 failing', 'retrying'] },
  { cmd: 'my-agent "upgrade deps"', lines: ['resolving', '31 packages', 'peer conflict'] },
  { cmd: 'my-agent "fix flaky spec"', lines: ['seed 8812', 'race in setup', 'patched'] },
  { cmd: 'my-agent "audit sql"', lines: ['scanning', '4 n+1 queries'] },
  { cmd: 'my-agent "port to esm"', lines: ['84 files', 'rewriting imports'] },
  { cmd: 'my-agent "read the rfc"', lines: ['summarizing', 'section 4 conflicts'] },
  { cmd: 'my-agent "profile build"', lines: ['cold 41s', 'tsc dominates'] },
  { cmd: 'my-agent "draft migration"', lines: ['diffing schema', 'add column'] },
  { cmd: 'my-agent "grep for todos"', lines: ['61 hits', 'clustering'] },
  { cmd: 'my-agent "review pr 212"', lines: ['3 comments', 'one blocking'] },
];
