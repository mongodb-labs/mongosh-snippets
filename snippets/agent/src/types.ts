export type ShellInstanceState = {
  evaluationListener: {
    setConfig: (key: string, value: unknown) => void;
    getConfig: <T>(key: string) => Promise<T>;
  };
  shellApi: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type CliContext = {
  db: {
    _mongo: {
      _instanceState: ShellInstanceState;
    };
  };
};

export type Skill = {
  name: string;
  description: string;
  content: string;
  source: string;
};
