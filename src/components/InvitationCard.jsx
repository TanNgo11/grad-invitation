import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { FaLocationArrow } from 'react-icons/fa'

import { person, directionsUrl } from '../data/person'
import avatar from '../assets/avatar.jpg'
import Countdown from './Countdown'

export default function InvitationCard() {
  const cardRef = useRef(null)

  useGSAP(
    () => {
      const card = cardRef.current
      if (!card) return

      gsap
        .timeline()
        .from(card, { x: -200, opacity: 0, scale: 0.95, duration: 1.2, ease: 'power3.out' })
        .from('.avatar', { y: -40, opacity: 0, scale: 0.8, duration: 0.7, ease: 'back.out(1.7)' }, '-=0.5')
        .from('.invitation-card h1', { y: 20, opacity: 0, duration: 0.5 }, '-=0.3')
        .from('.invitation-card p, .invitation-card h3', { y: 20, opacity: 0, stagger: 0.08, duration: 0.4 }, '-=0.2')
        .from('.count-item', { opacity: 0, y: 20, stagger: 0.05, duration: 0.5 }, '-=0.2')
        .fromTo(
          '.glass-button',
          { opacity: 0, y: 20, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: () => {
              card.classList.add('is-ready')
              gsap.set('.glass-button', { clearProps: 'opacity,transform' })
            },
          },
          '-=0.1',
        )
    },
    { scope: cardRef },
  )

  return (
    <div className="invitation-wrapper">
      <div ref={cardRef} className="glass-card invitation-card">
        <img src={avatar} className="avatar" alt={person.name} />
        <h1>{person.name}</h1>
        <p className="university">{person.university}</p>
        <p className="degree">{person.degree}</p>
        <div className="divider" />
        <p className="invite-text">You&apos;re Invited To ...</p>
        <h3>🎓 Graduation Ceremony</h3>
        <p>{person.date}</p>
        <p>{person.rangeTime}</p>
        <p>{person.location.name}</p>
        <Countdown />
        <button
          className="glass-button"
          onClick={() => window.open(directionsUrl, '_blank')}
        >
          <div className="button-icon-wrapper">
            <FaLocationArrow className="button-icon" />
          </div>
          <span>Get Directions</span>
        </button>
      </div>
    </div>
  )
}
