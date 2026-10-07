import { query, AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import { mcpServersConfig, githubTools } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import {
  DEFAULT_RATE_LIMITS,
  RateLimiter,
  RateLimiterConfig
} from './utils/rate-limiter.js';
import { withRetry, withTimeout } from './utils/error-handler.js';

export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  rateLimitConfig?: Partial<RateLimiterConfig>;
}

export class CodeReviewOrchestrator {
  private readonly options: Required<Pick<OrchestratorOptions, 'model' | 'maxTurns' | 'timeoutMs'>> & {
    rateLimitConfig: Partial<RateLimiterConfig>;
  };

  private readonly rateLimiter: RateLimiter;

  private readonly agents: Record<string, AgentDefinition> = {
    'code-quality-analyzer': codeQualityAnalyzer,
    'test-coverage-analyzer': testCoverageAnalyzer,
    'refactoring-suggester': refactoringSuggester
  };

  constructor(options: OrchestratorOptions = {}) {
    const model = options.model || process.env.ANTHROPIC_MODEL;

    if (!model) {
      throw new Error('ANTHROPIC_MODEL is not set');
    }

    this.options = {
      model,
      maxTurns: options.maxTurns ?? 30,
      timeoutMs: options.timeoutMs ?? 120_000,
      rateLimitConfig: options.rateLimitConfig ?? {}
    };

    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMITS,
      ...this.options.rateLimitConfig
    });
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!owner || !repo || !Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error('Invalid pull request information');
    }

    const startedAt = Date.now();

    const runReview = async (): Promise<ReviewReport> => {
      await this.rateLimiter.acquire(8000);

      try {
        const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

        let structuredOutput: unknown;

        for await (const message of query({
          prompt,
          options: {
            mcpServers: mcpServersConfig,
            agents: this.agents,
            model: this.options.model,
            allowedTools: ['Task', ...githubTools],
            maxTurns: this.options.maxTurns,
            outputFormat: {
              type: 'json_schema',
              schema: ReviewReportJSONSchema
            }
          }
        })) {
          if (message.type === 'result') {
            if (message.subtype === 'success' && message.structured_output) {
              structuredOutput = message.structured_output;
              break;
            }

            throw new Error(`Code review failed: ${message.subtype}`);
          }
        }

        if (!structuredOutput) {
          throw new Error('Claude did not return structured review output');
        }

        const validated = ReviewReportSchema.parse(structuredOutput);

        const duration = Date.now() - startedAt;

        const fileReviews = validated.fileReviews;

        const totalFiles = fileReviews.length;
        const overallScore =
          totalFiles === 0
            ? 100
            : Math.round(
                fileReviews.reduce(
                  (sum, review) => sum + review.codeQuality.overallScore,
                  0
                ) / totalFiles
              );

        const criticalIssues = fileReviews.reduce(
          (sum, review) =>
            sum +
            review.codeQuality.issues.filter(issue => issue.severity === 'critical').length,
          0
        );

        const highPriorityTests = fileReviews.reduce(
          (sum, review) =>
            sum +
            review.testCoverage.untestedPaths.filter(
              path => path.priority === 'critical' || path.priority === 'high'
            ).length,
          0
        );

        const refactoringOpportunities = fileReviews.reduce(
          (sum, review) => sum + review.refactorings.suggestions.length,
          0
        );

        return ReviewReportSchema.parse({
          ...validated,
          pullRequest: {
            owner,
            repo,
            number: prNumber
          },
          summary: {
            totalFiles,
            overallScore,
            criticalIssues,
            highPriorityTests,
            refactoringOpportunities
          },
          metadata: {
            analyzedAt: new Date().toISOString(),
            duration,
            agentVersions: {
              'code-quality-analyzer': '1.0.0',
              'test-coverage-analyzer': '1.0.0',
              'refactoring-suggester': '1.0.0'
            }
          }
        });
      } finally {
        this.rateLimiter.release();
      }
    };

    return withTimeout(
      () => withRetry(runReview, 2, 1000),
      this.options.timeoutMs,
      `Code review timed out after ${this.options.timeoutMs}ms`
    );
  }
}
