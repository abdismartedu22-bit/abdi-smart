import katex from 'katex';

export function renderMathToHtml(text: string): string {
  let html = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }); }
      catch { return `<code>${math}</code>`; }
    })
    .replace(/\$((?:[^$\\]|\\.)+?)\$/g, (_, math) => {
      try { return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }); }
      catch { return `<code>${math}</code>`; }
    })
    .replace(/\n/g, '<br>');
  return html;
}

export default function MathText({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <span
      style={{ fontFamily: 'var(--font-body)', ...style }}
      dangerouslySetInnerHTML={{ __html: renderMathToHtml(text) }}
    />
  );
}
