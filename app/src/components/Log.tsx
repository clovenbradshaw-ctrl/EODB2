import { useEffect, useRef } from 'react';

type Entry = { id: number; level: 'info' | 'error'; msg: string };

interface Props {
  entries: Entry[];
}

export function Log({ entries }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  if (entries.length === 0) return null;
  return (
    <div className="log" ref={ref}>
      {entries.map((e) => (
        <div key={e.id} className={e.level === 'error' ? 'err' : ''}>
          {e.msg}
        </div>
      ))}
    </div>
  );
}
