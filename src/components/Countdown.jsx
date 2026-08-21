import { useEffect, useState } from 'react'
import { person } from '../data/person'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function remaining() {
  const diff = new Date(`${person.date} ${person.time}`).getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff / HOUR) % 24),
    minutes: Math.floor((diff / MINUTE) % 60),
    seconds: Math.floor((diff / SECOND) % 60),
  }
}

export default function Countdown() {
  const [time, setTime] = useState(remaining)

  useEffect(() => {
    const id = setInterval(() => setTime(remaining()), SECOND)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="countdown">
      {[
        ['Days', time.days],
        ['Hours', time.hours],
        ['Minutes', time.minutes],
        ['Seconds', time.seconds],
      ].map(([label, value]) => (
        <div className="count-item" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
