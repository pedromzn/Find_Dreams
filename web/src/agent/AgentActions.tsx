/** The buttons that hand a task to the person's AI. Filled in by the agent-kit phase; nothing to show yet. */

export type AgentTask = 'analyze-fit' | 'research-company' | 'interviews' | 'fix-files'

export function AgentActions(_props: { slug: string; only: AgentTask[]; onDone: () => void }) {
  return null
}

export function MessageActions(_props: { slug: string; message: string; onDone: () => void }) {
  return null
}
