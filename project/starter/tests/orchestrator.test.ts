import { describe, expect, it, beforeEach, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewReportSchema } from '../src/types/report-types.js';

const validReport = {
  pullRequest: {
    owner: 'octocat',
    repo: 'Hello-World',
    number: 1,
  },
  fileReviews: [
    {
      file: 'src/example.ts',
      codeQuality: {
        file: 'src/example.ts',
        issues: [],
        overallScore: 90,
        summary: 'Good code quality',
      },
      testCoverage: {
        file: 'src/example.ts',
        hasTests: true,
        testFiles: ['tests/example.test.ts'],
        untestedPaths: [],
        coverageEstimate: 85,
        summary: 'Good coverage',
      },
      refactorings: {
        file: 'src/example.ts',
        suggestions: [],
        summary: 'No major refactoring required',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 100,
    agentVersions: {},
  },
};

function mockSuccessfulQuery(structuredOutput = validReport) {
  queryMock.mockImplementation(async function* () {
    yield {
      type: 'result',
      subtype: 'success',
      structured_output: structuredOutput,
      result: JSON.stringify(structuredOutput),
      duration_ms: 10,
      duration_api_ms: 10,
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0,
      usage: {},
      session_id: 'test-session',
    };
  });
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      expect(() => new CodeReviewOrchestrator()).not.toThrow();
    });

    it('should accept custom rate limit configuration', () => {
      expect(
        () =>
          new CodeReviewOrchestrator({
            rateLimitConfig: {
              maxRequestsPerMinute: 10,
              maxTokensPerMinute: 5000,
              maxConcurrent: 2,
            },
          })
      ).not.toThrow();
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR data through GitHub MCP', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(queryMock).toHaveBeenCalledTimes(1);

      const call = queryMock.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect(call.options.mcpServers.github).toBeDefined();
      expect(call.options.allowedTools).toContain('mcp__github__*');
      expect(call.prompt).toContain('octocat');
      expect(call.prompt).toContain('Hello-World');
      expect(call.prompt).toContain('1');
    });

    it('should provide all 3 specialized subagents', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      const call = queryMock.mock.calls[0]?.[0];

      expect(Object.keys(call.options.agents)).toEqual(
        expect.arrayContaining([
          'code-quality-analyzer',
          'test-coverage-analyzer',
          'refactoring-suggester',
        ])
      );

      expect(Object.keys(call.options.agents)).toHaveLength(3);
      expect(call.options.allowedTools).toContain('Task');
    });

    it('should aggregate results into a ReviewReport', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(report.pullRequest).toEqual({
        owner: 'octocat',
        repo: 'Hello-World',
        number: 1,
      });
      expect(report.fileReviews).toHaveLength(1);
      expect(report.summary.totalFiles).toBe(1);
      expect(report.summary.overallScore).toBe(90);
      expect(report.metadata.agentVersions).toHaveProperty(
        'code-quality-analyzer'
      );
    });

    it('should validate output with the Zod schema', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(() => ReviewReportSchema.parse(report)).not.toThrow();
    });

    it('should reject invalid structured output', async () => {
      mockSuccessfulQuery({
        ...validReport,
        summary: {
          ...validReport.summary,
          overallScore: 'invalid',
        },
      });

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow();
    });

    it('should reject invalid pull request input', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('', 'Hello-World', 1)
      ).rejects.toThrow('Invalid pull request information');

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 0)
      ).rejects.toThrow('Invalid pull request information');
    });
  });
});
