import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-dark-800 prose-code:bg-surface-100 prose-code:px-1 prose-code:rounded prose-pre:bg-dark-900 prose-pre:text-surface-100 prose-table:text-sm prose-th:text-left prose-th:px-2 prose-th:py-1 prose-th:bg-surface-100 prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-surface-200 prose-th:border prose-th:border-surface-200">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
    </div>
  );
}
