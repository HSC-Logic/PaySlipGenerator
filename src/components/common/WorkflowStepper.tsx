import { Building2, Check, Contact, CreditCard, Eye } from 'lucide-react'
import type { WorkflowStep } from '../../types'

export const workflowSteps: { id: WorkflowStep; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'company', label: 'Company', description: 'Your business details', icon: <Building2 /> },
  { id: 'recipient', label: 'Recipient', description: 'Who is being paid', icon: <Contact /> },
  { id: 'payment', label: 'Payment', description: 'Amounts and terms', icon: <CreditCard /> },
  { id: 'review', label: 'Review', description: 'Check and generate', icon: <Eye /> },
]

interface Props { active: WorkflowStep; highestIndex: number; onSelect: (step: WorkflowStep) => void }
export function WorkflowStepper({ active, highestIndex, onSelect }: Props) {
  const activeIndex = workflowSteps.findIndex(step => step.id === active)
  return <nav className="workflow-stepper" aria-label="Payment slip creation steps"><ol>{workflowSteps.map((step, index) => {
    const complete = index < activeIndex
    const available = index <= highestIndex
    return <li key={step.id} className={`${active === step.id ? 'active' : ''} ${complete ? 'complete' : ''}`}><button type="button" onClick={() => onSelect(step.id)} disabled={!available} aria-current={active === step.id ? 'step' : undefined}><span className="step-icon">{complete ? <Check /> : step.icon}</span><span><strong>{step.label}</strong><small>{step.description}</small></span></button>{index < workflowSteps.length - 1 && <i />}</li>
  })}</ol></nav>
}
