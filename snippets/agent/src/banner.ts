export async function printBanner(): Promise<void> {
  const chalk = await import('chalk');
  const g = chalk.default.green;
  const w = chalk.default.white.bold;
  const dim = chalk.default.gray;

  process.stdout.write('\n');
  process.stdout.write(`    ${g('       .    ')}\n`);
  process.stdout.write(`    ${g('      /|\\  ')}     ${w('mongosh')}\n`);
  process.stdout.write(
    `    ${g('     / | \\ ')}       ${g('▄▄▄    ▄▄▄▄   ▄▄▄▄  ▄ ▄▄▄  ▄▄█▄▄')}\n`,
  );
  process.stdout.write(
    `    ${g('    /  |  \\')}      ${g('▀   █  █▀ ▀█  █▀  █  █▀  █    █')}\n`,
  );
  process.stdout.write(
    `    ${g('   |   |   |')}     ${g('▄▀▀▀█  █   █  █▀▀▀▀  █   █    █')}\n`,
  );
  process.stdout.write(
    `    ${g('    \\  |  /')}      ${g('▀▄▄▀█  ▀█▄▀█  ▀█▄▄▀  █   █    ▀▄▄')}\n`,
  );
  process.stdout.write(`    ${g('     \\/|\\/ ')}       ${g('       ▄  █')}\n`);
  process.stdout.write(`    ${g('      |||   ')}      ${g('        ▀▀')}\n`);
  process.stdout.write(`\n`);
  process.stdout.write(
    dim('  Type your prompts below. Enter to send, /quit to quit.\n'),
  );
  process.stdout.write(
    dim('  Run mongosh commands manually with: $ <query>\n'),
  );
}
