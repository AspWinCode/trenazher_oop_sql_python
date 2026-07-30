import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Таблицы стилизуем вручную и оборачиваем в not-prose, иначе стили Tailwind prose
// (более специфичные) перебивают классы ячеек и таблица выходит без рамок.
const components: Components = {
  table: ({ children }) => (
    <div className="not-prose my-4 overflow-x-auto">
      <table className="w-full border-collapse border border-surface-200 text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-100">{children}</thead>,
  tr: ({ children }) => <tr className="even:bg-surface-50">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-surface-200 px-3 py-2 text-left font-semibold text-dark-800 align-top">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-surface-200 px-3 py-2 text-dark-700 align-top">
      {children}
    </td>
  ),
};

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-dark-800 prose-code:bg-surface-100 prose-code:px-1 prose-code:rounded prose-pre:bg-dark-900 prose-pre:text-surface-100">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
