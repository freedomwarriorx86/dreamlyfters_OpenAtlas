import React from 'react'

export const OverlayControls = ({ra, dec, fov, onToggleGaia, onToggleWISE}) => {
  return (
    <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 12px', color: '#374151'}}>
        Overlays
      </h4>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '10px'}}>
        <label 
          style={{
            padding: '8px 12px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            background: 'white',
            fontSize: '0.875rem',
            color: '#4a5568',
            cursor: 'pointer',
          }}
          onClick={() => onToggleGaia()}
        >
          Gaia DR3 Stars
        </label>
        <label 
          style={{
            padding: '8px 12px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            background: 'white',
            fontSize: '0.875rem',
            color: '#4a5568',
            cursor: 'pointer',
        }}
          onClick={() => onToggleWISE()}
        >
          WISE/NEOWISE
        </label>
      </div>
      
      <p style={{margin: '0', fontSize: '0.75rem', color: '#64748b'}}>
        Toggle catalog overlays for comparison
      </p>
    </div>
  )
}