import * as fs from 'fs';
import * as path from 'path';
import type { Skill } from './types';

export function loadSkillsFromDir(skillsDir: string): Skill[] {
  const skills: Skill[] = [];
  if (!fs.existsSync(skillsDir)) return skills;

  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(skillsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    let name = file.replace('.md', '');
    let description = '';
    let skillContent = content;

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      skillContent = content.slice(frontmatterMatch[0].length);

      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      const descMatch = frontmatter.match(/description:\s*(.+)/);
      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
    }

    skills.push({
      name,
      description,
      content: skillContent.trim(),
      source: filePath,
    });
  }
  return skills;
}
