import './instrument.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary.jsx'
import { initUiScale } from '@/lib/ui-scale'
import '@/index.css'

initUiScale()

ReactDOM.createRoot(document.getElementById('root')).render(
  import.meta.env.PROD ? (
    <Sentry.ErrorBoundary fallback={<ErrorBoundary />} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  ) : (
    <App />
  )
)
