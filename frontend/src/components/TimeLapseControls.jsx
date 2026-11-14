import React from 'react'

export const TimeLapseControls = ({
  epochs,
  currentEpoch,
  onEpochChange,
  onStepForward,
  onStepBackward,
  onSpeedChange,
}) => {
  const canStepBack = currentEpoch > 1
  const canStepForward = currentEpoch < (epochs.length || 1)

  return (
    <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 12px', color: '#374151'}}>
        Time-Lapse Viewer
      </h4>
      
      <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px'}}>
        <button
          disabled={!canStepBack}
          onClick={onStepBackward}
          style={{
            padding: '6px 12px',
            background: 'white',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            color: '#374151',
            fontSize: '0.875rem',
            cursor: canStepBack ? 'pointer' : 'not-allowed',
          }}
        >
          &\lt;
        </button>

        <select
          value={currentEpoch}
          onChange={(e) => onEpochChange(parseInt(e.target.value, 10))}
          style={{
            padding: '6px 12px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            background: 'white',
            fontSize: '0.875rem',
          }}
        >
          {epochs.map((ep) => (
            <option key={ep.epoch} value={ep.epoch}>
              {ep.date}
            </option>
          ))}
        </select>

        <button
          disabled={!canStepForward}
          onClick={onStepForward}
          style={{
            padding: '6px 12px',
            background: 'white',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            color: '#374151',
            fontSize: '0.875rem',
            cursor: canStepForward ? 'pointer' : 'not-allowed',
          }}
        >
          >>
        </button>
      </div>

      <div style={{display: 'flex', gap: '15px'}}>
        <span 
          style={{fontSize: '0.875rem', color: '#4a5568'}}
        >
          Speed:
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={1}
          onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
          style={{
            width: '150px',
          }}
        />
        <span 
          style={{fontSize: '0.875rem', color: '#4a5568'}}
        >
          x
        </span>
      </div>
    </div>
  )
}