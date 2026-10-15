export interface DigestItem {
  id: number;
  title: string;
  url: string;
  storyUrl: string;
  score: number;
  by?: string;
  descendants?: number;
  summary?: string | null;
  tags?: string[];
  about_ai?: boolean | number;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractDomain(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function formatDigestDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function renderHtmlDigest(
  items: DigestItem[],
  date: Date = new Date()
): string {
  const formattedDate = formatDigestDate(date);
  const totalStories = items.length;

  const storyRows = items
    .map((item, index) => {
      const escapedTitle = escapeHtml(item.title);
      const articleUrl = item.url || item.storyUrl;
      const escapedArticleUrl = escapeHtml(articleUrl);
      const escapedStoryUrl = escapeHtml(item.storyUrl);
      const domain = extractDomain(articleUrl);
      const isAi = item.about_ai === true || item.about_ai === 1;
      const commentsCount = item.descendants ?? 0;

      const aiBadgeHtml = isAi
        ? `<span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 9999px; border: 1px solid #bfdbfe; margin-left: 6px;">✦ AI</span>`
        : '';

      const domainHtml = domain
        ? `<span style="font-size: 13px; color: #94a3b8; font-weight: 400; margin-left: 6px;">(${escapeHtml(domain)})</span>`
        : '';

      const summaryHtml = item.summary
        ? `<p style="margin: 8px 0 10px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">${escapeHtml(item.summary)}</p>`
        : '';

      const tagsHtml =
        item.tags && item.tags.length > 0
          ? `<div style="margin-top: 8px;">
              ${item.tags
                .map(
                  (tag) =>
                    `<span style="display: inline-block; background-color: #f1f5f9; color: #475569; font-size: 11.5px; font-weight: 500; padding: 2px 8px; border-radius: 4px; margin-right: 6px; margin-bottom: 4px;">#${escapeHtml(tag)}</span>`
                )
                .join('')}
            </div>`
          : '';

      const dividerHtml =
        index < items.length - 1
          ? `<hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />`
          : '';

      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; align-items: baseline; margin-bottom: 6px;">
            <span style="font-size: 14px; font-weight: 600; color: #94a3b8; min-width: 24px; display: inline-block;">${index + 1}.</span>
            <div style="flex: 1;">
              <a href="${escapedArticleUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 16.5px; font-weight: 600; color: #0f172a; text-decoration: none; line-height: 1.4;">${escapedTitle}</a>${domainHtml}${aiBadgeHtml}
            </div>
          </div>
          <div style="font-size: 12.5px; color: #64748b; margin-bottom: 8px; margin-left: 24px;">
            <span style="font-weight: 600; color: #ea580c;">▲ ${item.score} pts</span>
            ${item.by ? `<span style="margin: 0 6px;">•</span><span>by ${escapeHtml(item.by)}</span>` : ''}
            <span style="margin: 0 6px;">•</span>
            <a href="${escapedStoryUrl}" target="_blank" rel="noopener noreferrer" style="color: #475569; text-decoration: underline;">💬 ${commentsCount} comments</a>
          </div>
          <div style="margin-left: 24px;">
            ${summaryHtml}
            ${tagsHtml}
          </div>
        </div>
        ${dividerHtml}
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hacker News Digest - ${formattedDate}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <!-- Top Accent Bar -->
    <tr>
      <td style="height: 4px; background-color: #ff6600;"></td>
    </tr>
    <!-- Header -->
    <tr>
      <td style="padding: 24px 32px 18px 32px; border-bottom: 1px solid #f1f5f9;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">Hacker News Digest</h1>
              <p style="margin: 0; font-size: 13.5px; color: #64748b;">${formattedDate} &bull; ${totalStories} top stories curated with executive AI summaries</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Story List -->
    <tr>
      <td style="padding: 24px 32px 16px 32px;">
        ${storyRows}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">Generated by <strong style="color: #64748b;">digest-web-news</strong></p>
        <p style="margin: 0;">Automated executive web news distillation</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderTextDigest(
  items: DigestItem[],
  date: Date = new Date()
): string {
  const formattedDate = formatDigestDate(date);
  const header = `HACKER NEWS DIGEST - ${formattedDate}\n${'='.repeat(80)}\n\n`;

  const body = items
    .map((item, index) => {
      const articleUrl = item.url || item.storyUrl;
      const isAi = item.about_ai === true || item.about_ai === 1;
      const aiTag = isAi ? ' [AI]' : '';
      const tags =
        item.tags && item.tags.length > 0
          ? `\nTags: ${item.tags.join(', ')}`
          : '';
      const summary = item.summary ? `\n${item.summary}` : '';

      return [
        `${index + 1}. ${item.title}${aiTag}`,
        `   URL: ${articleUrl}`,
        `   Discussion (${item.score} pts, ${item.descendants ?? 0} comments): ${item.storyUrl}`,
        summary,
        tags,
      ]
        .filter((line) => line !== '')
        .join('\n');
    })
    .join(`\n\n${'-'.repeat(80)}\n\n`);

  return header + body + '\n';
}
