import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function readTemplateFile(templateDirectory: string, templateRelativePath: string): Promise<string> {
	const templatePath = path.join(templateDirectory, templateRelativePath);
	return fs.readFile(templatePath, 'utf8');
}
