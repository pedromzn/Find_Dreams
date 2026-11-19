/**
 * Markdown from files the AI or a job page wrote (job post, company research, CV, messages).
 *
 * That text is untrusted: `react-markdown` keeps its default, which does NOT interpret HTML (no `rehype-raw`), and
 * links open in the system browser tab without `opener`. The front matter (`---` block) is shown as metadata elsewhere,
 * so it is cut here.
 */

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { join } from './ui'

const COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
}

const PLUGINS = [remarkGfm]

export const withoutFrontMatter = (text: string) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={join('reading', className)}>
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {withoutFrontMatter(text)}
      </ReactMarkdown>
    </div>
  )
}
