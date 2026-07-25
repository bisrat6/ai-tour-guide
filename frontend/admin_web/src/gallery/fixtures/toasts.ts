import type { ToastInput } from '../../kit/Toast/Toast.types.ts'

export const TOAST_FIXTURES = [
  {
    tone: 'success',
    message: 'Room published.',
  },
  {
    tone: 'danger',
    message: 'Room did not publish. The request timed out.',
    detail: 'Try again from the editor.',
    action: { label: 'Try again', onAct: () => undefined },
  },
  {
    tone: 'neutral',
    message: 'Draft saved.',
    detail: 'Visitors still see the previous version until you publish.',
  },
] as const satisfies readonly ToastInput[]
