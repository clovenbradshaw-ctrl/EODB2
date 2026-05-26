export interface MediaReference {
  __media: 1;
  mxc: string;
  mime: string;
  size: number;
  name: string;
}

export const HOIST_THRESHOLD: number;
export const CONTENT_SIZE_LIMIT: number;

export function contentSize(content: unknown): number;
export function hoistLargeFields(
  content: unknown,
): Promise<{ content: unknown; hoisted: number }>;
export function resolveMediaReferences(content: unknown): Promise<unknown>;
