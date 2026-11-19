#!/usr/bin/env node
/**
 * A fake ACP agent for the tests: speaks the real protocol (official SDK) over stdio. On a prompt it streams a text
 * chunk, reports a tool call, asks for permission to write, and — if allowed — writes `fake-agent-was-here.md` in its
 * cwd through the client's fs method. `FAKE_AGENT_MODE=crash` exits right away; `slow` waits until cancelled.
 */
import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'

if (process.env.FAKE_AGENT_MODE === 'crash') {
  process.stderr.write('fake agent: crashing on purpose\n')
  process.exit(3)
}

let cancelled = false
let interviewTurns = 0
const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin))
acp
  .agent({ name: 'fake-agent' })
  .onRequest(acp.methods.agent.initialize, () => ({ protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: {} }))
  .onRequest(acp.methods.agent.session.new, () => ({ sessionId: 'fake-session' }))
  .onNotification(acp.methods.agent.session.cancel, () => {
    cancelled = true
  })
  .onRequest(acp.methods.agent.session.prompt, async ({ params, client }) => {
    const sessionId = params.sessionId
    const said = params.prompt.map((b) => (b.type === 'text' ? b.text : '')).join(' ')
    if (said.includes('MZN-INTERVIEWER') || said.includes('The candidate says')) {
      interviewTurns++
      const reply =
        interviewTurns >= 3
          ? { say: 'Thank you, that is all for today.', intent: 'end', notes: '' }
          : {
              say: interviewTurns === 1 ? 'Hi! Tell me about yourself.' : 'Can you give a concrete example?',
              intent: 'probe',
              notes: 'n',
            }
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: JSON.stringify(reply) } },
      })
      return { stopReason: 'end_turn' }
    }
    await client.notify(acp.methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: said.includes('connection test')
            ? process.env.FAKE_AGENT_MODE === 'error-text'
              ? 'unexpected status 402 Payment Required'
              : 'OK'
            : 'Working on it. ',
        },
      },
    })
    if (said.includes('connection test')) return { stopReason: 'end_turn' }
    if (process.env.FAKE_AGENT_MODE === 'slow') {
      while (!cancelled) await new Promise((r) => setTimeout(r, 20))
      return { stopReason: 'cancelled' }
    }
    await client.notify(acp.methods.client.session.update, {
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        title: 'Write fake-agent-was-here.md',
        kind: 'edit',
        status: 'pending',
      },
    })
    const answer = await client.request(acp.methods.client.session.requestPermission, {
      sessionId,
      toolCall: { toolCallId: 't1', title: 'Write fake-agent-was-here.md' },
      options: [
        { optionId: 'yes', name: 'Allow', kind: 'allow_once' },
        { optionId: 'no', name: 'Reject', kind: 'reject_once' },
      ],
    })
    if (answer.outcome.outcome === 'selected' && answer.outcome.optionId === 'yes') {
      await client.request(acp.methods.client.fs.writeTextFile, {
        sessionId,
        path: 'fake-agent-was-here.md',
        content: `# done\n\n${said.slice(0, 80)}\n`,
      })
      let blocked = false
      try {
        await client.request(acp.methods.client.fs.writeTextFile, { sessionId, path: '../escape.md', content: 'no' })
      } catch {
        blocked = true
      }
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' },
      })
      await client.notify(acp.methods.client.session.update, {
        sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: blocked ? 'Done.' : 'ESCAPED' },
        },
      })
    }
    return { stopReason: 'end_turn' }
  })
  .connect(stream)
