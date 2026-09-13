declare module 'vitest' {
  export interface ProvidedContext {
    e2eBaseUrl: string;
    e2eWsBaseUrl: string;
  }
}

export {};
