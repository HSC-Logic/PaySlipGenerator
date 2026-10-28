import { apiConfigured } from './api/client'
import { cognitoConfigured } from './cognito/auth'

/** Cloud features need both the Slipy API and the shared HSClogic Cognito pool; without them the app stays browser-only. */
export const cloudDataEnabled = apiConfigured && cognitoConfigured
