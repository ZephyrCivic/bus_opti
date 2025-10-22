/**
 * src/features/duties/components/DutyCsvPreview.tsx
 * Duties CSV のプレビューを表示し、コピー操作を補助するカードコンポーネント。
 */
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DutyCsvPreviewProps {
  csv: string;
  rowCount: number;
  fileName: string;
  generatedAt?: string;
}

const MAX_LINES = 50;

export function DutyCsvPreview({ csv, rowCount, fileName, generatedAt }: DutyCsvPreviewProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => csv.split(/\r?\n/), [csv]);
  const previewLines = useMemo(() => {
    if (expanded) {
      return lines;
    }
    return lines.slice(0, MAX_LINES);
  }, [expanded, lines]);
  const hiddenCount = lines.length - previewLines.length;

  const handleCopy = useCallback(() => {
    const text = csv;
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard !== 'undefined') {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success('CSV をクリップボードにコピーしました。');
        })
        .catch(() => {
          toast.error('コピーに失敗しました。');
        });
      return;
    }
    if (typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('CSV をクリップボードにコピーしました。');
        return;
      } catch (error) {
        console.warn('CSV copy fallback failed', error);
      }
    }
    toast.error('コピーに失敗しました。');
  }, [csv]);

  return (
    <Card data-testid="duties-csv-preview">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Duty CSV プレビュー</CardTitle>
          <CardDescription>
            エクスポート前に内容を確認できます。行数: {rowCount}{rowCount === 1 ? ' 行' : ' 行'}
          </CardDescription>
          <p className="mt-1 text-xs text-muted-foreground">ファイル名: {fileName}{generatedAt ? ` ／ 生成時刻: ${generatedAt}` : null}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? '折りたたむ' : '全て表示'}
          </Button>
          <Button onClick={handleCopy}>CSV をコピー</Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="max-h-72 overflow-auto rounded-md bg-muted/70 p-3 text-xs font-mono leading-relaxed">
          {previewLines.map((line, index) => (
            <span key={`${index}-${line}`} className="block">
              {line}
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="block text-muted-foreground">…ほか {hiddenCount} 行</span>
          ) : null}
        </pre>
      </CardContent>
    </Card>
  );
}
