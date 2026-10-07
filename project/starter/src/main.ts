import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';

dotenv.config();

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    fail('Usage: npm run dev -- <owner> <repo> <pr-number>');
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    fail('Pull request number must be a positive integer');
  }

  const hasAnthropicAuth =
    Boolean(process.env.ANTHROPIC_API_KEY) ||
    Boolean(process.env.ANTHROPIC_AUTH_TOKEN);

  const hasAwsAuth =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsAuth) {
    if (!process.env.AWS_REGION) {
      fail('AWS_REGION is required when using AWS Bedrock authentication');
    }

    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicAuth) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    fail(
      'No authentication configured. Set ANTHROPIC_API_KEY for Anthropic API access, ' +
      'or set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION for AWS Bedrock.'
    );
  }

  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    fail('ANTHROPIC_MODEL is not set');
  }

  const orchestrator = new CodeReviewOrchestrator({
    model,
  });

  try {
    console.log(`Starting review for ${owner}/${repo}#${prNumber}`);

    const startTime = Date.now();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);
    const duration = Date.now() - startTime;

    report.metadata.duration = duration;

    const generator = new ReportGenerator();
    const reportsDir = join(
      process.env.PROJECT_ROOT || process.cwd(),
      'reports'
    );

    await mkdir(reportsDir, { recursive: true });

    const baseName = `${owner}_${repo}_${prNumber}`;

    const markdown = generator.generateMarkdownReport(report);
    const html = generator.generateHTMLReport(report);
    const json = generator.generateJSONReport(report);

    await writeFile(join(reportsDir, `${baseName}.md`), markdown, 'utf8');
    await writeFile(join(reportsDir, `${baseName}.html`), html, 'utf8');
    await writeFile(join(reportsDir, `${baseName}.json`), json, 'utf8');

    console.log(`Review completed. Overall score: ${report.summary.overallScore}/100`);
    console.log(`Reports saved to: ${reportsDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

main().catch(() => {
  // Error has already been reported and process.exitCode has been set.
});
