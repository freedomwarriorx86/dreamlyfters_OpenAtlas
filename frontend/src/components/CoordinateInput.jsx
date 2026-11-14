import React, {useState} from 'react'

const formatDMS = (degrees, hemisphere) => {
  const absDeg = Math.abs(degrees)
  const hours = Math.floor(absDeg / 15)
  const minutes = Math.floor((absDeg / 15 - hours) * 60)
  const seconds = ((absDeg / 15 - hours) * 60 - minutes) * 60
  const dir = degrees >= 0 ? 'E' : 'W'
  
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m${seconds.toFixed(2).padStart(5, '0')}s ${dir}`
  }
  return `${degrees.toFixed(3)}° ${hemisphere}`
}

const formatHMS = (degrees) => {
  const hours = degrees / 15
  const h = Math.floor(hours)
  const minutes = Math.floor((hours - h) * 60)
  const seconds = ((hours - h) * 60 - minutes) * 60
  return `${h}h${minutes.toString().padStart(2, '0')}m${seconds.toFixed(1).padStart(4, '0')}s`
}

export const CoordinateInput = ({
  ra,
  dec,
  fov,
  onRAChange,
  onDecChange,
  onFOVChange,
}) => {
  const [raInput, setRAInput] = useState(ra ? ra.toString() : '')
  const [decInput, setDecInput] = useState(dec ? dec.toString() : '')
  const [fovInput, setFOVInput] = useState(fov ? fov.toString() : '0.5')
  const [format, setFormat] = useState('decimal')

  const raDecMatches = /^-?\d+\.?\d*$/.test(raInput || '')
  const dmsMatches = /^-?\d+h\d+m\d+\.?\d*s? [NS]$/.test(decInput || '')
  hmsMatches = /^\d+h\d+m\d+(\.\d+)?s$/.test(raInput || '')

  const handleRAChange = (e) => {
    const value = e.target.value
    setRAInput(value)
    onRAChange(parseFloat(value) || undefined)
  }

  const handleDecChange = (e) => {
    const value = e.target.value
    setDecInput(value)
    onDecChange(parseFloat(value) || undefined)
  }

  const handleFOVChange = (e) => {
    const value = parseFloat(e.target.value)
    setFOVInput(value)
    onFOVChange(isNaN(value) ? 0.5 : value)
  }

  return (
    <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 15px', color: '#374151'}}>
        Coordinate Input
      </h4>
      
      <div style={{marginBottom: '12px'}}>
        <label 
          htmlFor="ra-input" 
          style={{display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: '#4a5568'}}
        >
          Right Ascension
        </label>
        <div style={{display: 'flex', gap: '8px'}}>
          <input
            id="ra-input"
            type="text"
            value={raInput}
            onChange={handleRAChange}
            placeholder="133.794 or 08h55m10.831s"
            style={{
              flex: '1',
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
            defaultValue="133.794"
          />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: 'white',
              minWidth: '120px',
            }}
          >
            <option value="decimal">Decimal Degrees</option>
            <option value="hms">HMS</option>
          </select>
        </div>
      </div>

      <div style={{marginBottom: '12px'}}>
        <label 
          htmlFor="dec-input" 
          style={{display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: '#4a5568'}}
        >
          Declination
        </label>
        <div style={{display: 'flex', gap: '8px'}}>
          <input
            id="dec-input"
            type="text"
            value={decInput}
            onChange={handleDecChange}
            placeholder="-07.245 or -07d14m42.53s"
            style={{
              flex: '1',
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
            defaultValue="-7.245"
          />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              background: 'white',
              minWidth: '120px',
            }}
          >
            <option value="decimal">Decimal Degrees</option>
            <option value="dms">DMS</option>
          </select>
        </div>
      </div>

      <div>
        <label 
          htmlFor="fov-input" 
          style={{display: 'block', marginBottom: '4px', fontSize: '0.875rem', color: '#4a5568'}}
        >
          Field of View (0.1° - 2°)
        </label>
        <input
          id="fov-input"
          type="number"
          value={fovInput}
          onChange={handleFOVChange}
          min="0.1"
          max="2"
          step="0.1"
          style={{
            padding: '8px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            fontSize: '0.875rem',
            width: '100%',
          }}
        />
      </div>
    </div>
  )
}