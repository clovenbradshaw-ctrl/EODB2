export interface Operator {
  key: string;
  glyph: string;
  triad: 'existence' | 'structure' | 'significance';
  order: number;
  stored: boolean;
}

export const OP: {
  NUL: Operator;
  SIG: Operator;
  INS: Operator;
  SEG: Operator;
  CON: Operator;
  SYN: Operator;
  DEF: Operator;
  EVA: Operator;
  REC: Operator;
};

export function setNamespace(namespace: string): void;
export function getNamespace(): string;
export function eventType(op: Operator): string;
export function parseEventType(type: string): Operator | null;
export function emit(roomId: string, op: Operator, content: unknown): Promise<string>;
export function ins(
  roomId: string,
  entityType: string,
  payload?: Record<string, unknown>,
): Promise<string>;
export function def(
  roomId: string,
  anchor: string,
  path: string,
  value: unknown,
): Promise<string>;
export function defSchema(roomId: string, path: string, value: unknown): Promise<string>;
export function seg(roomId: string, anchor: string, partition: string): Promise<string>;
export function con(
  roomId: string,
  sourceAnchor: string,
  targetAnchor: string,
  relationType: string,
): Promise<string>;
export function syn(
  roomId: string,
  inputAnchors: string[],
  output: Record<string, unknown>,
): Promise<string>;
export function eva(
  roomId: string,
  anchor: string,
  criterion: string,
  result: string,
  note?: string,
): Promise<string>;
export function rec(
  roomId: string,
  scope: string,
  beforeFrame: unknown,
  afterFrame: unknown,
): Promise<string>;
