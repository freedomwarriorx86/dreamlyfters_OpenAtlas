import React, {useRef, useEffect} from 'react'

export const ImageViewer = ({
  image,
  loading,
  error,
  fov,
  onEpochImageFetch,
  currentEpoch,
  bands,
  setBand,
  spectrumData,
  setSpectrumData,
}) => {
  const canvasRef = useRef(null)

  if (loading && !image) {
    return (
      <div 
        style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          borderRadius: '8px',
        }}
      >
        <div>Loading image...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        style={{
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          borderRadius: '8px',
        }}
      >
        <div style={{color: 'red'}>Error: {error}</div>
      </div>
    )
  }

  if (!image) {
    return null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const imageWidth = 800
    const imageHeight = 800
    canvas.width = imageWidth
    canvas.height = imageHeight
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, imageWidth, imageHeight)
    
    // Convert float [-1,1] data to uint8 [0,255] for display
    const floatData = image
    const width = imageWidth
    const height = imageHeight
    
    // Downsample: create a grid mapping from the float data
    const dataLen = floatData.length
    const gridSize = Math.floor(Math.sqrt(dataLen))
    
    if (gridSize < 2) return
    
    // Create image data
    const imgData = ctx.createImageData(width, height)
    
    // Map the 1D float data to a 2D image with gradient coloring
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Map pixel position to data index
        const dataIdx = Math.min(
          (y * gridSize * width + x * gridSize) % dataLen,
          dataLen - 1
        )
        const val = floatData[dataIdx]
        
        // Map [-1, 1] to [0, 255]
        const mapped = Math.max(0, Math.min(255, Math.round((val + 1) / 2 * 255)))
        
        // Apply band-dependent color tint (infrared false color)
        const band = bands[currentEpoch - 1] || 50
        const wavelength = getWavelength(band)
        // Cooler bands (redder) get more red, warmer bands get more blue
        const red = mapped
        const green = Math.round(mapped * 0.8)
        const blue = Math.round(mapped * 0.6)
        
        const pixIdx = (y * width + x) * 4
        imgData.data[pixIdx] = red
        imgData.data[pixIdx + 1] = green
        imgData.data[pixIdx + 2] = blue
        imgData.data[pixIdx + 3] = 255
      }
    }
    
    ctx.putImageData(imgData, 0, 0)
    
    // Draw band and epoch info overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, height - 50, width, height)
    
    ctx.fillStyle = 'white'
    ctx.font = '14px sans-serif'
    ctx.fillText(
      `SPHEREx Band ${band} (${getWavelength(band).toFixed(3)}µm) • Epoch ${currentEpoch}`,
      15,
      height - 15
    )
    ctx.fillText(
      `Coordinates: RA, Dec (WCS projected) • ${fov}° FOV`,
      15,
      height - 5
    )
  }, [image, currentEpoch, bands, fov])

  return (
    <div style={{marginBottom: '20px'}}>
      <div style={{textAlign: 'center', marginBottom: '10px'}}>
        <span 
          style={{
            fontSize: '0.875rem',
            color: '#4a5568',
            marginRight: '10px',
          }}
        >
          Epoch {currentEpoch}
        </span>
        <span 
          style={{
            fontSize: '0.875rem',
            color: '#4a5568',
          }}
        >
          FOV: {fov}° | Band: {bands[currentEpoch - 1] || 50}
        </span>
      </div>

      <canvas 
        ref={canvasRef}
        width={800}
        height={800}
        style={{
          width: 800,
          height: 800,
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          background: '#0f172a',
        }}
      />
    </div>
  )
}

// Helper function for wavelength lookup
function getWavelength(band) {
  const MIN_WAVELENGTH = 0.75
  const MAX_WAVELENGTH = 5.0
  return parseFloat((MIN_WAVELENGTH + (MAX_WAVELENGTH - MIN_WAVELENGTH) * (band - 1) / (102 - 1)).toFixed(3)}