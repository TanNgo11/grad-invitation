import { useState } from 'react'
import { useMediaQuery } from 'react-responsive'

import MapScene from './components/MapScene'
import InvitationCard from './components/InvitationCard'
import Footer from './components/Footer'

export default function App() {
  const [arrived, setArrived] = useState(false)
  const isMobile = useMediaQuery({ maxWidth: 768 })

  return (
    <div>
      <MapScene onArrived={() => setArrived(true)} />

      {!isMobile && arrived && <InvitationCard />}
      {isMobile && arrived && (
        <div className="mobile-card-sheet">
          <InvitationCard />
        </div>
      )}

      <Footer />
    </div>
  )
}
