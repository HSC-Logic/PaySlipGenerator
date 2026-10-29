import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function BrandHeader() {
  return <Link className="brand-header" to="/" aria-label="Sliply home"><Logo size={36} /><strong>Sliply</strong></Link>
}

export function DeveloperMark() {
  return <p className="developer-mark standalone">Developed by <a href="https://hsclogic.com/" target="_blank" rel="noreferrer">HSC Logic</a></p>
}
