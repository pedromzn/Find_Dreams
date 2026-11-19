/** One practice interview: the transcript and the feedback (scores, stuck points with a better answer, what to train). */

import { useParams, Link } from 'react-router-dom'
import type { ApplicationDetail } from '@shared/api'
import { Badge, Empty, Header, Loading, Panel, Problems, ScreenError, join } from '@/components/ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'
import { useLiveReload } from '@/lib/events'
import { useHandOff } from '@/agent/AgentActions'
import { Button } from '@/components/ui'

export default function InterviewDetail() {
  const { slug = '', folder = '' } = useParams()
  const t = useT()
  const i = t.interview
  const detail = useData<ApplicationDetail>(`/api/applications/${slug}`)
  useLiveReload(detail.reload, slug)
  const handOff = useHandOff(detail.reload)
  if (detail.error) return <ScreenError error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return <Loading />
  const interview = detail.data.interviews.find((x) => x.id === folder)
  if (!interview) return <ScreenError error={{ message: t.application.notFound }} />
  const { session, feedback } = interview

  return (
    <div className="flex flex-col gap-6">
      <Header
        title={session ? t.interviewType[session.interviewType] : folder}
        note={
          <Link to={`/applications/${slug}`}>
            {detail.data.application?.company} · {detail.data.application?.role}
          </Link>
        }
      />
      <Problems problems={interview.problems} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col gap-4 p-6">
          <h2 className="text-xl">{i.feedback}</h2>
          {!feedback ? (
            <Empty title={i.noFeedback}>
              <Button
                variant="subtle"
                className="mt-3"
                disabled={handOff.busy}
                onClick={() =>
                  handOff.start('interview-feedback', {
                    application: slug,
                    file: `interviews/${folder}/transcript.json`,
                    ...(session ? { interviewType: session.interviewType } : {}),
                  })
                }
              >
                {i.getFeedback}
              </Button>
              {handOff.dialog}
            </Empty>
          ) : (
            <>
              <p className="text-text">{feedback.overall}</p>
              <section>
                <h3 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{i.scores}</h3>
                <ul className="flex flex-col gap-2">
                  {feedback.scores.map((s) => (
                    <li key={s.criterion}>
                      <p className="flex items-center gap-2 text-text">
                        {s.criterion}{' '}
                        <Badge tone={s.score >= 4 ? 'success' : s.score <= 2 ? 'warning' : 'neutral'}>
                          {s.score}/5
                        </Badge>
                      </p>
                      <p className="text-sm text-muted">{s.comment}</p>
                    </li>
                  ))}
                </ul>
              </section>
              {feedback.strengths.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{i.strengths}</h3>
                  <ul className="list-disc pl-5 text-text">
                    {feedback.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </section>
              )}
              {feedback.stuckPoints.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium tracking-wide text-muted uppercase">{i.stuck}</h3>
                  {feedback.stuckPoints.map((p) => (
                    <div key={p.excerpt} className="flex flex-col gap-2 rounded-tile border border-border bg-bg p-4">
                      <p className="text-xs text-faint">{i.youSaid}</p>
                      <blockquote className="border-l-2 border-accent pl-3 text-text italic">“{p.excerpt}”</blockquote>
                      <p className="text-sm text-muted">
                        <span className="text-faint">{i.why}: </span>
                        {p.why}
                      </p>
                      <p className="text-xs text-faint">{i.better}</p>
                      <p className="text-success">{p.betterAnswer}</p>
                    </div>
                  ))}
                </section>
              )}
              {feedback.nextPractice.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{i.nextPractice}</h3>
                  <ul className="list-disc pl-5 text-text">
                    {feedback.nextPractice.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </Panel>
        <Panel className="flex flex-col gap-3 p-6">
          <h2 className="text-xl">{i.transcript}</h2>
          <ol className="flex flex-col gap-3">
            {session?.turns.map((turn, n) => (
              <li key={n} className={join('flex flex-col gap-0.5', turn.speaker === 'candidate' && 'items-end')}>
                <span className="text-xs text-faint">{turn.speaker === 'interviewer' ? i.interviewer : i.you}</span>
                <p
                  className={join(
                    'max-w-[90%] rounded-tile px-3 py-2 text-sm whitespace-pre-wrap',
                    turn.speaker === 'interviewer' ? 'bg-surface-2 text-text' : 'bg-accent/90 text-on-accent',
                  )}
                >
                  {turn.text}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  )
}
