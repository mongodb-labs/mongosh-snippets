declare global {
  var ai: {
    login: () => Promise<void>;
    explain: (code: string) => Promise<string>;
    ask: (question: string) => Promise<string>;
  };
}

export {};
