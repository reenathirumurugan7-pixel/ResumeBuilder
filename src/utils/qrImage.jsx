import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { QRCodeCanvas } from 'qrcode.react'

export function qrDataUrl(value, size = 160) {
  if (!value || typeof document === 'undefined') return null
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;'
  document.body.appendChild(container)
  const root = createRoot(container)
  let canvasNode = null
  try {
    flushSync(() => {
      root.render(
        <QRCodeCanvas
          ref={(n) => { canvasNode = n }}
          value={value}
          size={size}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
        />,
      )
    })
    if (canvasNode) {
      return canvasNode.toDataURL('image/png')
    }
  } catch {
    return null
  } finally {
    try { root.unmount() } catch { /* ignore */ }
    try { container.remove() } catch { /* ignore */ }
  }
  return null
}
