import type { HostedProfilePageSession } from '@/lib/api'

export function openHostedProfilePage(session: HostedProfilePageSession, target = '_blank') {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = session.url
  form.target = target
  form.style.display = 'none'

  const tokenInput = document.createElement('input')
  tokenInput.type = 'hidden'
  tokenInput.name = 'token'
  tokenInput.value = session.token
  form.appendChild(tokenInput)

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}
