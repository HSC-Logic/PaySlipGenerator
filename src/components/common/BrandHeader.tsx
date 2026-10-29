import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BrandHeader() {
  return <Link className="brand-header" to="/" aria-label="Sliply home"><span className="brand-mark"><FilePlus2 /></span><strong>Sliply</strong></Link>
}

export function DeveloperMark() {
  return <p className="developer-mark standalone">Developed by <a href="https://hsclogic.com/" target="_blank" rel="noreferrer">HSC Logic</a></p>
}
