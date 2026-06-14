import { addReceipt } from '../core/context.js'

export function createDrivingHandlers() {
  return new Map([
    ['draft_running_late_message', draftRunningLateMessage]
  ])
}

async function draftRunningLateMessage(ctx, item, adapters) {
  const args = { ...(item.defaults ?? {}), ...(ctx.facts.commandArgs ?? {}) }
  const contact = clean(args.contact)

  if (!contact) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'runninglate_contact_missing',
          title: 'Contact needed',
          prompt: 'Who should receive the running-late message?',
          resumeHint: 'Run: commandbook runninglate --contact Jane --eta "15 minutes"'
        }
      ]
    }
  }

  const destination = clean(args.destination) ?? 'current destination'
  const eta = clean(args.eta) ?? clean(args.etaText) ?? 'ETA unavailable'
  const channel = clean(args.channel) ?? 'whatsapp_or_sms'
  const extra = clean(args.message)
  const messageText = buildMessage({ destination, eta, extra })
  const outputFact = item.outputFact ?? 'runningLateDraft'
  const draft = {
    mode: 'dry_run_only',
    action: 'prepare_message',
    recipient: contact,
    channel,
    destination,
    eta,
    messageText,
    sendEnabled: false,
    requiresConfirmation: true,
    safety: 'No message was sent. This command only prepares the draft.'
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: draft
    }
  }, {
    op: 'draft_running_late_message',
    result: 'draft_prepared',
    outputFact,
    recipient: contact,
    channel
  }, adapters.clock)
}

function buildMessage({ destination, eta, extra }) {
  const destinationText = destination === 'current destination'
    ? ''
    : ` to ${destination}`
  const base = eta === 'ETA unavailable'
    ? `I'm running late${destinationText}.`
    : `I'm running late${destinationText}. ETA ${eta}.`

  return extra ? `${base} ${extra}` : base
}

function clean(value) {
  if (value === undefined || value === null || value === true) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}
