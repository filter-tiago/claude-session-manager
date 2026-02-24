import type { Components } from 'react-markdown';

/**
 * Shared ReactMarkdown component overrides for ledger viewer/editor.
 * Extracted to module level (3E) to avoid recreating the object on every render.
 * None of these overrides depend on props or state.
 */
export const MARKDOWN_COMPONENTS: Components = {
  // Custom checkbox rendering for task lists
  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-2 accent-[var(--accent-primary)]"
      {...props}
    />
  ),
  // Style code blocks
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !className;

    return isInline ? (
      <code
        className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--accent-secondary)]"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className={`${className} block bg-[var(--bg-tertiary)] p-4 rounded-lg overflow-x-auto`}
        {...props}
      >
        {children}
      </code>
    );
  },
  // Style tables
  table: ({ children }) => (
    <table className="border-collapse w-full">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-left text-sm">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--border)] px-3 py-2 text-sm">
      {children}
    </td>
  ),
  // Style links
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-[var(--accent-primary)] hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  // Style headers
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-6 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-6 mb-3 pb-2 border-b border-[var(--border)]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-medium text-[var(--text-primary)] mt-4 mb-2">
      {children}
    </h3>
  ),
  // Style lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 my-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 my-2">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-[var(--text-secondary)]">
      {children}
    </li>
  ),
  // Style blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[var(--purple)] pl-4 my-4 text-[var(--text-secondary)] italic">
      {children}
    </blockquote>
  ),
  // Style paragraphs
  p: ({ children }) => (
    <p className="my-2 text-[var(--text-secondary)]">
      {children}
    </p>
  ),
};
