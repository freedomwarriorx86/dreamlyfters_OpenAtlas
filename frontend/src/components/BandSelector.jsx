import React from 'react'

export const BandSelector = ({band, onBandChange}) => {
  const getWavelength = (bandNum) => {
    const MIN_WAVELENGTH = 0.75
    const MAX_WAVELENGTH = 5.0
    return parseFloat((MIN_WAVELENGTH + (MAX_WAVELENGTH - MIN_WAVELENGTH) * (bandNum - 1) / (102 - 1)).toFixed(3))
  }

  return (
    <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 12px', color: '#374151'}}>
        Infrared Band Selector
      </h4>
      
      <div style={{marginBottom: '15px'}}>
        <label 
          style={{display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: '#4a5568'}}
        >
          Band {band} of 102
        </label>
        <input
          type="range"
          min="1"
          max="102"
          value={band}
          onChange={(e) => onBandChange(parseInt(e.target.value, 10))}
          style={{
            width: '100%',
          }}
        />
      </div>

      <div>
        <label 
          style={{fontSize: '0.875rem', color: '#4a5568', marginRight: '15px'}}
        >
          Wavelength:
        </label>
        <span 
          style={{
            fontWeight: 'bold',
            color: '#1e293b',
            fontFamily: "'Courier New', monospace"
          }}>
          {getWavelength(band).toFixed(3)} µm
        </span>
      </div>
    </div>
  )
}