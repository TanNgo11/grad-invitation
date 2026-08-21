import { footer } from '../data/person'

export default function Footer() {
  return (
    <footer className="footer">
      <span className="footer-text">{footer.text}</span>
      <img src={footer.logo} alt="logo" className="footer-logo" />
    </footer>
  )
}
