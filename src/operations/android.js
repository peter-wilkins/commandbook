import { addReceipt } from '../core/context.js'
import { throwIfShellFailed } from '../adapters/shell.js'

export function createAndroidHandlers() {
  return new Map([
    ['android_detect_device', androidDetectDevice],
    ['android_check_taptap_installed', androidCheckTapTapInstalled],
    ['android_ensure_taptap_accessibility', androidEnsureTapTapAccessibility],
    ['android_check_field_relay_shortcut', androidCheckFieldRelayShortcut],
    ['android_prompt_shortcut_configuration', androidPromptShortcutConfiguration],
    ['android_save_setup_record', androidSaveSetupRecord]
  ])
}

async function androidDetectDevice(ctx, _item, adapters) {
  const result = await adapters.shell('adb', ['devices'])
  throwIfShellFailed(result, 'Failed to run adb. Is Android SDK installed and in PATH?')

  const lines = result.stdout.split('\n').map(l => l.trim()).filter(Boolean)
  const devices = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/)
    if (parts[1] === 'device') {
      devices.push(parts[0])
    }
  }

  if (devices.length === 0) {
    return {
      ...ctx,
      status: 'paused_for_human',
      humanRequirements: [
        ...ctx.humanRequirements,
        {
          id: 'android_no_device',
          title: 'No Android Device Connected',
          prompt: 'Please connect your Android dev phone with USB debugging enabled, then resume the command.',
          resumeHint: 'Connect device and run: commandbook resume'
        }
      ]
    }
  }

  // Use specified device ID from arguments if provided, else default to the first one found.
  const targetId = ctx.facts.commandArgs.device ?? devices[0]

  if (!devices.includes(targetId)) {
    throw new Error(`Device ${targetId} is not connected or unauthorized. Connected devices: ${devices.join(', ')}`)
  }

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      deviceId: targetId,
      'android.device_connected': true
    }
  }
}

async function androidCheckTapTapInstalled(ctx, _item, adapters) {
  const deviceId = ctx.facts.deviceId
  const result = await adapters.shell('adb', ['-s', deviceId, 'shell', 'pm', 'list', 'packages', 'com.kieronquinn.app.taptap'])

  if (result.stdout.includes('package:com.kieronquinn.app.taptap')) {
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        'android.taptap_installed': true
      }
    }
  }

  // Open the download link on the device
  const url = 'https://github.com/KieronQuinn/TapTap/releases'
  await adapters.shell('adb', ['-s', deviceId, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url])

  return {
    ...ctx,
    status: 'paused_for_human',
    humanRequirements: [
      ...ctx.humanRequirements,
      {
        id: 'taptap_apk_not_installed',
        title: 'TapTap APK Not Installed',
        prompt: `TapTap is not installed on the device. I have opened the download page (${url}) on your phone. Please download and install the APK, then resume the command.`,
        resumeHint: 'Install the APK on the phone and run: commandbook resume'
      }
    ]
  }
}

async function androidEnsureTapTapAccessibility(ctx, _item, adapters) {
  const deviceId = ctx.facts.deviceId
  const result = await adapters.shell('adb', ['-s', deviceId, 'shell', 'settings', 'get', 'secure', 'enabled_accessibility_services'])

  if (result.ok && result.stdout.includes('com.kieronquinn.app.taptap')) {
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        'android.taptap_accessibility_enabled': true
      }
    }
  }

  // Launch accessibility settings on the device
  await adapters.shell('adb', ['-s', deviceId, 'shell', 'am', 'start', '-a', 'android.settings.ACCESSIBILITY_SETTINGS'])

  return {
    ...ctx,
    status: 'paused_for_human',
    humanRequirements: [
      ...ctx.humanRequirements,
      {
        id: 'taptap_accessibility_disabled',
        title: 'TapTap Accessibility Service Disabled',
        prompt: 'TapTap accessibility service is disabled. I have opened the accessibility settings on the device. Please turn on the TapTap service, then resume the command.',
        resumeHint: 'Enable the accessibility service and run: commandbook resume'
      }
    ]
  }
}

async function androidCheckFieldRelayShortcut(ctx, _item, adapters) {
  const deviceId = ctx.facts.deviceId

  // Ensure Field Relay package is installed
  const pkgCheck = await adapters.shell('adb', ['-s', deviceId, 'shell', 'pm', 'list', 'packages', 'dev.peter.fieldrelay'])
  if (!pkgCheck.stdout.includes('package:dev.peter.fieldrelay')) {
    throw new Error('Field Relay app (dev.peter.fieldrelay) is not installed on the device. Please build and run Field Relay first.')
  }

  // Check shortcut manager dumpsys
  const shortcutCheck = await adapters.shell('adb', ['-s', deviceId, 'shell', 'dumpsys', 'shortcut'])
  const hasShortcut = shortcutCheck.stdout.includes('dev.peter.fieldrelay') &&
                      (shortcutCheck.stdout.includes('field_relay_capture') || shortcutCheck.stdout.includes('Field Relay Capture'))

  if (!hasShortcut) {
    throw new Error('Field Relay Capture shortcut could not be found. Please ensure the app is built with shortcut support.')
  }

  return {
    ...ctx,
    facts: {
      ...ctx.facts,
      'android.field_relay_shortcut_exposed': true
    }
  }
}

async function androidPromptShortcutConfiguration(ctx, _item, adapters) {
  if (ctx.facts.autoApprove) {
    return {
      ...ctx,
      facts: {
        ...ctx.facts,
        'android.taptap_shortcut_configured': true
      }
    }
  }

  const deviceId = ctx.facts.deviceId
  // Use monkey runner to launch TapTap's main screen
  await adapters.shell('adb', ['-s', deviceId, 'shell', 'monkey', '-p', 'com.kieronquinn.app.taptap', '-c', 'android.intent.category.LAUNCHER', '1'])

  return {
    ...ctx,
    status: 'paused_for_human',
    humanRequirements: [
      ...ctx.humanRequirements,
      {
        id: 'taptap_shortcut_not_configured',
        title: 'Configure TapTap double-tap action',
        prompt: 'Please configure TapTap on the device to trigger the "Field Relay Capture" shortcut on Double Tap. Once configured, resume the command.',
        resumeHint: 'Configure the double-tap action in TapTap and run: commandbook resume'
      }
    ]
  }
}

async function androidSaveSetupRecord(ctx, _item, adapters) {
  return addReceipt({
    ...ctx,
    status: 'complete'
  }, {
    op: 'install_taptap',
    result: 'completed',
    deviceId: ctx.facts.deviceId,
    taptapInstalled: true,
    accessibilityEnabled: true,
    shortcutConfigured: true
  }, adapters.clock)
}
