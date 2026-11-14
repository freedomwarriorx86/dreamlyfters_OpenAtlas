import React from 'react'

export const SpectrumPlot = ({data}) => {
  const {bands, fluxes, snrs, objectPosition} = data

  return (
    <div style={{marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 12px', color: '#374151'}}>
        Spectrum Analysis
      </h4>
      
      <p style={{margin: '8px 0 0', fontSize: '0.875rem', color: '#64748b'}}>
        Object at RA {objectPosition.ra.toFixed(3)}, Dec {objectPosition.dec.toFixed(3)}
      </p>
      
      <canvas 
        width={600}
        height={400}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          background: 'white',
        }}
      />
    </div>
  )
}