import { addReceipt } from '../core/context.js'

export function createDrivingHandlers() {
  return new Map([
    ['draft_running_late_message', prepareRunningLateMessage],
    ['prepare_running_late_message', prepareRunningLateMessage]
  ])
}

async function prepareRunningLateMessage(ctx, item, adapters) {
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
  const channel = clean(args.channel) ?? 'whatsapp'
  const extra = clean(args.message)
  const autoSend = booleanArg(args.autoSend)
  const messageText = buildMessage({ destination, eta, extra })
  const outputFact = item.outputFact ?? 'runningLateMessage'
  const request = {
    mode: autoSend ? 'trusted_test_send_request' : 'draft_only',
    action: autoSend ? 'send_message' : 'prepare_message',
    recipient: contact,
    channel,
    destination,
    eta,
    messageText,
    sendEnabled: autoSend,
    requiresConfirmation: !autoSend,
    smsFallback: false,
    testChannel: booleanArg(args.testChannel),
    safety: autoSend
      ? 'Trusted test route requested WhatsApp delivery through the platform adapter. No SMS fallback.'
      : 'No message was sent. This command only prepares the draft.'
  }

  return addReceipt({
    ...ctx,
    facts: {
      ...ctx.facts,
      [outputFact]: request
    }
  }, {
    op: item.op,
    result: autoSend ? 'send_requested' : 'draft_prepared',
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
    ? `Running late${destinationText}.`
    : `Running late${destinationText}, ETA ${eta}.`

  return extra ? `${base} ${extra}` : base
}

function clean(value) {
  if (value === undefined || value === null || value === true) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function booleanArg(value) {
  if (value === true) return true
  if (value === false || value === undefined || value === null) return false
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase())
}
