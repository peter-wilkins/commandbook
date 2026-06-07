import { createRunId } from './run-id.js'

export function createRunContext({ command, recipe, args = {}, runId, now }) {
  const id = runId ?? createRunId({ now })

  return {
    runId: id,
    runKey: `runs/${command}/${id}.json`,
    command,
    status: 'running',
    facts: {
      commandArgs: args,
      autoApprove: Boolean(args.yes),
      scope: args.scope ?? recipe.defaultScope ?? 'current_repo'
    },
    goal: recipe.goal ?? {},
    queue: (recipe.queue ?? []).map((item) => ({ phase: 'enter', ...item })),
    stack: [],
    completed: [],
    inProgress: [],
    humanRequirements: [],
    approvals: {},
    receipts: [],
    failures: []
  }
}

export function addReceipt(ctx, receipt, clock = () => new Date()) {
  return {
    ...ctx,
    receipts: [
      ...ctx.receipts,
      {
        at: clock().toISOString(),
        ...receipt
      }
    ]
  }
}

export function addFailure(ctx, failure) {
  return {
    ...ctx,
    failures: [
      ...ctx.failures,
      {
        at: new Date().toISOString(),
        ...failure
      }
    ]
  }
}
