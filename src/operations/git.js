import { addReceipt } from '../core/context.js'
import { throwIfShellFailed } from '../adapters/shell.js'

export function createGitHandlers() {
  return new Map([
    ['query_current_repo', queryCurrentRepo],
    ['query_git_identity', queryGitIdentity],
    ['ensure_git_identity_facts', ensureGitIdentityFacts],
    ['dry_run_git_identity', dryRunGitIdentity],
    ['apply_git_identity', applyGitIdentity],
    ['verify_git_identity', verifyGitIdentity],
    ['ask_are_you_happy', askAreYouHappy],
    ['try_git_push_current_branch', tryGitPushCurrentBranch]
  ])
}

async function queryCurrentRepo(ctx, _item, adapters) {
  const args = ctx.facts.commandArgs
  const cwd = args.repo ?? adapters.cwd
  const result = await adapters.shell('git', ['rev-parse', '--show-toplevel'], { cwd })
  throwIfShellFailed(result, `Not inside a git repository: ${cwd}`)

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      repoPath: result.stdout.trim()
    }
  }
}

async function queryGitIdentity(ctx, _item, adapters) {
  const cwd = ctx.facts.repoPath
  const name = await gitConfigGet(adapters, cwd, 'user.name')
  const email = await gitConfigGet(adapters, cwd, 'user.email')

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      currentGitIdentity: { name, email }
    }
  }
}

async function ensureGitIdentityFacts(ctx) {
  const args = ctx.facts.commandArgs
  const current = ctx.facts.currentGitIdentity ?? {}
  const desired = {
    name: args.name ?? current.name,
    email: args.email ?? current.email
  }

  const missing = []
  if (!desired.name) missing.push('name')
  if (!desired.email) missing.push('email')

  if (missing.length > 0) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'git_identity_missing',
          title: 'Git identity needed',
          prompt: 'Tell me the git user.name and user.email to use for this repo.',
          missing,
          resumeHint: 'Run again with --name "Your Name" --email you@example.com'
        }
      ]
    }
  }

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      desiredGitIdentity: desired
    }
  }
}

async function dryRunGitIdentity(ctx, _item, adapters) {
  const current = ctx.facts.currentGitIdentity
  const desired = ctx.facts.desiredGitIdentity
  const changeNeeded = current.name !== desired.name || current.email !== desired.email
  const dryRun = {
    repoPath: ctx.facts.repoPath,
    before: current,
    after: desired,
    commands: [
      `git config --local user.name ${JSON.stringify(desired.name)}`,
      `git config --local user.email ${JSON.stringify(desired.email)}`
    ]
  }

  if (!changeNeeded) {
    return addReceipt({
      ...ctx,
      facts: {
        ...ctx.facts,
        gitIdentityChangeNeeded: false,
        gitIdentityDryRun: dryRun
      }
    }, {
      op: 'dry_run_git_identity',
      result: 'already_configured',
      repoPath: ctx.facts.repoPath
    }, adapters.clock)
  }

  if (!ctx.facts.autoApprove) {
    return {
      ...ctx,
      status: 'paused_for_approval',
      facts: {
        ...ctx.facts,
        gitIdentityChangeNeeded: true,
        gitIdentityDryRun: dryRun
      },
      approvals: {
        ...ctx.approvals,
        git_identity_change: {
          status: 'pending',
          dryRun,
          resumeHint: 'Run again with --yes to apply this change.'
        }
      }
    }
  }

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      gitIdentityChangeNeeded: true,
      gitIdentityDryRun: dryRun
    },
    approvals: {
      ...ctx.approvals,
      git_identity_change: {
        status: 'approved',
        dryRun
      }
    }
  }
}

async function applyGitIdentity(ctx, _item, adapters) {
  if (!ctx.facts.gitIdentityChangeNeeded) return ctx

  const desired = ctx.facts.desiredGitIdentity
  const cwd = ctx.facts.repoPath

  throwIfShellFailed(
    await adapters.shell('git', ['config', '--local', 'user.name', desired.name], { cwd }),
    'Failed to set git user.name'
  )
  throwIfShellFailed(
    await adapters.shell('git', ['config', '--local', 'user.email', desired.email], { cwd }),
    'Failed to set git user.email'
  )

  return addReceipt(ctx, {
    op: 'apply_git_identity',
    repoPath: cwd,
    name: desired.name,
    email: desired.email
  }, adapters.clock)
}

async function verifyGitIdentity(ctx, _item, adapters) {
  const cwd = ctx.facts.repoPath
  const actual = {
    name: await gitConfigGet(adapters, cwd, 'user.name'),
    email: await gitConfigGet(adapters, cwd, 'user.email')
  }
  const desired = ctx.facts.desiredGitIdentity ?? actual
  const verified = actual.name === desired.name && actual.email === desired.email

  if (!verified) {
    return {
      ...ctx,
      status: 'failed',
      failures: [
        ...ctx.failures,
        {
          op: 'verify_git_identity',
          message: 'Git identity did not verify after mutation.',
          expected: desired,
          actual,
          at: adapters.clock().toISOString()
        }
      ]
    }
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      verifiedGitIdentity: actual
    }
  }, {
    op: 'verify_git_identity',
    verified: true,
    repoPath: cwd
  }, adapters.clock)
}

async function askAreYouHappy(ctx, _item, adapters) {
  if (ctx.facts.autoApprove) {
    return addReceipt(ctx, {
      op: 'ask_are_you_happy',
      result: 'auto_accepted'
    }, adapters.clock)
  }

  return {
    ...ctx,
    status: 'paused_for_human',
    humanRequirements: [
      ...ctx.humanRequirements,
      {
        id: 'are_you_happy',
        title: 'Are you happy?',
        prompt: 'Check the result. If it looks right, mark the run accepted.'
      }
    ]
  }
}

async function tryGitPushCurrentBranch(ctx, item, adapters) {
  const cwd = ctx.facts.repoPath
  const result = await adapters.shell('git', ['push'], { cwd })

  if (result.ok) {
    return addReceipt(ctx, {
      op: 'try_git_push_current_branch',
      result: 'pushed',
      stdout: result.stdout.trim()
    }, adapters.clock)
  }

  if (isGitIdentityError(result) && !ctx.facts.gitIdentitySetupAttempted) {
    const setupRecipe = await adapters.loadRecipe('configure_git_identity')
    const setupQueue = setupRecipe.queue.filter((next) => next.op !== 'ask_are_you_happy')

    // Update this run only: set up identity, then retry the original push item.
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        gitIdentitySetupAttempted: true
      },
      failures: [
        ...ctx.failures,
        {
          op: item.op,
          unplannedIssue: 'git_identity_missing',
          message: 'Git reported a missing identity. Enqueued configure_git_identity for this run.',
          stderr: result.stderr,
          at: adapters.clock().toISOString()
        }
      ],
      queue: [
        ...setupQueue.map((next) => ({ phase: 'enter', ...next })),
        item,
        ...ctx.queue
      ]
    }
  }

  const error = new Error('git push failed')
  Object.assign(error, result)
  throw error
}

async function gitConfigGet(adapters, cwd, key) {
  const result = await adapters.shell('git', ['config', '--local', '--get', key], { cwd })
  if (!result.ok) return null
  const value = result.stdout.trim()
  return value.length > 0 ? value : null
}

function isGitIdentityError(result) {
  const text = `${result.stdout}\n${result.stderr}`
  return text.includes('Author identity unknown') || text.includes('Please tell me who you are')
}
